import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

interface ClassInfo {
  id: string;
  name: string;
  grade?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  instructor_id?: string;
}

interface StudentInfo {
  id: string;
  name: string;
  status?: string;
  assignment_id?: string;
  // 출석 상태
  attendance_status?: 'present' | 'absent' | 'late' | 'makeup' | null;
  // 사전 결석 정보
  absence_id?: string;
  reason?: string;
  notified_by?: string;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const ABSENCE_REASONS = ['병원', '가족행사', '학원변경', '개인사유', '미통보'];

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getTodayDow() {
  return new Date().getDay();
}

export default function TimerPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [classStudents, setClassStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // 수업 마침 모달
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [uncheckedStudents, setUncheckedStudents] = useState<StudentInfo[]>([]);
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [finishLoading, setFinishLoading] = useState(false);

  // 퇴근 모달
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [copyDone, setCopyDone] = useState(false);

  const today = getToday();
  const todayDow = getTodayDow();

  // 수업 목록 로드
  useEffect(() => {
    api.getClasses()
      .then((data) => {
        setClasses(data || []);
        const filtered = (data || []).filter((c: ClassInfo) => c.day_of_week === todayDow);
        setTodayClasses(filtered);
        if (filtered.length > 0) setSelectedClass(filtered[0]);
      })
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [todayDow]);

  // 수업별 학생 + 출석 로드
  const loadClassStudents = useCallback(async (classInfo: ClassInfo) => {
    try {
      const [students, attendance] = await Promise.all([
        api.getClassStudents(classInfo.id),
        api.getAttendance(classInfo.id, today),
      ]);

      const merged: StudentInfo[] = (students || []).map((s: any) => {
        const att = (attendance || []).find((a: any) => a.student_id === s.id);
        return {
          ...s,
          attendance_status: att?.status || null,
        };
      });

      setClassStudents(merged);
    } catch {
      setClassStudents([]);
    }
  }, [today]);

  useEffect(() => {
    if (selectedClass) loadClassStudents(selectedClass);
  }, [selectedClass, loadClassStudents]);

  // 출석 체크
  const handleAttendance = async (student: StudentInfo, status: 'present' | 'late') => {
    if (!selectedClass) return;
    try {
      await api.recordAttendance({
        studentId: student.id,
        classId: selectedClass.id,
        date: today,
        status,
      });
      await loadClassStudents(selectedClass);
    } catch (err) {
      alert('출석 기록 실패: ' + (err as Error).message);
    }
  };

  // 수업 마침
  const handleFinishClass = async () => {
    if (!selectedClass) return;
    try {
      const unchecked = await api.getUncheckedStudents(selectedClass.id, today);
      setUncheckedStudents(unchecked || []);
      // 사전 통보된 학생은 이유 미리 채우기
      const reasons: Record<string, string> = {};
      (unchecked || []).forEach((s: any) => {
        reasons[s.id] = s.reason || '미통보';
      });
      setAbsenceReasons(reasons);
      setFinishModalOpen(true);
    } catch (err) {
      alert('미출석자 조회 실패: ' + (err as Error).message);
    }
  };

  // 결석 기록 및 수업 마침
  const handleConfirmFinish = async () => {
    if (!selectedClass || uncheckedStudents.length === 0) {
      setFinishModalOpen(false);
      return;
    }
    setFinishLoading(true);
    try {
      await api.recordAbsenceBatch(
        uncheckedStudents.map((s) => ({
          studentId: s.id,
          classId: selectedClass.id,
          absenceDate: today,
          reason: absenceReasons[s.id] || '미통보',
          notifiedBy: '',
        }))
      );
      setFinishModalOpen(false);
      await loadClassStudents(selectedClass);
    } catch (err) {
      alert('결석 기록 실패: ' + (err as Error).message);
    } finally {
      setFinishLoading(false);
    }
  };

  // 퇴근
  const handleLeave = async () => {
    try {
      const summary = await api.getDailySummary(today);
      setDailySummary(summary);
      setCopyDone(false);
      setLeaveModalOpen(true);
    } catch (err) {
      alert('요약 조회 실패: ' + (err as Error).message);
    }
  };

  const handleCopyClipboard = async () => {
    if (!dailySummary?.clipboardText) return;
    try {
      await navigator.clipboard.writeText(dailySummary.clipboardText);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = dailySummary.clipboardText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    }
  };

  const presentCount = classStudents.filter((s) => s.attendance_status === 'present' || s.attendance_status === 'late').length;
  const totalStudents = classStudents.length;

  return (
    <div>
      <div className="timer-header">
        <h2 className="page-title">시간표</h2>
        <span className="timer-date">
          {today} ({DAY_NAMES[todayDow]})
        </span>
        <div className="timer-actions">
          <button className="btn btn-finish" onClick={handleFinishClass} disabled={!selectedClass}>
            수업 마침
          </button>
          <button className="btn btn-leave" onClick={handleLeave}>
            퇴근
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : (
        <div className="timer-layout">
          {/* 좌측: 오늘 수업 목록 */}
          <div className="timer-left">
            <div className="timer-section-title">오늘 수업</div>
            {todayClasses.length === 0 ? (
              <div className="timer-empty">오늘은 수업이 없습니다</div>
            ) : (
              <div className="timer-class-list">
                {todayClasses.map((c) => (
                  <div
                    key={c.id}
                    className={`timer-class-card ${selectedClass?.id === c.id ? 'timer-class-card--active' : ''}`}
                    onClick={() => setSelectedClass(c)}
                  >
                    <div className="timer-class-name">{c.name}</div>
                    <div className="timer-class-time">
                      {c.start_time} ~ {c.end_time}
                    </div>
                    {c.grade && <div className="timer-class-grade">{c.grade}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 전체 수업 (다른 요일) */}
            {classes.filter((c) => c.day_of_week !== todayDow).length > 0 && (
              <>
                <div className="timer-section-title" style={{ marginTop: 24 }}>다른 요일</div>
                <div className="timer-class-list">
                  {classes
                    .filter((c) => c.day_of_week !== todayDow)
                    .sort((a, b) => (a.day_of_week || 0) - (b.day_of_week || 0))
                    .map((c) => (
                      <div
                        key={c.id}
                        className={`timer-class-card timer-class-card--other ${selectedClass?.id === c.id ? 'timer-class-card--active' : ''}`}
                        onClick={() => setSelectedClass(c)}
                      >
                        <div className="timer-class-name">
                          <span className="timer-dow-badge">{DAY_NAMES[c.day_of_week || 0]}</span>
                          {c.name}
                        </div>
                        <div className="timer-class-time">
                          {c.start_time} ~ {c.end_time}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

          {/* 우측: 출석 체크 */}
          <div className="timer-right">
            {selectedClass ? (
              <>
                <div className="timer-attendance-header">
                  <h3>{selectedClass.name}</h3>
                  <span className="timer-attendance-count">
                    출석 {presentCount}/{totalStudents}
                  </span>
                </div>

                {classStudents.length === 0 ? (
                  <div className="timer-empty">
                    배정된 학생이 없습니다.
                    <br />설정에서 학생을 수업에 배정해주세요.
                  </div>
                ) : (
                  <div className="timer-student-list">
                    {classStudents.map((student) => (
                      <div key={student.id} className="timer-student-row">
                        <span className="timer-student-name">{student.name}</span>
                        <div className="timer-student-actions">
                          {student.attendance_status === 'present' ? (
                            <span className="att-badge att-badge--present">출석</span>
                          ) : student.attendance_status === 'late' ? (
                            <span className="att-badge att-badge--late">지각</span>
                          ) : student.attendance_status === 'absent' ? (
                            <span className="att-badge att-badge--absent">결석</span>
                          ) : (
                            <>
                              <button
                                className="btn btn-sm btn-present"
                                onClick={() => handleAttendance(student, 'present')}
                              >
                                출석
                              </button>
                              <button
                                className="btn btn-sm btn-late"
                                onClick={() => handleAttendance(student, 'late')}
                              >
                                지각
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="timer-empty">수업을 선택하세요</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 수업 마침 모달 ═══ */}
      {finishModalOpen && (
        <div className="modal-overlay" onClick={() => setFinishModalOpen(false)}>
          <div className="modal-content modal-finish" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">수업 마침 — {selectedClass?.name}</h3>

            {uncheckedStudents.length === 0 ? (
              <div className="modal-body">
                <p className="modal-empty-msg">모든 학생이 출석했습니다!</p>
              </div>
            ) : (
              <div className="modal-body">
                <p className="modal-desc">미출석 학생 {uncheckedStudents.length}명 — 결석 사유를 선택해주세요</p>
                <div className="finish-student-list">
                  {uncheckedStudents.map((s) => (
                    <div key={s.id} className="finish-student-row">
                      <span className="finish-student-name">{s.name}</span>
                      {s.absence_id ? (
                        <span className="finish-pre-notified">사전통보: {s.reason}</span>
                      ) : (
                        <select
                          className="finish-reason-select"
                          value={absenceReasons[s.id] || '미통보'}
                          onChange={(e) =>
                            setAbsenceReasons((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        >
                          {ABSENCE_REASONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFinishModalOpen(false)}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={uncheckedStudents.length > 0 ? handleConfirmFinish : () => setFinishModalOpen(false)}
                disabled={finishLoading}
              >
                {finishLoading ? '처리 중...' : uncheckedStudents.length > 0 ? '결석 기록 및 마침' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 퇴근 모달 ═══ */}
      {leaveModalOpen && dailySummary && (
        <div className="modal-overlay" onClick={() => setLeaveModalOpen(false)}>
          <div className="modal-content modal-leave" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">퇴근 — {today} ({DAY_NAMES[todayDow]}) 요약</h3>
            <div className="modal-body">
              <div className="leave-section">
                <div className="leave-section-title">오늘 결석: {dailySummary.todayAbsences.length}명</div>
                {dailySummary.todayAbsences.length === 0 ? (
                  <p className="leave-none">결석 없음</p>
                ) : (
                  <div className="leave-list">
                    {dailySummary.todayAbsences.map((a: any, i: number) => (
                      <div key={i} className="leave-item">
                        <span className="leave-item-name">{a.student_name}</span>
                        <span className="leave-item-class">{a.class_name}</span>
                        <span className="leave-item-reason">{a.reason || '미통보'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="leave-section">
                <div className="leave-section-title">미보강 누적: {dailySummary.pendingMakeups.length}건</div>
                {dailySummary.pendingMakeups.length === 0 ? (
                  <p className="leave-none">없음</p>
                ) : (
                  <div className="leave-list">
                    {dailySummary.pendingMakeups.map((m: any, i: number) => (
                      <div key={i} className="leave-item">
                        <span className="leave-item-name">{m.student_name}</span>
                        <span className="leave-item-class">{m.absence_date} {m.class_name}</span>
                        <span className="leave-item-reason">미지정</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className={`btn ${copyDone ? 'btn-success' : 'btn-primary'}`}
                onClick={handleCopyClipboard}
              >
                {copyDone ? '복사 완료!' : '클립보드 복사'}
              </button>
              <button className="btn btn-secondary" onClick={() => setLeaveModalOpen(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
