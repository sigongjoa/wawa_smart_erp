/**
 * StepBlock 컴포넌트 단위 테스트
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepBlock } from './StepBlock';

describe('StepBlock', () => {
  it('explain step — 제목과 본문 렌더', () => {
    render(<StepBlock index={0} step={{
      kind: 'explain', title: '표본평균은 변수다', body_md: '매번 표본을 뽑으면...',
    }} />);
    expect(screen.getByText('표본평균은 변수다')).toBeInTheDocument();
    expect(screen.getByText('매번 표본을 뽑으면...')).toBeInTheDocument();
  });

  it('checkpoint step — question 렌더', () => {
    render(<StepBlock index={1} step={{
      kind: 'checkpoint', question: '여기까지 OK?',
    }} />);
    expect(screen.getByText(/여기까지 OK/)).toBeInTheDocument();
  });

  it('inline_cite — src와 quote 렌더 + variant class', () => {
    const { container } = render(<StepBlock index={0} step={{
      kind: 'inline_cite', variant: 'unit', src: '확통 §2.1', page: 11, quote: '확률표본의 정의',
    }} />);
    expect(screen.getByText('확률표본의 정의')).toBeInTheDocument();
    expect(container.querySelector('.askai-cite-unit')).toBeTruthy();
  });

  it('isDone → step-num 색 변화 (is-done class)', () => {
    const { container } = render(<StepBlock index={0} isDone step={{
      kind: 'explain', title: 'x', body_md: 'y',
    }} />);
    expect(container.querySelector('.is-done')).toBeTruthy();
  });

  it('isLocked → is-locked class + 잠금 표시', () => {
    const { container } = render(<StepBlock index={0} isLocked step={{
      kind: 'explain', title: 'x', body_md: 'y',
    }} />);
    expect(container.querySelector('.is-locked')).toBeTruthy();
  });

  it('번호는 index+1 표시', () => {
    render(<StepBlock index={2} step={{ kind: 'explain', title: 'x', body_md: 'y' }} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
