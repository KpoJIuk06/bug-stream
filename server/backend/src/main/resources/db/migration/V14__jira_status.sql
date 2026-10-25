-- =====================================================================
-- V14: Jira issue status on reports.
--   A background job (every 5 minutes by default) asks Jira for the issues with the label "bugstream"
--   that changed since the last run and stores their status on the report's link.
--   status_category: new | indeterminate | done (Jira's status categories: To Do / In Progress / Done).
-- =====================================================================

ALTER TABLE report_external_link
  ADD COLUMN status_name      text,
  ADD COLUMN status_category  varchar(20),
  ADD COLUMN status_synced_at timestamptz,
  ADD COLUMN missing_at       timestamptz;              -- Jira no longer returns the issue (deleted / no access)

CREATE INDEX ix_external_link_key ON report_external_link (type, upper(external_key));
CREATE INDEX ix_external_link_unsynced ON report_external_link (id) WHERE status_synced_at IS NULL;

ALTER TABLE jira_connection
  ADD COLUMN status_sync_at    timestamptz,             -- last successful status sync
  ADD COLUMN status_sync_error text;
