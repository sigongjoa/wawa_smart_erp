import { useState, useEffect, useMemo } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import {
  createExamEntry,
  updateExamDifficulty,
  bulkSetExamDate,
  markExamCompleted,
  createAbsenceRecordSimplified
} from '../../services/notion';
import type { Student, Exam, DifficultyGrade, ExamStatus } from '../../types';

export default function Exams() {
  const { students, exams } = useFilteredData();
  const { fetchAllData, isLoading: storeLoading, currentYearMonth, currentUser } = useReportStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'schedules' | 'templates'>('schedules');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const isLoading = storeLoading;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 관리 ({currentYearMonth})</h1>
            <p className="page-description">학생별 시험 일정과 과목별 시험지를 관리합니다</p>
          </div>
          <div className="page-actions">
            {activeTab === 'templates' && (
              <button className="btn btn-primary" onClick={() => setIsTemplateModalOpen(true)}>
                <span className="material-symbols-outlined">add</span>시험지 등록
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => fetchAllData()} disabled={isLoading}>
              <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid var(--border)',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('schedules')}
          data-testid="tab-schedules"
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'schedules' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'schedules' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'schedules' ? 600 : 400,
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all var(--transition-fast)',
          }}
        >
          학생별 일정
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          data-testid="tab-templates"
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'templates' ? 600 : 400,
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all var(--transition-fast)',
          }}
        >
          과목별 시험지
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'schedules' && (
        <SchedulesTab
          students={students}
          exams={exams}
          currentYearMonth={currentYearMonth}
          currentUser={currentUser}
          fetchAllData={fetchAllData}
        />
      )}

      {activeTab === 'templates' && (
        <TemplatesTab
          exams={exams}
        />
      )}

      {isTemplateModalOpen && (
        <ExamTemplateModal
          onClose={() => setIsTemplateModalOpen(false)}
          onSubmit={async (data) => {
            // Handled via useAsync in the component
          }}
        />
      )}
    </div>
  );
}

