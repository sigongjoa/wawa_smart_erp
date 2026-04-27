-- =============================================
-- 의학용어 CH01 단어 시드 (84개)
-- 출처: 보건의료인을 위한 기초의학용어 CH01 문제집
-- 분류: 약어 14 + 접두사 30 + 접미사 14 + 결합형 26
-- Tier 분류:
--   1 (33) — 핵심: 약어 14 + 신체 결합형 11 + 빈출 접두사/접미사 8
--   2 (26) — 빈출: 일반 접두사 14 + 일반 결합형 8 + 접미사 4
--   3 (25) — 확장: 드문 접두사 12 + 색상 4 + 기타 결합형 3 + 외과 접미사 6
-- =============================================

-- ── Tier 1: 핵심 (33개) ────────────────────────────────────

-- 약어 (14)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-001', 'medical-health-vocational-2026', 'BP',     'blood pressure (혈압)',                          'abbreviation', 1,  1, NULL),
  ('cw-med-002', 'medical-health-vocational-2026', 'CC',     'chief complaint (주호소)',                       'abbreviation', 2,  1, '환자가 내원 시 가장 호소하는 증상'),
  ('cw-med-003', 'medical-health-vocational-2026', 'Dx',     'diagnosis (진단)',                               'abbreviation', 3,  1, NULL),
  ('cw-med-004', 'medical-health-vocational-2026', 'HEENT',  'head, eyes, ears, nose, throat (머리·눈·귀·코·목)', 'abbreviation', 4,  1, NULL),
  ('cw-med-005', 'medical-health-vocational-2026', 'H&P',    'history and physical (병력 및 신체검사)',         'abbreviation', 5,  1, NULL),
  ('cw-med-006', 'medical-health-vocational-2026', 'c/o',    'complains of (~에 관해 호소함)',                 'abbreviation', 6,  1, NULL),
  ('cw-med-007', 'medical-health-vocational-2026', 'CP',     'chest pain (흉통)',                              'abbreviation', 7,  1, NULL),
  ('cw-med-008', 'medical-health-vocational-2026', 'FH',     'family history (가족력)',                        'abbreviation', 8,  1, NULL),
  ('cw-med-009', 'medical-health-vocational-2026', 'SOAP',   'Subjective, Objective, Assessment, Plan (의무기록 4요소)', 'abbreviation', 9,  1, '주관적 자료 / 객관적 자료 / 사정 / 계획'),
  ('cw-med-010', 'medical-health-vocational-2026', 'SOB',    'shortness of breath (호흡곤란)',                 'abbreviation', 10, 1, NULL),
  ('cw-med-011', 'medical-health-vocational-2026', 'STAT',   '즉시 (at once) — 즉시 시행되어야 함',            'abbreviation', 11, 1, '라틴어 statim에서 유래'),
  ('cw-med-012', 'medical-health-vocational-2026', 't.i.d.', 'three times a day (하루에 세 번)',               'abbreviation', 12, 1, '라틴어 ter in die'),
  ('cw-med-013', 'medical-health-vocational-2026', 'WNL',    'within normal limits (정상 범위 내)',            'abbreviation', 13, 1, NULL),
  ('cw-med-014', 'medical-health-vocational-2026', 'Sx',     'symptom (증상)',                                  'abbreviation', 14, 1, NULL);

