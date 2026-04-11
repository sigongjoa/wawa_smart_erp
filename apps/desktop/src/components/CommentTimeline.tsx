import { useState } from 'react';
import { CommentHistoryEntry } from '../api';

interface Props {
  entries: CommentHistoryEntry[];
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${year}년 ${parseInt(month)}월 월말평가`;
}

export default function CommentTimeline({ entries }: Props) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set(entries.length > 0 ? [entries[0].yearMonth] : [])
  );

  const toggle = (ym: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym);
      else next.add(ym);
      return next;
    });
  };

  return (
    <div className="comment-timeline">
      {entries.map((entry) => {
        const isOpen = expandedMonths.has(entry.yearMonth);
        return (
          <div key={entry.yearMonth} className="timeline-month">
            <button
              className="timeline-month-header"
              onClick={() => toggle(entry.yearMonth)}
            >
              <span className="timeline-toggle">{isOpen ? '▼' : '▶'}</span>
              <span>{formatYearMonth(entry.yearMonth)}</span>
            </button>
            {isOpen && (
              <div className="timeline-month-body">
                {entry.scores.map((s, i) => (
                  <div key={i} className="timeline-score-card">
                    <div className="timeline-score-header">
                      <span className="timeline-subject">{s.subject}</span>
                      <span className="timeline-score">{s.score}점</span>
                    </div>
                    {s.comment && (
                      <p className="timeline-comment">{s.comment}</p>
                    )}
                  </div>
                ))}
                {entry.totalComment && (
                  <div className="timeline-total-comment">
                    <strong>총평</strong>
                    <p>{entry.totalComment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
