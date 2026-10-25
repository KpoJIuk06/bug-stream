-- =====================================================================
-- V7: project settings (network filter), instant replay, notifications, tracker integrations
-- =====================================================================

-- ---------- project settings ----------
-- {"networkIgnore": ["collector.github.com", "*/telemetry*"]} — requests the extension does not record
ALTER TABLE project ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------- instant replay: file with the DOM recording (rrweb) ----------
ALTER TABLE stored_file DROP CONSTRAINT stored_file_kind_check;
ALTER TABLE stored_file ADD CONSTRAINT stored_file_kind_check
  CHECK (kind IN ('VIDEO', 'SCREENSHOT', 'THUMBNAIL', 'ATTACHMENT', 'AVATAR', 'REPLAY'));

UPDATE attribute
   SET options = '["EXTENSION","SCREENSHOT","REPLAY","API"]'::jsonb
 WHERE code = 'source' AND project_id IS NULL
   AND entity_type_id = (SELECT id FROM entity_type WHERE code = 'report');

-- ---------- notifications ----------
ALTER TABLE app_user ADD COLUMN email_notifications boolean NOT NULL DEFAULT true;

CREATE TABLE notification (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id        uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,   -- recipient
  type           varchar(30) NOT NULL CHECK (type IN
                 ('MENTION', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENT', 'REPORT_CREATED')),
  report_id      uuid        REFERENCES entity (id) ON DELETE CASCADE,
  comment_id     uuid        REFERENCES entity (id) ON DELETE CASCADE,
  actor_id       uuid        REFERENCES app_user (id) ON DELETE SET NULL,          -- who did it
  title          text        NOT NULL,
  body           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  read_at        timestamptz,
  -- e-mail is sent by a background job: PENDING → SENT / SKIPPED (turned off) / FAILED (after retries)
  email_status   varchar(10) NOT NULL DEFAULT 'PENDING'
                 CHECK (email_status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  email_attempts int         NOT NULL DEFAULT 0,
  emailed_at     timestamptz
);
CREATE INDEX ix_notification_user   ON notification (user_id, id DESC);
CREATE INDEX ix_notification_unread ON notification (user_id) WHERE read_at IS NULL;
CREATE INDEX ix_notification_email  ON notification (id) WHERE email_status = 'PENDING';

-- ---------- tracker integrations ("Send to app") ----------
CREATE TABLE project_integration (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id  uuid        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  type        varchar(20) NOT NULL CHECK (type IN ('JIRA', 'GITLAB', 'REDMINE')),
  name        text        NOT NULL,
  base_url    text        NOT NULL,                -- https://jira.corp.local
  secret_enc  text,                                -- token, AES-GCM encrypted (key: INTEGRATION_SECRET)
  config      jsonb       NOT NULL DEFAULT '{}',   -- JIRA: projectKey, issueType · GITLAB: projectId, labels · REDMINE: projectId, trackerId
  enabled     boolean     NOT NULL DEFAULT true,
  created_by  uuid        NOT NULL REFERENCES app_user (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE TRIGGER project_integration_touch BEFORE UPDATE ON project_integration
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

CREATE TABLE report_external_link (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  report_id      uuid        NOT NULL REFERENCES entity (id) ON DELETE CASCADE,
  integration_id uuid        REFERENCES project_integration (id) ON DELETE SET NULL,
  type           varchar(20) NOT NULL,
  external_key   text        NOT NULL,             -- ESOC-123, #45, 1001
  external_url   text        NOT NULL,
  created_by     uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_external_link_report ON report_external_link (report_id);

-- ---------- audit: integration tokens are never logged ----------
CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  skip constant text[] := ARRAY['password_hash', 'secret_enc', 'updated_at', 'last_login_at'];
  full_row jsonb := coalesce(to_jsonb(NEW), to_jsonb(OLD));
  o jsonb;
  n jsonb;
  pid uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD) - skip; END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW) - skip; END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(k, o -> k), jsonb_object_agg(k, n -> k)
      INTO o, n
      FROM jsonb_object_keys(n) AS k
     WHERE (o -> k) IS DISTINCT FROM (n -> k);
    IF o IS NULL THEN RETURN NULL; END IF;
  END IF;

  pid := CASE TG_TABLE_NAME
           WHEN 'project'             THEN (full_row ->> 'id')::uuid
           WHEN 'service_url_pattern' THEN (SELECT s.project_id FROM project_service s
                                             WHERE s.id = (full_row ->> 'service_id')::uuid)
           ELSE (full_row ->> 'project_id')::uuid
         END;

  INSERT INTO audit_log (table_name, row_id, project_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, (full_row ->> 'id')::uuid, pid, TG_OP, o, n, app_current_user());
  RETURN NULL;
END $$;

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON project_integration
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
