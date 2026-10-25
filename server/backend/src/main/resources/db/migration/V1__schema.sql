-- =====================================================================
-- V1: base schema of Bug Stream
-- PostgreSQL 18+ (uses the built-in uuidv7())
-- =====================================================================

-- Shared trigger: updates updated_at on every UPDATE
CREATE FUNCTION trg_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- =====================================================================
-- 1. Users and authentication
-- =====================================================================

CREATE TABLE app_user (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  email          varchar(320) NOT NULL,
  password_hash  text         NOT NULL,                 -- argon2id / bcrypt
  full_name      text         NOT NULL,
  role           varchar(20)  NOT NULL DEFAULT 'TESTER'
                 CHECK (role IN ('ADMIN', 'TESTER', 'ANALYST')),
  avatar_file_id uuid,                                   -- FK is added after stored_file
  is_active      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);
CREATE UNIQUE INDEX uq_app_user_email ON app_user (lower(email));
CREATE TRIGGER app_user_touch BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

CREATE TABLE refresh_token (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,              -- only the hash is stored
  client      varchar(20) NOT NULL CHECK (client IN ('WEB', 'EXTENSION')),
  user_agent  text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_token_user ON refresh_token (user_id) WHERE revoked_at IS NULL;

-- =====================================================================
-- 2. Projects, members, services
-- =====================================================================

CREATE TABLE project (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  key         varchar(20) NOT NULL UNIQUE
              CHECK (key ~ '^[A-Z][A-Z0-9_]{1,19}$'),   -- 'ESOC', 'HR_PORTAL'
  name        text        NOT NULL,
  description text,
  -- PUBLIC projects are visible to everyone; PRIVATE ones to members (checked by the backend).
  visibility  varchar(20) NOT NULL DEFAULT 'PUBLIC'
              CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  created_by  uuid        NOT NULL REFERENCES app_user (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE TRIGGER project_touch BEFORE UPDATE ON project
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- Project members: "my projects", owners and maintainers,
-- and access to PRIVATE projects.
CREATE TABLE project_member (
  project_id uuid        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  role       varchar(20) NOT NULL DEFAULT 'MEMBER'
             CHECK (role IN ('OWNER', 'MAINTAINER', 'MEMBER', 'VIEWER')),
  added_by   uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX ix_project_member_user ON project_member (user_id);

-- Project service: a separate app/module/stand (portal, admin, API ...)
CREATE TABLE project_service (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id  uuid        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  code        varchar(50) NOT NULL,
  name        text        NOT NULL,
  description text,
  environment varchar(20) NOT NULL DEFAULT 'TEST'
              CHECK (environment IN ('DEV', 'TEST', 'STAGE', 'PROD')),
  created_by  uuid        NOT NULL REFERENCES app_user (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (project_id, code)
);
CREATE TRIGGER project_service_touch BEFORE UPDATE ON project_service
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- With these patterns the extension resolves project and service from the page URL.
--   HOST   : '10.0.0.15:8080'
--   PREFIX : 'http://10.0.0.15:8080/admin'
--   REGEX  : '^https?://test-[a-z]+\.corp\.local/'
CREATE TABLE service_url_pattern (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  service_id uuid        NOT NULL REFERENCES project_service (id) ON DELETE CASCADE,
  match_type varchar(10) NOT NULL DEFAULT 'PREFIX'
             CHECK (match_type IN ('HOST', 'PREFIX', 'REGEX')),
  pattern    text        NOT NULL,
  priority   int         NOT NULL DEFAULT 0,          -- higher = checked first
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, match_type, pattern)
);

-- =====================================================================
-- 3. EAV core: reports, comments and any future entities
-- =====================================================================

CREATE TABLE entity_type (
  id   uuid PRIMARY KEY DEFAULT uuidv7(),
  code varchar(50) NOT NULL UNIQUE                     -- 'report', 'comment'
);

CREATE TABLE attribute (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_type_id uuid         NOT NULL REFERENCES entity_type (id),
  project_id     uuid         REFERENCES project (id) ON DELETE CASCADE,  -- NULL = common field; otherwise a custom field of the project
  code           varchar(100) NOT NULL,
  label          text         NOT NULL,
  data_type      varchar(20)  NOT NULL CHECK (data_type IN
                 ('STRING', 'TEXT', 'INT', 'DECIMAL', 'BOOL', 'TIMESTAMP', 'UUID', 'JSON')),
  is_required    boolean      NOT NULL DEFAULT false,
  is_multi       boolean      NOT NULL DEFAULT false,  -- several values (tags, mentions)
  is_filterable  boolean      NOT NULL DEFAULT false,  -- shown in list filters
  is_system      boolean      NOT NULL DEFAULT true,   -- false = added in the UI
  options        jsonb,                                -- allowed values: ["NEW","IN_PROGRESS",...]
  sort_order     int          NOT NULL DEFAULT 0,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_attribute_code UNIQUE NULLS NOT DISTINCT (entity_type_id, project_id, code)
);

CREATE TABLE entity (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_type_id uuid        NOT NULL REFERENCES entity_type (id),
  parent_id      uuid        REFERENCES entity (id) ON DELETE CASCADE,       -- comment → report, reply → comment
  project_id     uuid        REFERENCES project (id) ON DELETE SET NULL,     -- NULL = "no project"
  service_id     uuid        REFERENCES project_service (id) ON DELETE SET NULL,
  created_by     uuid        NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz                                                 -- soft delete
);
CREATE TRIGGER entity_touch BEFORE UPDATE ON entity
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

CREATE INDEX ix_entity_list    ON entity (entity_type_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_entity_project ON entity (project_id, entity_type_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_entity_service ON entity (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX ix_entity_parent  ON entity (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX ix_entity_author  ON entity (created_by);

CREATE TABLE entity_value (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_id    uuid NOT NULL REFERENCES entity (id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES attribute (id),
  idx          int  NOT NULL DEFAULT 0,               -- value position for is_multi
  v_string     varchar(2048),
  v_text       text,
  v_int        bigint,
  v_decimal    numeric(20, 6),
  v_bool       boolean,
  v_ts         timestamptz,
  v_uuid       uuid,
  v_json       jsonb,
  CONSTRAINT ck_entity_value_one
    CHECK (num_nonnulls(v_string, v_text, v_int, v_decimal, v_bool, v_ts, v_uuid, v_json) = 1),
  CONSTRAINT uq_entity_value UNIQUE (entity_id, attribute_id, idx)
);
CREATE INDEX ix_ev_attr_string ON entity_value (attribute_id, v_string) WHERE v_string IS NOT NULL;
CREATE INDEX ix_ev_attr_uuid   ON entity_value (attribute_id, v_uuid)   WHERE v_uuid   IS NOT NULL;
CREATE INDEX ix_ev_attr_int    ON entity_value (attribute_id, v_int)    WHERE v_int    IS NOT NULL;
CREATE INDEX ix_ev_attr_ts     ON entity_value (attribute_id, v_ts)     WHERE v_ts     IS NOT NULL;
CREATE INDEX ix_ev_text_fts    ON entity_value USING gin (to_tsvector('simple', v_text)) WHERE v_text IS NOT NULL;

-- EAV guard: the value type matches the attribute's data_type, the attribute belongs
-- to the entity type and (when custom) to the entity's project, idx > 0 only for is_multi.
CREATE FUNCTION trg_entity_value_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  a attribute%ROWTYPE;
  e entity%ROWTYPE;
  type_ok boolean;
BEGIN
  SELECT * INTO a FROM attribute WHERE id = NEW.attribute_id;
  SELECT * INTO e FROM entity    WHERE id = NEW.entity_id;

  IF a.entity_type_id <> e.entity_type_id THEN
    RAISE EXCEPTION 'Attribute % does not belong to entity type of %', a.code, NEW.entity_id;
  END IF;
  IF a.project_id IS NOT NULL AND a.project_id IS DISTINCT FROM e.project_id THEN
    RAISE EXCEPTION 'Attribute % is a custom field of another project', a.code;
  END IF;
  IF NOT a.is_multi AND NEW.idx <> 0 THEN
    RAISE EXCEPTION 'Attribute % is not multi-valued', a.code;
  END IF;
  type_ok := CASE a.data_type
           WHEN 'STRING'    THEN NEW.v_string  IS NOT NULL
           WHEN 'TEXT'      THEN NEW.v_text    IS NOT NULL
           WHEN 'INT'       THEN NEW.v_int     IS NOT NULL
           WHEN 'DECIMAL'   THEN NEW.v_decimal IS NOT NULL
           WHEN 'BOOL'      THEN NEW.v_bool    IS NOT NULL
           WHEN 'TIMESTAMP' THEN NEW.v_ts      IS NOT NULL
           WHEN 'UUID'      THEN NEW.v_uuid    IS NOT NULL
           WHEN 'JSON'      THEN NEW.v_json    IS NOT NULL
             END;
  IF NOT type_ok THEN
    RAISE EXCEPTION 'Attribute % expects % value', a.code, a.data_type;
  END IF;
  IF a.options IS NOT NULL AND NEW.v_string IS NOT NULL
     AND NOT a.options ? NEW.v_string THEN
    RAISE EXCEPTION 'Value "%" is not allowed for %', NEW.v_string, a.code;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER entity_value_validate BEFORE INSERT OR UPDATE ON entity_value
  FOR EACH ROW EXECUTE FUNCTION trg_entity_value_validate();

-- =====================================================================
-- 4. Files (the files are on a docker volume, here only metadata)
-- =====================================================================

CREATE TABLE stored_file (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_id   uuid         REFERENCES entity (id) ON DELETE CASCADE,  -- report or comment
  kind        varchar(20)  NOT NULL
              CHECK (kind IN ('VIDEO', 'SCREENSHOT', 'THUMBNAIL', 'ATTACHMENT', 'AVATAR')),
  storage_key text         NOT NULL UNIQUE,   -- '2026/10/<report_id>/video.webm' relative to the storage root
  file_name   text         NOT NULL,
  mime_type   varchar(100) NOT NULL,
  size_bytes  bigint       NOT NULL CHECK (size_bytes >= 0),
  sha256      char(64),
  duration_ms int,
  width       int,
  height      int,
  uploaded_by uuid         REFERENCES app_user (id) ON DELETE SET NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_file_entity ON stored_file (entity_id, kind);

ALTER TABLE app_user
  ADD CONSTRAINT fk_app_user_avatar FOREIGN KEY (avatar_file_id)
  REFERENCES stored_file (id) ON DELETE SET NULL;

-- =====================================================================
-- 5. Recording events: Console / Network / Actions / Navigation
-- =====================================================================

CREATE TABLE report_event (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  report_id   uuid        NOT NULL REFERENCES entity (id) ON DELETE CASCADE,
  kind        varchar(20) NOT NULL
              CHECK (kind IN ('CONSOLE', 'NETWORK', 'ACTION', 'NAVIGATION', 'CUSTOM')),
  t_ms        int         NOT NULL CHECK (t_ms >= 0),  -- ms since the recording started → sync with the video
  occurred_at timestamptz NOT NULL,
  level       varchar(20),     -- console: log/info/warn/error/debug · action: click/input/scroll/key
  summary     text        NOT NULL,   -- list line: 'POST /api/save 500', 'Click «Next»'
  http_method varchar(10),
  http_status smallint,
  duration_ms int,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_event_timeline   ON report_event (report_id, t_ms);
CREATE INDEX ix_event_kind       ON report_event (report_id, kind, t_ms);
CREATE INDEX ix_event_net_errors ON report_event (http_status) WHERE kind = 'NETWORK' AND http_status >= 400;
CREATE INDEX ix_event_payload    ON report_event USING gin (payload jsonb_path_ops);

-- Report counters for the list and filters ("with errors", duration, preview).
-- Filled by the backend on upload (events never change afterwards).
CREATE TABLE report_summary (
  report_id         uuid PRIMARY KEY REFERENCES entity (id) ON DELETE CASCADE,
  duration_ms       int  NOT NULL DEFAULT 0,
  events_total      int  NOT NULL DEFAULT 0,
  console_errors    int  NOT NULL DEFAULT 0,
  console_warnings  int  NOT NULL DEFAULT 0,
  network_total     int  NOT NULL DEFAULT 0,
  network_errors    int  NOT NULL DEFAULT 0,
  actions_total     int  NOT NULL DEFAULT 0,
  video_file_id     uuid REFERENCES stored_file (id) ON DELETE SET NULL,
  thumbnail_file_id uuid REFERENCES stored_file (id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_report_summary_errors ON report_summary (report_id)
  WHERE console_errors > 0 OR network_errors > 0;
