import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, StudentProfile, CommentHistoryEntry, AttendanceSummary as AttendanceData } from '../api';
import ScoreChart from '../components/ScoreChart';
import CommentTimeline from '../components/CommentTimeline';
import AttendanceSummary from '../components/AttendanceSummary';
import StudentInfo from '../components/StudentInfo';
import EnrollmentManager from '../components/EnrollmentManager';
import { useAuthStore } from '../store';
import Modal from '../components/Modal';

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
        </section>
      </div>

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
    </div>
  );
}
