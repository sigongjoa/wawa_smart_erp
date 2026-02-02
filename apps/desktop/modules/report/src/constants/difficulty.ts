/**
 * Difficulty grade constants and styling
 * 시험 난이도 등급 상수 및 스타일링
 */
import type { DifficultyGrade } from '../types';

/** Available difficulty grades (highest to lowest) */
export const DIFFICULTY_GRADES: DifficultyGrade[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Colors for each difficulty grade */
export const DIFFICULTY_COLORS: Record<DifficultyGrade, string> = {
  A: '#dc2626', // red-600
  B: '#ea580c', // orange-600
  C: '#ca8a04', // yellow-600
  D: '#65a30d', // lime-600
  E: '#16a34a', // green-600
  F: '#2563eb', // blue-600
};

/** Human-readable labels for difficulty grades */
export const DIFFICULTY_LABELS: Record<DifficultyGrade, string> = {
  A: '최상',
  B: '상',
  C: '중',
  D: '중하',
  E: '하',
  F: '기초',
};

/** Get background color with opacity for badges */
export const getDifficultyBgColor = (grade: DifficultyGrade, opacity: number = 0.2): string => {
  const color = DIFFICULTY_COLORS[grade];
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
