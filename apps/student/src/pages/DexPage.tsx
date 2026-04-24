/**
 * 도감 탭 — 학습 자료 + 완료 단어·증명 카탈로그
 * v1: MyArchivePage 재사용 + 상단 안내
 */
import { lazy, Suspense } from 'react';

const MyArchivePage = lazy(() => import('./MyArchivePage'));

export default function DexPage() {
  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">도감</h1>
        <p className="page-subtitle">선생님이 배포한 자료와 내가 공부한 기록</p>
      </header>
      <Suspense fallback={<div style={{ padding: 20 }}>불러오는 중...</div>}>
        <MyArchivePage />
      </Suspense>
    </div>
  );
}