// ==================== 학생별 일정 탭 ====================
function SchedulesTab({ students, exams, currentYearMonth, currentUser, fetchAllData }: any) {
  const { addToast } = useToastStore();
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkExamDate, setBulkExamDate] = useState('');
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedStudentForAbsence, setSelectedStudentForAbsence] = useState<Student | null>(null);

  const bulkSetAsync = useAsync(bulkSetExamDate);
  const markCompletedAsync = useAsync(markExamCompleted);
  const createAbsenceAsync = useAsync(createAbsenceRecordSimplified);

  // 학생별 현재 월 시험 정보 매핑
  const studentExamMap = useMemo(() => {
    const map: Record<string, Exam> = {};
    exams.forEach((exam: Exam) => {
      if (exam.studentId) {
        map[exam.studentId] = exam;
      }
    });
    return map;
  }, [exams]);

  const getStudentExamStatus = (student: Student): { status: ExamStatus; examDate?: string; examId?: string; completedAt?: string } => {
    const exam = studentExamMap[student.id];
    if (!exam || !exam.examDate) return { status: 'unscheduled' };
    if (exam.completedAt) return { status: 'completed', examDate: exam.examDate, examId: exam.id, completedAt: exam.completedAt };

    const today = new Date().toISOString().split('T')[0];
    const examDate = exam.examDate;
    if (examDate === today) return { status: 'today', examDate, examId: exam.id };
    if (examDate < today) return { status: 'absent', examDate, examId: exam.id };
    return { status: 'upcoming', examDate, examId: exam.id };
  };

  const stats = useMemo(() => {
    const results = { today: 0, completed: 0, pending: 0, absent: 0 };
    students.forEach((s: Student) => {
      const { status } = getStudentExamStatus(s);
      if (status === 'today') results.today++;
      else if (status === 'completed') results.completed++;
      else if (status === 'absent') results.absent++;
      else if (status === 'upcoming') results.pending++;
      else if (status === 'unscheduled') results.pending++;
    });
    return results;
  }, [students, studentExamMap]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedStudents(new Set(students.map((s: any) => s.id)));
    else setSelectedStudents(new Set());
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSet = new Set(selectedStudents);
    if (checked) newSet.add(studentId);
    else newSet.delete(studentId);
    setSelectedStudents(newSet);
  };

  const handleBulkSetExamDate = async () => {
    if (selectedStudents.size === 0 || !bulkExamDate) return;
    const result = await bulkSetAsync.execute(Array.from(selectedStudents), currentYearMonth, bulkExamDate);
    if (result.success) {
      addToast(`${selectedStudents.size}명의 시험일이 지정되었습니다.`, 'success');
      setSelectedStudents(new Set());
      setBulkExamDate('');
      await fetchAllData();
    } else {
      addToast(result.error?.message || '실패했습니다.', 'error');
    }
  };

  const handleMarkCompleted = async (student: Student) => {
    const { examId, status } = getStudentExamStatus(student);
    if (status === 'completed' || !examId) return;
    if (!confirm('시험 완료 처리하시겠습니까?')) return;
    const result = await markCompletedAsync.execute(examId, currentUser?.teacher?.id || '');
    if (result.success) {
      addToast('시험 완료 처리되었습니다.', 'success');
      await fetchAllData();
    }
  };

  const handleAbsence = (student: Student) => {
    const { examDate } = getStudentExamStatus(student);
    setSelectedStudentForAbsence({ ...student, examDate });
    setIsAbsenceModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon="event" iconColor="blue" label="오늘 시험" value={stats.today} />
        <StatCard icon="check_circle" iconColor="green" label="완료" value={stats.completed} />
        <StatCard icon="pending" iconColor="amber" label="진행/대기" value={stats.pending} />
        <StatCard icon="cancel" iconColor="rose" label="결시" value={stats.absent} />
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--primary-light)', border: '1px solid var(--primary-border)' }}>
        <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>
          선택된 학생: {selectedStudents.size}명
        </span>
        <input type="date" className="search-input" style={{ width: '160px' }} value={bulkExamDate} onChange={(e) => setBulkExamDate(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={handleBulkSetExamDate} disabled={bulkSetAsync.isLoading || selectedStudents.size === 0}>
          <span className="material-symbols-outlined">event</span>일괄 시험일 지정
        </button>
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center' }}>
                <input type="checkbox" checked={selectedStudents.size === students.length && students.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} />
              </th>
              <th>이름</th>
              <th>학년</th>
              <th>시험 예정일</th>
              <th>상태</th>
              <th style={{ textAlign: 'center' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student: Student) => {
              const { status, examDate } = getStudentExamStatus(student);
              return (
                <tr key={student.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedStudents.has(student.id)} onChange={(e) => handleSelectStudent(student.id, e.target.checked)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  <td><span className={`grade-badge ${student.grade.toLowerCase()}`}>{student.grade}</span></td>
                  <td>
                    {examDate ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
                        {examDate}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>미지정</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${status === 'completed' ? 'success' : status === 'today' ? 'info' : status === 'absent' ? 'danger' : status === 'upcoming' ? 'warning' : 'neutral'}`}>
                      {status === 'completed' ? '완료' : status === 'today' ? '오늘' : status === 'absent' ? '결시' : status === 'upcoming' ? '예정' : '미지정'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn-icon" onClick={() => handleMarkCompleted(student)} title="시험 완료" disabled={status === 'completed' || status === 'unscheduled'}>
                        <span className="material-symbols-outlined">check_circle</span>
                      </button>
                      <button className="btn-icon" onClick={() => handleAbsence(student)} title="결시 처리" disabled={status === 'unscheduled'}>
                        <span className="material-symbols-outlined">event_busy</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAbsenceModalOpen && selectedStudentForAbsence && (
        <AbsenceModal
          student={selectedStudentForAbsence}
          onClose={() => setIsAbsenceModalOpen(false)}
          onSubmit={async (reason: string) => {
            if (!selectedStudentForAbsence) return;
            if (!selectedStudentForAbsence.examDate) {
              addToast('시험일이 지정되지 않아 결시 처리할 수 없습니다.', 'error');
              return;
            }
            const result = await createAbsenceAsync.execute(selectedStudentForAbsence.id, selectedStudentForAbsence.name, selectedStudentForAbsence.examDate, reason, currentYearMonth);
            if (result.success) {
              addToast('결시 처리되었습니다.', 'success');
              setIsAbsenceModalOpen(false);
              await fetchAllData();
            } else {
              addToast(result.error?.message || '결시 처리에 실패했습니다.', 'error');
            }
          }}
        />
      )}
    </div>
  );
}

// ==================== 과목별 시험지 탭 ====================
function TemplatesTab({ exams }: { exams: Exam[] }) {
  const { fetchAllData } = useReportStore();
  const { addToast } = useToastStore();
  const updateAsync = useAsync(updateExamDifficulty);

  // 템플릿용(studentId 없는) 시험지만 필터링
  const templates = exams.filter(e => !e.studentId);

  const handleUpdateDifficulty = async (id: string, diff: DifficultyGrade) => {
    const result = await updateAsync.execute(id, diff);
    if (result.success) {
      addToast('난이도가 수정되었습니다.', 'success');
      await fetchAllData();
    }
  };

  return (
    <div
      className="grid"
      data-testid="templates-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}
    >
      {templates.map(exam => (
        <div key={exam.id} className="card" style={{ padding: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span className="subject-badge" style={{ padding: '4px 12px', fontSize: '13px' }}>{exam.subject}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{exam.yearMonth}</span>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px', fontWeight: 500 }}>기본 난이도</label>
            <select
              className="search-input"
              style={{ width: '100%', fontWeight: 600 }}
              value={exam.difficulty}
              onChange={(e) => handleUpdateDifficulty(exam.id, e.target.value as DifficultyGrade)}
            >
              {['A', 'B', 'C', 'D', 'E', 'F'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', minHeight: '40px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>범위:</span><br />
            {exam.scope || '미지정'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            등록자: {exam.uploadedBy}
          </div>
          {exam.examFileUrl && (
            <a href={exam.examFileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ width: '100%', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>attachment</span>시험지/답지 보기
            </a>
          )}
        </div>
      ))}
      {templates.length === 0 && (
        <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '60px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-muted)' }}>description</span>
          <div className="empty-state-title">등록된 시험지 템플릿이 없습니다.</div>
        </div>
      )}
    </div>
  );
}

// ==================== 서브 컴포넌트들 ====================

function StatCard({ icon, iconColor, label, value }: any) {
  const colorMap: Record<string, string> = { blue: '#3b82f6', green: '#10b981', rose: '#f43f5e', amber: '#f59e0b' };
  return (
    <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${colorMap[iconColor]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorMap[iconColor] }}>
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function AbsenceModal({ student, onClose, onSubmit }: any) {
  const [absenceReason, setAbsenceReason] = useState('병결');
  const [customReason, setCustomReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '400px', padding: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>결시 처리 - {student.name}</h2>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>원래 시험일</label>
          <input className="search-input" style={{ width: '100%' }} value={student.examDate || ''} disabled />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>결시 사유</label>
          <select className="search-input" style={{ width: '100%' }} value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)}>
            <option>병결</option><option>개인 사정</option><option>학교 행사</option><option>가족 행사</option><option>기타</option>
          </select>
        </div>
        {absenceReason === '기타' && (
          <input className="search-input" style={{ width: '100%', marginTop: '8px' }} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="사유를 입력하세요" />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={() => onSubmit(absenceReason === '기타' ? customReason : absenceReason)}>저장</button>
        </div>
      </div>
    </div>
  );
}

function ExamTemplateModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({ subject: '국어', difficulty: 'A' as DifficultyGrade, scope: '' });
  const { currentYearMonth, currentUser, fetchAllData } = useReportStore();
  const createAsync = useAsync(createExamEntry);
  const { addToast } = useToastStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createAsync.execute({ ...formData, yearMonth: currentYearMonth, uploadedBy: currentUser?.teacher?.name || '관리자' });
    if (result.success) {
      addToast('시험지가 등록되었습니다.', 'success');
      await fetchAllData();
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '400px', padding: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>새 시험지 정보 등록</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>과목</label>
            <select className="search-input" style={{ width: '100%' }} value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })}>
              {['국어', '영어', '수학', '사회', '과학', '기타'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>기본 난이도</label>
            <select className="search-input" style={{ width: '100%' }} value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value as DifficultyGrade })}>
              {['A', 'B', 'C', 'D', 'E', 'F'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>시험 범위</label>
            <input className="search-input" style={{ width: '100%' }} value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value })} placeholder="예: 평면좌표 ~ 원의 방정식" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={createAsync.isLoading}>등록하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}
