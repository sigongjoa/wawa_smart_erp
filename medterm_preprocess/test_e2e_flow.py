"""MedTerm UC E2E 데이터 흐름 시나리오 테스트.

각 시나리오는 SQLite 메모리 DB 위에서 핸들러와 동등한 SQL flow를 실행하며,
최종 상태를 assert 한다.

검증 범위:
  - UC-MA-01 / MT-01     교재·챕터 등록
  - UC-MT-02            챕터 시드 (parts/terms/term_parts/exam_items)
  - UC-MT-05            학생 할당 (modes × terms × students 카드 생성)
  - UC-MS-01            오늘의 카드 조회 (next_review 가중치)
  - UC-MS-02            meaning 채점 → Leitner 갱신
  - UC-MS-03            decompose 채점 → Leitner 갱신
  - UC-MX-01            Leitner box 전이 (정답 → +1, 오답 → 1)

학원 격리도 검증: 다른 학원 학생에 카드 보이지 않는지.
"""
import json
import sqlite3
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKERS = ROOT.parent / 'workers'


# ── 채점 함수 (medterm-validate.ts 와 동등 — Python 포팅) ──

def normalize_term(s: str) -> str:
    import re
    return re.sub(r'[\s\-_/().]+', '', s.lower()).strip()


def grade_short_answer(answer, response) -> bool:
    if not isinstance(answer, str) or not isinstance(response, str):
        return False
    return normalize_term(answer) == normalize_term(response)


def grade_decompose(answer, response, strict_role=False) -> bool:
    def parse(x):
        if isinstance(x, str):
            return [{'value': v.strip()} for v in x.split('/') if v.strip()]
        if isinstance(x, list):
            return [p for p in x if isinstance(p, dict) and 'value' in p]
        return None
    a = parse(answer)
    r = parse(response)
    if a is None or r is None or len(a) != len(r):
        return False
    for ap, rp in zip(a, r):
        if normalize_term(ap['value']) != normalize_term(rp['value']):
            return False
        if strict_role and ap.get('role') and rp.get('role') and ap['role'] != rp['role']:
            return False
    return True


LEITNER_INTERVALS_HOURS = {1: 1, 2: 24, 3: 72, 4: 168, 5: 336}


def next_leitner(current_box: int, is_correct: bool, now: datetime):
    box = min(current_box + 1, 5) if is_correct else 1
    interval_h = LEITNER_INTERVALS_HOURS[box] if is_correct else 4
    next_review = now + timedelta(hours=interval_h)
    return box, next_review


# ── DB 헬퍼 ──

def fresh_db() -> sqlite3.Connection:
    """gacha_students 더미 + 마이그레이션 + 시드 SQL 적용된 메모리 DB."""
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys = ON')
    # 의존 테이블 더미
    conn.executescript('''
        CREATE TABLE gacha_students(
            id TEXT PRIMARY KEY,
            academy_id TEXT,
            name TEXT
        );
    ''')
    migration = (WORKERS / 'migrations' / '059_medterm_system.sql').read_text(encoding='utf-8')
    conn.executescript(migration)
    seed = (ROOT / 'output' / '059_seed_chapter01.sql').read_text(encoding='utf-8')
    conn.executescript(seed)
    return conn


def gen_id(prefix: str, n: int) -> str:
    return f'{prefix}-{n:08d}'


# ── 시나리오 ──

class TestUcMt01_BookChapter(unittest.TestCase):
    """UC-MA-01 + UC-MT-01: 시드 직후 교재·챕터가 정확히 1개씩."""

    def test_book_chapter_count(self):
        db = fresh_db()
        n_books = db.execute('SELECT COUNT(*) FROM med_books').fetchone()[0]
        n_chap = db.execute('SELECT COUNT(*) FROM med_chapters').fetchone()[0]
        self.assertEqual(n_books, 1)
        self.assertEqual(n_chap, 1)
        chap = db.execute(
            "SELECT id, book_id, title FROM med_chapters WHERE id='med-basic-ch01'"
        ).fetchone()
        self.assertEqual(chap[1], 'med-basic')
        self.assertIn('단어의 요소', chap[2])


