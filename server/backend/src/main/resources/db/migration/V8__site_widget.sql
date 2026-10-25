-- =====================================================================
-- V8: site widget (no extension)
--   project_widget_key — the project key a site gives to the widget (like a Sentry DSN).
--     The key is visible in the site's code, so it grants one thing only: sending a report to its project.
--     The database keeps its SHA-256; the key is shown once when created.
--   System user "Site widget" — author of reports when the e-mail of the person on the site
--     matches no user. Nobody can sign in as it.
-- =====================================================================

CREATE TABLE project_widget_key (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id       uuid         NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  name             varchar(100) NOT NULL,
  key_hash         text         NOT NULL UNIQUE,
  key_prefix       varchar(16)  NOT NULL,              -- start of the key for lists: adk_Ab12…
  allowed_origins  text[]       NOT NULL DEFAULT '{}', -- empty = any site
  enabled          boolean      NOT NULL DEFAULT true,
  created_by       uuid         NOT NULL REFERENCES app_user (id),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  last_used_at     timestamptz
);
CREATE INDEX ix_widget_key_project ON project_widget_key (project_id);
CREATE TRIGGER project_widget_key_touch BEFORE UPDATE ON project_widget_key
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- report source WIDGET
UPDATE attribute a SET options = '["EXTENSION","SCREENSHOT","REPLAY","WIDGET","API"]'::jsonb
  FROM entity_type et
 WHERE a.entity_type_id = et.id AND et.code = 'report' AND a.code = 'source';

-- system author of widget reports
INSERT INTO app_user (email, password_hash, full_name, role, is_active)
VALUES ('widget@adtask.local', '!no-login', 'Site widget', 'TESTER', false)
ON CONFLICT DO NOTHING;

-- audit: the key hash and last-use time are never logged
CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  skip constant text[] := ARRAY['password_hash', 'secret_enc', 'key_hash', 'last_used_at', 'updated_at', 'last_login_at'];
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

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON project_widget_key
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
