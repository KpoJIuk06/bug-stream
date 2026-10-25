-- =====================================================================
-- V12: public links to reports and Slack notifications.
-- =====================================================================

-- ---------- public links ("Open by link without signing in") ----------
-- The token is looked up by its SHA-256; it is also kept encrypted so the author can copy the link again.
CREATE TABLE report_share (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  report_id      uuid        NOT NULL REFERENCES entity (id) ON DELETE CASCADE,
  token_hash     char(64)    NOT NULL UNIQUE,
  token_enc      text        NOT NULL,
  created_by     uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  revoked_by     uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  views          int         NOT NULL DEFAULT 0,
  last_viewed_at timestamptz
);
CREATE INDEX ix_report_share_report ON report_share (report_id) WHERE revoked_at IS NULL;

-- who opened a public link (IP and browser), for the audit
CREATE TABLE report_share_view (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  share_id   uuid        NOT NULL REFERENCES report_share (id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  ip         text,
  user_agent text
);
CREATE INDEX ix_report_share_view ON report_share_view (share_id, id DESC);

CREATE OR REPLACE FUNCTION trg_audit_share() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- only creating and revoking are logged, not every view
  IF TG_OP = 'UPDATE' AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at
     AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at THEN
    RETURN NULL;
  END IF;
  INSERT INTO audit_log (table_name, row_id, project_id, action, old_data, new_data, changed_by)
  VALUES ('report_share', NEW.id, (SELECT project_id FROM entity WHERE id = NEW.report_id), TG_OP,
          CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('revoked_at', OLD.revoked_at, 'expires_at', OLD.expires_at) END,
          jsonb_build_object('report_id', NEW.report_id, 'expires_at', NEW.expires_at, 'revoked_at', NEW.revoked_at),
          app_current_user());
  RETURN NULL;
END $$;

CREATE TRIGGER audit AFTER INSERT OR UPDATE ON report_share
  FOR EACH ROW EXECUTE FUNCTION trg_audit_share();

-- ---------- audit: the Slack bot token is never logged ----------
CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  skip constant text[] := ARRAY['password_hash', 'secret_enc', 'service_token_enc', 'token_enc', 'bot_token_enc', 'key_hash',
                                'updated_at', 'last_login_at', 'last_used_at', 'last_sync_at'];
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
  VALUES (TG_TABLE_NAME,
          CASE WHEN full_row ->> 'id' ~ '^[0-9a-f-]{36}$' THEN (full_row ->> 'id')::uuid END,
          pid, TG_OP, o, n, app_current_user());
  RETURN NULL;
END $$;

-- ---------- Slack ----------
-- One Slack workspace: a bot token (xoxb-…) set by an admin.
CREATE TABLE slack_connection (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bot_token_enc   text        NOT NULL,
  team_name       text,
  default_channel text,                          -- channel ID for new reports (C0123…); empty = no channel posts
  updated_by      uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER slack_connection_touch BEFORE UPDATE ON slack_connection
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON slack_connection
  FOR EACH ROW EXECUTE FUNCTION trg_audit();

-- a project can post its new reports to its own channel
ALTER TABLE project ADD COLUMN slack_channel text;

-- personal notifications as Slack direct messages (the Slack user is found by e-mail)
ALTER TABLE app_user
  ADD COLUMN slack_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN slack_user_id       text;

ALTER TABLE notification
  ADD COLUMN slack_status varchar(10) NOT NULL DEFAULT 'PENDING'
             CHECK (slack_status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED'));
UPDATE notification SET slack_status = 'SKIPPED';     -- do not send old notifications
CREATE INDEX ix_notification_slack ON notification (id) WHERE slack_status = 'PENDING';