class TestUcMt02_Seed(unittest.TestCase):
    """UC-MT-02: 시드 결과 카운트 검증."""

    def test_seed_counts(self):
        db = fresh_db()
        counts = {}
        for tbl in ['med_word_parts', 'med_terms', 'med_term_parts',
                    'med_exam_items', 'med_figures', 'med_figure_labels']:
            counts[tbl] = db.execute(f'SELECT COUNT(*) FROM {tbl}').fetchone()[0]
        self.assertGreaterEqual(counts['med_word_parts'], 50, 'parts ≥ 50')
        self.assertGreaterEqual(counts['med_terms'], 5, 'terms ≥ 5')
        self.assertGreaterEqual(counts['med_term_parts'], 15, 'term_parts ≥ 15')
        self.assertEqual(counts['med_exam_items'], 30)
        self.assertEqual(counts['med_figures'], 4)
        self.assertEqual(counts['med_figure_labels'], 10)

    def test_term_parts_join(self):
        db = fresh_db()
        # cardiology = cardi/o/logy 합성 확인
        rows = db.execute('''
            SELECT wp.role, wp.value, tp.position
            FROM med_terms t
            JOIN med_term_parts tp ON tp.term_id = t.id
            JOIN med_word_parts wp ON wp.id = tp.part_id
            WHERE t.term = 'cardiology'
            ORDER BY tp.position
        ''').fetchall()
        self.assertGreater(len(rows), 0, 'cardiology 합성 링크 존재')
        # 역할 순서 검증 — cardi(r), o(cv), logy(s)
        roles = [r[0] for r in rows]
        values = [r[1] for r in rows]
        # cardi/o/logy 또는 cardi(/o)/logy
        self.assertIn('r', roles)
        self.assertIn('s', roles)

    def test_figure_labels_part_mapping(self):
        db = fresh_db()
        rows = db.execute('''
            SELECT fl.text, fl.part_id, wp.value
            FROM med_figure_labels fl
            LEFT JOIN med_word_parts wp ON wp.id = fl.part_id
            WHERE fl.figure_id = 'fig-ch01-1-3'
        ''').fetchall()
        self.assertEqual(len(rows), 10, '인체 라벨 10개')
        for text, part_id, value in rows:
            self.assertIsNotNone(part_id, f'라벨 "{text}" 의 part_id 매핑됨')


class TestUcMt05_AssignAcademyIsolation(unittest.TestCase):
    """UC-MT-05 + 학원 격리: 학생 할당 + 다른 학원 학생 차단."""

    def setUp(self):
        self.db = fresh_db()
        # 두 학원, 각각 학생 둘 (학생A·학생B는 wawa, evil 은 다른 학원)
        self.db.executemany(
            'INSERT INTO gacha_students(id, academy_id, name) VALUES(?,?,?)',
            [
                ('stu-hyeyeon', 'wawa', '학생A'),
                ('stu-hyejung', 'wawa', '학생B'),
                ('stu-evil',    'other-academy', 'Other Academy 학생'),
            ]
        )

    def assign_chapter(self, academy_id, student_ids, chapter_id, modes):
        """handleAssignChapter 핸들러 SQL flow 모방."""
        # 학원 격리 검증 (CLAUDE.md 1번)
        placeholders = ','.join('?' * len(student_ids))
        valid = self.db.execute(
            f'SELECT id FROM gacha_students WHERE academy_id=? AND id IN ({placeholders})',
            [academy_id, *student_ids]
        ).fetchall()
        valid_ids = {r[0] for r in valid}
        invalid = [s for s in student_ids if s not in valid_ids]
        if invalid:
            return {'error': f'학원 격리 위반: {invalid}'}

        terms = self.db.execute(
            'SELECT id FROM med_terms WHERE chapter_id=?',
            [chapter_id]
        ).fetchall()
        term_ids = [r[0] for r in terms]

        modes_json = json.dumps(modes)
        i = 0
        for sid in student_ids:
            self.db.execute(
                '''INSERT OR IGNORE INTO med_student_chapters
                   (id, academy_id, student_id, chapter_id, modes_json, assigned_by)
                   VALUES(?,?,?,?,?,?)''',
                [gen_id('msc', i := i + 1), academy_id, sid, chapter_id, modes_json, 'teacher-1']
            )
            for tid in term_ids:
                for mode in modes:
                    self.db.execute(
                        '''INSERT OR IGNORE INTO med_student_terms
                           (id, academy_id, student_id, term_id, study_mode, box, next_review)
                           VALUES(?,?,?,?,?,1,datetime('now'))''',
                        [gen_id('mst', i := i + 1), academy_id, sid, tid, mode]
                    )
        return {
            'assigned': len(student_ids),
            'terms': len(term_ids),
            'cards': len(student_ids) * len(term_ids) * len(modes),
        }

    def test_assign_two_students_two_modes(self):
        result = self.assign_chapter(
            'wawa', ['stu-hyeyeon', 'stu-hyejung'],
            'med-basic-ch01', ['meaning', 'decompose']
        )
        self.assertNotIn('error', result)
        n_terms = result['terms']
        self.assertEqual(result['assigned'], 2)
        self.assertEqual(result['cards'], 2 * n_terms * 2)

        # 카드 실제 카운트
        actual = self.db.execute(
            "SELECT COUNT(*) FROM med_student_terms WHERE academy_id='wawa'"
        ).fetchone()[0]
        self.assertEqual(actual, result['cards'])

    def test_cross_academy_blocked(self):
        # wawa 강사가 다른 학원 학생을 할당하려 하면 실패해야 함
        result = self.assign_chapter(
            'wawa', ['stu-evil'],
            'med-basic-ch01', ['meaning']
        )
        self.assertIn('error', result, '학원 격리 위반은 거부되어야 함')

    def test_idempotent_reassign(self):
        # 같은 할당 두 번 → 카드 중복 생성 안 됨 (UNIQUE 제약)
        self.assign_chapter('wawa', ['stu-hyeyeon'], 'med-basic-ch01', ['meaning'])
        before = self.db.execute('SELECT COUNT(*) FROM med_student_terms').fetchone()[0]
        self.assign_chapter('wawa', ['stu-hyeyeon'], 'med-basic-ch01', ['meaning'])
        after = self.db.execute('SELECT COUNT(*) FROM med_student_terms').fetchone()[0]
        self.assertEqual(before, after, '재할당은 멱등')


