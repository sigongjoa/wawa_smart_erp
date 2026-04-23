import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, StudentProfile, CommentHistoryEntry, AttendanceSummary as AttendanceData } from '../api';
import ScoreChart from '../components/ScoreChart';
import CommentTimeline from '../components/CommentTimeline';
import AttendanceSummary from '../components/AttendanceSummary';
import StudentInfo from '../components/StudentInfo';
import EnrollmentManager from '../components/EnrollmentManager';
import ConsultationPanel from '../components/ConsultationPanel';
import ExternalSchedulePanel from '../components/ExternalSchedulePanel';
import TeacherNotesPanel from '../components/TeacherNotesPanel';
import HomeroomSelector from '../components/HomeroomSelector';
import { useAuthStore } from '../store';
import Modal from '../components/Modal';
import { toast } from '../components/Toast';

const GRADE_OPTIONS = [
  '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
];

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ months: string[]; subjects: Record<string, (number | null)[]> } | null>(null);
  const [comments, setComments] = useState<CommentHistoryEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [loading, setLoading] = useState(true);

  // 편집 모달
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editGuardian, setEditGuardian] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // 삭제 확인
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 학부모 링크 공유
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpires, setShareExpires] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadProfile();
  }, [id, historyMonths]);

  const loadProfile = () => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      api.getStudentProfile(id),
      api.getScoreHistory(id, historyMonths),
      api.getStudentComments(id, 12),
      api.getStudentAttendance(id, 6),
    ]).then(([profileRes, scoresRes, commentsRes, attendanceRes]) => {
      const p = profileRes.status === 'fulfilled' ? profileRes.value : null;
      setProfile(p);
      if (p) {
        setEditName(p.name);
        setEditGrade(p.grade || '');
        setEditContact((p as any).contact || '');
        setEditGuardian(p.guardian_contact || '');
      }
      setScoreHistory(scoresRes.status === 'fulfilled' ? scoresRes.value : null);
      setComments(commentsRes.status === 'fulfilled' ? commentsRes.value : []);
      setAttendance(attendanceRes.status === 'fulfilled' ? attendanceRes.value : null);
      setLoading(false);
    });
  };

  const handleEdit = async () => {
    if (!id || !editName.trim() || !editGrade) return;
    setEditSaving(true);
    try {
      await api.updateStudent(id, {
        name: editName.trim(),
        grade: editGrade,
        contact: editContact.trim() || undefined,
        guardian_contact: editGuardian.trim() || undefined,
      });
      setShowEdit(false);
      loadProfile();
    } catch (err: any) {
      alert(err.message || '수정 실패');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.deleteStudent(id);
      navigate('/student');
    } catch (err: any) {
      alert(err.message || '삭제 실패');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="student-profile-page"><p>불러오는 중...</p></div>;
  }

  if (!profile) {
    return <div className="student-profile-page"><p>학생을 찾을 수 없습니다</p></div>;
  }

  return (
    <div className="student-profile-page">
      <div className="student-profile-header">
        <button className="back-btn" onClick={() => navigate('/student')}>
          &larr; 학생 목록
        </button>
        <div className="student-profile-title-row">
          <h2>{profile.name} <span className="student-grade-badge">{profile.grade}</span></h2>
          <div className="student-profile-actions">
            {(user?.role === 'instructor' || user?.role === 'admin') && (
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const subject = window.prompt('과목명을 입력하세요 (예: 수학)', '수학');
                  if (!subject) return;
                  try {
                    const res = await api.startLiveSession({
                      student_id: id!,
                      subject: subject.trim(),
                    });
                    navigate(`/live/${res.id}?student_name=${encodeURIComponent(profile.name)}`);
                  } catch (e: any) {
                    alert(e.message || '라이브 세션 시작 실패');
                  }
                }}
              >
                🔴 라이브 시작
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              disabled={shareLoading}
              onClick={async () => {
                if (!id) return;
                setShareLoading(true);
                const month = new Date().toISOString().slice(0, 7);
                try {
                  const res = await api.createParentReportLink(id, { month, days: 14 });
                  const fullUrl = res.url.startsWith('http')
                    ? res.url
                    : `${window.location.origin}${res.path}`;
                  setShareUrl(fullUrl);
                  setShareExpires(res.expires_at);
                  // 최적 UX: 모달 열리면서 자동 복사 시도; 실패해도 모달에서 수동 복사 가능
                  try {
                    await navigator.clipboard.writeText(fullUrl);
                    toast.success('링크가 복사되었습니다');
                  } catch {
                    // fallback 모달에 복사 버튼 있음
                  }
                } catch (e: any) {
                  toast.error(e.message || '링크 생성 실패');
                } finally {
                  setShareLoading(false);
                }
              }}
            >
              {shareLoading ? '생성 중...' : '학부모 링크'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>
              편집
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* 시간표 관리 */}
      <EnrollmentManager studentId={id!} studentName={profile.name} />

      {/* 성적 추이 차트 */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <h3>성적 추이</h3>
          <div className="period-toggle">
            {[6, 12].map((m) => (
              <button
                key={m}
                className={historyMonths === m ? 'active' : ''}
                onClick={() => setHistoryMonths(m)}
              >
                {m}개월
              </button>
            ))}
          </div>
        </div>
        {scoreHistory && scoreHistory.months.length > 0 ? (
          <ScoreChart months={scoreHistory.months} subjects={scoreHistory.subjects} />
        ) : (
          <p className="no-data">성적 데이터가 없습니다</p>
        )}
      </section>

      {/* 출결 + 기본정보 */}
      <div className="dashboard-row">
        <section className="dashboard-section dashboard-half">
          <h3>출결 요약</h3>
          {attendance ? <AttendanceSummary data={attendance} /> : <p className="no-data">출결 데이터 없음</p>}
        </section>
        <section className="dashboard-section dashboard-half">
          <h3>기본 정보</h3>
          <StudentInfo profile={profile} />
          {user?.role === 'admin' && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <HomeroomSelector profile={profile} onChanged={loadProfile} />
            </div>
          )}
        </section>
      </div>

      {/* 교과 선생님 메모 (담임 종합 조회용) */}
      <TeacherNotesPanel studentId={id!} />

      {/* 학부모 상담 (담당 선생님 공유) */}
      <ConsultationPanel studentId={id!} />

      {/* 타 과목/타 학원/시험 일정 공유 */}
      <ExternalSchedulePanel studentId={id!} />

      {/* 코멘트 히스토리 */}
      <section className="dashboard-section">
        <h3>코멘트 히스토리</h3>
        {comments.length > 0 ? (
          <CommentTimeline entries={comments} />
        ) : (
          <p className="no-data">코멘트가 없습니다</p>
        )}
      </section>

      {/* 편집 모달 */}
      {showEdit && (
        <Modal onClose={() => setShowEdit(false)}>
            <h3 className="modal-title">학생 정보 편집</h3>
            <div className="modal-body">
              <label className="form-label">이름</label>
              <input
                className="form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editSaving}
              />
              <label className="form-label">학년</label>
              <select
                className="form-select"
                value={editGrade}
                onChange={(e) => setEditGrade(e.target.value)}
                disabled={editSaving}
              >
                <option value="">학년 선택</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <label className="form-label">학생 연락처</label>
              <input
                className="form-input"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                disabled={editSaving}
              />
              <label className="form-label">학부모 연락처</label>
              <input
                className="form-input"
                value={editGuardian}
                onChange={(e) => setEditGuardian(e.target.value)}
                disabled={editSaving}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)} disabled={editSaving}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleEdit}
                disabled={editSaving || !editName.trim() || !editGrade}
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
        </Modal>
      )}

      {/* 삭제 확인 모달 */}
      {showDelete && (
        <Modal onClose={() => setShowDelete(false)} className="modal-confirm">
            <h3 className="modal-title">학생 삭제</h3>
            <div className="modal-body">
              <p><strong>{profile.name}</strong> 학생을 삭제하시겠습니까?</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                성적, 출결, 시간표 등 관련 데이터가 모두 삭제됩니다.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDelete(false)} disabled={deleting}>취소</button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
        </Modal>
      )}

      {/* 학부모 링크 공유 모달 */}
      {shareUrl && (
        <Modal onClose={() => setShareUrl(null)}>
          <h3 className="modal-title">학부모 월간 리포트 링크</h3>
          <div className="modal-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              아래 링크를 카톡/문자로 전달해 주세요.
              {shareExpires && (
                <> 만료일: <strong>{new Date(shareExpires).toLocaleDateString('ko-KR')}</strong></>
              )}
            </p>
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontFamily: 'monospace',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
              aria-label="학부모 리포트 링크"
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShareUrl(null)}>닫기</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success('복사되었습니다');
                } catch {
                  toast.error('수동으로 선택 후 복사해 주세요');
                }
              }}
            >
              복사
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
