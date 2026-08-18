import { useState, useEffect } from 'react';
import { api, Contract, ContractSummary } from '../api';
import Modal from './Modal';
import ContractCalendar from './ContractCalendar';
import { toast } from './Toast';

interface Props {
  studentId: string;
  studentName: string;
  grade?: string | null;
}

const EMPTY = {
  subject: '',
  product_name: '',
  unit_price: '',
  session_count: '',
  in_date: '',
  collect_day: '',
  status: 'active' as Contract['status'],
};

const STATUS_LABEL: Record<Contract['status'], string> = {
  active: '수강중',
  suspended: '휴회',
  ended: '종료',
};

const won = (n: number) => n.toLocaleString('ko-KR');

/** 날짜를 n일 이동 (구간 이동용) */
function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ContractManager({ studentId, studentName, grade }: Props) {
  const [data, setData] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // 정산 구간은 서버가 입금일로 계산한다. 여기선 "이 날짜가 속한 구간" 기준일만 넘긴다.
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [studentId, anchor]);

  const load = () => {
    setLoading(true);
    api
      .getContracts(studentId, anchor)
      .then(setData)
      .catch((err: any) => toast.error(err.message || '계약 조회 실패'))
      .finally(() => setLoading(false));
  };

  const openModal = (c: Contract) => {
    setForm({
      subject: c.subject,
      product_name: c.product_name ?? '',
      unit_price: String(c.unit_price),
      session_count: String(c.session_count),
      in_date: c.in_date ?? '',
      collect_day: c.collect_day == null ? '' : String(c.collect_day),
      status: c.status,
    });
    setEditing(c);
  };

  /** 시간표에도 없는 과목을 직접 추가 */
  const openNew = () => {
    setForm({ ...EMPTY });
    setEditing({
      id: null,
      is_draft: true,
      subject: '',
      product_name: null,
      unit_price: 0,
      session_count: 0,
      in_date: null,
      out_date: null,
      collect_day: null,
      status: 'active',
      note: null,
      total_price: 0,
      weekly_slots: 0,
      has_schedule: false,
      planned_slots: 0,
      done_slots: 0,
      missed_slots: 0,
      done_minutes: 0,
      sessions: [],
    });
  };

  const remove = async () => {
    if (!editing?.id) return;
    setSaving(true);
    try {
      await api.deleteContract(editing.id);
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message || '삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      await api.putContract({
        student_id: studentId,
        subject: form.subject.trim(),
        product_name: form.product_name.trim() || null,
        unit_price: Number(form.unit_price) || 0,
        session_count: Number(form.session_count) || 0,
        in_date: form.in_date || null,
        collect_day: form.collect_day ? Number(form.collect_day) : null,
        status: form.status,
      });
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dashboard-section contract-section">
      <div className="section-title-row">
        <h3>
          수강계약 · 회차
          <span className="contract-who">
            {studentName}
            {grade ? ` · ${grade}` : ''}
          </span>
        </h3>
        <div className="contract-cycle-nav">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => data && setAnchor(shiftDays(data.cycle.from, -1))}
            disabled={!data}
            aria-label="이전 정산 구간"
          >
            ‹
          </button>
          <input
            className="form-input form-input--sm"
            type="date"
            value={anchor}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
            aria-label="기준일 (이 날짜가 속한 정산 구간)"
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => data && setAnchor(shiftDays(data.cycle.to, 1))}
            disabled={!data}
            aria-label="다음 정산 구간"
          >
            ›
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            + 과목
          </button>
        </div>
      </div>

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : !data || data.contracts.length === 0 ? (
        <div className="enroll-empty">
          <p>시간표도 계약도 없습니다</p>
          <button className="btn btn-ghost btn-sm" onClick={openNew}>
            과목 추가하기
          </button>
        </div>
      ) : (
        <>
          {/* 정산 구간 요약 — 지난 입금일 ~ 이번 입금일 */}
          <div className="contract-cycle">
            <div className="contract-cycle-range">
              <strong>
                {data.cycle.from} ~ {data.cycle.to}
              </strong>
              <span>
                {data.cycle.collect_day
                  ? `매월 ${data.cycle.collect_day}일 입금 기준`
                  : '입금일 미입력 — 달력 월 기준'}
              </span>
            </div>
            <dl className="contract-stats">
              <div>
                <dt>수업</dt>
                <dd>
                  {data.done_slots}/{data.planned_slots}
                  <small>타임 · {data.done_minutes}분</small>
                </dd>
              </div>
              <div>
                <dt>안 한 수업</dt>
                <dd className={data.missed_slots > 0 ? 'contract-mismatch' : undefined}>
                  {data.missed_slots}타임
                </dd>
              </div>
              <div>
                <dt>결석</dt>
                <dd className={data.absent_count > 0 ? 'contract-mismatch' : undefined}>
                  {data.absent_count}회
                  {data.makeup_unscheduled > 0 && <small>보강 미지정 {data.makeup_unscheduled}</small>}
                </dd>
              </div>
              <div>
                <dt>보강</dt>
                <dd>
                  완료 {data.makeup_completed}
                  {data.makeup_pending > 0 && (
                    <small className="contract-mismatch">미완료 {data.makeup_pending}</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>월 수강료</dt>
                <dd>{won(data.monthly_total)}원</dd>
              </div>
            </dl>
          </div>

          <div className="contract-table-wrap">
            <table className="contract-table">
              <thead>
                <tr>
                  <th>과목</th>
                  <th>상품</th>
                  <th className="cc-num">단가</th>
                  <th className="cc-num">월 금액</th>
                  <th className="cc-num">수업(타임)</th>
                  <th className="cc-num">안 한 수업</th>
                  <th>입금일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.map((c) => (
                  <tr
                    key={c.id ?? `draft-${c.subject}`}
                    className={`contract-row${c.is_draft ? ' contract-row--draft' : ''}`}
                    onClick={() => openModal(c)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(c);
                      }
                    }}
                  >
                    <td>{c.subject}</td>
                    <td>{c.product_name || '-'}</td>
                    <td className="cc-num">{c.is_draft ? '-' : won(c.unit_price)}</td>
                    <td className="cc-num">{c.is_draft ? '-' : won(c.total_price)}</td>
                    <td className="cc-num" title={`${c.done_minutes}분`}>
                      {c.is_draft ? c.done_slots : `${c.done_slots}/${c.planned_slots}`}
                    </td>
                    <td className={`cc-num${!c.is_draft && c.missed_slots > 0 ? ' contract-mismatch' : ''}`}>
                      {c.is_draft ? '-' : c.missed_slots}
                    </td>
                    <td>{c.collect_day ? `${c.collect_day}일` : '-'}</td>
                    <td>
                      {c.is_draft ? <span className="contract-draft">미등록</span> : STATUS_LABEL[c.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="no-data contract-foot">
            행을 누르면 계약 정보를 수정할 수 있습니다
            {data.unassigned_attendance > 0 &&
              ` · 과목 미기입 출석 ${data.unassigned_attendance}회는 과목별 회차에 반영되지 않았습니다`}
          </p>
        </>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <Modal.Header>
            {studentName}
            {grade ? ` (${grade})` : ''} · {editing.subject || '새 과목'}
          </Modal.Header>
          <Modal.Body>
            {/* 이 계약의 구간 실적 — 모달을 연 이유 */}
            <div className="contract-modal-summary">
              <div>
                <dt>{data?.cycle.from} ~ {data?.cycle.to}</dt>
                <dd>
                  {editing.is_draft ? (
                    <>
                      실제 수업 <strong>{editing.done_slots}</strong> 타임
                      <span className="contract-draft"> · 계약 미등록</span>
                    </>
                  ) : (
                    <>
                      수업 <strong>{editing.done_slots}/{editing.planned_slots}</strong> 타임
                      {editing.missed_slots > 0 && (
                        <span className="contract-mismatch"> · 안 한 수업 {editing.missed_slots}타임</span>
                      )}
                    </>
                  )}
                </dd>
              </div>
            </div>

            {data && (
              <ContractCalendar contract={editing} cycle={data.cycle} makeups={data.makeups} />
            )}

            {!editing.id && (
              <>
                <label className="form-label">과목 *</label>
                <input
                  className="form-input"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  disabled={saving || !!editing.subject}
                  placeholder="예: 수학"
                  autoFocus={!editing.subject}
                />
              </>
            )}
            <label className="form-label">상품명</label>
            <input
              className="form-input"
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              disabled={saving}
            />
            <label className="form-label">타임당 단가 (월)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              disabled={saving}
            />
            <label className="form-label">주당 타임 (30분 = 1타임)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={100}
              value={form.session_count}
              onChange={(e) => setForm({ ...form, session_count: e.target.value })}
              disabled={saving}
            />
            {/* 계약 타임과 시간표 타임이 어긋나면 m이 틀어진다. 시간표가 없으면 경고하지 않는다. */}
            {editing.has_schedule &&
              Number(form.session_count) > 0 &&
              Number(form.session_count) !== editing.weekly_slots && (
                <p className="contract-mismatch contract-warn">
                  시간표는 주 {editing.weekly_slots}타임({editing.weekly_slots * 30}분)입니다
                </p>
              )}
            {!editing.has_schedule && (
              <p className="no-data contract-warn">
                시간표가 없어 여기 입력한 주당 타임으로만 계산됩니다
              </p>
            )}
            <p className="no-data contract-warn">
              월 {(Number(form.session_count) || 0) * 4}타임 ·{' '}
              {((Number(form.unit_price) || 0) * (Number(form.session_count) || 0)).toLocaleString('ko-KR')}원
            </p>
            <label className="form-label">입회일</label>
            <input
              className="form-input"
              type="date"
              value={form.in_date}
              onChange={(e) => setForm({ ...form, in_date: e.target.value })}
              disabled={saving}
            />
            <label className="form-label">입금일 (매월)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={31}
              value={form.collect_day}
              onChange={(e) => setForm({ ...form, collect_day: e.target.value })}
              disabled={saving}
            />
            <label className="form-label">상태</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Contract['status'] })}
              disabled={saving}
            >
              {(Object.keys(STATUS_LABEL) as Contract['status'][]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Modal.Body>
          <Modal.Footer>
            {editing.id && (
              <button className="btn btn-danger" onClick={remove} disabled={saving}>
                계약 삭제
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={saving || !form.subject.trim()}
            >
              {saving ? '저장 중...' : editing.is_draft ? '계약 등록' : '저장'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </section>
  );
}
