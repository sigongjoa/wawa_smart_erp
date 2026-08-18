import { Contract, ContractSummary } from '../api';

interface Props {
  contract: Contract;
  cycle: ContractSummary['cycle'];
  makeups: ContractSummary['makeups'];
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const LEGEND: Array<{ status: string; label: string }> = [
  { status: 'done', label: '수업함' },
  { status: 'missed', label: '안 함' },
  { status: 'absent', label: '결석' },
  { status: 'extra', label: '보강·추가' },
];

/** 'YYYY-MM-DD' → UTC epoch (로컬 타임존 영향 배제) */
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * 정산 구간 달력. 구간이 달을 걸치므로(8/15~9/14) 월 그리드가 아니라
 * 구간을 덮는 주 단위로 그린다. 구간 밖 칸은 흐리게.
 */
export default function ContractCalendar({ contract, cycle, makeups }: Props) {
  const from = ts(cycle.from);
  const to = ts(cycle.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;

  // 같은 날 2타임이면 상태가 2개 — 셀 안에 점을 두 개 찍는다
  const byDate = new Map<string, string[]>();
  for (const s of contract.sessions) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s.status]);
  }
  const makeupByDate = new Map(makeups.map((m) => [m.date, m.status]));

  // 구간 시작이 속한 주의 일요일부터, 끝이 속한 주의 토요일까지
  const gridStart = from - new Date(from).getUTCDay() * 86_400_000;
  const gridEnd = to + (6 - new Date(to).getUTCDay()) * 86_400_000;

  const cells: number[] = [];
  for (let t = gridStart; t <= gridEnd; t += 86_400_000) cells.push(t);

  return (
    <div className="cc">
      <div className="cc-grid cc-head">
        {DOW.map((d) => (
          <div key={d} className="cc-dow">
            {d}
          </div>
        ))}
      </div>
      <div className="cc-grid">
        {cells.map((t) => {
          const date = iso(t);
          const outside = t < from || t > to;
          const statuses = byDate.get(date) ?? [];
          const makeup = makeupByDate.get(date);
          const day = new Date(t).getUTCDate();
          const title = [
            date,
            ...statuses.map((s) => LEGEND.find((l) => l.status === s)?.label ?? s),
            makeup ? `보강 ${makeup === 'completed' ? '완료' : '예정'}` : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={date}
              className={`cc-cell${outside ? ' cc-out' : ''}`}
              title={title}
              aria-label={title}
            >
              <span className="cc-day">{day === 1 ? `${new Date(t).getUTCMonth() + 1}/1` : day}</span>
              <span className="cc-dots">
                {statuses.map((s, i) => (
                  <i key={i} className={`cc-dot cc-${s}`} />
                ))}
                {makeup && <i className={`cc-dot cc-makeup-${makeup === 'completed' ? 'done' : 'plan'}`} />}
              </span>
            </div>
          );
        })}
      </div>
      <div className="cc-legend">
        {LEGEND.map((l) => (
          <span key={l.status}>
            <i className={`cc-dot cc-${l.status}`} /> {l.label}
          </span>
        ))}
        <span>
          <i className="cc-dot cc-makeup-plan" /> 보강일
        </span>
      </div>
    </div>
  );
}
