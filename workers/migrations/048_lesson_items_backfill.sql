-- Phase B: 레거시 도메인 → student_lesson_items 백필
-- Deprecated 대상: study_units, student_study_progress, print_materials,
--                  material_archives, archive_files, archive_distributions
-- 멱등성: deterministic id + INSERT OR IGNORE → 재실행 안전

-- 1) study_units × student_study_progress → lesson_items (이해도 보존)
INSERT OR IGNORE INTO student_lesson_items
  (id, academy_id, student_id, textbook, unit_name, kind, order_idx,
   understanding, status, note, created_by, created_at, updated_at)
SELECT
  'sli-prog-' || ssp.id,
  su.academy_id,
  ssp.student_id,
  su.textbook,
  su.name,
  COALESCE(su.kind, 'unit'),
  su.order_idx,
  ssp.understanding,
  COALESCE(ssp.status, 'todo'),
  ssp.note,
  COALESCE(ssp.updated_by, su.created_by, 'system'),
  ssp.updated_at,
  ssp.updated_at
FROM student_study_progress ssp
JOIN study_units su ON su.id = ssp.unit_id;

-- 2) print_materials → lesson_items (kind=free, 학생별 todo/done)
INSERT OR IGNORE INTO student_lesson_items
  (id, academy_id, student_id, title, kind, status, note,
   created_by, created_at, updated_at)
SELECT
  'sli-pm-' || pm.id,
  s.academy_id,
  pm.student_id,
  pm.title,
  'free',
  COALESCE(pm.status, 'todo'),
  NULLIF(pm.memo, ''),
  pm.created_by,
  pm.created_at,
  COALESCE(pm.completed_at, pm.created_at)
FROM print_materials pm
JOIN students s ON s.id = pm.student_id;

-- 3a) material_archives × scope=student → 1:1 lesson_item
INSERT OR IGNORE INTO student_lesson_items
  (id, academy_id, student_id, title, purpose, topic, description, tags,
   visible_to_parent, parent_can_download, kind, status,
   created_by, created_at, updated_at)
SELECT
  'sli-arch-' || ma.id || '-' || ad.scope_id,
  ma.academy_id,
  ad.scope_id,
  ma.title,
  ma.purpose,
  ma.topic,
  ma.description,
  ma.tags,
  1,
  COALESCE(ad.can_download, 1),
  'free',
  'todo',
  ma.created_by,
  ad.distributed_at,
  ma.updated_at
FROM archive_distributions ad
JOIN material_archives ma ON ma.id = ad.archive_id
WHERE ad.scope = 'student'
  AND ad.scope_id IS NOT NULL
  AND ma.archived_at IS NULL;

-- 3b) material_archives × scope=academy → 학원 모든 학생에게 fan-out
INSERT OR IGNORE INTO student_lesson_items
  (id, academy_id, student_id, title, purpose, topic, description, tags,
   visible_to_parent, parent_can_download, kind, status,
   created_by, created_at, updated_at)
SELECT
  'sli-arch-' || ma.id || '-' || s.id,
  ma.academy_id,
  s.id,
  ma.title,
  ma.purpose,
  ma.topic,
  ma.description,
  ma.tags,
  1,
  COALESCE(ad.can_download, 1),
  'free',
  'todo',
  ma.created_by,
  ad.distributed_at,
  ma.updated_at
FROM archive_distributions ad
JOIN material_archives ma ON ma.id = ad.archive_id
JOIN students s ON s.academy_id = ma.academy_id
WHERE ad.scope = 'academy'
  AND ma.archived_at IS NULL;

-- 4) archive_files → lesson_item_files (R2 키 그대로, 학생별 lesson_item 마다 row 복제)
INSERT OR IGNORE INTO lesson_item_files
  (id, lesson_item_id, r2_key, file_name, file_role, mime_type,
   size_bytes, version, uploaded_by, uploaded_at)
SELECT
  'lif-' || af.id || '-' || sli.student_id,
  sli.id,
  af.r2_key,
  af.file_name,
  af.file_role,
  af.mime_type,
  af.size_bytes,
  af.version,
  af.uploaded_by,
  af.uploaded_at
FROM archive_files af
JOIN material_archives ma ON ma.id = af.archive_id
JOIN student_lesson_items sli
  ON sli.academy_id = ma.academy_id
  AND sli.id LIKE 'sli-arch-' || ma.id || '-%';
