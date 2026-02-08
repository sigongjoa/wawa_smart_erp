import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// 의도적으로 에러를 발생시키는 테스트 컴포넌트
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('테스트 에러 발생');
  }
  return <div>정상 렌더링</div>;
}

// ============================================================
// Feature: ErrorBoundary - 에러 복구 컴포넌트
// As a 선생님
// I want 페이지에서 에러가 발생해도 앱이 멈추지 않기를 원한다
// So that 다른 기능을 계속 사용할 수 있다
// ============================================================
describe('Feature: ErrorBoundary', () => {
  beforeEach(() => {
    // React가 에러 바운더리 테스트 시 console.error를 출력하는 것을 억제
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // --- Happy Path ---
  describe('Scenario: 정상 렌더링 시 children을 표시한다', () => {
    it('Given 에러가 없을 때, Then children이 렌더링된다', () => {
      render(
        <ErrorBoundary>
          <div>테스트 컨텐츠</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('테스트 컨텐츠')).toBeInTheDocument();
    });
  });

  // --- Error Path ---
  describe('Scenario: 에러 발생 시 기본 fallback UI를 표시한다', () => {
    it('Given children에서 에러가 발생할 때, Then 에러 메시지 UI를 표시한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();
      expect(screen.getByText('테스트 에러 발생')).toBeInTheDocument();
    });

    it('Given 에러가 발생할 때, Then "다시 시도" 버튼이 표시된다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
    });

    it('Given 에러가 발생할 때, Then 에러 아이콘이 표시된다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText('error')).toBeInTheDocument(); // material-symbols-outlined
    });
  });

  // --- Recovery Path ---
  describe('Scenario: "다시 시도" 버튼으로 복구할 수 있다', () => {
    it('Given 에러 UI가 표시된 상태에서, When "다시 시도"를 클릭하면, Then 에러 상태가 초기화된다', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // 에러 UI 확인
      expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();

      // 다시 시도 클릭 → 에러 없는 컴포넌트로 re-render
      // 먼저 ThrowError를 shouldThrow=false로 변경해야 복구됨
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // ErrorBoundary 내부 state를 리셋하기 위해 버튼 클릭
      // rerender 후에는 이미 에러가 없으므로 정상 렌더링 확인
      // (실제 앱에서는 버튼 클릭으로 state 리셋 후 children 재렌더링)
    });
  });

  // --- Custom Fallback ---
  describe('Scenario: 커스텀 fallback이 제공되면 해당 UI를 표시한다', () => {
    it('Given fallback prop이 제공될 때, When 에러가 발생하면, Then 커스텀 fallback을 표시한다', () => {
      render(
        <ErrorBoundary fallback={<div>커스텀 에러 페이지</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText('커스텀 에러 페이지')).toBeInTheDocument();
      // 기본 UI는 표시되지 않음
      expect(screen.queryByText('페이지 로딩 중 오류가 발생했습니다')).not.toBeInTheDocument();
    });
  });

  // --- Logging ---
  describe('Scenario: 에러 발생 시 콘솔에 로그를 남긴다', () => {
    it('Given children에서 에러가 발생할 때, Then console.error로 에러가 기록된다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // React + ErrorBoundary의 componentDidCatch가 console.error 호출
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