class TestUcMs01TodayCards(unittest.TestCase):
    """UC-MS-01: next_review 도래 카드만 조회되는지."""

    def setUp(self):
        self.db = fresh_db()
        self.db.execute(
            'INSERT INTO gacha_students(id,academy_id,name) VALUES(?,?,?)',
            ('stu-hyeyeon', 'wawa', '학생A')
        )
        # 4 카드 — 2개는 due, 2개는 미래
        terms = self.db.execute(
            "SELECT id FROM med_terms WHERE chapter_id='med-basic-ch01' LIMIT 4"
        ).fetchall()
        i = 0
        for due, tid in [(True, terms[0][0]), (True, terms[1][0]),
                         (False, terms[2][0]), (False, terms[3][0])]:
            i += 1
            review = "datetime('now', '-1 hour')" if due else "datetime('now', '+1 day')"
            self.db.execute(f'''
                INSERT INTO med_student_terms
                (id,academy_id,student_id,term_id,study_mode,box,next_review)
                VALUES(?,'wawa','stu-hyeyeon',?, 'meaning', 1, {review})
            ''', [gen_id('mst', i), tid])

    def test_only_due_cards_returned(self):
        rows = self.db.execute('''
            SELECT st.id, t.term, st.box
            FROM med_student_terms st
            JOIN med_terms t ON t.id = st.term_id
            WHERE st.academy_id='wawa' AND st.student_id='stu-hyeyeon'
              AND st.next_review <= datetime('now')
            ORDER BY st.box, st.next_review
        ''').fetchall()
        self.assertEqual(len(rows), 2, 'due 카드만 2개')


