/**
 * Zod 기반 입력 검증 스키마
 * 모든 API 요청 입력값 검증
 */

import { z } from 'zod';

// ==================== 인증 ====================
export const LoginSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ==================== 시간표 ====================
export const CreateClassSchema = z.object({
  name: z.string().min(1, '학급명은 필수입니다').max(100),
  grade: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '시간 형식: HH:MM').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '시간 형식: HH:MM').optional(),
  capacity: z.number().int().min(1).optional(),
});

export const UpdateClassSchema = CreateClassSchema.partial();

export const RecordAttendanceSchema = z.object({
  studentId: z.string().uuid('유효한 학생 ID를 입력하세요'),
  classId: z.string().uuid('유효한 학급 ID를 입력하세요'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  status: z.enum(['present', 'absent', 'late', 'makeup']).default('present'),
  notes: z.string().max(500).optional(),
});

export type CreateClassInput = z.infer<typeof CreateClassSchema>;
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;

// ==================== 성적 ====================
export const CreateExamSchema = z.object({
  classId: z.string().uuid('유효한 학급 ID를 입력하세요'),
  name: z.string().min(1, '시험명은 필수입니다').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  totalScore: z.number().min(0).optional(),
});

export const RecordGradeSchema = z.object({
  studentId: z.string().uuid('유효한 학생 ID를 입력하세요'),
  examId: z.string().uuid('유효한 시험 ID를 입력하세요'),
  score: z.number().min(0).max(100).optional(),
  comments: z.string().max(1000).optional(),
});

export const UpdateGradeSchema = RecordGradeSchema.omit({ studentId: true, examId: true }).partial();

export type CreateExamInput = z.infer<typeof CreateExamSchema>;
export type RecordGradeInput = z.infer<typeof RecordGradeSchema>;
export type UpdateGradeInput = z.infer<typeof UpdateGradeSchema>;

// ==================== 학생 ====================
export const CreateStudentSchema = z.object({
  name: z.string().min(1, '학생명은 필수입니다').max(100),
  classId: z.string().uuid().optional(),
  contact: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '유효한 전화번호를 입력하세요').optional(),
  guardianContact: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).optional(),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const UpdateStudentSchema = CreateStudentSchema.omit({ enrollmentDate: true }).partial();

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

// ==================== 보고서 ====================
export const GenerateReportSchema = z.object({
  studentId: z.string().uuid('유효한 학생 ID를 입력하세요'),
  month: z.string().regex(/^\d{4}-\d{2}$/, '날짜 형식: YYYY-MM'),
});

export const SendReportSchema = z.object({
  recipientPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '유효한 전화번호를 입력하세요'),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
export type SendReportInput = z.infer<typeof SendReportSchema>;

// ==================== 메시지 ====================
export const SendMessageSchema = z.object({
  recipientId: z.string().uuid('유효한 수신자 ID를 입력하세요'),
  content: z.string().min(1, '메시지 내용은 필수입니다').max(5000),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// ==================== 검증 헬퍼 ====================
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`입력 검증 실패: ${messages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * 안전한 JSON 파싱 및 검증
 */
export async function parseAndValidate<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const json = await request.json();
    return validateInput(schema, json);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`요청 처리 실패: ${error.message}`);
    }
    throw error;
  }
}
