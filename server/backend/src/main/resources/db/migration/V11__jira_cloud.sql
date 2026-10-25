-- =====================================================================
-- V11: Jira Cloud.
--   jira_connection — one Jira site for the whole installation, set up by an admin
--                     (address + a service account used only to read the project list).
--   jira_project    — Jira projects loaded by "Sync"; the admin links the ones needed.
--   project.jira_*  — Bug Stream project ↔ Jira project.
--   user_jira_token — each person's own Atlassian API token: issues are created on their
--                     behalf, so Jira shows who reported the bug.
-- Tokens are encrypted with AES-GCM (key: INTEGRATION_SECRET) and never returned to clients.
-- =====================================================================

CREATE TABLE jira_connection (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),     -- a single row
  base_url           text        NOT NULL,                               -- https://company.atlassian.net
  service_email      text        NOT NULL,
  service_token_enc  text        NOT NULL,
  default_issue_type text        NOT NULL DEFAULT 'Bug',
  environment_field  text,                                               -- optional: customfield_10050
  last_sync_at       timestamptz,
  last_sync_error    text,
  updated_by         uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER jira_connection_touch BEFORE UPDATE ON jira_connection
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

CREATE TABLE jira_project (
  id           text        PRIMARY KEY,                 -- Jira project id: '10001'
  key          text        NOT NULL,                    -- 'ESOC'
  name         text        NOT NULL,
  project_type text,
  avatar_url   text,
  issue_types  jsonb       NOT NULL DEFAULT '[]',       -- [{"id":"10004","name":"Bug","subtask":false}]
  synced_at    timestamptz NOT NULL DEFAULT now(),
  removed_at   timestamptz                              -- missing from Jira on the last sync
);
CREATE UNIQUE INDEX uq_jira_project_key ON jira_project (key);

ALTER TABLE project
  ADD COLUMN jira_project_id text REFERENCES jira_project (id) ON DELETE SET NULL,
  ADD COLUMN jira_issue_type text;                        -- empty = the connection's default
CREATE UNIQUE INDEX uq_project_jira ON project (jira_project_id) WHERE jira_project_id IS NOT NULL;

CREATE TABLE user_jira_token (
  user_id           uuid        PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
  jira_email        text        NOT NULL,
  token_enc         text        NOT NULL,
  jira_account_id   text,
  jira_display_name text,
  verified_at       timestamptz,
  invalid_at        timestamptz,                         -- Jira rejected the token: the user must enter a new one
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER user_jira_token_touch BEFORE UPDATE ON user_jira_token
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- audit: secrets are never written to the log
CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  skip constant text[] := ARRAY['password_hash', 'secret_enc', 'service_token_enc', 'token_enc', 'key_hash',
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

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON jira_connection
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON user_jira_token
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
