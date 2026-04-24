import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ExamPaperItem, ExamPaperDistribution } from '../api';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';

type ExamType = 'midterm' | 'final' | 'performance';

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: '중간고사',
  final: '기말고사',
  performance: '수행평가',
};

const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface UploadState {
  title: string;
  examType: ExamType;
  subject: string;
  school: string;
  grade: string;
  examYear: number;
  semester: 1 | 2;
  memo: string;
  file: File | null;
  excludeIds: string[];
}

const emptyUpload = (): UploadState => ({
  title: '',
  examType: 'midterm',
  subject: '',
  school: '',
  grade: '',
  examYear: CURRENT_YEAR,
  semester: 1,
  memo: '',
  file: null,
  excludeIds: [],
});

export default function ExamPapersPage() {
  const [papers, setPapers] = useState<ExamPaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    examType: '', school: '', grade: '', year: '', semester: '',
  });

  const [showUpload, setShowUpload] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(emptyUpload());
  const [uploading, setUploading] = useState(false);
  const [previewStudents, setPreviewStudents] = useState<Array<{ id: string; name: string; grade: string; school: string }>>([]);

  const [detailPaperId, setDetailPaperId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<(ExamPaperItem & { distributions: ExamPaperDistribution[] }) | null>(null);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listExamPapers({
        examType: filters.examType || undefined,
        school: filters.school || undefined,
        grade: filters.grade || undefined,
        year: filters.year || undefined,
        semester: filters.semester || undefined,
      });
      setPapers(rows || []);
    } catch {
      setPapers([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // 업로드 모달: 학교+학년 바뀔 때 배포 대상 미리보기 (300ms 디바운싱)
  useEffect(() => {
    if (!showUpload) return;
    const { school, grade } = uploadState;
    if (!school.trim() || !grade) { setPreviewStudents([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      api.previewExamPaperStudents(school.trim(), grade)
        .then(rows => { if (!cancelled) setPreviewStudents(rows || []); })
        .catch(() => { if (!cancelled) setPreviewStudents([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showUpload, uploadState.school, uploadState.grade]);

  const distributeTargets = useMemo(
    () => previewStudents.filter(s => !uploadState.excludeIds.includes(s.id)),
    [previewStudents, uploadState.excludeIds]
  );

  const closeUpload = useCallback(() => { if (!uploading) setShowUpload(false); }, [uploading]);
  const closeDetail = useCallback(() => setDetailPaperId(null), []);

  const openUpload = () => {
    setUploadState(emptyUpload());
    setPreviewStudents([]);
    setShowUpload(true);
  };

  const toggleExclude = (studentId: string, include: boolean) => {
    setUploadState(s => ({
      ...s,
      excludeIds: include ? s.excludeIds.filter(id => id !== studentId) : [...s.excludeIds, studentId],
    }));
  };

  const handleUploadSubmit = async () => {
    const { title, examType, subject, school, grade, examYear, semester, memo, file, excludeIds } = uploadState;
    if (!title.trim()) { toast.error('제목을 입력하세요'); return; }

    setUploading(true);
    let uploadedKey: string | null = null;
    try {
      let fileMeta: { key: string; fileName: string; fileSize: number; contentType: string } | null = null;
      if (file) {
        fileMeta = await api.uploadExamPaperFile(file);
        uploadedKey = fileMeta.key;
      }

      const res = await api.createExamPaperDoc({
        title: title.trim(),
        examType,
        subject: subject.trim() || undefined,
        school: school.trim() || undefined,
        grade: grade || undefined,
        examYear,
        semester,
        memo: memo.trim() || undefined,
        fileKey: fileMeta?.key,
        fileName: fileMeta?.fileName,
        fileSize: fileMeta?.fileSize,
        contentType: fileMeta?.contentType,
        autoDistribute: true,
        excludeStudentIds: excludeIds,
      });

      toast.success(`업로드 완료 · ${res.distributed}명에게 배포`);
      uploadedKey = null;
      setShowUpload(false);
      load();
    } catch (err) {
      // 메타 저장 실패 시 업로드된 R2 파일은 orphan — 현재는 서버측 정기 청소 권장. 경고만 표시.
      if (uploadedKey) {
        toast.error(`저장 실패 (파일은 업로드됨): ${(err as Error).message}`);
      } else {
        toast.error('업로드 실패: ' + (err as Error).message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (paper: ExamPaperItem) => {
    const ok = await confirmDialog(`"${paper.title}"을(를) 삭제하시겠습니까? 배포된 학생 목록도 함께 삭제됩니다.`);
    if (!ok) return;
    try {
      await api.deleteExamPaperDoc(paper.id);
      toast.success('삭제 완료');
      load();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const openDetail = async (id: string) => {
    setDetailPaperId(id);
    setDetailData(null);
    try {
      const data = await api.getExamPaper(id);
      setDetailData(data);
    } catch (err) {
      toast.error('상세 조회 실패: ' + (err as Error).message);
      setDetailPaperId(null);
    }
  };

  const canPreview = uploadState.school.trim() && uploadState.grade;

  return (
    <div className="page-container exam-papers-page">
      <div className="page-header page-header-row">
        <div>
          <h1 className="page-title">시험지 관리</h1>
          <p className="page-description">중간고사 · 기말고사 · 수행평가 유인물 업로드와 자동 배포</p>
        </div>
        <button className="btn btn-primary" onClick={openUpload}>+ 업로드</button>
      </div>

      <div className="filter-bar" role="group" aria-label="시험지 필터">
        <label className="sr-only" htmlFor="filter-exam-type">시험 유형</label>
        <select id="filter-exam-type" value={filters.examType} onChange={e => setFilters(f => ({ ...f, examType: e.target.value }))} aria-label="시험 유형 필터">
          <option value="">전체 유형</option>
          <option value="midterm">중간고사</option>
          <option value="final">기말고사</option>
          <option value="performance">수행평가</option>
        </select>
        <label className="sr-only" htmlFor="filter-school">학교명</label>
        <input id="filter-school" placeholder="학교명" value={filters.school} onChange={e => setFilters(f => ({ ...f, school: e.target.value }))} aria-label="학교명 필터" />
        <label className="sr-only" htmlFor="filter-grade">학년</label>
        <select id="filter-grade" value={filters.grade} onChange={e => setFilters(f => ({ ...f, grade: e.target.value }))} aria-label="학년 필터">
          <option value="">전체 학년</option>
          {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-year">연도</label>
        <select id="filter-year" value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))} aria-label="연도 필터">
          <option value="">전체 연도</option>
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-semester">학기</label>
        <select id="filter-semester" value={filters.semester} onChange={e => setFilters(f => ({ ...f, semester: e.target.value }))} aria-label="학기 필터">
          <option value="">전체 학기</option>
          <option value="1">1학기</option>
          <option value="2">2학기</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-block" role="status">불러오는 중…</div>
      ) : papers.length === 0 ? (
        <div className="empty-block">등록된 시험지가 없습니다. "+ 업로드"를 눌러 추가하세요.</div>
      ) : (
        <>
          {/* 데스크톱: 테이블 */}
          <div className="table-wrap exam-papers-desktop">
            <table className="data-table exam-papers-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>유형</th>
                  <th>학교</th>
                  <th>학년</th>
                  <th>과목</th>
                  <th>연/학기</th>
                  <th>배포</th>
                  <th>파일</th>
                  <th>등록일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {papers.map(p => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>
                      <span className={`badge badge--${p.exam_type}`}>{EXAM_TYPE_LABEL[p.exam_type as ExamType]}</span>
                    </td>
                    <td>{p.school || '-'}</td>
                    <td>{p.grade || '-'}</td>
                    <td>{p.subject || '-'}</td>
                    <td>{p.exam_year ? `${p.exam_year}/${p.semester || '-'}` : '-'}</td>
                    <td>{p.distribution_count ?? 0}명</td>
                    <td>
                      {p.file_key ? (
                        <a href={api.examPaperFileUrl(p.file_key)} target="_blank" rel="noreferrer" aria-label={`${p.title} 파일 열기`}>
                          열기
                        </a>
                      ) : '-'}
                    </td>
                    <td>{p.created_at?.split('T')[0] || p.created_at}</td>
                    <td className="action-cell">
                      <button className="btn btn-sm btn-ghost" onClick={() => openDetail(p.id)} aria-label={`${p.title} 상세 보기`}>상세</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(p)} aria-label={`${p.title} 삭제`}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 */}
          <ul className="exam-papers-cards" aria-label="시험지 목록">
            {papers.map(p => (
              <li key={p.id} className="exam-paper-card">
                <div className="exam-paper-card-head">
                  <span className={`badge badge--${p.exam_type}`}>{EXAM_TYPE_LABEL[p.exam_type as ExamType]}</span>
                  <strong className="exam-paper-card-title">{p.title}</strong>
                </div>
                <dl className="exam-paper-card-meta">
                  <div><dt>학교</dt><dd>{p.school || '-'}</dd></div>
                  <div><dt>학년</dt><dd>{p.grade || '-'}</dd></div>
                  <div><dt>과목</dt><dd>{p.subject || '-'}</dd></div>
                  <div><dt>연/학기</dt><dd>{p.exam_year ? `${p.exam_year}/${p.semester || '-'}` : '-'}</dd></div>
                  <div><dt>배포</dt><dd>{p.distribution_count ?? 0}명</dd></div>
                  <div><dt>등록일</dt><dd>{p.created_at?.split('T')[0] || p.created_at}</dd></div>
                </dl>
                <div className="exam-paper-card-actions">
                  {p.file_key && (
                    <a className="btn btn-sm btn-ghost" href={api.examPaperFileUrl(p.file_key)} target="_blank" rel="noreferrer" aria-label={`${p.title} 파일 열기`}>
                      파일 열기
                    </a>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => openDetail(p.id)}>상세</button>
                  <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(p)}>삭제</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {showUpload && (
        <Modal onClose={closeUpload} className="modal-content--wide">
          <Modal.Header closeDisabled={uploading}>시험지 업로드</Modal.Header>
          <Modal.Body>
            <div className="form-grid">
              <div>
                <label className="form-label" htmlFor="exam-upload-title">
                  제목 <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <input
                  id="exam-upload-title"
                  className="form-input"
                  required
                  value={uploadState.title}
                  onChange={e => setUploadState(s => ({ ...s, title: e.target.value }))}
                  placeholder="예: 2026 1학기 중간고사 수학"
                  aria-required="true"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-type">유형</label>
                <select
                  id="exam-upload-type"
                  className="form-select"
                  value={uploadState.examType}
                  onChange={e => setUploadState(s => ({ ...s, examType: e.target.value as ExamType }))}
                >
                  <option value="midterm">중간고사</option>
                  <option value="final">기말고사</option>
                  <option value="performance">수행평가</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-subject">과목</label>
                <input
                  id="exam-upload-subject"
                  className="form-input"
                  value={uploadState.subject}
                  onChange={e => setUploadState(s => ({ ...s, subject: e.target.value }))}
                  placeholder="수학, 영어 …"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-school">
                  학교 <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <input
                  id="exam-upload-school"
                  className="form-input"
                  value={uploadState.school}
                  onChange={e => setUploadState(s => ({ ...s, school: e.target.value, excludeIds: [] }))}
                  placeholder="이매고등학교"
                  aria-required="true"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-grade">
                  학년 <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <select
                  id="exam-upload-grade"
                  className="form-select"
                  value={uploadState.grade}
                  onChange={e => setUploadState(s => ({ ...s, grade: e.target.value, excludeIds: [] }))}
                  aria-required="true"
                >
                  <option value="">선택</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-year">연도</label>
                <input
                  id="exam-upload-year"
                  className="form-input"
                  type="number"
                  value={uploadState.examYear}
                  onChange={e => setUploadState(s => ({ ...s, examYear: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="exam-upload-semester">학기</label>
                <select
                  id="exam-upload-semester"
                  className="form-select"
                  value={uploadState.semester}
                  onChange={e => setUploadState(s => ({ ...s, semester: Number(e.target.value) as 1 | 2 }))}
                >
                  <option value={1}>1학기</option>
                  <option value={2}>2학기</option>
                </select>
              </div>
              <div className="form-full">
                <label className="form-label" htmlFor="exam-upload-memo">메모</label>
                <textarea
                  id="exam-upload-memo"
                  className="form-textarea"
                  rows={2}
                  value={uploadState.memo}
                  onChange={e => setUploadState(s => ({ ...s, memo: e.target.value }))}
                />
              </div>
              <div className="form-full">
                <label className="form-label" htmlFor="exam-upload-file">파일</label>
                <input
                  id="exam-upload-file"
                  className="form-input"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={e => setUploadState(s => ({ ...s, file: e.target.files?.[0] || null }))}
                  aria-describedby="exam-upload-file-hint"
                />
                <p id="exam-upload-file-hint" className="form-hint">PDF 또는 이미지 · 20MB 이하</p>
                {uploadState.file && (
                  <div className="file-preview">{uploadState.file.name} · {formatFileSize(uploadState.file.size)}</div>
                )}
              </div>
            </div>

            <div className="distribute-preview">
              <div className="distribute-preview-header">
                <strong>자동 배포 대상</strong>
                <span aria-live="polite" aria-atomic="true">
                  {canPreview
                    ? `${distributeTargets.length}명 / ${previewStudents.length}명 매칭`
                    : '학교와 학년을 선택하면 배포 대상이 표시됩니다'}
                </span>
              </div>
              {previewStudents.length > 0 && (
                <div className="distribute-preview-list" role="group" aria-label="배포 대상 학생 선택">
                  {previewStudents.map(st => {
                    const excluded = uploadState.excludeIds.includes(st.id);
                    return (
                      <label key={st.id} className={`student-chip ${excluded ? 'student-chip--excluded' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={e => toggleExclude(st.id, e.target.checked)}
                        />
                        {st.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={closeUpload} disabled={uploading}>취소</button>
            <button
              className="btn btn-primary"
              onClick={handleUploadSubmit}
              disabled={uploading}
              aria-label={uploading ? '업로드 중' : `업로드 및 ${distributeTargets.length}명에게 배포`}
            >
              {uploading ? '업로드 중…' : <>업로드 <span aria-hidden="true">· {distributeTargets.length}명 배포</span></>}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {detailPaperId && (
        <Modal onClose={closeDetail} className="modal-content--wide">
          {!detailData ? (
            <>
              <Modal.Header>불러오는 중…</Modal.Header>
              <Modal.Body>
                <div className="loading-block" role="status">불러오는 중…</div>
              </Modal.Body>
            </>
          ) : (
            <>
              <Modal.Header>{detailData.title}</Modal.Header>
              <Modal.Body>
                <div className="detail-meta">
                  <span className={`badge badge--${detailData.exam_type}`}>{EXAM_TYPE_LABEL[detailData.exam_type as ExamType]}</span>
                  <span>{detailData.school || '-'}</span>
                  <span>{detailData.grade || '-'}</span>
                  <span>{detailData.subject || '-'}</span>
                  <span>{detailData.exam_year}/{detailData.semester}</span>
                </div>
                {detailData.memo && <p className="detail-memo">{detailData.memo}</p>}
                {detailData.file_key && (
                  <div className="detail-file">
                    <a className="btn btn-ghost btn-sm" href={api.examPaperFileUrl(detailData.file_key)} target="_blank" rel="noreferrer">
                      {detailData.file_name || '파일 열기'}
                    </a>
                  </div>
                )}
                <h3 className="section-title">배포 학생 ({detailData.distributions.length}명)</h3>
                {detailData.distributions.length === 0 ? (
                  <div className="empty-block">배포된 학생이 없습니다.</div>
                ) : (
                  <ul className="distribution-list">
                    {detailData.distributions.map(d => (
                      <li key={d.id}>
                        <span>{d.student_name}</span>
                        <span className="muted">{d.student_grade} · {d.student_school || '-'}</span>
                        <span className={`badge badge--${d.source}`}>{d.source === 'auto' ? '자동' : '수동'}</span>
                        <button
                          className="btn btn-sm btn-danger-ghost"
                          onClick={async () => {
                            await api.removeExamPaperDistribution(d.paper_id, d.student_id);
                            toast.success('배포 해제');
                            openDetail(detailData.id);
                            load();
                          }}
                          aria-label={`${d.student_name} 배포 제외`}
                        >
                          제외
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Modal.Body>
              <Modal.Footer>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    try {
                      const r = await api.redistributeExamPaper(detailData.id);
                      toast.success(`재배포 · ${r.distributed}명 추가`);
                      openDetail(detailData.id);
                      load();
                    } catch (err) {
                      toast.error('재배포 실패: ' + (err as Error).message);
                    }
                  }}
                >
                  재배포 (누락 학생 추가)
                </button>
                <button className="btn btn-primary" onClick={closeDetail}>닫기</button>
              </Modal.Footer>
            </>
          )}
        </Modal>
      )}

      {ConfirmDialog}
    </div>
  );
}