-- 신체 결합형 (11)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-015', 'medical-health-vocational-2026', 'cardi/o',          'heart (심장)',                       'combining_form', 15, 1, 'cardiology, cardiomegaly'),
  ('cw-med-016', 'medical-health-vocational-2026', 'hem/o, hemat/o',   'blood (혈액)',                       'combining_form', 16, 1, 'hematology, hemolysis'),
  ('cw-med-017', 'medical-health-vocational-2026', 'nephr/o, ren/o',   'kidney (신장/콩팥)',                  'combining_form', 17, 1, 'nephrectomy, suprarenal'),
  ('cw-med-018', 'medical-health-vocational-2026', 'pneum/o, pneumon/o', 'air or lung (공기 또는 폐)',        'combining_form', 18, 1, 'pneumonia, pneumothorax'),
  ('cw-med-019', 'medical-health-vocational-2026', 'rhin/o, nas/o',    'nose (코)',                          'combining_form', 19, 1, 'rhinoplasty, nasal'),
  ('cw-med-020', 'medical-health-vocational-2026', 'oste/o',           'bone (뼈)',                          'combining_form', 20, 1, 'osteoporosis'),
  ('cw-med-021', 'medical-health-vocational-2026', 'my/o',             'muscle (근육)',                      'combining_form', 21, 1, 'myopathy'),
  ('cw-med-022', 'medical-health-vocational-2026', 'neur/o',           'nerve (신경)',                       'combining_form', 22, 1, 'neurology'),
  ('cw-med-023', 'medical-health-vocational-2026', 'cephal/o',         'head (머리)',                        'combining_form', 23, 1, 'cephalalgia (두통)'),
  ('cw-med-024', 'medical-health-vocational-2026', 'abdomin/o',        'abdomen (복부)',                     'combining_form', 24, 1, 'abdominocentesis (복강천자)'),
  ('cw-med-025', 'medical-health-vocational-2026', 'vas/o, vascul/o',  'vessel (혈관)',                      'combining_form', 25, 1, 'vasoconstriction, vascular');

-- 핵심 접두사·접미사 (8)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-026', 'medical-health-vocational-2026', 'a-, an-',         'without (~없이)',                    'prefix', 26, 1, 'aphonia (실성증), anaerobic (혐기성)'),
  ('cw-med-027', 'medical-health-vocational-2026', 'hyper-',          'above / excessive (과도한)',         'prefix', 27, 1, 'hypertension (고혈압)'),
  ('cw-med-028', 'medical-health-vocational-2026', 'hypo-',           'below / deficient (결핍된)',         'prefix', 28, 1, 'hypothermia (저체온증)'),
  ('cw-med-029', 'medical-health-vocational-2026', 'peri-',           'around (~주위에)',                   'prefix', 29, 1, 'periosteum (골막), pericarditis (심낭염)'),
  ('cw-med-030', 'medical-health-vocational-2026', '-itis',           'inflammation (염증)',                'suffix', 30, 1, 'pericarditis (심낭염), arthritis (관절염)'),
  ('cw-med-031', 'medical-health-vocational-2026', '-ectomy',         'excision / removal (적출·제거)',     'suffix', 31, 1, 'nephrectomy (신장절제술)'),
  ('cw-med-032', 'medical-health-vocational-2026', '-algia, -dynia',  'pain (동통)',                        'suffix', 32, 1, 'cephalalgia, cephalodynia = 두통'),
  ('cw-med-033', 'medical-health-vocational-2026', '-megaly',         'enlargement (비대)',                 'suffix', 33, 1, 'hepatomegaly = 간비대');

-- ── Tier 2: 빈출 (26개) ────────────────────────────────────

-- 일반 접두사 (14)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-034', 'medical-health-vocational-2026', 'anti-, contra-',     'against / opposed to (~에 반대하는)', 'prefix', 34, 2, 'anticoagulant (항응고제), contraception (피임)'),
  ('cw-med-035', 'medical-health-vocational-2026', 'ab-',                'away from (멀리)',                    'prefix', 35, 2, 'abnormal'),
  ('cw-med-036', 'medical-health-vocational-2026', 'ad-',                'to / toward / near (향하여)',         'prefix', 36, 2, 'adhesion (유착)'),
  ('cw-med-037', 'medical-health-vocational-2026', 'endo-, en-',         'within (안의, 이내에)',               'prefix', 37, 2, 'endoscope (내시경)'),
  ('cw-med-038', 'medical-health-vocational-2026', 'intra-',             'within (안에)',                       'prefix', 38, 2, 'intradermal (피내)'),
  ('cw-med-039', 'medical-health-vocational-2026', 'inter-',             'between (사이에)',                    'prefix', 39, 2, 'intercostal (늑간)'),
  ('cw-med-040', 'medical-health-vocational-2026', 'sub-, infra-',       'below or under (아래, 밑)',           'prefix', 40, 2, 'sublingual (설하-), infraumbilical (배꼽하부)'),
  ('cw-med-041', 'medical-health-vocational-2026', 'post-',              'after or behind (~후에/뒤에)',        'prefix', 41, 2, 'postoperative (수술 후)'),
  ('cw-med-042', 'medical-health-vocational-2026', 'ante-, pre-, pro-',  'before (~전에)',                      'prefix', 42, 2, 'antepartum, premature, prognosis'),
  ('cw-med-043', 'medical-health-vocational-2026', 'dys-',               'painful, difficult, faulty (힘든·장애)', 'prefix', 43, 2, 'dysuria (배뇨곤란), dysphonia (발성장애)'),
  ('cw-med-044', 'medical-health-vocational-2026', 'brady-',             'slow (느린)',                         'prefix', 44, 2, 'bradycardia (서맥)'),
  ('cw-med-045', 'medical-health-vocational-2026', 'tachy-',             'fast (빠른)',                         'prefix', 45, 2, 'tachycardia (빈맥)'),
  ('cw-med-046', 'medical-health-vocational-2026', 'micro-',             'small (작은)',                        'prefix', 46, 2, 'microlith (미세결석)'),
  ('cw-med-047', 'medical-health-vocational-2026', 'macro-',             'large / long (큰)',                   'prefix', 47, 2, 'macrocyte (거대적혈구)');