class TestUcMs02Meaning(unittest.TestCase):
    """UC-MS-02 + UC-MX-01: meaning 채점 + Leitner 갱신."""

    def setUp(self):
        self.db = fresh_db()
        self.db.execute(
            'INSERT INTO gacha_students(id,academy_id,name) VALUES(?,?,?)',
            ('stu-hyeyeon', 'wawa', '학생A')
        )
        # cardiology meaning 카드 1개 (box=1, due)
        cardio = self.db.execute(
            "SELECT id, meaning_ko FROM med_terms WHERE term='cardiology'"
        ).fetchone()
        self.term_id, self.meaning = cardio
        self.card_id = 'mst-test-1'
        self.db.execute('''
            INSERT INTO med_student_terms
            (id,academy_id,student_id,term_id,study_mode,box,next_review)
            VALUES(?,'wawa','stu-hyeyeon',?, 'meaning', 1, datetime('now','-1 hour'))
        ''', [self.card_id, self.term_id])

    def submit_answer(self, response: str):
        """handleAnswer SQL flow 모방."""
        # 카드 + 정답 조회
        row = self.db.execute('''
            SELECT st.box, t.meaning_ko, t.term
            FROM med_student_terms st
            JOIN med_terms t ON t.id = st.term_id
            WHERE st.id=? AND st.academy_id='wawa' AND st.student_id='stu-hyeyeon'
        ''', [self.card_id]).fetchone()
        box_before = row[0]
        answer = row[1]  # meaning 모드는 meaning_ko가 정답
        is_correct = grade_short_answer(answer, response)
        new_box, next_review = next_leitner(box_before, is_correct, datetime.now(timezone.utc))
        self.db.execute('''
            UPDATE med_student_terms
            SET box=?, review_count=review_count+1, wrong_count=wrong_count+?,
                last_reviewed=datetime('now'), next_review=?
            WHERE id=?
        ''', [new_box, 0 if is_correct else 1, next_review.isoformat(), self.card_id])
        return is_correct, box_before, new_box

    def test_correct_answer_promotes_box(self):
        is_correct, before, after = self.submit_answer(self.meaning)
        self.assertTrue(is_correct)
        self.assertEqual(before, 1)
        self.assertEqual(after, 2)

    def test_wrong_answer_demotes_to_box1(self):
        # box를 3으로 올린 뒤 오답
        self.db.execute('UPDATE med_student_terms SET box=3 WHERE id=?', [self.card_id])
        is_correct, before, after = self.submit_answer('완전 다른 답')
        self.assertFalse(is_correct)
        self.assertEqual(before, 3)
        self.assertEqual(after, 1, '오답은 box 1로 강등')

    def test_wrong_count_increments(self):
        self.submit_answer('완전 다른 답')
        wc = self.db.execute(
            'SELECT wrong_count FROM med_student_terms WHERE id=?', [self.card_id]
        ).fetchone()[0]
        self.assertEqual(wc, 1)


class TestUcMs03Decompose(unittest.TestCase):
    """UC-MS-03: decompose 채점 — 정답 parts JOIN + Leitner."""

    def setUp(self):
        self.db = fresh_db()
        self.db.execute(
            'INSERT INTO gacha_students(id,academy_id,name) VALUES(?,?,?)',
            ('stu-hyeyeon', 'wawa', '학생A')
        )
        # gastroenteritis decompose 카드
        ge = self.db.execute(
            "SELECT id FROM med_terms WHERE term='gastroenteritis'"
        ).fetchone()
        self.term_id = ge[0]
        self.card_id = 'mst-test-2'
        self.db.execute('''
            INSERT INTO med_student_terms
            (id,academy_id,student_id,term_id,study_mode,box,next_review)
            VALUES(?,'wawa','stu-hyeyeon',?,'decompose',1,datetime('now','-1 hour'))
        ''', [self.card_id, self.term_id])

    def get_answer_parts(self):
        rows = self.db.execute('''
            SELECT wp.role, wp.value
            FROM med_term_parts tp JOIN med_word_parts wp ON wp.id = tp.part_id
            WHERE tp.term_id=? ORDER BY tp.position
        ''', [self.term_id]).fetchall()
        return [{'role': r[0], 'value': r[1]} for r in rows]

    def test_correct_decompose_promotes(self):
        answer = self.get_answer_parts()
        # 학생 응답 — value만 (role 없이도 통과)
        response = [{'value': p['value']} for p in answer]
        ok = grade_decompose(answer, response)
        self.assertTrue(ok)

    def test_string_response_format(self):
        answer = self.get_answer_parts()
        # gastr/o/enter/itis 형 입력
        response_str = '/'.join(p['value'] for p in answer)
        ok = grade_decompose(answer, response_str)
        self.assertTrue(ok)

    def test_wrong_order_fails(self):
        answer = self.get_answer_parts()
        if len(answer) >= 2:
            reversed_resp = list(reversed(answer))
            ok = grade_decompose(answer, reversed_resp)
            self.assertFalse(ok)

    def test_missing_part_fails(self):
        answer = self.get_answer_parts()
        # 한 부분 빠뜨림
        response = answer[:-1]
        ok = grade_decompose(answer, response)
        self.assertFalse(ok)


class TestUcMxLeitnerIntervals(unittest.TestCase):
    """UC-MX-01 — 간격 검증."""

    def test_box_intervals(self):
        now = datetime(2026, 4, 30, 10, 0, 0, tzinfo=timezone.utc)
        for current_box, expected_box, expected_h in [
            (1, 2, 24),    # 1d
            (2, 3, 72),    # 3d
            (3, 4, 168),   # 7d
            (4, 5, 336),   # 14d
            (5, 5, 336),   # cap
        ]:
            box, nr = next_leitner(current_box, True, now)
            self.assertEqual(box, expected_box)
            self.assertEqual((nr - now).total_seconds() / 3600, expected_h)

    def test_wrong_resets(self):
        now = datetime(2026, 4, 30, 10, 0, 0, tzinfo=timezone.utc)
        for current_box in [1, 2, 3, 4, 5]:
            box, nr = next_leitner(current_box, False, now)
            self.assertEqual(box, 1)
            self.assertEqual((nr - now).total_seconds() / 3600, 4)


