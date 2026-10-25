-- =====================================================================
-- V5: replies to comments.
-- All comments of a report have parent_id = the report (easier to count and select),
-- and "reply to" is stored in the reply_to attribute.
-- =====================================================================

INSERT INTO attribute (entity_type_id, code, label, data_type, is_required, is_multi, is_filterable, sort_order)
SELECT et.id, 'reply_to', 'Reply to', 'UUID', false, false, false, 50
FROM entity_type et
WHERE et.code = 'comment';
