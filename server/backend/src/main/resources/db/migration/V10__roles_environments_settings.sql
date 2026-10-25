-- =====================================================================
-- V10: roles & permissions, environments managed in the admin panel,
--      application settings, LDAP / Active Directory accounts, user language.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permissions (fixed list, defined by the code) and roles (editable)
-- ---------------------------------------------------------------------
CREATE TABLE permission (
  code       varchar(60) PRIMARY KEY,
  category   varchar(30) NOT NULL,          -- admin | project | report
  sort_order int         NOT NULL DEFAULT 0
);

INSERT INTO permission (code, category, sort_order) VALUES
  ('admin.access',        'admin',   10),   -- see the admin panel
  ('user.manage',         'admin',   20),   -- create / disable users, reset passwords, assign roles
  ('role.manage',         'admin',   30),   -- create roles and change their permissions
  ('environment.manage',  'admin',   40),   -- environments list (DEV, TEST, ...)
  ('integration.manage',  'admin',   50),   -- Jira connection, project sync
  ('settings.manage',     'admin',   60),   -- sharing, retention and other global settings
  ('audit.view',          'admin',   70),   -- audit log
  ('project.create',      'project', 10),
  ('project.manage_all',  'project', 20),   -- manage any project (otherwise only own / maintained ones)
  ('project.view_all',    'project', 30),   -- see private projects without being a member
  ('report.create',       'report',  10),
  ('report.edit',         'report',  20),   -- change status, assignee, fields of any report (own reports are always editable)
  ('report.delete_all',   'report',  30),   -- delete any report (authors can delete their own)
  ('report.share',        'report',  40),   -- create public links
  ('report.send_tracker', 'report',  50),   -- create Jira issues from reports
  ('comment.delete_all',  'report',  60);   -- delete other people's comments

CREATE TABLE app_role (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  code        varchar(30) NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  name        text        NOT NULL,
  description text,
  is_system   boolean     NOT NULL DEFAULT false,   -- system roles cannot be deleted; ADMIN keeps all permissions
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER app_role_touch BEFORE UPDATE ON app_role
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

CREATE TABLE role_permission (
  role_id         uuid        NOT NULL REFERENCES app_role (id) ON DELETE CASCADE,
  permission_code varchar(60) NOT NULL REFERENCES permission (code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

INSERT INTO app_role (code, name, description, is_system) VALUES
  ('ADMIN',     'Administrator', 'Full access, including the admin panel', true),
  ('DEVELOPER', 'Developer',     'Records and handles bug reports, sends them to Jira', true),
  ('TESTER',    'QA engineer',   'Records and handles bug reports, sends them to Jira', true),
  ('ANALYST',   'Analyst',       'Records and handles bug reports', true),
  ('VIEWER',    'Viewer',        'Reads reports and writes comments', true);

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM app_role r CROSS JOIN permission p WHERE r.code = 'ADMIN';

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code
  FROM app_role r
  JOIN (VALUES
    ('DEVELOPER', 'project.create'), ('DEVELOPER', 'report.create'), ('DEVELOPER', 'report.edit'),
    ('DEVELOPER', 'report.share'),   ('DEVELOPER', 'report.send_tracker'),
    ('TESTER',    'project.create'), ('TESTER',    'report.create'), ('TESTER',    'report.edit'),
    ('TESTER',    'report.share'),   ('TESTER',    'report.send_tracker'),
    ('ANALYST',   'report.create'),  ('ANALYST',   'report.edit'),   ('ANALYST',   'report.share')
  ) AS p(role_code, code) ON p.role_code = r.code;

-- users reference roles by code (the code never changes, the name can)
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ALTER COLUMN role TYPE varchar(30);
ALTER TABLE app_user ALTER COLUMN role SET DEFAULT 'DEVELOPER';
ALTER TABLE app_user
  ADD CONSTRAINT fk_app_user_role FOREIGN KEY (role) REFERENCES app_role (code) ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 2. LDAP / Active Directory accounts and interface language
-- ---------------------------------------------------------------------
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;     -- LDAP users have no local password
ALTER TABLE app_user
  ADD COLUMN auth_source varchar(10) NOT NULL DEFAULT 'LOCAL' CHECK (auth_source IN ('LOCAL', 'LDAP')),
  ADD COLUMN external_id text,                                     -- LDAP distinguished name
  ADD COLUMN username    varchar(200),                             -- LDAP login (sAMAccountName / uid)
  ADD COLUMN locale      varchar(5) NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ru', 'az'));
CREATE UNIQUE INDEX uq_app_user_username ON app_user (lower(username)) WHERE username IS NOT NULL;

UPDATE app_user SET full_name = 'Site widget' WHERE email = 'widget@adtask.local';

-- ---------------------------------------------------------------------
-- 3. Environments: managed in the admin panel instead of a fixed list
-- ---------------------------------------------------------------------
CREATE TABLE environment (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  code        varchar(20) NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{0,19}$'),
  name        text        NOT NULL,
  color       varchar(7)  NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  int         NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,           -- inactive: kept on old reports, hidden from pickers
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER environment_touch BEFORE UPDATE ON environment
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

INSERT INTO environment (code, name, color, sort_order) VALUES
  ('DEV',   'Development', '#64748b', 10),
  ('TEST',  'Test',        '#2563eb', 20),
  ('STAGE', 'Staging',     '#d97706', 30),
  ('PROD',  'Production',  '#dc2626', 40);

ALTER TABLE project_service DROP CONSTRAINT project_service_environment_check;
ALTER TABLE project_service
  ADD CONSTRAINT fk_project_service_environment FOREIGN KEY (environment)
  REFERENCES environment (code) ON UPDATE CASCADE;

-- the report field is checked by the backend against the environment table
UPDATE attribute SET options = NULL
 WHERE code = 'environment' AND project_id IS NULL
   AND entity_type_id = (SELECT id FROM entity_type WHERE code = 'report');

-- ---------------------------------------------------------------------
-- 4. Application settings (key → JSON value), edited in the admin panel
-- ---------------------------------------------------------------------
CREATE TABLE app_setting (
  key        varchar(100) PRIMARY KEY,
  value      jsonb        NOT NULL,
  updated_at timestamptz  NOT NULL DEFAULT now(),
  updated_by uuid         REFERENCES app_user (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 5. Audit of the new tables
-- ---------------------------------------------------------------------
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app_role
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON role_permission
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON environment
  FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app_setting
  FOR EACH ROW EXECUTE FUNCTION trg_audit();

CREATE INDEX ix_audit_changed_at ON audit_log (id DESC);
