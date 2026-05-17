INSERT INTO vocab_catalogs (id, title, source, license, word_count) VALUES (
  'csat-megastudy-2025', '수능 영단어 (메가스터디 무료 PDF)', 'megastudy-2025-susung+23mar', '학원 내부 학습용 — 메가스터디 김동영 강사 무료 배포 PDF 기반', 635
) ON CONFLICT(id) DO UPDATE SET title=excluded.title, source=excluded.source, license=excluded.license, word_count=excluded.word_count;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00001', 'csat-megastudy-2025', 'assessment', 'n. 평가', 'noun', 1, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00002', 'csat-megastudy-2025', 'case', '경우; 사건, 사례', 'noun', 2, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00003', 'csat-megastudy-2025', 'critical', '중요한; 비판적인', 'adj', 3, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00004', 'csat-megastudy-2025', 'hold out', 'v. 지속되다, 보이다', 'verb', 4, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00005', 'csat-megastudy-2025', 'likely', '~할 것으로 예상되는', 'noun', 5, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00006', 'csat-megastudy-2025', 'rather', '오히려, 차라리; 꽤', 'noun', 6, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00007', 'csat-megastudy-2025', 'rather than', '~(라기)보다는', 'noun', 7, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00008', 'csat-megastudy-2025', 'store', '저장하다; 가게, 상점', 'verb', 8, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00009', 'csat-megastudy-2025', 'take place', 'v. 실시되다, 일어나다', 'verb', 9, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00010', 'csat-megastudy-2025', 'advantage', '이점, 장점', 'noun', 10, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00011', 'csat-megastudy-2025', 'afterlife', 'n. 내세, 여생', 'noun', 11, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00012', 'csat-megastudy-2025', 'aim', '~을 목표로 하다, 목표를 설정하다 as compared with', 'verb', 12, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00013', 'csat-megastudy-2025', 'analytic', 'a. 분석적인', 'adj', 13, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00014', 'csat-megastudy-2025', 'architecture', '건축', 'noun', 14, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00015', 'csat-megastudy-2025', 'assess', '평가하다, 판단하다', 'verb', 15, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00016', 'csat-megastudy-2025', 'assume', '가정하다, 추정하다; 전제하다', 'verb', 16, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00017', 'csat-megastudy-2025', 'assumption', 'n. 가정, 가설', 'noun', 17, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00018', 'csat-megastudy-2025', 'attraction', '명소, 볼거리; 유인력', 'noun', 18, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00019', 'csat-megastudy-2025', 'attribute', '속성, 자질', 'noun', 19, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00020', 'csat-megastudy-2025', 'benefit', 'n. 편익, 혜택; 이익, 이득', 'noun', 20, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00021', 'csat-megastudy-2025', 'capital', '자본(금); 수도', 'noun', 21, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00022', 'csat-megastudy-2025', 'career', '(직업 상의) 경력, 이력', 'noun', 22, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00023', 'csat-megastudy-2025', 'conduct', 'v. 수행하다, 집행하다; 안내하다', 'verb', 23, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00024', 'csat-megastudy-2025', 'contagion', '전염, 감염', 'noun', 24, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00025', 'csat-megastudy-2025', 'context', '맥락, 상황', 'noun', 25, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00026', 'csat-megastudy-2025', 'contract', 'n. 계약, 약정 v. 계약하다', 'noun', 26, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00027', 'csat-megastudy-2025', 'conventional', '관례적인, 전통적인', 'adj', 27, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00028', 'csat-megastudy-2025', 'cooperate', '협동하다, 협력하다', 'verb', 28, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00029', 'csat-megastudy-2025', 'coordination', '(신체) 조정력,', 'noun', 29, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00030', 'csat-megastudy-2025', 'counterpart', '상대, 대응 관계에 있는 사람', 'adj', 30, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00031', 'csat-megastudy-2025', 'decade', 'n. 10년', 'noun', 31, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00032', 'csat-megastudy-2025', 'demonstrate', '입증하다; 보여주다, 설명하다', 'verb', 32, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00033', 'csat-megastudy-2025', 'disclose', 'v. 밝히다, 드러내다, 나타내다', 'verb', 33, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00034', 'csat-megastudy-2025', 'domain', 'n. 영역, 영토', 'noun', 34, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00035', 'csat-megastudy-2025', 'emotional', '감정적인, 감정이 동요되는', 'noun', 35, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00036', 'csat-megastudy-2025', 'employ', 'v. 이용하다; 고용하다', 'verb', 36, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00037', 'csat-megastudy-2025', 'engage in', '~을 하다', 'verb', 37, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00038', 'csat-megastudy-2025', 'evaluation', '평가; 검토, 판단', 'noun', 38, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00039', 'csat-megastudy-2025', 'evolution', '진화; 발전', 'noun', 39, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00040', 'csat-megastudy-2025', 'examine', 'v. 검토하다, 조사하다, 살펴보다', 'verb', 40, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00041', 'csat-megastudy-2025', 'except for', '~을 제외하고는', 'noun', 41, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00042', 'csat-megastudy-2025', 'exhausting', '지치게 하는, 힘든', 'noun', 42, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00043', 'csat-megastudy-2025', 'expense', '비용, 돈; 지출', 'noun', 43, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00044', 'csat-megastudy-2025', 'formal', 'a. 형식적인, 공식적인', 'adj', 44, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00045', 'csat-megastudy-2025', 'foster', '기르다, 양육하다; 촉진하다', 'verb', 45, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00046', 'csat-megastudy-2025', 'host', '많은 수, 다수', 'noun', 46, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00047', 'csat-megastudy-2025', 'immediate', '인접한, 바로 옆의; 즉각적인', 'adj', 47, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00048', 'csat-megastudy-2025', 'injury', '손상, 부상', 'noun', 48, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00049', 'csat-megastudy-2025', 'legal', '법적인, 법률 상의', 'noun', 49, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00050', 'csat-megastudy-2025', 'line of thought', '사고방식', 'noun', 50, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00051', 'csat-megastudy-2025', 'maintenance', 'n. 관리, 보수; 유지 지속', 'noun', 51, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00052', 'csat-megastudy-2025', 'majority', 'n. 대부분, 대다수', 'noun', 52, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00053', 'csat-megastudy-2025', 'measure up', '겨루다; 측정하다, 재다', 'verb', 53, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00054', 'csat-megastudy-2025', 'near', '가까운; 가까이, 인접하여', 'noun', 54, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00055', 'csat-megastudy-2025', 'norm', '규범, 기준; 일반 표준', 'noun', 55, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00056', 'csat-megastudy-2025', 'particularly', 'adv. 특히, 특별히', 'adv', 56, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00057', 'csat-megastudy-2025', 'population dynamics', 'n. 개체군 역학', 'noun', 57, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00058', 'csat-megastudy-2025', 'population ecology', 'n. 개체군 생태학', 'noun', 58, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00059', 'csat-megastudy-2025', 'practical', '실용적인, 실제의', 'noun', 59, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00060', 'csat-megastudy-2025', 'practice', '관행, 관례; 실행, 실시', 'noun', 60, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00061', 'csat-megastudy-2025', 'precisely', '정밀하게, 정확하게', 'noun', 61, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00062', 'csat-megastudy-2025', 'principle', '원칙, 원리; 법칙', 'noun', 62, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00063', 'csat-megastudy-2025', 'profile', 'n. 개요서', 'noun', 63, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00064', 'csat-megastudy-2025', 'profile piece', 'n. 인물 소개 기사', 'noun', 64, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00065', 'csat-megastudy-2025', 'promise', 'n. 가능성, 장래성; 약속, 계약', 'noun', 65, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00066', 'csat-megastudy-2025', 'promote', 'v. 홍보하다; 장려하다', 'verb', 66, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00067', 'csat-megastudy-2025', 'relationship', '관계', 'noun', 67, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00068', 'csat-megastudy-2025', 'relevant', '중요한, 의의가 있는, 유의미한', 'adj', 68, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00069', 'csat-megastudy-2025', 'replace', 'v. 대체하다, 되돌리다', 'verb', 69, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00070', 'csat-megastudy-2025', 'reputation', 'n. 평판', 'noun', 70, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00071', 'csat-megastudy-2025', 'require', 'v. 필요로 하다, 요구하다', 'verb', 71, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00072', 'csat-megastudy-2025', 'response', '반응; 응답, 대답', 'noun', 72, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00073', 'csat-megastudy-2025', 'rise', '상승하다; 일어서다', 'verb', 73, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00074', 'csat-megastudy-2025', 'risk', '~의 위험을 감수하다', 'verb', 74, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00075', 'csat-megastudy-2025', 'risk assessment', 'n. 위험 평가', 'noun', 75, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00076', 'csat-megastudy-2025', 'rule', '통치, 지배; 규칙', 'noun', 76, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00077', 'csat-megastudy-2025', 'serve', '제공하다, 공급하다', 'verb', 77, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00078', 'csat-megastudy-2025', 'theoretical', 'a. 이론적인', 'adj', 78, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00079', 'csat-megastudy-2025', 'tourist', '관광객', 'noun', 79, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00080', 'csat-megastudy-2025', 'transportation', '교통, 운송, 수송', 'noun', 80, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00081', 'csat-megastudy-2025', 'turn', '(책장을) 넘기다', 'noun', 81, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00082', 'csat-megastudy-2025', 'work', '제품; 일, 작업; 일하다, 작동하다', 'verb', 82, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00083', 'csat-megastudy-2025', 'absolutely', '전적으로, 틀림없이', 'noun', 83, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00084', 'csat-megastudy-2025', 'accept', '믿다, 받아들이다; 신뢰하다', 'verb', 84, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00085', 'csat-megastudy-2025', 'accomplish', '완수하다, 성취하다, 해내다', 'verb', 85, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00086', 'csat-megastudy-2025', 'accomplishment', 'n. 달성, 성취', 'noun', 86, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00087', 'csat-megastudy-2025', 'according to', '~에 따르면', 'noun', 87, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00088', 'csat-megastudy-2025', 'accurate', '정확한, 정밀한; 정확한 계산, 정보 antipredatory', 'noun', 88, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00089', 'csat-megastudy-2025', 'accurately', '정확하게', 'noun', 89, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00090', 'csat-megastudy-2025', 'acquisition', '획득, 습득', 'noun', 90, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00091', 'csat-megastudy-2025', 'adaptive', '적응적인, 적응할 수 있는', 'adj', 91, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00092', 'csat-megastudy-2025', 'additional', '추가의, 추가적인,', 'noun', 92, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00093', 'csat-megastudy-2025', 'admire', 'v. 존중하다; 칭찬하다; 감탄하다', 'verb', 93, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00094', 'csat-megastudy-2025', 'admission', '입장료, 입장; 허가, 인정', 'noun', 94, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00095', 'csat-megastudy-2025', 'advanced', '발달한, 진보한; 고급의, 심화된', 'noun', 95, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00096', 'csat-megastudy-2025', 'affairs', '상황; 사건, 일', 'noun', 96, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00097', 'csat-megastudy-2025', 'affective', 'a. 감정적인', 'adj', 97, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00098', 'csat-megastudy-2025', 'after all', '결국, 무엇보다', 'noun', 98, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00099', 'csat-megastudy-2025', 'afterwards', '그 후에', 'noun', 99, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00100', 'csat-megastudy-2025', 'alchemy', 'n. 연금술, 연탄술', 'noun', 100, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00101', 'csat-megastudy-2025', 'algebra', 'n. 대수학(代數學)', 'noun', 101, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00102', 'csat-megastudy-2025', 'algorithm-generated', '알고리듬에 의해 생성된', 'noun', 102, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00103', 'csat-megastudy-2025', 'altruistic', '이타주의의', 'noun', 103, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00104', 'csat-megastudy-2025', 'analysis', '분석 연구, 분석', 'noun', 104, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00105', 'csat-megastudy-2025', 'anatomical', '해부학적인', 'adj', 105, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00106', 'csat-megastudy-2025', 'anatomy', '해부학', 'noun', 106, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00107', 'csat-megastudy-2025', 'ankle', '발목', 'noun', 107, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00108', 'csat-megastudy-2025', 'annual', '연례의, 매년의; 연간 행사', 'noun', 108, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00109', 'csat-megastudy-2025', 'antibiotics', 'n. 항생제. 항생 물질', 'noun', 109, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00110', 'csat-megastudy-2025', 'apparent', 'a. ~인 것 같은, ~인 것으로 보이는', 'adj', 110, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00111', 'csat-megastudy-2025', 'applicant', 'n. 지원자, 응모자, 후보자', 'noun', 111, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00112', 'csat-megastudy-2025', 'apply for', '~에 지원하다', 'verb', 112, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00113', 'csat-megastudy-2025', 'appreciably', '상당히, 주목할 만하게, 눈에 띄게', 'noun', 113, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00114', 'csat-megastudy-2025', 'appreciation', '이해; 감사, 감상', 'noun', 114, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00115', 'csat-megastudy-2025', 'appropriately', '적절히, 알맞게', 'noun', 115, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00116', 'csat-megastudy-2025', 'arena', '장, 무대', 'noun', 116, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00117', 'csat-megastudy-2025', 'argue', '주장하다, 논쟁하다', 'verb', 117, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00118', 'csat-megastudy-2025', 'array', '정렬, 배열, 집합', 'noun', 118, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00119', 'csat-megastudy-2025', 'arrival', '도래, 도착', 'noun', 119, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00120', 'csat-megastudy-2025', 'aspiring', '장차 ~이 되려는; 희망하는', 'noun', 120, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00121', 'csat-megastudy-2025', 'associate', 'v. 관련시키다(with); 결합하다', 'verb', 121, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00122', 'csat-megastudy-2025', 'associative', 'a. 연합하는, 관념의', 'adj', 122, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00123', 'csat-megastudy-2025', 'astronomy', '천문학; 우주 연구', 'noun', 123, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00124', 'csat-megastudy-2025', 'attract', '~의 관심을 끌다', 'noun', 124, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00125', 'csat-megastudy-2025', 'automate', '자동화하다, 기계화하다', 'verb', 125, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00126', 'csat-megastudy-2025', 'automatically', '자동적으로', 'noun', 126, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00127', 'csat-megastudy-2025', 'automobile', '자동차', 'noun', 127, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00128', 'csat-megastudy-2025', 'avoid', '~하기를 피하다, 회피하다', 'verb', 128, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00129', 'csat-megastudy-2025', 'awareness', '의식, 관심; 인식', 'noun', 129, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00130', 'csat-megastudy-2025', 'bear out', '~을 유지하다, ~을 지지하다', 'verb', 130, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00131', 'csat-megastudy-2025', 'belief', 'n. 믿음; 확신', 'noun', 131, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00132', 'csat-megastudy-2025', 'beloved', '사랑받는, 인기 많은', 'noun', 132, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00133', 'csat-megastudy-2025', 'beyond', '~을 너머', 'noun', 133, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00134', 'csat-megastudy-2025', 'bind', 'v. 묶다', 'verb', 134, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00135', 'csat-megastudy-2025', 'biography', '일대기, 전기', 'noun', 135, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00136', 'csat-megastudy-2025', 'bloody', '피투성이가 되는, 피를 흘리는', 'noun', 136, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00137', 'csat-megastudy-2025', 'body budget', 'n. 신체 (에너지) 예산', 'noun', 137, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00138', 'csat-megastudy-2025', 'boost', 'v. 높이다, 증가시키다', 'verb', 138, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00139', 'csat-megastudy-2025', 'break', '휴식 (시간); 파손, 고장', 'noun', 139, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00140', 'csat-megastudy-2025', 'breakdown', '고장; 분해, 분석', 'noun', 140, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00141', 'csat-megastudy-2025', 'broadcaster', '방송인', 'noun', 141, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00142', 'csat-megastudy-2025', 'call for', '~을 요구하다', 'verb', 142, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00143', 'csat-megastudy-2025', 'cancel', '취소하다, 무효화하다', 'verb', 143, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00144', 'csat-megastudy-2025', 'capacity', '능력, 수용 능력', 'noun', 144, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00145', 'csat-megastudy-2025', 'captor', 'n. 포획자, 체포자, 잡는 사람', 'noun', 145, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00146', 'csat-megastudy-2025', 'careful', '주의 깊게, 조심하는; 세심한', 'noun', 146, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00147', 'csat-megastudy-2025', 'cash', '현금, 돈', 'noun', 147, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00148', 'csat-megastudy-2025', 'cause', '원인; 이유, 목적', 'adj', 148, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00149', 'csat-megastudy-2025', 'centralize', '중앙집권화를 하다', 'verb', 149, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00150', 'csat-megastudy-2025', 'chairman', '회장, 의장', 'noun', 150, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00151', 'csat-megastudy-2025', 'chance', 'n. 가능성; 우연; 기회', 'noun', 151, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00152', 'csat-megastudy-2025', 'change', '변화시키다, 변경하다', 'verb', 152, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00153', 'csat-megastudy-2025', 'channel', 'v. 특정한 방향으로 돌리다', 'verb', 153, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00154', 'csat-megastudy-2025', 'character', '등장인물; 성격, 특성', 'noun', 154, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00155', 'csat-megastudy-2025', 'characteristic', 'n. 특성, 특징', 'noun', 155, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00156', 'csat-megastudy-2025', 'charitable', 'a. 관대한, 자선의, 자비로운', 'adj', 156, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00157', 'csat-megastudy-2025', 'chase', 'v. 쫓다, 추적하다', 'verb', 157, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00158', 'csat-megastudy-2025', 'class', '(~와) 같은 부류에 넣다; 계층, 종류 consequence', 'noun', 158, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00159', 'csat-megastudy-2025', 'claw', '발톱', 'noun', 159, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00160', 'csat-megastudy-2025', 'clear', '분명한, 명확한; 깨끗한', 'noun', 160, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00161', 'csat-megastudy-2025', 'clerk', '점원, 직원', 'noun', 161, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00162', 'csat-megastudy-2025', 'clock-oriented', '시계 중심의', 'noun', 162, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00163', 'csat-megastudy-2025', 'close-knit', '긴밀히 맺어진, 유대감 있는', 'adj', 163, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00164', 'csat-megastudy-2025', 'collect', '수거하다; 모으다, 수집하다', 'verb', 164, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00165', 'csat-megastudy-2025', 'collectivistically oriented', 'a. 집단주의 지향의', 'adj', 165, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00166', 'csat-megastudy-2025', 'colony', 'n. 식민지', 'noun', 166, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00167', 'csat-megastudy-2025', 'combination', '조합, 결합', 'noun', 167, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00168', 'csat-megastudy-2025', 'command', '지배하다, 지휘하다;', 'verb', 168, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00169', 'csat-megastudy-2025', 'communication', '의사소통', 'noun', 169, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00170', 'csat-megastudy-2025', 'community', '공동체, 사회 집단', 'noun', 170, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00171', 'csat-megastudy-2025', 'compelling', 'a. 설득력 있는; 강제적인', 'adj', 171, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00172', 'csat-megastudy-2025', 'competition', 'n. 경기, 대회; 경쟁', 'noun', 172, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00173', 'csat-megastudy-2025', 'completely', '완전히, 전적으로', 'noun', 173, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00174', 'csat-megastudy-2025', 'complicated', '복잡한, 어려운', 'noun', 174, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00175', 'csat-megastudy-2025', 'composition', '구성 요소, 성분', 'noun', 175, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00176', 'csat-megastudy-2025', 'concept', '개념; 아이디어, 생각', 'noun', 176, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00177', 'csat-megastudy-2025', 'conclusion', 'n. 결론, 결정; 결말, 종결', 'noun', 177, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00178', 'csat-megastudy-2025', 'conform', '따르다, 순응하다; 일치하다', 'verb', 178, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00179', 'csat-megastudy-2025', 'conscious', '의식적인, 알고 있는', 'adj', 179, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00180', 'csat-megastudy-2025', 'consequently', 'adv. 그 결과, 결과적으로', 'adv', 180, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00181', 'csat-megastudy-2025', 'consider', '사려하다, 고려하다, 숙고하다', 'verb', 181, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00182', 'csat-megastudy-2025', 'considerable', '상당한, 많은', 'noun', 182, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00183', 'csat-megastudy-2025', 'consideration', 'n. 고려, 숙고', 'noun', 183, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00184', 'csat-megastudy-2025', 'constantly', '끊임없이', 'noun', 184, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00185', 'csat-megastudy-2025', 'constitute', '구성하다, 형성하다', 'verb', 185, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00186', 'csat-megastudy-2025', 'constrain', '속박하다, 제약하다', 'verb', 186, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00187', 'csat-megastudy-2025', 'consume', '소비하다, 소모하다', 'verb', 187, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00188', 'csat-megastudy-2025', 'continual', 'a. 계속적인, 끊임없는, 연속적인', 'adj', 188, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00189', 'csat-megastudy-2025', 'controlled', '통제된, 규제된', 'noun', 189, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00190', 'csat-megastudy-2025', 'convenience', '편리함, 편의시설', 'noun', 190, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00191', 'csat-megastudy-2025', 'convey', 'v. 전달하다; 나르다, 운반하다', 'verb', 191, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00192', 'csat-megastudy-2025', 'cooperative', '협력하는, 협동하는', 'noun', 192, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00193', 'csat-megastudy-2025', 'coordinate', '(신체를) 조정하다, 조화롭게 하다', 'verb', 193, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00194', 'csat-megastudy-2025', 'core', '핵심의; 중심', 'noun', 194, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00195', 'csat-megastudy-2025', 'corporation', '기업', 'noun', 195, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00196', 'csat-megastudy-2025', 'correlate', 'v. 서로 연관시키다', 'verb', 196, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00197', 'csat-megastudy-2025', 'cover', '보도하다, 취재하다; 덮다, 숨기다', 'verb', 197, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00198', 'csat-megastudy-2025', 'coverage', '관심, 보도 (범위)', 'noun', 198, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00199', 'csat-megastudy-2025', 'critically', '비판적으로; 심각하게', 'noun', 199, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00200', 'csat-megastudy-2025', 'curriculum', '교육 과정', 'noun', 200, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00201', 'csat-megastudy-2025', 'cycle', '주기; 순환', 'noun', 201, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00202', 'csat-megastudy-2025', 'daily', '일상의, 매일의', 'noun', 202, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00203', 'csat-megastudy-2025', 'decide', '결정하다', 'verb', 203, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00204', 'csat-megastudy-2025', 'decision', 'n. (의사) 결정, 결심', 'noun', 204, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00205', 'csat-megastudy-2025', 'definition', '정의, 의미;', 'noun', 205, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00206', 'csat-megastudy-2025', 'delicate', '깨지기 쉬운, 섬세한; 미세한', 'noun', 206, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00207', 'csat-megastudy-2025', 'density', 'n. 밀도,', 'noun', 207, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00208', 'csat-megastudy-2025', 'depict', 'eager to 동사원형', 'noun', 208, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00209', 'csat-megastudy-2025', 'deprive A of B', 'A에게서 B를 빼앗다', 'noun', 209, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00210', 'csat-megastudy-2025', 'derail', '저해하다, 망치다; 실패하게 하다', 'verb', 210, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00211', 'csat-megastudy-2025', 'derive from', '~에서 유래하다', 'verb', 211, 1, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00212', 'csat-megastudy-2025', 'design', '설계하다, 구상하다', 'verb', 212, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00213', 'csat-megastudy-2025', 'desirable', '바람직한, 호감 가는, 가치 있는', 'adj', 213, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00214', 'csat-megastudy-2025', 'desire', '욕구, 갈망;', 'noun', 214, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00215', 'csat-megastudy-2025', 'devalue', '가치가 떨어지다', 'noun', 215, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00216', 'csat-megastudy-2025', 'develop', '구축하다, 조성하다, 개발하다', 'verb', 216, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00217', 'csat-megastudy-2025', 'diminish', '줄이다, 약화시키다', 'noun', 217, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00218', 'csat-megastudy-2025', 'director', '감독; 책임자, 관리자', 'noun', 218, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00219', 'csat-megastudy-2025', 'disappear', '사라지다, 없어지다', 'noun', 219, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00220', 'csat-megastudy-2025', 'disaster', 'n. 재난', 'noun', 220, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00221', 'csat-megastudy-2025', 'discipline', '학문, 지식 분야; 규율, 훈육', 'noun', 221, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00222', 'csat-megastudy-2025', 'discourse', '담론; 논의, 이야기', 'noun', 222, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00223', 'csat-megastudy-2025', 'disquiet', 'n. 불안 v. 불안하게 하다', 'noun', 223, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00224', 'csat-megastudy-2025', 'dissolve', 'v. 해체하다; 녹이다, 분해시키다', 'verb', 224, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00225', 'csat-megastudy-2025', 'distress', '괴로움, (심리적) 고통', 'noun', 225, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00226', 'csat-megastudy-2025', 'diverse', '다양한, 다채로운', 'noun', 226, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00227', 'csat-megastudy-2025', 'dog-ear', '(책장의) 모서리를 접다', 'noun', 227, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00228', 'csat-megastudy-2025', 'dominate', 'v. 장악하다; 지배하다', 'verb', 228, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00229', 'csat-megastudy-2025', 'downtown', '시내에, 시내로; 도심지', 'noun', 229, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00230', 'csat-megastudy-2025', 'draftsmanship', '제도, 제도공의 기술', 'noun', 230, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00231', 'csat-megastudy-2025', 'drawer', '서랍, 서랍장', 'noun', 231, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00232', 'csat-megastudy-2025', 'drive', '유도하다; 운전하다; 추진하다', 'verb', 232, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00233', 'csat-megastudy-2025', 'due to', '~때문에', 'noun', 233, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00234', 'csat-megastudy-2025', 'dynamic', '역동적인; 활발한, 변화가 많은', 'noun', 234, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00235', 'csat-megastudy-2025', 'ecologist', 'n. 생태학자', 'noun', 235, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00236', 'csat-megastudy-2025', 'edge', 'n. 문제; 테두리; 우세, 강점', 'noun', 236, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00237', 'csat-megastudy-2025', 'editor', '편집자', 'noun', 237, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00238', 'csat-megastudy-2025', 'education', '교육; 학습, 훈련', 'noun', 238, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00239', 'csat-megastudy-2025', 'educator', '교육자', 'noun', 239, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00240', 'csat-megastudy-2025', 'effect', '초래하다, 가져오다 결과; 효과', 'verb', 240, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00241', 'csat-megastudy-2025', 'efficient', '효율적인, 유능한,', 'noun', 241, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00242', 'csat-megastudy-2025', 'effort', '노력', 'noun', 242, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00243', 'csat-megastudy-2025', 'effortful', '노력이 필요한', 'noun', 243, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00244', 'csat-megastudy-2025', 'embarrassed', '민망한, 당황스러운', 'noun', 244, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00245', 'csat-megastudy-2025', 'encounter', 'v. (우연히) 마주치다 n. 만남', 'verb', 245, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00246', 'csat-megastudy-2025', 'energize', '힘을 북돋아 주다, 활력을 주다', 'noun', 246, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00247', 'csat-megastudy-2025', 'enforcement', '(규제) 집행; 실행, 시행', 'noun', 247, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00248', 'csat-megastudy-2025', 'enhance', '높이다, 향상시키다; 강화하다', 'verb', 248, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00249', 'csat-megastudy-2025', 'enjoy', '즐기다', 'noun', 249, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00250', 'csat-megastudy-2025', 'enormous', 'a. 막대한, 거대한', 'adj', 250, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00251', 'csat-megastudy-2025', 'ensure', '보장하다, 확인하다', 'verb', 251, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00252', 'csat-megastudy-2025', 'entirely', '전적으로, 완전히', 'noun', 252, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00253', 'csat-megastudy-2025', 'envious', '질투하는, 샘내는; 부러워하는', 'noun', 253, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00254', 'csat-megastudy-2025', 'envy', '부러워하다, 시기하다', 'verb', 254, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00255', 'csat-megastudy-2025', 'equipment', '장비, 기기', 'noun', 255, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00256', 'csat-megastudy-2025', 'establish', '확립하다, 수립하다', 'verb', 256, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00257', 'csat-megastudy-2025', 'eternal', 'a. 영원한; 끝이 없는', 'adj', 257, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00258', 'csat-megastudy-2025', 'evaluate', 'v. 평가하다', 'verb', 258, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00259', 'csat-megastudy-2025', 'event', '행사, 사건', 'noun', 259, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00260', 'csat-megastudy-2025', 'evolve', '발달시키다, 진전시키다', 'noun', 260, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00261', 'csat-megastudy-2025', 'executive', 'n. 경영자, 간부 a. 실행의', 'noun', 261, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00262', 'csat-megastudy-2025', 'exercise bicycle', 'n. 실내 운동용 자전거', 'noun', 262, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00263', 'csat-megastudy-2025', 'expand', '확장하다, 늘리다', 'verb', 263, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00264', 'csat-megastudy-2025', 'expansion', '확장; 팽창', 'noun', 264, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00265', 'csat-megastudy-2025', 'explicitly', 'adv. 명시적으로', 'adv', 265, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00266', 'csat-megastudy-2025', 'express', '표현하다', 'verb', 266, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00267', 'csat-megastudy-2025', 'extended', '장기간에 걸친, 확장된', 'noun', 267, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00268', 'csat-megastudy-2025', 'extensive', 'a. 광범위한, 폭넓은', 'adj', 268, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00269', 'csat-megastudy-2025', 'facility', '시설, 기관', 'noun', 269, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00270', 'csat-megastudy-2025', 'factory', '공장', 'noun', 270, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00271', 'csat-megastudy-2025', 'fairly', '상당히, 꽤', 'noun', 271, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00272', 'csat-megastudy-2025', 'fairness', '공정함; 정당성', 'noun', 272, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00273', 'csat-megastudy-2025', 'famously', '잘 알려졌듯이', 'noun', 273, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00274', 'csat-megastudy-2025', 'fashion', '방식; 유행', 'noun', 274, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00275', 'csat-megastudy-2025', 'fat', '지방', 'noun', 275, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00276', 'csat-megastudy-2025', 'favor', 'n. 호의, 친절', 'noun', 276, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00277', 'csat-megastudy-2025', 'fearful', '두려운, 겁먹은', 'noun', 277, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00278', 'csat-megastudy-2025', 'feature', 'n. 특징; 얼굴', 'noun', 278, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00279', 'csat-megastudy-2025', 'fiction', '소설, 허구', 'noun', 279, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00280', 'csat-megastudy-2025', 'film', '영화', 'noun', 280, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00281', 'csat-megastudy-2025', 'final round', 'n. 결승전', 'noun', 281, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00282', 'csat-megastudy-2025', 'flat', '평평한', 'noun', 282, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00283', 'csat-megastudy-2025', 'flesh', 'n. 살, 육체', 'noun', 283, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00284', 'csat-megastudy-2025', 'flexibility', '유연성; 적응력', 'noun', 284, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00285', 'csat-megastudy-2025', 'flockmate', '무리 구성원', 'noun', 285, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00286', 'csat-megastudy-2025', 'following', '다음의, 후속의, 뒤따르는', 'noun', 286, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00287', 'csat-megastudy-2025', 'formation', '설립, 형성 (과정)', 'noun', 287, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00288', 'csat-megastudy-2025', 'found', 'v. 설립하다, 세우다', 'verb', 288, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00289', 'csat-megastudy-2025', 'foundation', 'n. 토대, 기반', 'noun', 289, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00290', 'csat-megastudy-2025', 'founder', '설립자', 'noun', 290, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00291', 'csat-megastudy-2025', 'fulfillment', 'n. 만족감; 이행 수행', 'noun', 291, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00292', 'csat-megastudy-2025', 'full-time', '전업의', 'noun', 292, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00293', 'csat-megastudy-2025', 'fully', '완전히, 충분히', 'noun', 293, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00294', 'csat-megastudy-2025', 'fundamental', '근본적인, 기본적인', 'adj', 294, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00295', 'csat-megastudy-2025', 'fundamentally', 'adv. 근본적(본질적)으로', 'adv', 295, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00296', 'csat-megastudy-2025', 'further', '더 나아간, 추가적인', 'adj', 296, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00297', 'csat-megastudy-2025', 'gain', '이득을 얻다; 득점하다, 획득하다', 'verb', 297, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00298', 'csat-megastudy-2025', 'gather', '모으다', 'noun', 298, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00299', 'csat-megastudy-2025', 'generation', 'n. 세대', 'noun', 299, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00300', 'csat-megastudy-2025', 'give off', '~을 방출하다', 'verb', 300, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00301', 'csat-megastudy-2025', 'global', '세계적인', 'adj', 301, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00302', 'csat-megastudy-2025', 'grip', '움켜쥐다; 움켜쥠; 잡다, 파악하다', 'verb', 302, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00303', 'csat-megastudy-2025', 'grow', '성장하다, 발달하다; 번식하다', 'verb', 303, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00304', 'csat-megastudy-2025', 'guarantee', 'n. 보장, 보증 v. 보증하다', 'noun', 304, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00305', 'csat-megastudy-2025', 'guardian', '후견인, 보호자', 'noun', 305, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00306', 'csat-megastudy-2025', 'guilt', '죄책감, 유죄; 잘못, 죄', 'noun', 306, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00307', 'csat-megastudy-2025', 'gut feeling', 'n. 직감', 'noun', 307, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00308', 'csat-megastudy-2025', 'harmful', '해로운, 유해한', 'noun', 308, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00309', 'csat-megastudy-2025', 'harvest', '추수하다, 수확하다; 수확(물)', 'verb', 309, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00310', 'csat-megastudy-2025', 'heartbeat', '심장 박동', 'noun', 310, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00311', 'csat-megastudy-2025', 'hesitation', '망설임, 주저', 'noun', 311, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00312', 'csat-megastudy-2025', 'heuristic', '체험적인', 'adj', 312, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00313', 'csat-megastudy-2025', 'highlight', '강조하다', 'verb', 313, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00314', 'csat-megastudy-2025', 'highly', 'adv. 매우, 대단히', 'adv', 314, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00315', 'csat-megastudy-2025', 'honesty', '정직, 솔직함', 'noun', 315, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00316', 'csat-megastudy-2025', 'hum', '(기계 등이) 윙윙거리며 돌아가다', 'noun', 316, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00317', 'csat-megastudy-2025', 'hunt', '쫓다, 사냥하다, 추적하다; 사냥', 'verb', 317, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00318', 'csat-megastudy-2025', 'imaginatively', '상상을 통해, 창의적으로', 'noun', 318, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00319', 'csat-megastudy-2025', 'imperfect', '불완전한, 결점이 있는', 'adj', 319, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00320', 'csat-megastudy-2025', 'imply', '암시하다', 'verb', 320, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00321', 'csat-megastudy-2025', 'impose', '부과하다; 강요하다', 'verb', 321, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00322', 'csat-megastudy-2025', 'incentive', '장려책, 우대책', 'noun', 322, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00323', 'csat-megastudy-2025', 'indeed', 'adv. 실제로, 참으로', 'adv', 323, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00324', 'csat-megastudy-2025', 'indifferent', '무관심한; 중요하지 않은', 'noun', 324, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00325', 'csat-megastudy-2025', 'indirectly', '간접적으로; 우회적으로', 'noun', 325, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00326', 'csat-megastudy-2025', 'individual', '개별적인, 개인적인', 'adj', 326, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00327', 'csat-megastudy-2025', 'industry', '산업', 'noun', 327, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00328', 'csat-megastudy-2025', 'inevitable', '불가피한, 필연적인', 'adj', 328, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00329', 'csat-megastudy-2025', 'inexperienced', '경험이 부족한, 미숙한', 'noun', 329, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00330', 'csat-megastudy-2025', 'informal', 'a. 비공식적인, 격식을 차리지 않는', 'adj', 330, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00331', 'csat-megastudy-2025', 'ingredient', '성분, 재료', 'noun', 331, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00332', 'csat-megastudy-2025', 'inhabit', '~에 깃들다, ~에 거주하다', 'verb', 332, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00333', 'csat-megastudy-2025', 'inherently', 'adv. 본래의, 타고난', 'adv', 333, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00334', 'csat-megastudy-2025', 'innate', 'a. 선천적인, 내재적인, 본질적인', 'adj', 334, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00335', 'csat-megastudy-2025', 'innovator', '혁신가', 'noun', 335, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00336', 'csat-megastudy-2025', 'inordinate', '과도한, 지나친', 'noun', 336, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00337', 'csat-megastudy-2025', 'insensitive', '둔감한, 무감각한', 'noun', 337, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00338', 'csat-megastudy-2025', 'institute', 'n. 연구소, 협회 v. 만들다, 설립하다', 'noun', 338, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00339', 'csat-megastudy-2025', 'institution', 'n. 기관, 학회, 협회', 'noun', 339, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00340', 'csat-megastudy-2025', 'institutional', 'n. 제도적인, 공공 단체의', 'noun', 340, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00341', 'csat-megastudy-2025', 'intensify', '강화하다', 'verb', 341, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00342', 'csat-megastudy-2025', 'interface', '접점', 'noun', 342, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00343', 'csat-megastudy-2025', 'internal', '마음속의, 내면의;', 'noun', 343, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00344', 'csat-megastudy-2025', 'intervention', 'n. 개입, 조정, 간섭', 'noun', 344, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00345', 'csat-megastudy-2025', 'introduction', 'n. 도입; 소개, 서론', 'noun', 345, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00346', 'csat-megastudy-2025', 'invaluable', '매우 유용한, 귀중한', 'noun', 346, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00347', 'csat-megastudy-2025', 'inventor', '발명가', 'noun', 347, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00348', 'csat-megastudy-2025', 'investigate', 'v. 조사하다, 연구하다', 'verb', 348, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00349', 'csat-megastudy-2025', 'investment', '투자', 'noun', 349, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00350', 'csat-megastudy-2025', 'involvement', '몰입, 몰두; 참여, 관련', 'noun', 350, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00351', 'csat-megastudy-2025', 'iron bar', 'n. 쇠창살', 'noun', 351, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00352', 'csat-megastudy-2025', 'isolate', '분리하다, 격리하다', 'verb', 352, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00353', 'csat-megastudy-2025', 'isolated', '분리된, 격리된', 'noun', 353, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00354', 'csat-megastudy-2025', 'join', '합류하다, 참여하다', 'verb', 354, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00355', 'csat-megastudy-2025', 'know-how', '요령, 노하우', 'noun', 355, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00356', 'csat-megastudy-2025', 'labor', '노동', 'noun', 356, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00357', 'csat-megastudy-2025', 'landowner', '지주, 토지 소유자', 'noun', 357, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00358', 'csat-megastudy-2025', 'lark', 'n. 종달새', 'noun', 358, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00359', 'csat-megastudy-2025', 'lasting', 'a. 지속되는, 영구적인', 'adj', 359, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00360', 'csat-megastudy-2025', 'laundry', '세탁소; 세탁하다', 'verb', 360, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00361', 'csat-megastudy-2025', 'liberty', 'n. 자유, 자립', 'noun', 361, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00362', 'csat-megastudy-2025', 'library', '도서관', 'noun', 362, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00363', 'csat-megastudy-2025', 'licensed', '면허를 받은', 'noun', 363, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00364', 'csat-megastudy-2025', 'lifecycle', '수명 주기, 생애 주기', 'noun', 364, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00365', 'csat-megastudy-2025', 'lifetime', '일생, 생애', 'noun', 365, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00366', 'csat-megastudy-2025', 'likewise', 'adv. 마찬가지로', 'adv', 366, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00367', 'csat-megastudy-2025', 'limit', '제한하다; 한계, 한도', 'verb', 367, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00368', 'csat-megastudy-2025', 'linear', '선형적인, 직선의', 'noun', 368, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00369', 'csat-megastudy-2025', 'linguistic', '언어의, 언어학의', 'noun', 369, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00370', 'csat-megastudy-2025', 'list', '나열하다; 목록, 표', 'verb', 370, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00371', 'csat-megastudy-2025', 'literally', '말(글자) 그대로', 'noun', 371, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00372', 'csat-megastudy-2025', 'literature', '문학, 문헌', 'noun', 372, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00373', 'csat-megastudy-2025', 'location', '장소, 위치, 지역', 'noun', 373, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00374', 'csat-megastudy-2025', 'long-term', '장기간의', 'noun', 374, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00375', 'csat-megastudy-2025', 'luckily', '다행히, 운이 좋게도', 'noun', 375, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00376', 'csat-megastudy-2025', 'mail', 'v. 우송하다 n. 우편물, 우편', 'verb', 376, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00377', 'csat-megastudy-2025', 'major', '주요한, 과반의, 대부분의', 'noun', 377, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00378', 'csat-megastudy-2025', 'manipulate', '조작하다, 조종하다', 'verb', 378, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00379', 'csat-megastudy-2025', 'manner', '방식, 벙밥; 태도, 거동', 'noun', 379, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00380', 'csat-megastudy-2025', 'map out', '~을 정리하다', 'verb', 380, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00381', 'csat-megastudy-2025', 'mark', '표시하다; 표, 기호', 'verb', 381, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00382', 'csat-megastudy-2025', 'mass', '대중의, 집단의; 덩어리, 모임', 'noun', 382, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00383', 'csat-megastudy-2025', 'master', '숙달하다, 통달하다', 'verb', 383, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00384', 'csat-megastudy-2025', 'meaningful', '의미 있는, 중요한', 'adj', 384, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00385', 'csat-megastudy-2025', 'mechanical', '기계적인, 공구의', 'noun', 385, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00386', 'csat-megastudy-2025', 'mediate', '영향을 주다, 중재하다', 'verb', 386, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00387', 'csat-megastudy-2025', 'medium', 'n. 매체 (수단)', 'noun', 387, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00388', 'csat-megastudy-2025', 'merry', 'a. 명랑한, 유쾌한', 'adj', 388, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00389', 'csat-megastudy-2025', 'metaphor', '은유, 비유', 'noun', 389, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00390', 'csat-megastudy-2025', 'minor', '미세한; 중요하지 않은', 'noun', 390, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00391', 'csat-megastudy-2025', 'modeling', 'n. 모형 제작', 'noun', 391, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00392', 'csat-megastudy-2025', 'monitor', '감시하다, 감독하다', 'verb', 392, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00393', 'csat-megastudy-2025', 'monument', 'n. 기념비, 유적', 'noun', 393, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00394', 'csat-megastudy-2025', 'mood', 'once 주어+동사', 'noun', 394, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00395', 'csat-megastudy-2025', 'moral', 'a. 도덕의, 도덕적인', 'adj', 395, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00396', 'csat-megastudy-2025', 'motivation', '이유, 동기', 'noun', 396, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00397', 'csat-megastudy-2025', 'natural', '천연의, 자연의', 'noun', 397, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00398', 'csat-megastudy-2025', 'nature', 'n. 본질, 성질; 자연', 'noun', 398, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00399', 'csat-megastudy-2025', 'nearly', 'adv. 거의, 대략', 'adv', 399, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00400', 'csat-megastudy-2025', 'need', '필요; 필요하다', 'verb', 400, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00401', 'csat-megastudy-2025', 'network', '방송국, 방송망', 'noun', 401, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00402', 'csat-megastudy-2025', 'networked', '네트워크로 연결된', 'noun', 402, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00403', 'csat-megastudy-2025', 'notice', '알아차리다', 'noun', 403, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00404', 'csat-megastudy-2025', 'notion', 'n. 개념, 관념', 'noun', 404, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00405', 'csat-megastudy-2025', 'notwithstanding', '~에도 불구하고', 'noun', 405, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00406', 'csat-megastudy-2025', 'novel', '소설; 새로운, 기발한', 'noun', 406, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00407', 'csat-megastudy-2025', 'observe', '관찰하다; 지키다, 준수하다', 'verb', 407, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00408', 'csat-megastudy-2025', 'obtain', '얻다, 획득하다', 'verb', 408, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00409', 'csat-megastudy-2025', 'obvious', '명백한, 명확한, 명료한', 'noun', 409, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00410', 'csat-megastudy-2025', 'occupy', '차지하다; 점령하다', 'verb', 410, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00411', 'csat-megastudy-2025', 'offer', '내놓다, 제공하다', 'verb', 411, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00412', 'csat-megastudy-2025', 'online', '온라인에서', 'noun', 412, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00413', 'csat-megastudy-2025', 'organize', '정리하다, 체계화하다', 'verb', 413, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00414', 'csat-megastudy-2025', 'origin', '원산지, 출처', 'noun', 414, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00415', 'csat-megastudy-2025', 'originally', '원래, 본래', 'noun', 415, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00416', 'csat-megastudy-2025', 'output', '생산량, 산출량', 'noun', 416, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00417', 'csat-megastudy-2025', 'overuse', '과용하다', 'verb', 417, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00418', 'csat-megastudy-2025', 'overwhelm', 'v. 압도하다, 제압하다', 'verb', 418, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00419', 'csat-megastudy-2025', 'pad-to-pad', '손가락 끝 살이 맞닿는', 'noun', 419, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00420', 'csat-megastudy-2025', 'paper', 'n. 논문, 논설', 'noun', 420, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00421', 'csat-megastudy-2025', 'partner', '동업자', 'noun', 421, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00422', 'csat-megastudy-2025', 'party', '당사자', 'noun', 422, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00423', 'csat-megastudy-2025', 'pattern', '양식', 'noun', 423, 2, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00424', 'csat-megastudy-2025', 'peer', 'n. 동료, 또래', 'noun', 424, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00425', 'csat-megastudy-2025', 'per', '~당, ~마다', 'noun', 425, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00426', 'csat-megastudy-2025', 'percentage', '비율', 'noun', 426, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00427', 'csat-megastudy-2025', 'perception', '인식, 지각(력)', 'noun', 427, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00428', 'csat-megastudy-2025', 'performance', '수행, 실행; 성적, 성과', 'noun', 428, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00429', 'csat-megastudy-2025', 'personality', '개인, 인간; 성격, 특성', 'noun', 429, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00430', 'csat-megastudy-2025', 'perspective', '관점, 시각', 'noun', 430, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00431', 'csat-megastudy-2025', 'persuasive', 'a. 설득력이 있는', 'adj', 431, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00432', 'csat-megastudy-2025', 'pharmacy', 'n. 약국', 'noun', 432, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00433', 'csat-megastudy-2025', 'phenomenon', 'n. 현상', 'noun', 433, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00434', 'csat-megastudy-2025', 'philosopher', 'n. 철학자', 'noun', 434, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00435', 'csat-megastudy-2025', 'phrase', '어구, 관용구', 'noun', 435, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00436', 'csat-megastudy-2025', 'physical', '실물의, 물리적인', 'adj', 436, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00437', 'csat-megastudy-2025', 'picture', '상상하다', 'verb', 437, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00438', 'csat-megastudy-2025', 'piecemeal', '단편적인', 'adj', 438, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00439', 'csat-megastudy-2025', 'pinpoint', '정확히 지적하다', 'verb', 439, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00440', 'csat-megastudy-2025', 'pleasant', '쾌적한, 즐거운, 기분 좋은', 'noun', 440, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00441', 'csat-megastudy-2025', 'point out', '~을 지적하다, ~을 말하다', 'verb', 441, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00442', 'csat-megastudy-2025', 'pointy', '끝이 뾰족한', 'noun', 442, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00443', 'csat-megastudy-2025', 'policy', 'n. 정책, 방침', 'noun', 443, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00444', 'csat-megastudy-2025', 'politely', '공손하게, 예의 바르게', 'noun', 444, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00445', 'csat-megastudy-2025', 'pollution', 'n. 오염', 'noun', 445, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00446', 'csat-megastudy-2025', 'position', '지위, 위치', 'noun', 446, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00447', 'csat-megastudy-2025', 'possess', '소유하다, 보유하다', 'verb', 447, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00448', 'csat-megastudy-2025', 'possession', '소유, 점유', 'noun', 448, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00449', 'csat-megastudy-2025', 'practicing', '활동하고 있는', 'adj', 449, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00450', 'csat-megastudy-2025', 'predominantly', '주로, 대부분', 'noun', 450, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00451', 'csat-megastudy-2025', 'prefer', '선호하다', 'verb', 451, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00452', 'csat-megastudy-2025', 'pressure', '압박; 압력, 압축', 'noun', 452, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00453', 'csat-megastudy-2025', 'previously', '이전에', 'noun', 453, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00454', 'csat-megastudy-2025', 'primate', '영장류', 'noun', 454, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00455', 'csat-megastudy-2025', 'producer', '제작자', 'noun', 455, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00456', 'csat-megastudy-2025', 'productivity', '생산성', 'noun', 456, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00457', 'csat-megastudy-2025', 'profession', '직업', 'noun', 457, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00458', 'csat-megastudy-2025', 'profit', '수익', 'noun', 458, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00459', 'csat-megastudy-2025', 'prolong', '연장하다', 'verb', 459, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00460', 'csat-megastudy-2025', 'proposal', 'n. 제안서; 제안, 제의', 'noun', 460, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00461', 'csat-megastudy-2025', 'proprietary', '독점의, 독점적인', 'adj', 461, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00462', 'csat-megastudy-2025', 'prospect', 'n. 가능성, 전망', 'noun', 462, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00463', 'csat-megastudy-2025', 'protection', '보호', 'noun', 463, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00464', 'csat-megastudy-2025', 'provided', '~이라는 조건에서', 'noun', 464, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00465', 'csat-megastudy-2025', 'psychological', '심리의, 심리적인', 'adj', 465, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00466', 'csat-megastudy-2025', 'psychologist', 'n. 심리학자', 'noun', 466, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00467', 'csat-megastudy-2025', 'pursue', '추구하다', 'verb', 467, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00468', 'csat-megastudy-2025', 'put A to use', 'A를 이용하다', 'verb', 468, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00469', 'csat-megastudy-2025', 'quality', '질', 'noun', 469, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00470', 'csat-megastudy-2025', 'quantitative', 'a. 양적인', 'adj', 470, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00471', 'csat-megastudy-2025', 'quest', 'n. 탐구, 탐색', 'noun', 471, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00472', 'csat-megastudy-2025', 'quickly', '빨리, 곧', 'noun', 472, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00473', 'csat-megastudy-2025', 'quietly', '조용히', 'noun', 473, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00474', 'csat-megastudy-2025', 'range', '범위', 'noun', 474, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00475', 'csat-megastudy-2025', 'rare', 'a. 드문, 희귀한', 'adj', 475, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00476', 'csat-megastudy-2025', 'rarely', '드물게, 좀처럼 ~하지 않는', 'noun', 476, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00477', 'csat-megastudy-2025', 'rate', 'v. 평가하다 n. 비율; 속도', 'verb', 477, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00478', 'csat-megastudy-2025', 'rational', 'a. 합리적인; 이성적인', 'adj', 478, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00479', 'csat-megastudy-2025', 'reach', '도달하다', 'verb', 479, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00480', 'csat-megastudy-2025', 'react', '반응하다', 'verb', 480, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00481', 'csat-megastudy-2025', 'reasonably', '합리적으로', 'noun', 481, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00482', 'csat-megastudy-2025', 'reciprocity', 'n. 상호 호혜', 'noun', 482, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00483', 'csat-megastudy-2025', 'recognize', '인정하다', 'verb', 483, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00484', 'csat-megastudy-2025', 'recommend', '추천하다', 'verb', 484, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00485', 'csat-megastudy-2025', 'reduce', '줄이다', 'noun', 485, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00486', 'csat-megastudy-2025', 'reduction', '축소, 삭감, 감소', 'noun', 486, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00487', 'csat-megastudy-2025', 'refer to', '~을 언급하다', 'verb', 487, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00488', 'csat-megastudy-2025', 'refundable', '환불이 가능한', 'noun', 488, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00489', 'csat-megastudy-2025', 'refusal', 'n. 거부, 거절', 'noun', 489, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00490', 'csat-megastudy-2025', 'register', 'v. 등록하다', 'verb', 490, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00491', 'csat-megastudy-2025', 'regulate', '조절하다, 조정하다; 규제하다', 'verb', 491, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00492', 'csat-megastudy-2025', 'relatively', '상대적으로', 'noun', 492, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00493', 'csat-megastudy-2025', 'release', '공개하다, 발표하다', 'verb', 493, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00494', 'csat-megastudy-2025', 'relegate', '추방하다', 'verb', 494, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00495', 'csat-megastudy-2025', 'religious view', 'n. 종교관', 'noun', 495, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00496', 'csat-megastudy-2025', 'remain', '남아 있다', 'noun', 496, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00497', 'csat-megastudy-2025', 'remind', '상기시키다', 'noun', 497, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00498', 'csat-megastudy-2025', 'remote', '외진', 'noun', 498, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00499', 'csat-megastudy-2025', 'reorient', '방향을 바꾸다', 'noun', 499, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00500', 'csat-megastudy-2025', 'repair', '수리', 'noun', 500, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00501', 'csat-megastudy-2025', 'repositioning', '재배치, 위치 재선정', 'noun', 501, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00502', 'csat-megastudy-2025', 'repurpose', '~의 용도 변경을 하다', 'verb', 502, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00503', 'csat-megastudy-2025', 'reservation', '예약', 'noun', 503, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00504', 'csat-megastudy-2025', 'resolution', '해결, 해답; 결심, 결의', 'noun', 504, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00505', 'csat-megastudy-2025', 'resource', '자원, 물자', 'noun', 505, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00506', 'csat-megastudy-2025', 'respondent', 'n. 응답자', 'noun', 506, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00507', 'csat-megastudy-2025', 'resultant', 'a. 그 결과로 생기는', 'adj', 507, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00508', 'csat-megastudy-2025', 'reverse', '(정)반대, 역', 'noun', 508, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00509', 'csat-megastudy-2025', 'revise', '수정하다, 개정하다', 'verb', 509, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00510', 'csat-megastudy-2025', 'rework', '다시 만들다, 재가공하다', 'verb', 510, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00511', 'csat-megastudy-2025', 'ritual', 'a. 의식의; 관습의', 'adj', 511, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00512', 'csat-megastudy-2025', 'rotation', '회전; 자전', 'noun', 512, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00513', 'csat-megastudy-2025', 'rule-based', '규칙에 기초된', 'noun', 513, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00514', 'csat-megastudy-2025', 'safely', '무사히, 탈 없이', 'noun', 514, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00515', 'csat-megastudy-2025', 'safety', '안전성', 'noun', 515, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00516', 'csat-megastudy-2025', 'scan', '탐지하다, 관찰하다', 'verb', 516, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00517', 'csat-megastudy-2025', 'scholarly', '학문적인, 학술적인', 'adj', 517, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00518', 'csat-megastudy-2025', 'scholarship', '학문, 학식', 'noun', 518, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00519', 'csat-megastudy-2025', 'score', '악보; (음악) 작품', 'noun', 519, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00520', 'csat-megastudy-2025', 'scratch', 'v. 긁다, 할퀴다', 'verb', 520, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00521', 'csat-megastudy-2025', 'scream', 'v. 비명을 지르다, 소리치다', 'verb', 521, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00522', 'csat-megastudy-2025', 'secretive', '비밀스러운, 숨기는', 'noun', 522, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00523', 'csat-megastudy-2025', 'secure', '안전한, 확실한', 'noun', 523, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00524', 'csat-megastudy-2025', 'seize', 'v. 붙잡다; 포착하다', 'verb', 524, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00525', 'csat-megastudy-2025', 'self-portrait', '자화상', 'noun', 525, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00526', 'csat-megastudy-2025', 'sense', '의미, 뜻; 감각, 느낌', 'noun', 526, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00527', 'csat-megastudy-2025', 'setting', '환경[장소], 배경', 'noun', 527, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00528', 'csat-megastudy-2025', 'shadow', '그림자, 환영', 'noun', 528, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00529', 'csat-megastudy-2025', 'shamanistic', 'a. 무속의, 주술적인', 'adj', 529, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00530', 'csat-megastudy-2025', 'share', '(생각을) 나누다, 말하다', 'verb', 530, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00531', 'csat-megastudy-2025', 'short-term', '단기적인', 'adj', 531, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00532', 'csat-megastudy-2025', 'shuttle', '정기 왕복 교통 수단', 'noun', 532, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00533', 'csat-megastudy-2025', 'signature', '특징; 서명', 'noun', 533, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00534', 'csat-megastudy-2025', 'significance', '중요성, 중대성', 'noun', 534, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00535', 'csat-megastudy-2025', 'significantly', '훨씬, 상당히', 'noun', 535, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00536', 'csat-megastudy-2025', 'simplistic', '(지나치게) 단순한', 'noun', 536, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00537', 'csat-megastudy-2025', 'simultaneously', 'adv. 동시에, 일제히', 'adv', 537, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00538', 'csat-megastudy-2025', 'skilled', '능숙한, 숙련된', 'noun', 538, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00539', 'csat-megastudy-2025', 'slide', '미끄럼틀', 'noun', 539, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00540', 'csat-megastudy-2025', 'slippery', '미끄러운, 미끈거리는', 'noun', 540, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00541', 'csat-megastudy-2025', 'smooth', '완화하다 매끄러운; 부드러운', 'verb', 541, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00542', 'csat-megastudy-2025', 'smoothly', '(아무 문제없이) 순조롭게', 'noun', 542, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00543', 'csat-megastudy-2025', 'social proof', 'n. 사회적 증거', 'noun', 543, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00544', 'csat-megastudy-2025', 'sole', 'a. 오로지, 유일한 n. 발바닥, 굽', 'adj', 544, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00545', 'csat-megastudy-2025', 'specific', 'a. 특정한, 구체적인', 'adj', 545, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00546', 'csat-megastudy-2025', 'specifically', '구체적으로', 'noun', 546, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00547', 'csat-megastudy-2025', 'sportscaster', '스포츠 방송인', 'noun', 547, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00548', 'csat-megastudy-2025', 'sportscasting', '스포츠 방송', 'noun', 548, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00549', 'csat-megastudy-2025', 'statement', '성명, 진술', 'noun', 549, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00550', 'csat-megastudy-2025', 'stationary bicycle', 'n. 고정 자전거', 'noun', 550, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00551', 'csat-megastudy-2025', 'status', '지위; 상태, 사정', 'noun', 551, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00552', 'csat-megastudy-2025', 'stream', 'n. 개울, 시내', 'noun', 552, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00553', 'csat-megastudy-2025', 'strike', '두드리기, 치기', 'noun', 553, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00554', 'csat-megastudy-2025', 'structured', 'a. 체계화된', 'adj', 554, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00555', 'csat-megastudy-2025', 'subsequent', 'a. 이후의, 후속의, 차후의', 'adj', 555, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00556', 'csat-megastudy-2025', 'substance', '실체, 본질; 물질, 물체', 'noun', 556, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00557', 'csat-megastudy-2025', 'substitute A for B', 'B를 대신하여 A를 쓰다', 'noun', 557, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00558', 'csat-megastudy-2025', 'sufficiently', '충분히', 'noun', 558, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00559', 'csat-megastudy-2025', 'superficial', '피상적인; 표면상의, 외면의', 'noun', 559, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00560', 'csat-megastudy-2025', 'support', '지원하다, 지지하다; 지지, 지원', 'verb', 560, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00561', 'csat-megastudy-2025', 'supposed', 'a. 가정된, 추정된, 가상의', 'adj', 561, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00562', 'csat-megastudy-2025', 'surely', 'adv. 확실히, 분명히', 'adv', 562, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00563', 'csat-megastudy-2025', 'suspend', 'v. 중지하다; 매달다, 걸다', 'verb', 563, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00564', 'csat-megastudy-2025', 'sustained', '지속된', 'noun', 564, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00565', 'csat-megastudy-2025', 'symbolically', '상징적으로', 'noun', 565, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00566', 'csat-megastudy-2025', 'synchronize', 'v. 동조하다; 동시에 발생하다', 'verb', 566, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00567', 'csat-megastudy-2025', 'taint', '더럽히다', 'noun', 567, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00568', 'csat-megastudy-2025', 'tear', 'v. 상처를 내다, 찢다 n. 눈물', 'verb', 568, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00569', 'csat-megastudy-2025', 'tension', '갈등, 긴장 관계', 'noun', 569, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00570', 'csat-megastudy-2025', 'test', '테스트하다, 검사하다', 'verb', 570, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00571', 'csat-megastudy-2025', 'thoroughly', '온전하게, 완전히, 충분히', 'noun', 571, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00572', 'csat-megastudy-2025', 'threat', '위협, 협박', 'noun', 572, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00573', 'csat-megastudy-2025', 'throughout', '내내, ~동안 쭉', 'noun', 573, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00574', 'csat-megastudy-2025', 'thumb', '엄지손가락', 'noun', 574, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00575', 'csat-megastudy-2025', 'toe-to-toe', '정면으로 맞붙어', 'noun', 575, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00576', 'csat-megastudy-2025', 'tool', '도구, 수단', 'noun', 576, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00577', 'csat-megastudy-2025', 'trait', '특성, 특징', 'noun', 577, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00578', 'csat-megastudy-2025', 'translate', '번역하다, 옮기다', 'verb', 578, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00579', 'csat-megastudy-2025', 'transparent', '투명한', 'noun', 579, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00580', 'csat-megastudy-2025', 'trap', '포착하다; 덫, 함정', 'verb', 580, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00581', 'csat-megastudy-2025', 'travel', '여행; 여행하다', 'verb', 581, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00582', 'csat-megastudy-2025', 'tremendous', 'a. 엄청난; 무서운', 'adj', 582, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00583', 'csat-megastudy-2025', 'trustee', '신탁 관리자', 'noun', 583, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00584', 'csat-megastudy-2025', 'tunnel', '터널', 'noun', 584, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00585', 'csat-megastudy-2025', 'typical', 'a. 전형적인, 모범적인', 'adj', 585, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00586', 'csat-megastudy-2025', 'typically', '일반적으로, 전형적으로', 'noun', 586, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00587', 'csat-megastudy-2025', 'uncomfortable', '불편한, 거북한', 'noun', 587, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00588', 'csat-megastudy-2025', 'undergo', '겪다, 경험하다', 'verb', 588, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00589', 'csat-megastudy-2025', 'undergraduate degree', 'n. 학사 학위', 'noun', 589, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00590', 'csat-megastudy-2025', 'underpinning', '기반, 기초', 'noun', 590, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00591', 'csat-megastudy-2025', 'underreport', '축소보고하다', 'verb', 591, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00592', 'csat-megastudy-2025', 'understand', '이해하다', 'verb', 592, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00593', 'csat-megastudy-2025', 'underworld', 'n. 지하 세계, 하계', 'noun', 593, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00594', 'csat-megastudy-2025', 'uneasiness', '불안, 걱정, 불쾌', 'noun', 594, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00595', 'csat-megastudy-2025', 'unfortunately', '불행하게도, 유감스럽게도', 'noun', 595, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00596', 'csat-megastudy-2025', 'unique', '고유한, 독특한', 'noun', 596, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00597', 'csat-megastudy-2025', 'universal', '보편적인, 일반적인; 전세계적인', 'adj', 597, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00598', 'csat-megastudy-2025', 'universally', '일반적으로, 누구에게서나', 'noun', 598, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00599', 'csat-megastudy-2025', 'upward', '상향의, 상승의', 'noun', 599, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00600', 'csat-megastudy-2025', 'urban', '도시에 사는, 도시의', 'noun', 600, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00601', 'csat-megastudy-2025', 'urbanism', 'n. 도시화', 'noun', 601, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00602', 'csat-megastudy-2025', 'utilization', '활용, 이용', 'noun', 602, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00603', 'csat-megastudy-2025', 'validate', 'v. 확인하다; 유효하게 하다', 'verb', 603, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00604', 'csat-megastudy-2025', 'valley', '계곡, 골짜기', 'noun', 604, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00605', 'csat-megastudy-2025', 'valuable', '가치 있는, 귀중한', 'adj', 605, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00606', 'csat-megastudy-2025', 'valuation', 'n. 평가, 가치 판단', 'noun', 606, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00607', 'csat-megastudy-2025', 'value', '가치; 가격; 평가하다, 값을 치다', 'verb', 607, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00608', 'csat-megastudy-2025', 'variation', '변동성, 변화, 차이', 'noun', 608, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00609', 'csat-megastudy-2025', 'vary', '달라지다, 다르다', 'noun', 609, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00610', 'csat-megastudy-2025', 'violate', '위반하다, 어기다', 'verb', 610, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00611', 'csat-megastudy-2025', 'virtual', 'a. 가상의', 'adj', 611, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00612', 'csat-megastudy-2025', 'virtually', 'adv. 사실상, 실질적으로', 'adv', 612, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00613', 'csat-megastudy-2025', 'visual', '시각의, 시력의', 'noun', 613, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00614', 'csat-megastudy-2025', 'vocabulary', '어휘', 'noun', 614, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00615', 'csat-megastudy-2025', 'volume', '양; 부피, 크기', 'noun', 615, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00616', 'csat-megastudy-2025', 'well-defined', '잘 정의된', 'noun', 616, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00617', 'csat-megastudy-2025', 'whistle', 'v. 휘파람을 불다', 'verb', 617, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00618', 'csat-megastudy-2025', 'whitening strip', 'n. 부착형 (치아) 미백제', 'noun', 618, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00619', 'csat-megastudy-2025', 'whole', '전체의; 전체, 전부', 'noun', 619, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00620', 'csat-megastudy-2025', 'wish', '바라다, 원하다; 소원, 소망', 'verb', 620, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00621', 'csat-megastudy-2025', 'workday', '작업일', 'noun', 621, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00622', 'csat-megastudy-2025', 'worldly', 'a. 세속적인, 속세의', 'adj', 622, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00623', 'csat-megastudy-2025', 'writer', '작가, 저자', 'noun', 623, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00624', 'csat-megastudy-2025', 'as for', '~에 관해 말하자면', 'noun', 624, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00625', 'csat-megastudy-2025', 'at hand', '당면한', 'noun', 625, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00626', 'csat-megastudy-2025', 'be admitted', '입학하다', 'verb', 626, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00627', 'csat-megastudy-2025', 'be aware of', '의식하다, 인지하다', 'verb', 627, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00628', 'csat-megastudy-2025', 'be derived from', '~에서 유래하다', 'verb', 628, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00629', 'csat-megastudy-2025', 'be likely to', '~할 가능성이 있다', 'noun', 629, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00630', 'csat-megastudy-2025', 'be satisfied with', '~에 만족하다', 'verb', 630, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00631', 'csat-megastudy-2025', 'be willing to', '기꺼이 ~하다', 'verb', 631, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00632', 'csat-megastudy-2025', 'in general', '전반적으로', 'noun', 632, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00633', 'csat-megastudy-2025', 'in the absence of', '~이 없을 때는', 'noun', 633, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00634', 'csat-megastudy-2025', 'in turn', '결국', 'noun', 634, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  'cw-csat-megastudy-2025-00635', 'csat-megastudy-2025', 'in vain', '허사가 되어', 'noun', 635, 3, NULL
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;
