import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchStudents, fetchTeachers, updateScores } from '../services/notion';
import { EditScoreModal } from '../components';
import type { Student, MonthlyReport, SubjectScore } from '../types';

export default function AdminPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    logout,
    students,
    setStudents,
    teachers,
    setTeachers,
    reports,
    setReports,
    currentYearMonth,
    setCurrentYearMonth,
    setCurrentReport,
    addSendHistory,
  } = useReportStore();

  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null);

  // 점수 수정 모달
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    // 관리자가 아니면 일반 선생님 페이지로
    if (!currentUser.teacher.isAdmin) {
      navigate('/teacher');
      return;
    }

    const loadData = async () => {
      const [studentsData, teachersData] = await Promise.all([
        fetchStudents(),
        fetchTeachers(),
      ]);
      setStudents(studentsData);
      setTeachers(teachersData);
      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate, setStudents, setTeachers]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getStudentReport = (studentId: string): MonthlyReport | undefined => {
    return reports.find((r) => r.studentId === studentId && r.yearMonth === currentYearMonth);
  };

  const getReportStatus = (student: Student): { status: string; color: string; progress: string } => {
    const report = getStudentReport(student.id);
    if (!report || report.scores.length === 0) {
      return { status: '미입력', color: '#dc2626', progress: '0/' + student.subjects.length };
    }

    const enteredCount = report.scores.length;
    const totalCount = student.subjects.length;

    if (enteredCount < totalCount) {
      return { status: '진행중', color: '#f59e0b', progress: `${enteredCount}/${totalCount}` };
    }

    if (report.status === 'sent') {
      return { status: '전송완료', color: '#16a34a', progress: `${enteredCount}/${totalCount}` };
    }

    return { status: '입력완료', color: '#2563eb', progress: `${enteredCount}/${totalCount}` };
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handlePreview = (student: Student) => {
    const report = getStudentReport(student.id);
    if (report) {
      setCurrentReport(report);
      navigate('/preview');
    }
  };

  const handleBulkSend = async () => {
    if (selectedStudents.size === 0) {
      alert('전송할 학생을 선택해주세요.');
      return;
    }

    setSending(true);
    setSendResult(null);

    let success = 0;
    let failed = 0;

    for (const studentId of selectedStudents) {
      const student = students.find((s) => s.id === studentId);
      const report = getStudentReport(studentId);

      if (!student || !report) {
        failed++;
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        success++;
        addSendHistory({
          studentId: student.id,
          studentName: student.name,
          reportId: report.id,
          recipientName: student.parentName || '학부모',
          recipientType: 'parent',
          sentAt: new Date().toISOString(),
          status: 'success',
        });
      } else {
        failed++;
        addSendHistory({
          studentId: student.id,
          studentName: student.name,
          reportId: report.id,
          recipientName: student.parentName || '학부모',
          recipientType: 'parent',
          sentAt: new Date().toISOString(),
          status: 'failed',
          errorMessage: '전송 실패 (목업)',
        });
      }
    }

    setSendResult({ success, failed });
    setSending(false);
    setSelectedStudents(new Set());
  };

  // 점수 수정 모달 열기
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
  };

  // 점수 저장 핸들러 (EditScoreModal에서 호출)
  const handleSaveScores = useCallback(async (studentId: string, scores: SubjectScore[]): Promise<boolean> => {
    const student = students.find(s => s.id === studentId);
    if (!student) return false;

    const success = await updateScores(
      studentId,
      student.name,
      currentYearMonth,
      scores
    );

    if (success) {
      // 로컬 상태 업데이트
      const existingReport = getStudentReport(studentId);
      if (existingReport) {
        const updatedReports = reports.map(r =>
          r.id === existingReport.id
            ? { ...r, scores, updatedAt: new Date().toISOString() }
            : r
        );
        setReports(updatedReports);
      } else {
        // 새 리포트 생성
        const newReport: MonthlyReport = {
          id: `${studentId}-${currentYearMonth}`,
          studentId,
          studentName: student.name,
          yearMonth: currentYearMonth,
          scores,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setReports([...reports, newReport]);
      }
    }

    return success;
  }, [students, currentYearMonth, reports, setReports]);

  if (!currentUser) return null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  const completedCount = students.filter((s) => {
    const status = getReportStatus(s);
    return status.status === '입력완료' || status.status === '전송완료';
  }).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#1e40af', color: '#ffffff', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>관리자 대시보드</h1>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>{currentUser.teacher.name} 선생님</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="month"
              value={currentYearMonth}
              onChange={(e) => setCurrentYearMonth(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: 'none' }}
            />
            <button
              onClick={() => navigate('/teacher')}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              점수 입력
            </button>
            <button
              onClick={() => navigate('/students')}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              학생 관리
            </button>
            <button
              onClick={() => navigate('/schedule')}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              시험 일정
            </button>
            <button
              onClick={() => navigate('/exams')}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              시험지
            </button>
            <button
              onClick={() => navigate('/bulk-send')}
              style={{ padding: '8px 16px', backgroundColor: '#facc15', color: '#1f2937', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
            >
              일괄 전송
            </button>
            <button
              onClick={() => navigate('/settings')}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              설정
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 통계 카드 */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>전체 학생</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>{students.length}명</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>입력 완료</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{completedCount}명</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>진행률</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
              {students.length > 0 ? Math.round((completedCount / students.length) * 100) : 0}%
            </p>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>선생님</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed' }}>{teachers.length}명</p>
          </div>
        </div>

        {/* 일괄 전송 영역 */}
        <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontWeight: '600', color: '#854d0e', marginBottom: '4px' }}>
                카카오톡 일괄 전송 (목업)
              </h3>
              <p style={{ fontSize: '14px', color: '#a16207' }}>
                선택한 학생의 리포트를 학부모에게 전송합니다.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {sendResult && (
                <span style={{ fontSize: '14px' }}>
                  <span style={{ color: '#16a34a' }}>성공: {sendResult.success}</span>
                  {sendResult.failed > 0 && <span style={{ color: '#dc2626', marginLeft: '8px' }}>실패: {sendResult.failed}</span>}
                </span>
              )}
              <button
                onClick={handleBulkSend}
                disabled={sending || selectedStudents.size === 0}
                style={{
                  padding: '12px 24px',
                  backgroundColor: sending || selectedStudents.size === 0 ? '#d1d5db' : '#facc15',
                  color: '#1f2937',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: sending || selectedStudents.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? '전송 중...' : `선택 전송 (${selectedStudents.size}명)`}
              </button>
            </div>
          </div>
        </div>

        {/* 학생 목록 테이블 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{currentYearMonth} 월말평가 현황</h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '12px 24px', textAlign: 'center', width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectedStudents.size === students.length && students.length > 0}
                    onChange={handleSelectAll}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학생</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학년</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>수강 과목</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>진행</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>상태</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const statusInfo = getReportStatus(student);
                const report = getStudentReport(student.id);

                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id)}
                        onChange={() => handleSelectStudent(student.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontWeight: '500' }}>{student.name}</span>
                      {student.parentName && (
                        <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: '8px' }}>
                          ({student.parentName})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{student.grade}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {student.subjects.map((subject) => {
                          const hasScore = report?.scores.some((s) => s.subject === subject);
                          return (
                            <span
                              key={subject}
                              style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                                borderRadius: '9999px',
                                backgroundColor: hasScore ? '#dcfce7' : '#f3f4f6',
                                color: hasScore ? '#166534' : '#6b7280',
                              }}
                            >
                              {subject}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center', color: '#6b7280' }}>
                      {statusInfo.progress}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '9999px',
                          backgroundColor: statusInfo.color + '20',
                          color: statusInfo.color,
                        }}
                      >
                        {statusInfo.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(student)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handlePreview(student)}
                          disabled={!report || report.scores.length === 0}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            backgroundColor: report && report.scores.length > 0 ? '#eff6ff' : '#f3f4f6',
                            color: report && report.scores.length > 0 ? '#2563eb' : '#9ca3af',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: report && report.scores.length > 0 ? 'pointer' : 'not-allowed',
                          }}
                        >
                          미리보기
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 점수 수정 모달 */}
      {editingStudent && (
        <EditScoreModal
          student={editingStudent}
          currentYearMonth={currentYearMonth}
          existingReport={getStudentReport(editingStudent.id)}
          onSave={handleSaveScores}
          onClose={() => setEditingStudent(null)}
        />
      )}
    </div>
  );
}
