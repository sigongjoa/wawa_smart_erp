import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

let shouldThrow = false;

// 외부 변수로 에러 제어 가능한 컴포넌트
function ConditionalThrow() {
  if (shouldThrow) {
    throw new Error('조건부 에러');
  }
  return <div>정상 컨텐츠</div>;
}

// 에러 메시지가 없는 에러
function ThrowWithoutMessage() {
  throw new Error('');
}

// ============================================================
// Edge Case: ErrorBoundary 복구 및 특수 상황
// ============================================================
describe('Edge: ErrorBoundary 복구 및 특수 상황', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = false;
  });

  it('다시 시도 버튼 클릭 시 children이 다시 렌더링된다', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    // 에러 상태 확인
    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();

    // 에러 조건 해제 후 다시 시도
    shouldThrow = false;
    fireEvent.click(screen.getByText('다시 시도'));

    // 복구 확인
    expect(screen.getByText('정상 컨텐츠')).toBeInTheDocument();
    expect(screen.queryByText('페이지 로딩 중 오류가 발생했습니다')).not.toBeInTheDocument();
  });

  it('다시 시도 후 다시 에러 발생 시 에러 UI를 다시 표시한다', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();

    // 복구 시도했지만 다시 에러
    // shouldThrow는 여전히 true
    fireEvent.click(screen.getByText('다시 시도'));

    // 다시 에러 상태
    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();
  });

  it('에러 메시지가 빈 문자열인 경우에도 UI가 렌더링된다', () => {
    render(
      <ErrorBoundary>
        <ThrowWithoutMessage />
      </ErrorBoundary>
    );

    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
  });

  it('여러 children 중 하나만 에러여도 전체가 fallback으로 전환된다', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <div>정상 컴포넌트 1</div>
        <ConditionalThrow />
        <div>정상 컴포넌트 2</div>
      </ErrorBoundary>
    );

    expect(screen.queryByText('정상 컴포넌트 1')).not.toBeInTheDocument();
    expect(screen.queryByText('정상 컴포넌트 2')).not.toBeInTheDocument();
    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();
  });

  it('중첩된 ErrorBoundary에서 내부만 에러를 잡는다', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <div>외부 정상</div>
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      </ErrorBoundary>
    );

    // 내부 ErrorBoundary가 에러를 잡으므로 외부는 정상
    expect(screen.getByText('외부 정상')).toBeInTheDocument();
    expect(screen.getByText('페이지 로딩 중 오류가 발생했습니다')).toBeInTheDocument();
  });
});
