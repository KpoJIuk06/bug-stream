-- =====================================================================
-- V3: entity types and system attributes
-- The backend addresses attributes by (entity_type.code, attribute.code), not by id.
-- =====================================================================

INSERT INTO entity_type (code) VALUES ('report'), ('comment');

-- ---------- report ----------
INSERT INTO attribute (entity_type_id, code, label, data_type, is_required, is_multi, is_filterable, options, sort_order)
SELECT et.id, a.code, a.label, a.data_type, a.is_required, a.is_multi, a.is_filterable, a.options::jsonb, a.sort_order
FROM entity_type et
CROSS JOIN (VALUES
  -- main
  ('title',           'Title',            'STRING',    true,  false, false, NULL, 10),
  ('description',     'Description',      'TEXT',      false, false, false, NULL, 20),
  ('status',          'Status',           'STRING',    true,  false, true,  '["NEW","IN_PROGRESS","RESOLVED","CLOSED","REJECTED"]', 30),
  ('severity',        'Severity',         'STRING',    false, false, true,  '["LOW","MEDIUM","HIGH","CRITICAL"]', 40),
  ('assignee_id',     'Assignee',         'UUID',      false, false, true,  NULL, 50),
  ('tags',            'Tags',             'STRING',    false, true,  true,  NULL, 60),
  ('source',          'Source',           'STRING',    true,  false, true,  '["EXTENSION","SCREENSHOT","API"]', 70),
  -- Info tab
  ('page_url',        'URL',              'STRING',    true,  false, true,  NULL, 100),
  ('page_title',      'Page title',       'STRING',    false, false, false, NULL, 110),
  ('recorded_at',     'Timestamp',        'TIMESTAMP', true,  false, true,  NULL, 120),
  ('timezone',        'Timezone',         'STRING',    false, false, false, NULL, 130),
  ('locale',          'Locale',           'STRING',    false, false, false, NULL, 140),
  ('location',        'Location',         'STRING',    false, false, false, NULL, 150),
  ('os',              'OS',               'STRING',    false, false, true,  NULL, 160),
  ('os_version',      'OS version',       'STRING',    false, false, false, NULL, 170),
  ('browser',         'Browser',          'STRING',    false, false, true,  NULL, 180),
  ('browser_version', 'Browser version',  'STRING',    false, false, false, NULL, 190),
  ('window_size',     'Window size',      'STRING',    false, false, false, NULL, 200),
  ('screen_size',     'Screen size',      'STRING',    false, false, false, NULL, 210),
  ('device_pixel_ratio','Pixel ratio',    'DECIMAL',   false, false, false, NULL, 220),
  ('network_type',    'Network type',     'STRING',    false, false, false, NULL, 230),
  ('network_downlink','Downlink, Mbps',   'DECIMAL',   false, false, false, NULL, 240),
  ('network_rtt',     'Latency, ms',      'INT',       false, false, false, NULL, 250),
  ('extension_version','Extension version','STRING',   false, false, false, NULL, 260),
  ('custom_logs',     'Custom logs',      'JSON',      false, false, false, NULL, 270)
) AS a(code, label, data_type, is_required, is_multi, is_filterable, options, sort_order)
WHERE et.code = 'report';

-- ---------- comment ----------
INSERT INTO attribute (entity_type_id, code, label, data_type, is_required, is_multi, is_filterable, sort_order)
SELECT et.id, a.code, a.label, a.data_type, a.is_required, a.is_multi, false, a.sort_order
FROM entity_type et
CROSS JOIN (VALUES
  ('body',      'Text',      'TEXT',      true,  false, 10),
  ('mentions',  'Mentions',  'UUID',      false, true,  20),   -- app_user.id
  ('edited_at', 'Edited at', 'TIMESTAMP', false, false, 30),
  ('video_t_ms','Video time','INT',       false, false, 40)    -- comment on a video moment
) AS a(code, label, data_type, is_required, is_multi, sort_order)
WHERE et.code = 'comment';
