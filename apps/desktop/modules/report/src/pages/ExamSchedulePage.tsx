import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import {
  fetchStudents,
  fetchAbsenceHistories,
  createAbsenceHistory,
  updateAbsenceHistory as updateAbsenceHistoryApi,
  fetchStudentAbsenceHistories,
  fetchExamSchedules,
  upsertExamSchedule,
  bulkUpsertExamSchedules,
} from '../services/notion';
import type { Student, AbsenceHistory, ExamStatus } from '../types';

type TabType = 'today' | 'absent' | 'upcoming' | 'history';

const ABSENCE_REASONS = ['병결', '개인 사정', '학교 행사', '가족 행사', '기타'];

// 시험 상태별 색상
const STATUS_COLORS: Record<ExamStatus, { bg: string; text: string; label: string }> = {
  completed: { bg: '#dcfce7', text: '#166534', label: '완료' },
  today: { bg: '#fef9c3', text: '#854d0e', label: '오늘' },
  absent: { bg: '#fee2e2', text: '#dc2626', label: '결시' },
  retest_pending: { bg: '#dbeafe', text: '#1e40af', label: '재시험 대기' },
  upcoming: { bg: '#f3f4f6', text: '#374151', label: '예정' },
  unscheduled: { bg: '#fecaca', text: '#dc2626', label: '미지정' },
};

