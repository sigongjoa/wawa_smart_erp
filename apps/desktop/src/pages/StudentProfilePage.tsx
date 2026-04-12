import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, StudentProfile, CommentHistoryEntry, AttendanceSummary as AttendanceData } from '../api';
import ScoreChart from '../components/ScoreChart';
import CommentTimeline from '../components/CommentTimeline';
import AttendanceSummary from '../components/AttendanceSummary';
import StudentInfo from '../components/StudentInfo';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ months: string[]; subjects: Record<string, (number | null)[]> } | null>(null);
  const [comments, setComments] = useState<CommentHistoryEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    Promise.allSettled([
      api.getStudentProfile(id),
      api.getScoreHistory(id, historyMonths),
      api.getStudentComments(id, 12),
      api.getStudentAttendance(id, 6),
    ]).then(([profileRes, scoresRes, commentsRes, attendanceRes]) => {
      setProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
      setScoreHistory(scoresRes.status === 'fulfilled' ? scoresRes.value : null);
      setComments(commentsRes.status === 'fulfilled' ? commentsRes.value : []);
      setAttendance(attendanceRes.status === 'fulfilled' ? attendanceRes.value : null);
      setLoading(false);
    });
  }, [id, historyMonths]);

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
        <h2>{profile.name} <span className="student-grade-badge">{profile.grade}</span></h2>
      </div>

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
    </div>
  );
}
