-- =====================================================================
-- V13: pluggable sign-in methods.
--   - SMTP and LDAP connections are edited in the admin panel (the .env values are only the defaults);
--   - one-time e-mail codes and links (sign-in code, password reset, invitation).
-- Which methods are on is stored in app_setting (auth.* keys).
-- =====================================================================

-- ---------- SMTP server (one row). No row = SMTP_* from .env ----------
CREATE TABLE mail_connection (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host          text        NOT NULL,
  port          int         NOT NULL CHECK (port BETWEEN 1 AND 65535),
  security      varchar(10) NOT NULL DEFAULT 'STARTTLS' CHECK (security IN ('NONE', 'STARTTLS', 'SSL')),
  username      text,
  password_enc  text,                              -- AES-GCM (SecretCipher), never returned by the API
  from_address  text        NOT NULL,
  from_name     text,
  updated_by    uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER mail_connection_touch BEFORE UPDATE ON mail_connection
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- ---------- LDAP / Active Directory (one row). No row = LDAP_* from .env ----------
CREATE TABLE ldap_connection (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  url                text        NOT NULL,
  base_dn            text        NOT NULL,
  bind_dn            text,
  bind_password_enc  text,                         -- AES-GCM, never returned by the API
  user_filter        text,
  email_attribute    text,
  name_attribute     text,
  username_attribute text,
  group_roles        text,                         -- "group DN=ROLE;group DN=ROLE"
  default_role       varchar(30) REFERENCES app_role (code) ON UPDATE CASCADE,
  updated_by         uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER ldap_connection_touch BEFORE UPDATE ON ldap_connection
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- ---------- one-time codes and links ----------
-- LOGIN  — 6-digit code sent by e-mail ("Sign in with an e-mail code"), 10 minutes, 5 attempts;
-- RESET  — password reset link, 1 hour;
-- INVITE — "set your password" link for a new local user, 7 days.
-- Only an HMAC of the code / token is stored.
CREATE TABLE auth_code (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  purpose     varchar(10) NOT NULL CHECK (purpose IN ('LOGIN', 'RESET', 'INVITE')),
  email       text        NOT NULL,
  user_id     uuid        REFERENCES app_user (id) ON DELETE CASCADE,
  code_hash   text        NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_code_email ON auth_code (lower(email), purpose, created_at DESC);
CREATE INDEX ix_auth_code_hash ON auth_code (code_hash);
CREATE INDEX ix_auth_code_ip ON auth_code (ip, created_at DESC);

-- ---------- audit: connection secrets are never logged ----------
CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  skip constant text[] := ARRAY['password_hash', 'secret_enc', 'service_token_enc', 'token_enc', 'bot_token_enc', 'key_hash',
                                'password_enc', 'bind_password_enc',
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

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON mail_connection
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON ldap_connection
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
