import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchExams, createExamEntry, updateExamDifficulty } from '../services/notion';
import { printPDF, getPrinters, getDefaultPrinter, isElectronAvailable } from '../services/print';
import type { DifficultyGrade, Exam } from '../types';
import type { PrinterInfo } from '../electron';

const DIFFICULTY_OPTIONS: { value: DifficultyGrade; label: string; color: string }[] = [
  { value: 'A', label: 'A (최상)', color: '#ef4444' },
  { value: 'B', label: 'B (상)', color: '#f97316' },
  { value: 'C', label: 'C (중)', color: '#eab308' },
  { value: 'D', label: 'D (중하)', color: '#84cc16' },
  { value: 'E', label: 'E (하)', color: '#22c55e' },
  { value: 'F', label: 'F (기초)', color: '#3b82f6' },
];

const SUBJECTS = ['수학', '영어', '국어', '과학', '사회', '기타'];

export default function ExamManagePage() {
  const navigate = useNavigate();
  const { currentUser, exams, setExams, addExam, updateExam, currentYearMonth, setCurrentYearMonth } = useReportStore();

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExam, setNewExam] = useState({
    subject: '',
    difficulty: 'C' as DifficultyGrade,
    scope: '',
  });
  const [saving, setSaving] = useState(false);

  // 프린트 관련 상태
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printing, setPrinting] = useState<string | null>(null);
  const [electronAvailable, setElectronAvailable] = useState(false);

  useEffect(() => {
    if (!currentUser?.teacher.isAdmin) {
      return;
    }

    const loadExams = async () => {
      const examList = await fetchExams();
      setExams(examList);
      setLoading(false);
    };

    loadExams();
  }, [currentUser, setExams]);

  // 프린터 목록 로드
  useEffect(() => {
    const loadPrinters = async () => {
      const available = isElectronAvailable();
      setElectronAvailable(available);

      if (!available) {
        console.warn('Electron API not available - print feature disabled');
        return;
      }

      const printerList = await getPrinters();
      setPrinters(printerList);

      if (printerList.length > 0) {
        const defaultPrinter = await getDefaultPrinter();
        setSelectedPrinter(defaultPrinter || printerList[0].name);
      }
    };

    loadPrinters();
  }, []);

  if (!currentUser?.teacher.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>관리자만 접근할 수 있습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const filteredExams = exams.filter((e) => e.yearMonth === currentYearMonth);

  const handleAddExam = async () => {
    if (!newExam.subject) {
      alert('과목을 선택해주세요.');
      return;
    }

    // 중복 체크
    const exists = filteredExams.find((e) => e.subject === newExam.subject);
    if (exists) {
      alert('해당 월에 이미 등록된 과목입니다.');
      return;
    }

    setSaving(true);

    const examData: Omit<Exam, 'id' | 'uploadedAt'> = {
      subject: newExam.subject,
      yearMonth: currentYearMonth,
      difficulty: newExam.difficulty,
      scope: newExam.scope,
      uploadedBy: currentUser.teacher.name,
    };

    const created = await createExamEntry(examData);

    if (created) {
      addExam(created);
      setShowAddModal(false);
      setNewExam({ subject: '', difficulty: 'C', scope: '' });
    } else {
      // 로컬 저장 (목업)
      const mockExam: Exam = {
        id: `exam-${Date.now()}`,
        ...examData,
        uploadedAt: new Date().toISOString(),
      };
      addExam(mockExam);
      setShowAddModal(false);
      setNewExam({ subject: '', difficulty: 'C', scope: '' });
    }

    setSaving(false);
  };

  const handleDifficultyChange = async (exam: Exam, newDifficulty: DifficultyGrade) => {
    const success = await updateExamDifficulty(exam.id, newDifficulty);

    // 로컬 상태 업데이트 (성공 여부 관계없이)
    updateExam({ ...exam, difficulty: newDifficulty });

    if (!success) {
      console.log('Notion 업데이트 실패, 로컬에만 저장됨');
    }
  };

  const getDifficultyBadgeStyle = (difficulty: DifficultyGrade) => {
    const option = DIFFICULTY_OPTIONS.find((o) => o.value === difficulty);
    return {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#ffffff',
      backgroundColor: option?.color || '#6b7280',
    };
  };

  const handlePrint = async (exam: Exam) => {
    if (!exam.examFileUrl) {
      alert('시험지 PDF가 노션에 업로드되지 않았습니다.');
      return;
    }

    if (printers.length === 0) {
      alert('사용 가능한 프린터가 없습니다.\n\n프린터를 설치하고 페이지를 새로고침하세요.');
      return;
    }

    const selectedPrinterInfo = printers.find(p => p.name === selectedPrinter);
    const printerDisplayName = selectedPrinterInfo?.displayName || selectedPrinter;

    const confirmed = confirm(
      `${exam.subject} 시험지를 프린트하시겠습니까?\n\n` +
      `난이도: ${exam.difficulty}\n` +
      `범위: ${exam.scope || '없음'}\n` +
      `프린터: ${printerDisplayName}`
    );

    if (!confirmed) {
      return;
    }

    setPrinting(exam.id);

    const result = await printPDF({
      pdfUrl: exam.examFileUrl,
      examId: exam.id,
      printerName: selectedPrinter,
    });

    setPrinting(null);

    if (result.success) {
      alert(
        `프린트 요청이 전송되었습니다!\n\n` +
        `프린터: ${result.printer || printerDisplayName}`
      );
    } else {
      alert(
        `프린트 실패\n\n` +
        `에러: ${result.error}\n\n` +
        `상세: ${result.details || '없음'}`
      );
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>시험지 관리</h1>
            {electronAvailable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: printers.length > 0 ? '#22c55e' : '#ef4444',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  프린터: {printers.length}개 사용 가능
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {electronAvailable && printers.length > 0 && (
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName || printer.name}
                    {printer.isDefault && ' (기본)'}
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={currentYearMonth}
              onChange={(e) => setCurrentYearMonth(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
            <button
              onClick={() => navigate('/admin')}
              style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              돌아가기
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
              {currentYearMonth} 시험지 목록
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              시험지 등록
            </button>
          </div>

          {filteredExams.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              등록된 시험지가 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>과목</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>난이도</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>범위</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>등록자</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>등록일</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>시험지</th>
                  {electronAvailable && printers.length > 0 && (
                    <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>프린트</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((exam) => (
                  <tr key={exam.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px 24px', fontWeight: '500' }}>{exam.subject}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <select
                        value={exam.difficulty}
                        onChange={(e) => handleDifficultyChange(exam, e.target.value as DifficultyGrade)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        {DIFFICULTY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: '8px' }}>
                        <span style={getDifficultyBadgeStyle(exam.difficulty)}>
                          {exam.difficulty}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{exam.scope || '-'}</td>
                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{exam.uploadedBy}</td>
                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>
                      {new Date(exam.uploadedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      {exam.examFileUrl ? (
                        <a
                          href={exam.examFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                          보기
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                          노션에서 업로드
                        </span>
                      )}
                    </td>
                    {electronAvailable && printers.length > 0 && (
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <button
                          onClick={() => handlePrint(exam)}
                          disabled={printing === exam.id || !exam.examFileUrl}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: printing === exam.id || !exam.examFileUrl ? '#d1d5db' : '#3b82f6',
                            color: '#ffffff',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: printing === exam.id || !exam.examFileUrl ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                          }}
                          title={!exam.examFileUrl ? 'PDF가 업로드되지 않았습니다' : ''}
                        >
                          {printing === exam.id ? '프린트 중...' : '🖨️ 프린트'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 난이도 범례 */}
        <div style={{ marginTop: '24px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>난이도 범례</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={getDifficultyBadgeStyle(opt.value)}>{opt.value}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{opt.label.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 시험지 등록 모달 */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>시험지 등록</h3>

            {/* 과목 선택 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                과목 *
              </label>
              <select
                value={newExam.subject}
                onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                }}
              >
                <option value="">과목 선택</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 난이도 선택 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                난이도
              </label>
              <select
                value={newExam.difficulty}
                onChange={(e) => setNewExam({ ...newExam, difficulty: e.target.value as DifficultyGrade })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                }}
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 범위 입력 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                시험 범위
              </label>
              <input
                type="text"
                value={newExam.scope}
                onChange={(e) => setNewExam({ ...newExam, scope: e.target.value })}
                placeholder="예: 이차방정식, 관계대명사 등"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                }}
              />
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
              * 시험지 파일은 노션에서 직접 업로드해주세요.
            </p>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleAddExam}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: saving ? '#93c5fd' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
