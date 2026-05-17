/**
 * VocabAdminPage — mockup v2/09 톤 부모 shell.
 *
 * 구조:
 *   PageHeader (crumb 컨텐츠 · 단어 운영 / title 단어 운영 / sub stats / actions slot)
 *   .v2-tabs (4 tabs with count badge)
 *   <Outlet />  — 자식 탭 본문
 */
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '../api';
import { PageHeader } from '../components/v2';
import { Icon, type IconName } from '../components/icons/Icon';
import VocabWordsTab from './vocab/VocabWordsTab';

export interface VocabOutletContext {
  setHeaderAction: (node: ReactNode) => void;
}

interface TabSpec {
  to: string;
  label: string;
  icon: IconName;
  /** counts state 키 */
  countKey?: 'words' | 'wrong' | 'attempts';
  exact?: boolean;
}

const SUB_TABS: TabSpec[] = [
  { to: '/vocab', label: '단어', icon: 'BookMarked', countKey: 'words', exact: true },
  { to: '/vocab/wrong', label: '오답', icon: 'AlertCircle', countKey: 'wrong' },
  { to: '/vocab/grading', label: '응시 기록', icon: 'BarChart2', countKey: 'attempts' },
  { to: '/vocab/policy', label: '정책', icon: 'Settings2' },
];

export default function VocabAdminPage() {
  const loc = useLocation();
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);
  const [counts, setCounts] = useState<{ words: number; wrong: number; attempts: number }>({
    words: 0,
    wrong: 0,
    attempts: 0,
  });

  useEffect(() => {
    document.title = '단어 운영 · WAWA';
  }, []);

  // 상단 카운트 — 부담 적은 단발 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wordsRes, jobsRes] = await Promise.all([
          api.getVocabWordsPage({ limit: 1, offset: 0 }).catch(() => null),
          api.listVocabPrintJobsPage({ days: 14, limit: 1, offset: 0 }).catch(() => null),
        ]);
        if (cancelled) return;
        const wordsAll = wordsRes?.counts?.all ?? 0;
        const allWords = await api.getVocabWords().catch(() => [] as any[]);
        const wrongCount = (allWords || []).filter((w: any) => (w.wrong_count || 0) > 0).length;
        setCounts({
          words: wordsAll,
          wrong: wrongCount,
          attempts: jobsRes?.counts?.all ?? 0,
        });
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [loc.pathname]);

  return (
    <div className="v2-app-main">
      <PageHeader
        crumb="컨텐츠 · 단어 운영"
        title="단어 운영"
        sub={`총 ${counts.words.toLocaleString()}단어 · 오답 ${counts.wrong}개 · 응시 ${counts.attempts}건`}
        actions={headerAction}
      />

      <nav className="v2-tabs" role="tablist" aria-label="단어 운영 탭">
        {SUB_TABS.map((t) => {
          const active =
            loc.pathname === t.to ||
            (t.to === '/vocab' && loc.pathname === '/vocab/');
          const count = t.countKey ? counts[t.countKey] : undefined;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.exact}
              role="tab"
              aria-selected={active}
              className={({ isActive }) =>
                `v2-tabs__item${(isActive || active) ? ' is-active' : ''}`
              }
            >
              <Icon name={t.icon} size={16} />
              {t.label}
              {typeof count === 'number' && count > 0 && (
                <span className="v2-tabs__count">{count.toLocaleString()}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <Outlet context={{ setHeaderAction } satisfies VocabOutletContext} />
    </div>
  );
}

export { VocabWordsTab };