-- 일반 결합형 (8)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-048', 'medical-health-vocational-2026', 'arthr/o',         'joint (관절)',                       'combining_form', 48, 2, 'arthritis (관절염)'),
  ('cw-med-049', 'medical-health-vocational-2026', 'aden/o',          'gland (선/샘)',                      'combining_form', 49, 2, 'adenoma (선종)'),
  ('cw-med-050', 'medical-health-vocational-2026', 'angi/o',          'vessel (혈관)',                      'combining_form', 50, 2, 'angiography (혈관조영술)'),
  ('cw-med-051', 'medical-health-vocational-2026', 'lip/o',           'fat (지방)',                         'combining_form', 51, 2, 'lipoid (유지질)'),
  ('cw-med-052', 'medical-health-vocational-2026', 'py/o',            'pus (고름)',                         'combining_form', 52, 2, 'pyorrhea (고름배출)'),
  ('cw-med-053', 'medical-health-vocational-2026', 'ur/o, urin/o',    'urine (소변)',                       'combining_form', 53, 2, 'oliguria (소변감소), polyuria (다뇨)'),
  ('cw-med-054', 'medical-health-vocational-2026', 'carcin/o',        'cancer (암)',                        'combining_form', 54, 2, 'carcinoma (암종)'),
  ('cw-med-055', 'medical-health-vocational-2026', 'lith/o',          'stone (결석)',                       'combining_form', 55, 2, 'lithotripsy (결석분쇄술)');

-- 일반 접미사 (4)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-056', 'medical-health-vocational-2026', '-penia',            'abnormal reduction (비정상적 감소)',   'suffix', 56, 2, 'leukopenia (백혈구감소증)'),
  ('cw-med-057', 'medical-health-vocational-2026', '-rrhea',            'discharge (분비물의 흐름)',            'suffix', 57, 2, 'pyorrhea (고름의 배출)'),
  ('cw-med-058', 'medical-health-vocational-2026', '-lysis',            'breaking down or dissolution (파괴/용해)', 'suffix', 58, 2, 'hemolysis (용혈)'),
  ('cw-med-059', 'medical-health-vocational-2026', '-rrhage, -rrhagia', '과도한 분비물 (주로 혈액) — 출혈',     'suffix', 59, 2, 'hemorrhage (출혈)');

-- ── Tier 3: 확장 (25개) ────────────────────────────────────

