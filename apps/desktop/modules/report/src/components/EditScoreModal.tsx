/**
 * EditScoreModal - Modal component for editing student scores
 * Extracted from AdminPage for better maintainability
 */
import { useState, useCallback } from 'react';
import type { Student, SubjectScore, DifficultyGrade, MonthlyReport } from '../types';
import { DIFFICULTY_GRADES, DIFFICULTY_COLORS } from '../constants';

interface EditScoreModalProps {
  student: Student;
  currentYearMonth: string;
  existingReport?: MonthlyReport;
  onSave: (studentId: string, scores: SubjectScore[]) => Promise<boolean>;
  onClose: () => void;
}

export default function EditScoreModal({
  student,
  currentYearMonth,
  existingReport,
  onSave,
  onClose,
}: EditScoreModalProps) {
  // Initialize scores from existing report or create empty ones
  const [scores, setScores] = useState<SubjectScore[]>(() => {
    return student.subjects.map(subject => {
      const existing = existingReport?.scores.find(s => s.subject === subject);
      return existing || {
        subject,
        score: 0,
        teacherId: '',
        teacherName: '',
        comment: '',
        difficulty: 'C' as DifficultyGrade,
        updatedAt: new Date().toISOString(),
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleScoreChange = useCallback((subject: string, field: keyof SubjectScore, value: SubjectScore[keyof SubjectScore]) => {
    setScores(prev => prev.map(s =>
      s.subject === subject ? { ...s, [field]: value } : s
    ));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onSave(student.id, scores);
      if (success) {
        onClose();
      } else {
        alert('저장에 실패했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={handleBackdropClick}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          {student.name} ({student.grade}) 점수 수정
        </h2>
        <p style={styles.subtitle}>
          {currentYearMonth} 월말평가
        </p>

        <div style={styles.scoreList}>
          {scores.map((score) => (
            <div key={score.subject} style={styles.scoreCard}>
              <div style={styles.scoreHeader}>
                <span style={styles.subjectLabel}>{score.subject}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score.score}
                  onChange={(e) => handleScoreChange(score.subject, 'score', parseInt(e.target.value) || 0)}
                  style={styles.scoreInput}
                />
                <span style={styles.pointLabel}>점</span>
                <select
                  value={score.difficulty || 'C'}
                  onChange={(e) => handleScoreChange(score.subject, 'difficulty', e.target.value as DifficultyGrade)}
                  style={{
                    ...styles.difficultySelect,
                    backgroundColor: DIFFICULTY_COLORS[score.difficulty || 'C'] + '20',
                    color: DIFFICULTY_COLORS[score.difficulty || 'C'],
                  }}
                >
                  {DIFFICULTY_GRADES.map((d) => (
                    <option key={d} value={d}>{d}등급</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={score.comment || ''}
                onChange={(e) => handleScoreChange(score.subject, 'comment', e.target.value)}
                placeholder="코멘트 입력 (선택)"
                style={styles.commentInput}
              />
            </div>
          ))}
        </div>

        <div style={styles.buttonRow}>
          <button onClick={onClose} style={styles.cancelButton}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              ...styles.saveButton,
              backgroundColor: isSaving ? '#9ca3af' : '#2563eb',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
  },
  scoreList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
  },
  scoreHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  subjectLabel: {
    fontWeight: '600',
    color: '#374151',
    minWidth: '60px',
  },
  scoreInput: {
    width: '80px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '16px',
    fontWeight: '600',
    textAlign: 'center',
  },
  pointLabel: {
    color: '#6b7280',
  },
  difficultySelect: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontWeight: '600',
    cursor: 'pointer',
  },
  commentInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
  },
  saveButton: {
    padding: '10px 20px',
    color: '#ffffff',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '500',
  },
};
