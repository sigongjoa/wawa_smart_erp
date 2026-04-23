import { StudentProfile } from '../api';

interface Props {
  profile: StudentProfile;
}

export default function StudentInfo({ profile }: Props) {
  return (
    <div className="student-info">
      <div className="info-row">
        <span className="info-label">수강 과목</span>
        <span className="info-value">
          {profile.subjects.length > 0 ? profile.subjects.join(', ') : '-'}
        </span>
      </div>
      <div className="info-row">
        <span className="info-label">담임 선생님</span>
        <span className="info-value">
          {profile.homeroom_teacher ? (
            <strong>{profile.homeroom_teacher.name}</strong>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>미지정</span>
          )}
        </span>
      </div>
      <div className="info-row">
        <span className="info-label">담당 선생님</span>
        <span className="info-value">
          {profile.teachers.length > 0
            ? profile.teachers
                .map((t) => (t.is_homeroom ? `${t.name} (담임)` : t.name))
                .join(', ')
            : '-'}
        </span>
      </div>
      {profile.guardian_contact && (
        <div className="info-row">
          <span className="info-label">학부모 연락처</span>
          <span className="info-value">{profile.guardian_contact}</span>
        </div>
      )}
      {profile.enrollment_date && (
        <div className="info-row">
          <span className="info-label">등록일</span>
          <span className="info-value">{profile.enrollment_date}</span>
        </div>
      )}
      <div className="info-row">
        <span className="info-label">상태</span>
        <span className={`info-value status-${profile.status}`}>
          {profile.status === 'active' ? '수강중' : '휴원'}
        </span>
      </div>
    </div>
  );
}
