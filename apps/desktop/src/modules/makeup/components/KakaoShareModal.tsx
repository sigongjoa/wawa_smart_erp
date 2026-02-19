import { useState, useEffect, useRef, useMemo } from 'react';
import type { MakeupRecord } from '../../../types';
import { useToastStore } from '../../../stores/toastStore';

interface KakaoShareModalProps {
  date: string; // YYYY-MM-DD
  records: MakeupRecord[];
  onClose: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const KakaoShareModal: React.FC<KakaoShareModalProps> = ({ date, records, onClose }) => {
  const [selectedRecords, setSelectedRecords] = useState<MakeupRecord[]>([]);
  const allSelectedCheckboxRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();

  const formattedDate = useMemo(() => {
    // date가 "2026-02-19" 형식 → UTC 파싱 방지 위해 로컬 시간으로 분리
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const month = m;
    const day = d;
    const weekday = WEEKDAYS[dateObj.getDay()];
    return { month, day, weekday, fullDate: `${month}월 ${day}일(${weekday})` };
  }, [date]);

  useEffect(() => {
    // Select all records by default when modal opens
    setSelectedRecords(records);
  }, [records]);

  useEffect(() => {
    if (allSelectedCheckboxRef.current) {
      if (selectedRecords.length === records.length && records.length > 0) {
        allSelectedCheckboxRef.current.checked = true;
        allSelectedCheckboxRef.current.indeterminate = false;
      } else if (selectedRecords.length > 0) {
        allSelectedCheckboxRef.current.checked = false;
        allSelectedCheckboxRef.current.indeterminate = true;
      } else {
        allSelectedCheckboxRef.current.checked = false;
        allSelectedCheckboxRef.current.indeterminate = false;
      }
    }
  }, [selectedRecords, records]);

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecords(records);
    } else {
      setSelectedRecords([]);
    }
  };

  const handleToggleRecord = (record: MakeupRecord) => {
    setSelectedRecords(prev =>
      prev.includes(record) ? prev.filter(r => r !== record) : [...prev, record]
    );
  };

  const previewText = useMemo(() => {
    if (records.length === 0) {
      return '해당 날짜에 보강 일정이 없습니다.';
    }

    if (selectedRecords.length === 0) {
      return '선택된 보강 일정이 없습니다.';
    }

    const header = `보강 일정 안내
📅 ${formattedDate.fullDate}`;
    const recordList = selectedRecords
      .map(rec => {
        const time = rec.makeupTime ?? '시간 미정';
        return `• ${rec.studentName} (${rec.subject}) ${time}`;
      })
      .join('\n');
    const footer = `

총 ${selectedRecords.length}건 예정입니다.`;

    return `${header}

${recordList}${footer}`;
  }, [selectedRecords, records.length, formattedDate]);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      addToast('클립보드에 복사되었습니다!', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to copy text: ', err);
      addToast('클립보드 복사에 실패했습니다.', 'error');
    }
  };

  return (
    <div className='modal-overlay' onClick={onClose}>
      <div className='modal-content' onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className='modal-header'>
          <h3 className='modal-title'>
            📤 보강 일정 공유 - {formattedDate.fullDate}
          </h3>
          <button className='modal-close' onClick={onClose}>
            <span className='material-symbols-outlined'>close</span>
          </button>
        </div>
        <div className='modal-body'>
          {records.length === 0 ? (
            <p>해당 날짜에 보강 일정이 없습니다.</p>
          ) : (
            <>
              <div className='form-check mb-2'>
                <input
                  className='form-check-input'
                  type='checkbox'
                  id='selectAll'
                  ref={allSelectedCheckboxRef}
                  onChange={handleToggleAll}
                />
                <label className='form-check-label' htmlFor='selectAll'>
                  전체 선택 ({selectedRecords.length}/{records.length} 선택됨)
                </label>
              </div>
              <ul className='list-unstyled mb-3' style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {records.map((record, index) => (
                  <li key={index} className='form-check'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      id={`record-${index}`}
                      checked={selectedRecords.includes(record)}
                      onChange={() => handleToggleRecord(record)}
                    />
                    <label className='form-check-label' htmlFor={`record-${index}`}>
                      {record.studentName} ({record.subject}) {record.makeupTime || '시간 미정'}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4 className='mb-2'>미리보기</h4>
          <textarea
            className='form-control'
            readOnly
            rows={10}
            value={previewText}
            style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace' }}
            aria-label="미리보기"
          ></textarea>
        </div>
        <div className='modal-footer'>
          <button className='btn btn-secondary' onClick={onClose}>
            취소
          </button>
          <button
            className='btn btn-primary'
            onClick={handleCopyToClipboard}
            disabled={selectedRecords.length === 0 || records.length === 0}
          >
            📋 복사하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default KakaoShareModal;
