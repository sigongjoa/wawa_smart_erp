import { useEffect, useState } from 'react';
import { api, ExternalSchedule } from '../api';
import { useAuthStore } from '../store';

interface Props {
  studentId: string;
}

const KIND_LABEL: Record<ExternalSchedule['kind'], string> = {
  other_subject: '타 과목',
  other_academy: '타 학원',
  exam: '시험',
  event: '일정',
};

export default function ExternalSchedulePanel({ studentId }: Props) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ExternalSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImportExam = async () => {
    const month = prompt(
      '정기고사 월을 입력하세요 (YYYY-MM)',
      new Date().toISOString().slice(0, 7)
    );
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return;
    setImporting(true);
    try {
      const { periods } = await api.getExamPeriodsByMonth(month);
      if (!periods || periods.length === 0) {
        alert(`${month}에 등록된 정기고사가 없습니다`);
        return;
      }
      let added = 0;
      let skipped = 0;
      for (const p of periods) {
        const res = await api.importExamPeriodToSchedule(studentId, p.id);
        if (res.imported) added++;
        else skipped++;
      }
      alert(`추가 ${added}건 / 이미 존재 ${skipped}건`);
      await load();
    } catch (err: any) {
      alert(err.message || '가져오기 실패');
    } finally {
      setImporting(false);
    }
  };

  const [kind, setKind] = useState<ExternalSchedule['kind']>('other_academy');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await api.listSchedules(studentId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) load();
  }, [studentId]);

  const reset = () => {
    setKind('other_academy');
    setTitle('');
    setStartsAt('');
    setEndsAt('');
    setRecurrence('');
    setLocation('');
    setNote('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('제목을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      await api.createSchedule(studentId, {
        kind,
        title: title.trim(),
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        recurrence: recurrence.trim() || null,
        location: location.trim() || null,
        note: note.trim() || null,
      });
      reset();
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.deleteSchedule(studentId, id);
    await load();
  };

  return (
    <section className="dashboard-section">
      <div className="section-title-row">
        <h3>타 과목 / 타 학원 / 시험 일정</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleImportExam}
            disabled={importing}
            title="해당 월의 모든 정기고사를 이 학생 일정에 자동 추가"
          >
            {importing ? '가져오는 중...' : '정기고사 자동 반영'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '취소' : '+ 일정 추가'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: -4, marginBottom: 12 }}>
        담당 선생님 모두가 공유합니다.
      </p>

      {showForm && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
            <select
              className="form-select"
              value={kind}
              onChange={(e) => setKind(e.target.value as ExternalSchedule['kind'])}
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="예: 영어 1:1 과외 / 중간고사 수학"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <input
              type="datetime-local"
              className="form-input"
              placeholder="시작"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <input
              type="datetime-local"
              className="form-input"
              placeholder="종료"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
            <input
              className="form-input"
              placeholder="반복(예: 매주 화/목)"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 8 }}>
            <input
              className="form-input"
              placeholder="장소 / 기관명"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <input
              className="form-input"
              placeholder="메모"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="no-data">등록된 일정이 없습니다</p>
      ) : (
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '4px 6px' }}>구분</th>
              <th style={{ padding: '4px 6px' }}>제목</th>
              <th style={{ padding: '4px 6px' }}>일시 / 반복</th>
              <th style={{ padding: '4px 6px' }}>장소</th>
              <th style={{ padding: '4px 6px' }}>작성</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const canDelete = user?.role === 'admin' || user?.id === s.author_id;
              return (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px' }}>
                    <span className="badge">{KIND_LABEL[s.kind]}</span>
                  </td>
                  <td style={{ padding: '6px' }}>{s.title}</td>
                  <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>
                    {s.starts_at
                      ? new Date(s.starts_at).toLocaleString('ko-KR')
                      : s.recurrence || '-'}
                  </td>
                  <td style={{ padding: '6px' }}>{s.location || '-'}</td>
                  <td style={{ padding: '6px', fontSize: 12 }}>{s.author_name || '-'}</td>
                  <td style={{ padding: '6px' }}>
                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(s.id)}
                        style={{ padding: '2px 8px' }}
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
