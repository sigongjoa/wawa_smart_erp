import { useEffect, useState, useRef } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import {
  medtermAdminApi, MedBook, MedChapter,
  MedProgressBox, MedWeakTerm, MedFigureAdmin, MedExamAttemptAdmin,
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

  // 그림
  const [figures, setFigures] = useState<MedFigureAdmin[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFigId, setUploadFigId] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadFigType, setUploadFigType] = useState<'anatomy' | 'diagram' | 'etymology' | 'illustration'>('anatomy');
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  // 평가 출제
  const [examStudentIds, setExamStudentIds] = useState('');
  const [examLimit, setExamLimit] = useState(30);
  const [examAttempts, setExamAttempts] = useState<MedExamAttemptAdmin[]>([]);

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

  // 챕터 변경 시 그림 목록 reload
  useEffect(() => {
    if (!chapterId) return;
    medtermAdminApi.listFigures(chapterId).then((r) => setFigures(r.items)).catch(() => {});
  }, [chapterId]);

  async function uploadFigure() {
    setError(null); setUploadResult(null);
    if (!uploadFile) { setError('파일을 선택하세요'); return; }
    if (!uploadFigId.trim() || !uploadLabel.trim()) {
      setError('figure_id 와 label 입력 필요'); return;
    }
    try {
      const r = await medtermAdminApi.uploadFigure({
        figure_id: uploadFigId.trim(),
        chapter_id: chapterId,
        label: uploadLabel.trim(),
        fig_type: uploadFigType,
        file: uploadFile,
      });
      setUploadResult(`업로드 완료 — ${r.r2_key} (${(r.size / 1024).toFixed(1)}KB)`);
      // 목록 갱신
      const r2 = await medtermAdminApi.listFigures(chapterId);
      setFigures(r2.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    }
  }

  async function createExam() {
    setError(null); setExamAttempts([]);
    const ids = examStudentIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) { setError('학생 ID 입력 필요'); return; }
    try {
      const r = await medtermAdminApi.createExam(chapterId, ids, { limit: examLimit });
      setExamAttempts(r.attempts);
    } catch (e) {
      setError(e instanceof Error ? e.message : '평가 출제 실패');
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
        <h2>③ 그림 업로드 (UC-MT-03)</h2>
        <p className="medterm-admin-hint">
          챕터에 그림을 R2 에 업로드합니다. 파일은 학원별로 격리됩니다 (medterm/{'{academyId}'}/figs/...).
        </p>
        <div className="medterm-admin-row">
          <label>
            figure_id
            <input
              type="text"
              value={uploadFigId}
              onChange={(e) => setUploadFigId(e.target.value)}
              placeholder="예: fig-ch01-1-3"
              data-testid="medterm-fig-id"
            />
          </label>
          <label>
            label
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="예: 그림 1-3"
              data-testid="medterm-fig-label"
            />
          </label>
          <label>
            fig_type
            <select value={uploadFigType} onChange={(e) => setUploadFigType(e.target.value as any)}>
              <option value="anatomy">anatomy</option>
              <option value="diagram">diagram</option>
              <option value="etymology">etymology</option>
              <option value="illustration">illustration</option>
            </select>
          </label>
          <label>
            파일
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              data-testid="medterm-fig-file"
            />
          </label>
          <button onClick={uploadFigure} data-testid="medterm-fig-upload">업로드</button>
        </div>
        {uploadResult && <div className="medterm-admin-success">{uploadResult}</div>}

        {figures.length > 0 && (
          <div className="medterm-admin-progress">
            <h3>등록된 그림 ({figures.length})</h3>
            <table>
              <thead>
                <tr><th>ID</th><th>라벨</th><th>유형</th><th>이미지</th></tr>
              </thead>
              <tbody>
                {figures.map((f) => (
                  <tr key={f.id} data-testid={`medterm-fig-row-${f.id}`}>
                    <td><code>{f.id}</code></td>
                    <td>{f.label}</td>
                    <td>{f.fig_type}</td>
                    <td>
                      {f.has_image ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-text)' }}>
                          <Check size={14} aria-hidden /> 업로드됨
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning-text)' }}>
                          <AlertTriangle size={14} aria-hidden /> 없음
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>④ 단원평가 출제 (UC-MT-07)</h2>
        <p className="medterm-admin-hint">
          현재 챕터({chapterId})의 출제 문항으로 학생 평가를 생성합니다.
        </p>
        <textarea
          rows={2}
          value={examStudentIds}
          onChange={(e) => setExamStudentIds(e.target.value)}
          placeholder="학생 ID (콤마 구분) — 예: gstu-7404d02d, gstu-c4b35596"
          data-testid="medterm-exam-students"
        />
        <div className="medterm-admin-row">
          <label>
            문항 수
            <input
              type="number"
              value={examLimit}
              min={1}
              max={100}
              onChange={(e) => setExamLimit(parseInt(e.target.value, 10) || 30)}
              data-testid="medterm-exam-limit"
            />
          </label>
          <button onClick={createExam} data-testid="medterm-exam-create">평가 출제</button>
        </div>
        {examAttempts.length > 0 && (
          <div className="medterm-admin-success" data-testid="medterm-exam-result">
            {examAttempts.length}개 attempt 생성됨:
            <ul style={{ margin: '6px 0 0 16px', fontSize: 12 }}>
              {examAttempts.map((a) => (
                <li key={a.attempt_id}>
                  학생 <code>{a.student_id}</code> → attempt <code>{a.attempt_id}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2>⑤ 학생 진척 조회</h2>
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
