import { useEffect, useState } from 'react';
import {
  medtermAdminApi, MedBook, MedChapter,
  MedProgressBox, MedWeakTerm,
} from '../api';
import './MedTermAdminPage.css';

interface StudentInput {
  id: string;  // raw text
}

export default function MedTermAdminPage() {
  const [books, setBooks] = useState<MedBook[]>([]);
  const [chapters, setChapters] = useState<MedChapter[]>([]);
  const [bookId, setBookId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 할당 폼
  const [studentIdsRaw, setStudentIdsRaw] = useState('');
  const [modes, setModes] = useState<Set<string>>(new Set(['meaning', 'decompose']));
  const [assignResult, setAssignResult] = useState<string | null>(null);

  // 진척
  const [progressStudent, setProgressStudent] = useState('');
  const [progressBoxes, setProgressBoxes] = useState<MedProgressBox[]>([]);
  const [progressWeak, setProgressWeak] = useState<MedWeakTerm[]>([]);

  useEffect(() => {
    Promise.all([
      medtermAdminApi.listBooks().catch(() => ({ items: [] as MedBook[] })),
      medtermAdminApi.listChapters().catch(() => ({ items: [] as MedChapter[] })),
    ]).then(([b, c]) => {
      setBooks(b.items);
      setChapters(c.items);
      if (b.items[0]) setBookId(b.items[0].id);
      if (c.items[0]) setChapterId(c.items[0].id);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filteredChapters = chapters.filter((c) => !bookId || c.book_id === bookId);

  function toggleMode(mode: string) {
    const next = new Set(modes);
    if (next.has(mode)) next.delete(mode); else next.add(mode);
    setModes(next);
  }

  async function submitAssign() {
    setError(null); setAssignResult(null);
    const ids = studentIdsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      setError('학생 ID를 입력하세요'); return;
    }
    if (modes.size === 0) {
      setError('학습 모드를 1개 이상 선택하세요'); return;
    }
    try {
      const r = await medtermAdminApi.assign(chapterId, ids, Array.from(modes));
      setAssignResult(
        `할당 성공 — 학생 ${r.assigned_students}명 × 용어 ${r.terms}개 × 모드 ${modes.size}개 = ${r.cards_created}장 카드`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '할당 실패');
    }
  }

  async function loadProgress() {
    setError(null);
    if (!progressStudent.trim()) {
      setError('학생 ID 입력 필요'); return;
    }
    try {
      const r = await medtermAdminApi.progress(progressStudent.trim(), chapterId || undefined);
      setProgressBoxes(r.box_distribution);
      setProgressWeak(r.weak_terms);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    }
  }

  if (loading) return <div className="medterm-admin">불러오는 중...</div>;

  return (
    <div className="medterm-admin" data-testid="medterm-admin">
      <header>
        <h1>의학용어 — 강사 콘솔</h1>
      </header>

      {error && <div className="medterm-admin-error" data-testid="medterm-admin-error">{error}</div>}

      <section>
        <h2>① 교재 / 챕터 선택</h2>
        <div className="medterm-admin-row">
          <label>
            교재
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} data-testid="medterm-book-select">
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>
          <label>
            챕터
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} data-testid="medterm-chapter-select">
              {filteredChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch.{c.chapter_no} {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="medterm-admin-summary">
          <div data-testid="medterm-books-count">교재 {books.length}권</div>
          <div data-testid="medterm-chapters-count">챕터 {filteredChapters.length}개</div>
        </div>
      </section>

      <section>
        <h2>② 학생 할당</h2>
        <p className="medterm-admin-hint">
          학생 ID를 콤마(,) 또는 줄바꿈으로 구분해 입력합니다. 학원 격리 검증이 자동 적용됩니다.
        </p>
        <textarea
          rows={3}
          value={studentIdsRaw}
          onChange={(e) => setStudentIdsRaw(e.target.value)}
          placeholder="예: gstu-7404d02d, gstu-c4b35596"
          data-testid="medterm-assign-students"
        />
        <div className="medterm-admin-modes">
          {(['meaning', 'decompose', 'compose', 'plural', 'figure'] as const).map((m) => (
            <label key={m} className="medterm-admin-mode-chip">
              <input
                type="checkbox"
                checked={modes.has(m)}
                onChange={() => toggleMode(m)}
                data-testid={`medterm-mode-${m}`}
              />
              {m}
            </label>
          ))}
        </div>
        <button onClick={submitAssign} data-testid="medterm-assign-submit">할당 실행</button>
        {assignResult && (
          <div className="medterm-admin-success" data-testid="medterm-assign-result">{assignResult}</div>
        )}
      </section>

      <section>
        <h2>③ 학생 진척 조회</h2>
        <div className="medterm-admin-row">
          <input
            type="text"
            value={progressStudent}
            onChange={(e) => setProgressStudent(e.target.value)}
            placeholder="학생 ID (예: gstu-7404d02d)"
            data-testid="medterm-progress-student-id"
          />
          <button onClick={loadProgress} data-testid="medterm-progress-load">진척 조회</button>
        </div>

        {progressBoxes.length > 0 && (
          <div className="medterm-admin-progress" data-testid="medterm-progress-boxes">
            <h3>박스 분포 (모드별)</h3>
            <table>
              <thead>
                <tr><th>모드</th><th>박스</th><th>카드 수</th></tr>
              </thead>
              <tbody>
                {progressBoxes.map((p, i) => (
                  <tr key={i}>
                    <td>{p.study_mode}</td>
                    <td>{p.box}</td>
                    <td>{p.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {progressWeak.length > 0 && (
          <div className="medterm-admin-weak" data-testid="medterm-progress-weak">
            <h3>약점 용어 Top 10</h3>
            <table>
              <thead>
                <tr><th>용어</th><th>의미</th><th>오답</th><th>박스</th></tr>
              </thead>
              <tbody>
                {progressWeak.map((w, i) => (
                  <tr key={i}>
                    <td><b>{w.term}</b></td>
                    <td>{w.meaning_ko}</td>
                    <td>{w.wrong_count}</td>
                    <td>{w.box}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
