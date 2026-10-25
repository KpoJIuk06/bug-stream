-- =====================================================================
-- V2: change history
--   entity_history — field by field for EAV entities (reports, comments)
--   audit_log      — changes of reference tables: projects, services, members, users
--
-- The author of a change comes from a transaction setting the backend sets
-- at the start of every transaction:   SET LOCAL app.user_id = '<uuid>';
-- =====================================================================

CREATE FUNCTION app_current_user() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Value of an EAV row as jsonb (whichever v_* column is filled)
CREATE FUNCTION entity_value_json(v entity_value) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(to_jsonb(v.v_string), to_jsonb(v.v_text), to_jsonb(v.v_int),
                  to_jsonb(v.v_decimal), to_jsonb(v.v_bool), to_jsonb(v.v_ts),
                  to_jsonb(v.v_uuid), v.v_json)
$$;

-- ---------------------------------------------------------------------
-- entity_history
-- ---------------------------------------------------------------------
CREATE TABLE entity_history (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_id    uuid        NOT NULL,          -- no FK: history survives deletion
  attribute_id uuid        REFERENCES attribute (id) ON DELETE SET NULL,  -- NULL = entity-level event
  idx          int,
  action       varchar(20) NOT NULL CHECK (action IN
               ('CREATE', 'SET', 'UPDATE', 'UNSET', 'DELETE', 'RESTORE', 'MOVE', 'PURGE')),
  old_value    jsonb,
  new_value    jsonb,
  changed_by   uuid        REFERENCES app_user (id) ON DELETE SET NULL,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  tx_id        xid8        NOT NULL DEFAULT pg_current_xact_id()   -- groups the changes of one save
);
CREATE INDEX ix_entity_history_entity ON entity_history (entity_id, id DESC);
CREATE INDEX ix_entity_history_user   ON entity_history (changed_by, id DESC);

-- Create / soft delete / restore / move to another project or service
CREATE FUNCTION trg_entity_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_history (entity_id, action, new_value, changed_by)
    VALUES (NEW.id, 'CREATE',
            jsonb_build_object('project_id', NEW.project_id, 'service_id', NEW.service_id,
                               'parent_id', NEW.parent_id),
            coalesce(app_current_user(), NEW.created_by));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO entity_history (entity_id, action, changed_by)
      VALUES (NEW.id, 'DELETE', app_current_user());
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      INSERT INTO entity_history (entity_id, action, changed_by)
      VALUES (NEW.id, 'RESTORE', app_current_user());
    END IF;

    IF (OLD.project_id, OLD.service_id, OLD.parent_id)
       IS DISTINCT FROM (NEW.project_id, NEW.service_id, NEW.parent_id) THEN
      INSERT INTO entity_history (entity_id, action, old_value, new_value, changed_by)
      VALUES (NEW.id, 'MOVE',
              jsonb_build_object('project_id', OLD.project_id, 'service_id', OLD.service_id, 'parent_id', OLD.parent_id),
              jsonb_build_object('project_id', NEW.project_id, 'service_id', NEW.service_id, 'parent_id', NEW.parent_id),
              app_current_user());
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO entity_history (entity_id, action, changed_by)
    VALUES (OLD.id, 'PURGE', app_current_user());
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER entity_history AFTER INSERT OR UPDATE OR DELETE ON entity
  FOR EACH ROW EXECUTE FUNCTION trg_entity_history();

-- Field value changes
CREATE FUNCTION trg_entity_value_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  eid uuid := coalesce(NEW.entity_id, OLD.entity_id);
BEGIN
  -- Cascade delete of the entity itself: values are not logged, there is a PURGE row
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM entity WHERE id = eid) THEN
    RETURN NULL;
  END IF;

  -- Values set in the transaction that created the entity are covered by the CREATE row
  IF EXISTS (SELECT 1 FROM entity_history
             WHERE entity_id = eid AND action = 'CREATE' AND tx_id = pg_current_xact_id()) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_history (entity_id, attribute_id, idx, action, new_value, changed_by)
    VALUES (eid, NEW.attribute_id, NEW.idx, 'SET', entity_value_json(NEW), app_current_user());

  ELSIF TG_OP = 'UPDATE' THEN
    IF entity_value_json(OLD) IS DISTINCT FROM entity_value_json(NEW) THEN
      INSERT INTO entity_history (entity_id, attribute_id, idx, action, old_value, new_value, changed_by)
      VALUES (eid, NEW.attribute_id, NEW.idx, 'UPDATE',
              entity_value_json(OLD), entity_value_json(NEW), app_current_user());
    END IF;

  ELSE -- DELETE
    INSERT INTO entity_history (entity_id, attribute_id, idx, action, old_value, changed_by)
    VALUES (eid, OLD.attribute_id, OLD.idx, 'UNSET', entity_value_json(OLD), app_current_user());
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER entity_value_history AFTER INSERT OR UPDATE OR DELETE ON entity_value
  FOR EACH ROW EXECUTE FUNCTION trg_entity_value_history();

-- ---------------------------------------------------------------------
-- audit_log: regular tables (stores only the changed fields)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  table_name varchar(63) NOT NULL,
  row_id     uuid,                 -- row id (NULL for project_member, see old/new)
  project_id uuid,                 -- for the "project history" filter
  action     varchar(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid REFERENCES app_user (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  tx_id      xid8 NOT NULL DEFAULT pg_current_xact_id()
);
CREATE INDEX ix_audit_row     ON audit_log (table_name, row_id, id DESC);
CREATE INDEX ix_audit_project ON audit_log (project_id, id DESC) WHERE project_id IS NOT NULL;

CREATE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  -- fields that are never logged
  skip constant text[] := ARRAY['password_hash', 'updated_at', 'last_login_at'];
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
    IF o IS NULL THEN RETURN NULL; END IF;     -- only technical fields changed
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

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON project
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON project_member
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON project_service
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON service_url_pattern
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON attribute
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
