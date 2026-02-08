import type { DayType } from '../types';

/**
 * Shared constants used across multiple modules
 */

// 요일 라벨 (일요일=0)
export const DAY_LABELS: readonly DayType[] = ['일', '월', '화', '수', '목', '금', '토'] as const;

// 현재 요일 가져오기
export const getTodayDay = (): DayType => DAY_LABELS[new Date().getDay()];

// 과목별 색상
export const SUBJECT_COLORS: Record<string, string> = {
  '국어': '#FF6B00',
  '영어': '#3B82F6',
  '수학': '#10B981',
  '과학': '#8B5CF6',
  '사회': '#EC4899',
  '역사': '#F59E0B',
  '물리': '#06B6D4',
  '화학': '#84CC16',
  '생물': '#22C55E',
  '지구과학': '#6366F1',
};

export const getSubjectColor = (subject: string): string =>
  SUBJECT_COLORS[subject] || '#6B7280';

// 날짜/시간 포맷 유틸리티
export const formatMessageTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

export const formatTimeOnly = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

// Teacher lookup 유틸리티
export const getTeacherName = (teachers: Array<{ id: string; name: string }>, teacherId: string): string => {
  return teachers.find((t) => t.id === teacherId)?.name || '';
};
