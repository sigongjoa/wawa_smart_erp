/**
 * 도감 탭 — 학습 자료 카탈로그
 * v1: MyArchivePage 를 컨테이너로 사용 (자체 헤더 포함)
 * v2(TODO): 완료한 단어/증명 수집 뷰 추가
 */
import { lazy, Suspense } from 'react';

const MyArchivePage = lazy(() => import('./MyArchivePage'));

export default function DexPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--sp-6) var(--sp-5)', color: 'var(--ink-60)' }}>불러오는 중...</div>
    }>
      <MyArchivePage />
    </Suspense>
  );
}