export default function ExamSchedulePage() {
  const navigate = useNavigate();
  const {
    currentUser,
    students,
    setStudents,
    reports,
    currentYearMonth,
    absenceHistories,
    setAbsenceHistories,
    addAbsenceHistory,
    updateAbsenceHistory: updateAbsenceHistoryStore,
    examSchedules,
    setExamSchedules,
    upsertExamSchedule: upsertExamScheduleStore,
  } = useReportStore();

  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // 결시 처리 모달
  const [absenceModal, setAbsenceModal] = useState<Student | null>(null);
  const [newExamDate, setNewExamDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // 일괄 날짜 지정 모달
  const [bulkDateModal, setBulkDateModal] = useState(false);
  const [bulkDate, setBulkDate] = useState('');

  // 결시 이력 조회 모달
  const [historyModal, setHistoryModal] = useState<Student | null>(null);
  const [studentHistories, setStudentHistories] = useState<AbsenceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, [currentYearMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studentsData, historiesData, schedulesData] = await Promise.all([
        fetchStudents(),
        fetchAbsenceHistories(currentYearMonth),
        fetchExamSchedules(currentYearMonth),
      ]);
      setStudents(studentsData);
      setAbsenceHistories(historiesData);
      setExamSchedules(schedulesData);
    } finally {
      setIsLoading(false);
    }
  };

  // 학생의 현재 월 시험일 가져오기
  const getStudentExamDate = useCallback((studentId: string): string | undefined => {
    const schedule = examSchedules.find(
      s => s.studentId === studentId && s.yearMonth === currentYearMonth
    );
    return schedule?.examDate;
  }, [examSchedules, currentYearMonth]);

  // 학생의 시험 상태 판단 (점수 입력 여부 기반)
  const getStudentExamStatus = useCallback((student: Student): ExamStatus => {
    // 해당 월의 리포트 확인
    const report = reports.find(
      r => r.studentId === student.id && r.yearMonth === currentYearMonth
    );

    // 점수가 입력되어 있으면 완료
    const hasScores = report && report.scores.length > 0;
    if (hasScores) {
      return 'completed';
    }

    // 결시 이력이 있고 재시험일이 지정된 경우
    const absenceRecord = absenceHistories.find(
      h => h.studentId === student.id && h.yearMonth === currentYearMonth && !h.retestCompleted
    );
    if (absenceRecord && absenceRecord.retestDate) {
      if (absenceRecord.retestDate === today) {
        return 'today';
      }
      if (absenceRecord.retestDate > today) {
        return 'retest_pending';
      }
    }

    // 월별 시험 일정에서 시험일 가져오기
    const examDate = getStudentExamDate(student.id);

    // 시험일 기준 판단
    if (!examDate) {
      return 'unscheduled';
    }

    if (examDate === today) {
      return 'today';
    }

    if (examDate > today) {
      return 'upcoming';
    }

    // 시험일이 지났는데 점수가 없으면 결시
    return 'absent';
  }, [reports, currentYearMonth, absenceHistories, today, getStudentExamDate]);

  // 필터링된 학생 목록
  const { todayStudents, absentStudents, upcomingStudents } = useMemo(() => {
    const todayList: Student[] = [];
    const absentList: Student[] = [];
    const upcomingList: Student[] = [];

    students.forEach(student => {
      if (student.status === 'inactive') return;

      const status = getStudentExamStatus(student);
      const examDate = getStudentExamDate(student.id);

      switch (status) {
        case 'today':
        case 'completed':
          // 오늘 시험인 학생 (완료 포함)
          if (examDate === today ||
              absenceHistories.some(h => h.studentId === student.id && h.retestDate === today)) {
            todayList.push(student);
          }
          break;
        case 'absent':
        case 'unscheduled':
        case 'retest_pending':
          absentList.push(student);
          break;
        case 'upcoming':
          upcomingList.push(student);
          break;
      }
    });

    return { todayStudents: todayList, absentStudents: absentList, upcomingStudents: upcomingList };
  }, [students, getStudentExamStatus, getStudentExamDate, today, absenceHistories]);

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

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (studentList: Student[]) => {
    const allIds = studentList.map(s => s.id);
    const allSelected = allIds.every(id => selectedStudents.has(id));

    if (allSelected) {
      setSelectedStudents(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedStudents(prev => new Set([...prev, ...allIds]));
    }
  };

  const openAbsenceModal = (student: Student) => {
    setAbsenceModal(student);
    setNewExamDate('');
    setAbsenceReason('');
    setCustomReason('');
  };

  const handleSaveAbsence = async () => {
    if (!absenceModal) return;

    setIsLoading(true);
    try {
      const reason = absenceReason === '기타' ? customReason : absenceReason;
      const originalDate = getStudentExamDate(absenceModal.id) || today;

      // 1. 결시 이력 생성
      const history = await createAbsenceHistory(
        absenceModal.id,
        absenceModal.name,
        originalDate,
        reason,
        currentYearMonth,
        newExamDate || undefined
      );

      if (history) {
        addAbsenceHistory(history);
      }

      // 2. 시험 일정 업데이트 (재시험일 지정)
      if (newExamDate) {
        const schedule = await upsertExamSchedule(
          absenceModal.id,
          absenceModal.name,
          currentYearMonth,
          newExamDate
        );
        if (schedule) {
          upsertExamScheduleStore(schedule);
        }
      }

      setAbsenceModal(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDateChange = async () => {
    if (selectedStudents.size === 0 || !bulkDate) {
      alert('학생과 날짜를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const selectedStudentList = students
        .filter(s => selectedStudents.has(s.id))
        .map(s => ({ id: s.id, name: s.name }));

      const success = await bulkUpsertExamSchedules(selectedStudentList, currentYearMonth, bulkDate);
      if (success) {
        // 로컬 상태 업데이트
        selectedStudentList.forEach(student => {
          upsertExamScheduleStore({
            id: `local-${student.id}-${currentYearMonth}`,
            studentId: student.id,
            studentName: student.name,
            yearMonth: currentYearMonth,
            examDate: bulkDate,
          });
        });
        setSelectedStudents(new Set());
        setBulkDateModal(false);
        setBulkDate('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDateSet = async (studentId: string, date: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    setIsLoading(true);
    try {
      const schedule = await upsertExamSchedule(studentId, student.name, currentYearMonth, date);
      if (schedule) {
        upsertExamScheduleStore(schedule);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 결시 이력 조회
  const openHistoryModal = async (student: Student) => {
    setHistoryModal(student);
    setLoadingHistory(true);
    try {
      const histories = await fetchStudentAbsenceHistories(student.id);
      setStudentHistories(histories);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 재시험 완료 처리
  const handleMarkRetestComplete = async (historyId: string) => {
    setLoadingHistory(true);
    try {
      const success = await updateAbsenceHistoryApi(historyId, { retestCompleted: true });
      if (success) {
        const updatedHistory = studentHistories.find(h => h.id === historyId);
        if (updatedHistory) {
          const updated = { ...updatedHistory, retestCompleted: true };
          setStudentHistories(prev => prev.map(h => h.id === historyId ? updated : h));
          updateAbsenceHistoryStore(updated);
        }
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#ffffff' : 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const renderStudentList = (studentList: Student[], showAbsence: boolean = false) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '14px 16px', textAlign: 'center', width: '50px' }}>
            <input
              type="checkbox"
              checked={studentList.length > 0 && studentList.every(s => selectedStudents.has(s.id))}
              onChange={() => handleSelectAll(studentList)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>이름</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학년</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>수강과목</th>
          <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>상태</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>시험일</th>
          {showAbsence && (
            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>결시사유</th>
          )}
          <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>관리</th>
        </tr>
      </thead>
      <tbody>
        {studentList.length === 0 ? (
          <tr>
            <td colSpan={showAbsence ? 8 : 7} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              해당하는 학생이 없습니다.
            </td>
          </tr>
        ) : (
          studentList.map((student, idx) => {
            const status = getStudentExamStatus(student);
            const statusStyle = STATUS_COLORS[status];
            const absenceRecord = absenceHistories.find(
              h => h.studentId === student.id && h.yearMonth === currentYearMonth
            );

            return (
              <tr key={student.id} style={{ borderBottom: idx < studentList.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => handleSelectStudent(student.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1f2937' }}>{student.name}</td>
                <td style={{ padding: '14px 16px', color: '#6b7280' }}>{student.grade}</td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {student.subjects.map(sub => (
                      <span
                        key={sub}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <span
                    style={{
                      padding: '4px 12px',
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.text,
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    {statusStyle.label}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                  {(() => {
                    const examDate = getStudentExamDate(student.id);
                    if (absenceRecord?.retestDate) {
                      return (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>
                            {absenceRecord.originalDate}
                          </span>
                          {' → '}
                          <span style={{ color: '#2563eb', fontWeight: '500' }}>
                            {absenceRecord.retestDate}
                          </span>
                        </span>
                      );
                    }
                    if (examDate) {
                      return examDate;
                    }
                    return <span style={{ color: '#dc2626' }}>미지정</span>;
                  })()}
                </td>
                {showAbsence && (
                  <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                    {absenceRecord?.absenceReason || student.absenceReason || '-'}
                  </td>
                )}
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {status === 'completed' ? (
                      <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: '500' }}>
                        점수 입력됨
                      </span>
                    ) : status === 'today' ? (
                      <button
                        onClick={() => openAbsenceModal(student)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        결시 처리
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleQuickDateSet(student.id, today)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          오늘로
                        </button>
                        <button
                          onClick={() => openAbsenceModal(student)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          날짜 변경
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openHistoryModal(student)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#e0e7ff',
                        color: '#4338ca',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      이력
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  // 전체 결시 이력 탭
  const renderHistoryTab = () => (
    <div style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
        {currentYearMonth} 결시 이력
      </h3>
      {absenceHistories.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
          결시 이력이 없습니다.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학생</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>원래 시험일</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>결시 사유</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>재시험일</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {absenceHistories.map((history, idx) => {
              const student = students.find(s => s.id === history.studentId);
              return (
                <tr key={history.id} style={{ borderBottom: idx < absenceHistories.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1f2937' }}>
                    {student?.name || history.studentName || '알 수 없음'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{history.originalDate}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{history.absenceReason}</td>
                  <td style={{ padding: '12px 16px', color: history.retestDate ? '#2563eb' : '#9ca3af' }}>
                    {history.retestDate || '미지정'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        backgroundColor: history.retestCompleted ? '#dcfce7' : '#fef9c3',
                        color: history.retestCompleted ? '#166534' : '#854d0e',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {history.retestCompleted ? '재시험 완료' : '재시험 대기'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>시험 일정 관리</h1>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>오늘: {today} | {currentYearMonth} 월말평가</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                // 활성 학생 전체 선택
                const activeStudentIds = students
                  .filter(s => s.status !== 'inactive')
                  .map(s => s.id);
                setSelectedStudents(new Set(activeStudentIds));
                setBulkDateModal(true);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FF6B00',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              전체 일괄 날짜 지정
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e0e7ff',
                color: '#4338ca',
                borderRadius: '8px',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '로딩...' : '새로고침'}
            </button>
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
        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div
            onClick={() => setActiveTab('today')}
            style={{
              backgroundColor: activeTab === 'today' ? '#eff6ff' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'today' ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>오늘 시험</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{todayStudents.length}명</p>
          </div>
          <div
            onClick={() => setActiveTab('absent')}
            style={{
              backgroundColor: activeTab === 'absent' ? '#fef2f2' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'absent' ? '2px solid #dc2626' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>결시/미지정/재시험</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{absentStudents.length}명</p>
          </div>
          <div
            onClick={() => setActiveTab('upcoming')}
            style={{
              backgroundColor: activeTab === 'upcoming' ? '#f0fdf4' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'upcoming' ? '2px solid #16a34a' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>예정 학생</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>{upcomingStudents.length}명</p>
          </div>
          <div
            onClick={() => setActiveTab('history')}
            style={{
              backgroundColor: activeTab === 'history' ? '#faf5ff' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'history' ? '2px solid #7c3aed' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>결시 이력</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed' }}>{absenceHistories.length}건</p>
          </div>
        </div>

        {/* 일괄 처리 버튼 */}
        {selectedStudents.size > 0 && (
          <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#854d0e', fontWeight: '500' }}>
                {selectedStudents.size}명 선택됨
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setSelectedStudents(new Set())}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  선택 해제
                </button>
                <button
                  onClick={() => setBulkDateModal(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  일괄 날짜 지정
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px 12px 0 0', display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button style={tabStyle(activeTab === 'today')} onClick={() => setActiveTab('today')}>
            오늘 시험
            <span style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {todayStudents.length}
            </span>
          </button>
          <button style={tabStyle(activeTab === 'absent')} onClick={() => setActiveTab('absent')}>
            결시/미지정
            <span style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {absentStudents.length}
            </span>
          </button>
          <button style={tabStyle(activeTab === 'upcoming')} onClick={() => setActiveTab('upcoming')}>
            예정 학생
            <span style={{
              backgroundColor: '#16a34a',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {upcomingStudents.length}
            </span>
          </button>
          <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>
            결시 이력
            <span style={{
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {absenceHistories.length}
            </span>
          </button>
        </div>

        {/* 학생 목록 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {activeTab === 'today' && renderStudentList(todayStudents)}
          {activeTab === 'absent' && renderStudentList(absentStudents, true)}
          {activeTab === 'upcoming' && renderStudentList(upcomingStudents)}
          {activeTab === 'history' && renderHistoryTab()}
        </div>
      </main>

      {/* 결시/날짜변경 모달 */}
      {absenceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setAbsenceModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              {absenceModal.name} ({absenceModal.grade})
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              {activeTab === 'today' ? '결시 처리 및 재시험일 지정' : '시험일 변경'}
            </p>

            {/* 새 시험일 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                {activeTab === 'today' ? '재시험일' : '새 시험일'}
              </label>
              <input
                type="date"
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                min={today}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 결시 사유 */}
            {activeTab === 'today' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                  결시 사유
                </label>
                <select
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    marginBottom: absenceReason === '기타' ? '12px' : 0,
                  }}
                >
                  <option value="">선택하세요</option>
                  {ABSENCE_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                {absenceReason === '기타' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="사유 입력"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setAbsenceModal(null)}
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
                onClick={handleSaveAbsence}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 날짜 지정 모달 */}
      {bulkDateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setBulkDateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              일괄 시험일 지정
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              {selectedStudents.size}명의 학생에게 동일한 시험일을 지정합니다.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                시험일
              </label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                min={today}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setBulkDateModal(false)}
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
                onClick={handleBulkDateChange}
                disabled={isLoading || !bulkDate}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isLoading || !bulkDate ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading || !bulkDate ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 결시 이력 조회 모달 */}
      {historyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setHistoryModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              {historyModal.name}님의 결시 이력
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              전체 결시 기록을 확인합니다.
            </p>

            {loadingHistory ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>로딩 중...</p>
            ) : studentHistories.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>결시 이력이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {studentHistories.map(history => (
                  <div
                    key={history.id}
                    style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500', color: '#374151' }}>{history.yearMonth}</span>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: history.retestCompleted ? '#dcfce7' : '#fef9c3',
                          color: history.retestCompleted ? '#166534' : '#854d0e',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '500',
                        }}
                      >
                        {history.retestCompleted ? '완료' : '대기'}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      원래 시험일: {history.originalDate}
                    </p>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      사유: {history.absenceReason}
                    </p>
                    <p style={{ fontSize: '13px', color: history.retestDate ? '#2563eb' : '#9ca3af' }}>
                      재시험일: {history.retestDate || '미지정'}
                    </p>
                    {!history.retestCompleted && history.retestDate && (
                      <button
                        onClick={() => handleMarkRetestComplete(history.id)}
                        disabled={loadingHistory}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        재시험 완료 처리
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setHistoryModal(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