-- 드문 접두사 (12)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-060', 'medical-health-vocational-2026', 'epi-',                  'upon (위로)',                       'prefix', 60, 3, 'epidermal (표피)'),
  ('cw-med-061', 'medical-health-vocational-2026', 'pan-',                  'all (모두)',                        'prefix', 61, 3, 'panacea (만능약), pancytopenia (범혈구감소증)'),
  ('cw-med-062', 'medical-health-vocational-2026', 'eu-',                   'good or normal (좋은·정상)',        'prefix', 62, 3, 'eugenic (우생-)'),
  ('cw-med-063', 'medical-health-vocational-2026', 'neo-',                  'new (새로운)',                      'prefix', 63, 3, 'neoplasia (신생물/종양)'),
  ('cw-med-064', 'medical-health-vocational-2026', 'meta-',                 'beyond, after, change (뒤·후·변화)', 'prefix', 64, 3, 'metastasis (전이), metamorphosis (변태)'),
  ('cw-med-065', 'medical-health-vocational-2026', 'sym-, syn-, con-',      'together or with (함께)',           'prefix', 65, 3, 'symbiosis, syndactylism, congenital'),
  ('cw-med-066', 'medical-health-vocational-2026', 'ecto-, exo-, extra-',   'outside (바깥쪽의, 외부의)',        'prefix', 66, 3, 'ectopic, exocrine, extravascular'),
  ('cw-med-067', 'medical-health-vocational-2026', 'mono-',                 'one (1, 하나)',                     'prefix', 67, 3, 'monochromatic'),
  ('cw-med-068', 'medical-health-vocational-2026', 'bi-',                   'two (2, 둘)',                       'prefix', 68, 3, 'bilateral (양측의)'),
  ('cw-med-069', 'medical-health-vocational-2026', 'tri-',                  'three (3, 셋)',                     'prefix', 69, 3, 'triangle'),
  ('cw-med-070', 'medical-health-vocational-2026', 'quadri-',               'four (4, 넷)',                      'prefix', 70, 3, 'quadriplegia (사지마비)'),
  ('cw-med-071', 'medical-health-vocational-2026', 'poly-, multi-',         'many (많은)',                       'prefix', 71, 3, 'polyphobia, multicellular');

-- 색상 결합형 (4)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-072', 'medical-health-vocational-2026', 'cyan/o',     '청색 (cyan)',                          'combining_form', 72, 3, 'cyanosis (청색증)'),
  ('cw-med-073', 'medical-health-vocational-2026', 'erythr/o',   '적색 (red)',                           'combining_form', 73, 3, 'erythrocyte (적혈구)'),
  ('cw-med-074', 'medical-health-vocational-2026', 'leuk/o',     '백색 (white)',                         'combining_form', 74, 3, 'leukocyte (백혈구)'),
  ('cw-med-075', 'medical-health-vocational-2026', 'melan/o',    '흑색 (black)',                         'combining_form', 75, 3, 'melanoma (흑색종)');

-- 기타 결합형 (3)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-076', 'medical-health-vocational-2026', 'troph/o',  'nourishment or development (영양분·성장)', 'combining_form', 76, 3, 'hypertrophy (비대), atrophy (위축)'),
  ('cw-med-077', 'medical-health-vocational-2026', 'acr/o',    'extremity (팔다리·꼭대기)',                'combining_form', 77, 3, 'acrophobia (고소공포)'),
  ('cw-med-078', 'medical-health-vocational-2026', 'toxic/o',  'poison (독)',                              'combining_form', 78, 3, 'toxicology (독성학)');

-- 외과 접미사 (6)
INSERT OR IGNORE INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES
  ('cw-med-079', 'medical-health-vocational-2026', '-plasty',     'surgical repair or reconstruction (외과적 교정·성형)', 'suffix', 79, 3, 'rhinoplasty = 코성형술'),
  ('cw-med-080', 'medical-health-vocational-2026', '-centesis',   'puncture for aspiration (흡인을 위한 천자)',           'suffix', 80, 3, 'abdominocentesis (복강천자)'),
  ('cw-med-081', 'medical-health-vocational-2026', '-genesis',    'origin or production (기원/생성)',                     'suffix', 81, 3, 'pathogenesis (병인론)'),
  ('cw-med-082', 'medical-health-vocational-2026', '-oid',        'resembling (유사한)',                                  'suffix', 82, 3, 'lipoid (유지질)'),
  ('cw-med-083', 'medical-health-vocational-2026', '-pexy',       'suspension or fixation (매달기·고정)',                 'suffix', 83, 3, 'gastropexy (위고정술)'),
  ('cw-med-084', 'medical-health-vocational-2026', '-desis',      'binding (묶다)',                                       'suffix', 84, 3, 'arthrodesis (관절고정술)');

-- word_count 갱신
UPDATE vocab_catalogs
   SET word_count = (SELECT COUNT(*) FROM vocab_catalog_words WHERE catalog_id = 'medical-health-vocational-2026')
 WHERE id = 'medical-health-vocational-2026';
