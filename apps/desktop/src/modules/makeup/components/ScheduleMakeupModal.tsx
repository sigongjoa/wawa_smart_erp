import { useState } from 'react';
import { useMakeupStore } from '../../../stores/makeupStore';
import { useToastStore } from '../../../stores/toastStore';
import type { MakeupRecord } from '../../../types';

interface Props {
  record: MakeupRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScheduleMakeupModal({ record, onClose, onSuccess }: Props) {
  const { updateRecord } = useMakeupStore();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [makeupDate, setMakeupDate] = useState(record.makeupDate || '');
  const [makeupTime, setMakeupTime] = useState(record.makeupTime || '');
  const [memo, setMemo] = useState(record.memo || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeupDate) {
      addToast('보강 예정일을 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const success = await updateRecord(record.id, {
      makeupDate,
      makeupTime: makeupTime || undefined,
      memo: memo || undefined,
      status: '진행 중',
    });
    setIsSubmitting(false);

    if (success) {
      addToast('보강 일정이 등록되었습니다.', 'success');
      onSuccess();
    } else {
      addToast('일정 등록에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">보강 일정 등록</h2>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 학생 정보 */}
            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div><strong>학생:</strong> {record.studentName}</div>
                <div><strong>과목:</strong> {record.subject}</div>
              </div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                <strong>결석일:</strong> {record.absentDate} | <strong>사유:</strong> {record.absentReason}
              </div>
            </div>

            {/* 보강예정일 */}
            <div>
              <label className="form-label">보강 예정일 *</label>
              <input
                type="date"
                className="search-input"
                value={makeupDate}
                onChange={(e) => setMakeupDate(e.target.value)}
                required
              />
            </div>

            {/* 보강시간 */}
            <div>
              <label className="form-label">보강 시간</label>
              <input
                className="search-input"
                placeholder="예: 14:00~15:00"
                value={makeupTime}
                onChange={(e) => setMakeupTime(e.target.value)}
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="form-label">메모</label>
              <input
                className="search-input"
                placeholder="추가 메모"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
