/**
 * Cloudflare Workers API 클라이언트
 * 모든 API 요청을 처리하는 중앙화된 클라이언트
 */

// 환경에 따른 API URL 설정
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : 'https://wawa-smart-erp-api.zeskywa499.workers.dev');

// API 응답 타입
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// 요청 옵션
interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadTokens();
  }

  /**
   * 로컬 스토리지에서 토큰 로드
   */
  private loadTokens() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  /**
   * 토큰 저장
   */
  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  /**
   * 토큰 제거
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * 인증 헤더 생성
   */
  private getAuthHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  /**
   * 토큰 갱신
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.status === 401) {
        this.clearTokens();
        return false;
      }

      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        const { accessToken, refreshToken } = data.data;
        this.setTokens(accessToken, refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }

  // ==================== Generic HTTP Methods ====================
  async get<T>(endpoint: string, options?: { params?: Record<string, string> }): Promise<T> {
    const params = new URLSearchParams(options?.params || {});
    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * 기본 fetch 래퍼
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & FetchOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const { headers = {}, timeout = 30000, ...fetchOptions } = options;

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...headers,
    };

    // 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 401 Unauthorized - 토큰 갱신 시도
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // 토큰 갱신 성공 - 요청 재시도
          return this.request<T>(endpoint, { ...options, headers: { ...headers } });
        } else {
          // 토큰 갱신 실패 - 로그인 페이지로 이동
          window.location.href = '/login';
          throw new Error('Unauthorized');
        }
      }

      if (!response.ok) {
        const errorData: ApiResponse = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API error');
      }

      return data.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // ==================== Auth API ====================
  async login(name: string, pin: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    });

    const data: ApiResponse = await response.json();
    if (data.success && data.data) {
      const { accessToken, refreshToken, user } = data.data;
      this.setTokens(accessToken, refreshToken);
      return user;
    }

    throw new Error(data.error || 'Login failed');
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  // ==================== Timer API ====================
  async getClasses() {
    return this.request('/api/timer/classes', { method: 'GET' });
  }

  async createClass(classData: any) {
    return this.request('/api/timer/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async getClass(classId: string) {
    return this.request(`/api/timer/classes/${classId}`, { method: 'GET' });
  }

  async updateClass(classId: string, classData: any) {
    return this.request(`/api/timer/classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(classId: string) {
    return this.request(`/api/timer/classes/${classId}`, { method: 'DELETE' });
  }

  async recordAttendance(attendanceData: any) {
    return this.request('/api/timer/attendance', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  async getAttendance(classId: string, date: string) {
    return this.request(`/api/timer/attendance/${classId}/${date}`, {
      method: 'GET',
    });
  }

  // ==================== Grader API ====================
  async getExams() {
    return this.request('/api/grader/exams', { method: 'GET' });
  }

  async createExam(examData: any) {
    return this.request('/api/grader/exams', {
      method: 'POST',
      body: JSON.stringify(examData),
    });
  }

  async recordGrade(gradeData: any) {
    return this.request('/api/grader/grades', {
      method: 'POST',
      body: JSON.stringify(gradeData),
    });
  }

  async getStudentGrades(studentId: string) {
    return this.request(`/api/grader/grades/${studentId}`, { method: 'GET' });
  }

  async updateGrade(gradeId: string, gradeData: any) {
    return this.request(`/api/grader/grades/${gradeId}`, {
      method: 'PATCH',
      body: JSON.stringify(gradeData),
    });
  }

  // ==================== Student API ====================
  async getStudents(classId?: string) {
    const url = classId ? `/api/student?classId=${classId}` : '/api/student';
    return this.request(url, { method: 'GET' });
  }

  async createStudent(studentData: any) {
    return this.request('/api/student', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async getStudent(studentId: string) {
    return this.request(`/api/student/${studentId}`, { method: 'GET' });
  }

  async updateStudent(studentId: string, studentData: any) {
    return this.request(`/api/student/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(studentData),
    });
  }

  async deleteStudent(studentId: string) {
    return this.request(`/api/student/${studentId}`, { method: 'DELETE' });
  }

  // ==================== Report API ====================
  async generateReport(studentId: string, month: string) {
    return this.request('/api/report/generate', {
      method: 'POST',
      body: JSON.stringify({ studentId, month }),
    });
  }

  async getReport(studentId: string, month: string) {
    return this.request(`/api/report/${studentId}/${month}`, { method: 'GET' });
  }

  async getStudentReports(studentId: string) {
    return this.request(`/api/report/student/${studentId}`, { method: 'GET' });
  }

  async sendReport(reportId: string, recipientPhone: string) {
    return this.request(`/api/report/${reportId}/send`, {
      method: 'POST',
      body: JSON.stringify({ recipientPhone }),
    });
  }

  // ==================== Health Check ====================
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  // ==================== Utility ====================
  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;