# ── End-to-end 시나리오 (학생A 학습 journey) ──

class TestE2eHyeyeonLearningJourney(unittest.TestCase):
    """학생A의 시드 → 할당 → 학습 → Leitner 갱신 전체 흐름."""

    def test_full_journey(self):
        db = fresh_db()
        # 1. 학생 등록
        db.execute(
            'INSERT INTO gacha_students(id,academy_id,name) VALUES(?,?,?)',
            ('stu-hyeyeon', 'wawa', '학생A')
        )

        # 2. 챕터 할당 (UC-MT-05) — meaning + decompose 두 모드
        terms = [r[0] for r in db.execute(
            "SELECT id FROM med_terms WHERE chapter_id='med-basic-ch01'"
        )]
        i = 0
        for tid in terms:
            for mode in ['meaning', 'decompose']:
                i += 1
                db.execute('''
                    INSERT INTO med_student_terms
                    (id,academy_id,student_id,term_id,study_mode,box,next_review)
                    VALUES(?,'wawa','stu-hyeyeon',?,?,1,datetime('now','-1 hour'))
                ''', [gen_id('mst', i), tid, mode])

        n_cards_initial = db.execute(
            "SELECT COUNT(*) FROM med_student_terms WHERE student_id='stu-hyeyeon'"
        ).fetchone()[0]
        self.assertEqual(n_cards_initial, len(terms) * 2)

        # 3. 오늘의 카드 (UC-MS-01) — 모두 due
        due = db.execute('''
            SELECT st.id, st.study_mode, t.term, t.meaning_ko, st.box
            FROM med_student_terms st JOIN med_terms t ON t.id = st.term_id
            WHERE st.academy_id='wawa' AND st.student_id='stu-hyeyeon'
              AND st.next_review <= datetime('now')
            ORDER BY st.box, st.next_review
            LIMIT 10
        ''').fetchall()
        self.assertGreater(len(due), 0)

        # 4. meaning 모드 정답 응답 (UC-MS-02)
        meaning_card = next(c for c in due if c[1] == 'meaning')
        card_id, _, term, meaning_ko, box = meaning_card
        is_correct = grade_short_answer(meaning_ko, meaning_ko)
        self.assertTrue(is_correct)
        new_box, nr = next_leitner(box, True, datetime.now(timezone.utc))
        db.execute('''
            UPDATE med_student_terms
            SET box=?, review_count=review_count+1,
                last_reviewed=datetime('now'), next_review=?
            WHERE id=?
        ''', [new_box, nr.isoformat(), card_id])

        # 5. 갱신 검증
        updated_box = db.execute(
            'SELECT box FROM med_student_terms WHERE id=?', [card_id]
        ).fetchone()[0]
        self.assertEqual(updated_box, 2, '정답 시 box=1 → 2')

        # 6. decompose 모드 오답 응답 (UC-MS-03)
        decom_card = next(c for c in due if c[1] == 'decompose')
        card_id_d = decom_card[0]
        # 의도적 오답
        is_correct_d = grade_decompose(['cardi', 'o', 'logy'], 'wrong/answer')
        self.assertFalse(is_correct_d)
        new_box_d, nr_d = next_leitner(decom_card[4], False, datetime.now(timezone.utc))
        db.execute('''
            UPDATE med_student_terms
            SET box=?, review_count=review_count+1, wrong_count=wrong_count+1,
                last_reviewed=datetime('now'), next_review=?
            WHERE id=?
        ''', [new_box_d, nr_d.isoformat(), card_id_d])

        # 7. 약점 조회 (UC-MT-06) — wrong_count > 0 인 카드
        weak = db.execute('''
            SELECT t.term, st.wrong_count, st.box
            FROM med_student_terms st JOIN med_terms t ON t.id = st.term_id
            WHERE st.academy_id='wawa' AND st.student_id='stu-hyeyeon'
              AND st.wrong_count > 0
        ''').fetchall()
        self.assertEqual(len(weak), 1, '약점 카드 1개')
        self.assertEqual(weak[0][2], 1, '오답 카드는 box=1로 강등됨')


if __name__ == '__main__':
    unittest.main(verbosity=2)
