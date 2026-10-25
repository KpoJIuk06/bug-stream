-- =====================================================================
-- V9: report environment (DEV / TEST / STAGE / PROD) as its own field.
-- Before, only project services had an environment. Now it is taken from the service,
-- but people can choose another one in the extension or on the site; the list is filtered by it
-- and it goes to Jira (label env-<environment> and a line in the description).
-- =====================================================================

INSERT INTO attribute (entity_type_id, code, label, data_type, is_required, is_multi, is_filterable, options, sort_order)
SELECT et.id, 'environment', 'Environment', 'STRING', false, false, true, '["DEV","TEST","STAGE","PROD"]'::jsonb, 45
  FROM entity_type et
 WHERE et.code = 'report';

-- Existing reports: their service's environment. Not written to history — a data migration, not a change.
ALTER TABLE entity_value DISABLE TRIGGER entity_value_history;

INSERT INTO entity_value (entity_id, attribute_id, v_string)
SELECT e.id, a.id, s.environment
  FROM entity e
  JOIN entity_type et     ON et.id = e.entity_type_id AND et.code = 'report'
  JOIN project_service s  ON s.id = e.service_id
  JOIN attribute a        ON a.entity_type_id = et.id AND a.project_id IS NULL AND a.code = 'environment';

ALTER TABLE entity_value ENABLE TRIGGER entity_value_history;

-- List cards with the environment
DROP VIEW v_report_card;
DROP VIEW v_report_card_all;

CREATE VIEW v_report_card_all AS
SELECT e.id,
       e.project_id,
       p.key                AS project_key,
       p.name               AS project_name,
       e.service_id,
       s.name               AS service_name,
       e.created_by,
       u.full_name          AS author_name,
       e.created_at,
       e.updated_at,
       e.deleted_at,
       f.title,
       f.status,
       f.severity,
       f.environment,
       f.assignee_id,
       f.page_url,
       f.browser,
       f.os,
       f.recorded_at,
       coalesce(rs.duration_ms, 0)    AS duration_ms,
       coalesce(rs.console_errors, 0) AS console_errors,
       coalesce(rs.network_errors, 0) AS network_errors,
       rs.thumbnail_file_id,
       rs.video_file_id,
       (SELECT count(*)
          FROM entity c
          JOIN entity_type ct ON ct.id = c.entity_type_id AND ct.code = 'comment'
         WHERE c.parent_id = e.id AND c.deleted_at IS NULL) AS comments_count
FROM entity e
JOIN entity_type et     ON et.id = e.entity_type_id AND et.code = 'report'
JOIN app_user u         ON u.id = e.created_by
LEFT JOIN project p          ON p.id = e.project_id
LEFT JOIN project_service s  ON s.id = e.service_id
LEFT JOIN report_summary rs  ON rs.report_id = e.id
LEFT JOIN LATERAL (
  SELECT max(v.v_string)  FILTER (WHERE a.code = 'title')       AS title,
         max(v.v_string)  FILTER (WHERE a.code = 'status')      AS status,
         max(v.v_string)  FILTER (WHERE a.code = 'severity')    AS severity,
         max(v.v_string)  FILTER (WHERE a.code = 'environment') AS environment,
         (array_agg(v.v_uuid) FILTER (WHERE a.code = 'assignee_id'))[1] AS assignee_id,
         max(v.v_string)  FILTER (WHERE a.code = 'page_url')    AS page_url,
         max(v.v_string)  FILTER (WHERE a.code = 'browser')     AS browser,
         max(v.v_string)  FILTER (WHERE a.code = 'os')          AS os,
         max(v.v_ts)      FILTER (WHERE a.code = 'recorded_at') AS recorded_at
    FROM entity_value v
    JOIN attribute a ON a.id = v.attribute_id
   WHERE v.entity_id = e.id
     AND a.project_id IS NULL
     AND a.code IN ('title','status','severity','environment','assignee_id','page_url','browser','os','recorded_at')
) f ON true;

CREATE VIEW v_report_card AS
SELECT * FROM v_report_card_all WHERE deleted_at IS NULL;
