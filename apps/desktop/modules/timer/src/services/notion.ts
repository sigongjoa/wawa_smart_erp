/**
 * Notion Integration for Timer Module
 * Fetches student schedules via Backend API
 */
import type { Student } from '../types';

// Backend API base URL
const API_BASE = 'http://localhost:8000';

// Fetch schedules from backend API
export const fetchSchedules = async (): Promise<Student[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/timer/schedules`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to fetch schedules');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch schedules');
    }

    // Transform backend response to Student type
    return data.schedules.map((s: any) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  } catch (error) {
    console.error('Failed to fetch schedules:', error);
    throw error;
  }
};

// Test connection
export const testConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/timer/test-connection`);

    if (!response.ok) {
      return { success: false, message: '백엔드 서버 연결 실패' };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      message: `연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    };
  }
};
