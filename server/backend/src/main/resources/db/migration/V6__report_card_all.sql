-- =====================================================================
-- V6: v_report_card_all — report cards including deleted ones (for the "show deleted" filter).
-- v_report_card stays as before (not deleted only) and is built on top of it.
-- =====================================================================

DROP VIEW v_report_card;

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
         (array_agg(v.v_uuid) FILTER (WHERE a.code = 'assignee_id'))[1] AS assignee_id,
         max(v.v_string)  FILTER (WHERE a.code = 'page_url')    AS page_url,
         max(v.v_string)  FILTER (WHERE a.code = 'browser')     AS browser,
         max(v.v_string)  FILTER (WHERE a.code = 'os')          AS os,
         max(v.v_ts)      FILTER (WHERE a.code = 'recorded_at') AS recorded_at
    FROM entity_value v
    JOIN attribute a ON a.id = v.attribute_id
   WHERE v.entity_id = e.id
     AND a.project_id IS NULL
     AND a.code IN ('title','status','severity','assignee_id','page_url','browser','os','recorded_at')
) f ON true;

CREATE VIEW v_report_card AS
SELECT * FROM v_report_card_all WHERE deleted_at IS NULL;
