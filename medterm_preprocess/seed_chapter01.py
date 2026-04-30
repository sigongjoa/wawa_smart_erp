"""Ch.01 시드 스크립트 — JSON → SQL INSERT

입력:
  - output/pages_1_to_20.json (책 본문 추출)
  - output/exam_30q.json (단원평가 30문항)

출력:
  - output/059_seed_chapter01.sql — 적용 가능한 INSERT 문 모음
  - 또는 --apply 시 wrangler d1 execute 로 직접 적용 (선택)

스키마: workers/migrations/059_medterm_system.sql 참조
"""
import json
import re
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGES_JSON = ROOT / 'output' / 'pages_1_to_20.json'
EXAM_JSON = ROOT / 'output' / 'exam_30q.json'

BOOK_ID = 'med-basic'
BOOK_TITLE = '보건의료인을 위한 기초 의학용어'
CHAPTER_ID = 'med-basic-ch01'
CHAPTER_NO = 1
CHAPTER_TITLE = '단어의 요소와 단어 구성의 이해'


def sql_str(s):
    """SQL 문자열 리터럴 — None은 NULL, 작은따옴표는 이스케이프."""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def sql_int(n):
    return 'NULL' if n is None else str(int(n))


def slugify_part(role: str, value: str) -> str:
    """'cardi/o' → 'wp-r-cardi-o'"""
    cleaned = re.sub(r'[^a-zA-Z0-9]+', '-', value).strip('-').lower()
    return f'wp-{role}-{cleaned}'


def slugify_term(term: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9-]+', '-', term).strip('-').lower()
    return f'mt-{cleaned}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT / 'output' / '059_seed_chapter01.sql'))
    args = ap.parse_args()

    pages = json.load(open(PAGES_JSON, encoding='utf-8'))
    exam = json.load(open(EXAM_JSON, encoding='utf-8'))

    stmts = ['-- ===== Ch.01 시드 (자동 생성) =====',
             '-- 적용: wrangler d1 execute wawa-smart-erp --remote --file=output/059_seed_chapter01.sql',
             '']

    # ── 1. 교재 + 챕터 ─────────────────────────────────────────
    stmts.append('-- 교재')
    stmts.append(
        f"INSERT OR IGNORE INTO med_books(id,title,publisher,field) "
        f"VALUES({sql_str(BOOK_ID)},{sql_str(BOOK_TITLE)},NULL,'간호/보건');"
    )
    stmts.append('')
    stmts.append('-- 챕터')
    stmts.append(
        f"INSERT OR IGNORE INTO med_chapters(id,book_id,chapter_no,title,page_start,page_end,objectives) "
        f"VALUES({sql_str(CHAPTER_ID)},{sql_str(BOOK_ID)},{CHAPTER_NO},"
        f"{sql_str(CHAPTER_TITLE)},1,15,"
        f"{sql_str('의학용어 요소·구성·조합어/비조합어 구분·접두사/어근/접미사 구분')});"
    )
    stmts.append('')

    # ── 2. 단어 요소 (pages_1_to_20.json scan_page=17 의 reference_table) ────
    stmts.append('-- 단어 요소 (접두사·어근/결합형·접미사)')
    parts_table = next(p for p in pages['pages'] if p['scan_page'] == 17)
    part_id_map = {}  # (role, value) → id

    for p in parts_table.get('prefixes', []):
        role = 'p'
        value = p['prefix']
        meaning = p['meaning']
        pid = slugify_part(role, value)
        part_id_map[(role, value)] = pid
        stmts.append(
            f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko) "
            f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},'p',{sql_str(value)},{sql_str(meaning)});"
        )

    for r in parts_table.get('roots_combining_forms', []):
        # 'append/o, appendic/o' 같이 다중 표기는 '/'로 split
        primary = r['form'].split(',')[0].strip()
        role = 'r'
        pid = slugify_part(role, primary)
        part_id_map[(role, primary)] = pid
        # 'cardi/o' 형태면 그대로, 단일 어근(예: 'lith')도 허용
        stmts.append(
            f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko) "
            f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},'r',{sql_str(primary)},{sql_str(r['meaning'])});"
        )

    for s in parts_table.get('suffixes', []):
        role = 's'
        value = s['suffix']
        pid = slugify_part(role, value)
        part_id_map[(role, value)] = pid
        stmts.append(
            f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko) "
            f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},'s',{sql_str(value)},{sql_str(s['meaning'])});"
        )

    # 표 1-1 어원 어근 (scan_page=20)
    table_1_1_page = next((p for p in pages['pages'] if p['scan_page'] == 20), None)
    if table_1_1_page and 'table_1_1' in table_1_1_page:
        for row in table_1_1_page['table_1_1']['rows']:
            role = 'r'
            value = row['root']
            if (role, value) in part_id_map:
                continue
            pid = slugify_part(role, value)
            part_id_map[(role, value)] = pid
            stmts.append(
                f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko,origin,origin_word) "
                f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},'r',{sql_str(value)},{sql_str(row['meaning'])},"
                f"{sql_str(row['origin'].split(',')[-1].strip() if ',' in row['origin'] else None)},"
                f"{sql_str(row['origin'].split(',')[0].strip() if ',' in row['origin'] else row['origin'])});"
            )

    stmts.append('')

    # ── 3. 의학용어 + 합성 (exam_30q.json 의 parts 배열 기반) ─────────────
    stmts.append('-- 의학용어 + 합성 링크 (출제 문항에 등장한 분해 가능 용어)')
    seen_terms = set()
    for q in exam['questions']:
        if q.get('type') != '용어분해' or 'parts' not in q:
            continue
        # question 에서 용어 추출 — 'cardiology' 같은 단일 단어
        m = re.search(r'분리하시오:\s*([a-zA-Z-]+)', q['question'])
        if not m:
            continue
        term = m.group(1)
        if term in seen_terms:
            continue
        seen_terms.add(term)
        term_id = slugify_term(term)
        # 의미 추론 — exam answer/explanation 에서 한국어 의미 시도
        meaning_ko = None
        if 'explanation' in q:
            m2 = re.search(r"→\s*'?([^'.]+)", q['explanation'])
            if m2:
                meaning_ko = m2.group(1).strip()
        stmts.append(
            f"INSERT OR IGNORE INTO med_terms(id,chapter_id,term,meaning_ko,is_constructed) "
            f"VALUES({sql_str(term_id)},{sql_str(CHAPTER_ID)},{sql_str(term)},"
            f"{sql_str(meaning_ko or '— (미입력)')},1);"
        )
        # 합성 링크
        for pos, part in enumerate(q['parts']):
            role = part['role']
            value = part['value']
            # cv 의 'o' 같은 결합모음은 part_id_map 에 없을 수 있음 → 동적 생성
            if (role, value) not in part_id_map:
                pid = slugify_part(role, value)
                part_id_map[(role, value)] = pid
                stmts.append(
                    f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko) "
                    f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},{sql_str(role)},{sql_str(value)},"
                    f"{sql_str(part.get('meaning') or part.get('label_ko') or '')});"
                )
            link_id = f'tp-{term_id[3:]}-{pos}'
            stmts.append(
                f"INSERT OR IGNORE INTO med_term_parts(id,term_id,part_id,position) "
                f"VALUES({sql_str(link_id)},{sql_str(term_id)},{sql_str(part_id_map[(role,value)])},{pos});"
            )
    stmts.append('')

    # ── 4. 복수형 규칙이 적용된 용어 (page 16) ──────────────────────────
    stmts.append('-- 복수형 단어 (vertebra → vertebrae 등)')
    plurals_page = next((p for p in pages['pages'] if p['scan_page'] == 16), None)
    if plurals_page:
        for t in plurals_page.get('terms', []):
            term = t['en'].split()[0]  # 'vertebrae' → 'vertebrae'
            # 단수형은 rule 에서 추출 — 단순화: rule 첫 단어
            rule_text = t.get('rule', '')
            m = re.match(r'단수\s+(\S+)\s*→\s*복수\s+(\S+)', rule_text)
            if not m:
                continue
            singular, plural = m.group(1), m.group(2)
            term_id = slugify_term(singular)
            if singular in seen_terms:
                # 이미 있으면 plural_form/plural_rule UPDATE
                stmts.append(
                    f"UPDATE med_terms SET plural_form={sql_str(plural)},"
                    f"plural_rule={sql_str(rule_text)} WHERE id={sql_str(term_id)};"
                )
            else:
                seen_terms.add(singular)
                stmts.append(
                    f"INSERT OR IGNORE INTO med_terms(id,chapter_id,term,meaning_ko,plural_form,plural_rule) "
                    f"VALUES({sql_str(term_id)},{sql_str(CHAPTER_ID)},{sql_str(singular)},"
                    f"{sql_str(t.get('ko', singular))},{sql_str(plural)},{sql_str(rule_text)});"
                )
    stmts.append('')

    # ── 5. 출제 문항 (exam_30q.json 의 30문항 전체) ─────────────────────
    stmts.append('-- 단원평가 출제 문항')
    for q in exam['questions']:
        body = {k: v for k, v in q.items() if k in
                ('choices', 'items', 'options', 'parts', 'questions', 'available_parts',
                 'definitions', 'answer_form', 'rule', 'plural_rules')}
        ans = q.get('answer')
        item_id = f'ei-ch01-{q["no"]:03d}'
        stmts.append(
            f"INSERT OR IGNORE INTO med_exam_items"
            f"(id,chapter_id,no,type,topic,difficulty,question,body_json,answer_json,explanation) "
            f"VALUES({sql_str(item_id)},{sql_str(CHAPTER_ID)},{q['no']},"
            f"{sql_str(q['type'])},{sql_str(q.get('topic'))},{sql_str(q['difficulty'])},"
            f"{sql_str(q['question'])},{sql_str(json.dumps(body, ensure_ascii=False))},"
            f"{sql_str(json.dumps(ans, ensure_ascii=False))},"
            f"{sql_str(q.get('explanation'))});"
        )
    stmts.append('')

    # ── 6. 그림 메타데이터 (R2 업로드는 별도 작업 — 본 시드는 메타만) ──
    stmts.append('-- 그림 메타 (R2 업로드는 별도)')
    for fig in [
        ('fig-ch01-1-1', '그림 1-1', '조합어/비조합어 일러스트', 'illustration', 'page_008_fig_1-1.jpg'),
        ('fig-ch01-1-2', '그림 1-2', 'construction 분해 다이어그램', 'diagram', 'page_010_fig_1-2.jpg'),
        ('fig-ch01-1-3', '그림 1-3', '인체 결합형 라벨', 'anatomy', 'page_012_fig_1-3.jpg'),
        ('fig-ch01-1-4', '그림 1-4', '히포크라테스 흉상', 'illustration', 'page_020_fig_1-4.jpg'),
    ]:
        fid, label, caption, ftype, fname = fig
        # R2 키는 academy 별로 다름 — 시드 시에는 placeholder, 업로드 시 갱신
        stmts.append(
            f"INSERT OR IGNORE INTO med_figures(id,chapter_id,label,caption,fig_type,r2_key) "
            f"VALUES({sql_str(fid)},{sql_str(CHAPTER_ID)},{sql_str(label)},"
            f"{sql_str(caption)},{sql_str(ftype)},{sql_str(f'medterm/_pending/{fid}.jpg')});"
        )

    # 인체 해부도 라벨 10개 (fig_1-3)
    body_page = next((p for p in pages['pages'] if p['scan_page'] == 12), None)
    label_anchors = [  # 그림 1-3 위에서의 대략 좌표 (이미지에서 읽은 좌표 비율)
        ('Encephal/o', 'Encephal/o = brain 뇌',  0.62, 0.13),
        ('Ocul/o',    'Ocul/o = eye 눈',         0.65, 0.16),
        ('Ot/o',      'Ot/o = ear 귀',           0.32, 0.16),
        ('Trache/o',  'Trache/o = trachea 기관', 0.66, 0.20),
        ('Bronch/o',  'Bronch/o = bronchus 기관지', 0.30, 0.27),
        ('Angi/o',    'Angi/o = vessel 혈관',    0.38, 0.23),
        ('Cardi/o',   'Cardi/o = heart 심장',    0.65, 0.27),
        ('Gastr/o',   'Gastr/o = stomach 위장',  0.65, 0.31),
        ('Muscul/o',  'Muscul/o = muscle 근육',  0.30, 0.55),
        ('Oste/o',    'Oste/o = bone 뼈',        0.65, 0.59),
    ]
    for i, (key, text, x, y) in enumerate(label_anchors):
        lid = f'fl-ch01-1-3-{i+1:02d}'
        value = key.lower()
        # 표 17 reference_table 에 없는 결합형 (trache/o, ocul/o, ot/o, oste/o,
        # muscul/o, angi/o, bronch/o)은 그림 1-3 에서만 등장 → 동적 생성
        if ('r', value) not in part_id_map:
            pid = slugify_part('r', value)
            part_id_map[('r', value)] = pid
            # text 에서 의미 추출: 'Cardi/o = heart 심장' → '심장'
            m = re.search(r'=\s*\w+\s+(\S+)', text)
            meaning = m.group(1) if m else ''
            stmts.append(
                f"INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko) "
                f"VALUES({sql_str(pid)},{sql_str(CHAPTER_ID)},'r',{sql_str(value)},{sql_str(meaning)});"
            )
        part_id = part_id_map[('r', value)]
        stmts.append(
            f"INSERT OR IGNORE INTO med_figure_labels(id,figure_id,part_id,x_ratio,y_ratio,text) "
            f"VALUES({sql_str(lid)},'fig-ch01-1-3',{sql_str(part_id)},{x},{y},{sql_str(text)});"
        )
    stmts.append('')

    sql = '\n'.join(stmts) + '\n'
    Path(args.out).write_text(sql, encoding='utf-8')
    n_insert = sql.count('INSERT')
    n_update = sql.count('UPDATE')
    print(f'생성됨: {args.out}')
    print(f'INSERT 문: {n_insert} / UPDATE 문: {n_update}')


if __name__ == '__main__':
    main()
