import type { Teacher, Student, Score, MonthlyReport, SubjectScore, Exam, DifficultyGrade, AbsenceHistory, ExamSchedule } from '../types';
import { useReportStore } from '../stores/reportStore';
import { NOTION_COLUMNS_STUDENT, NOTION_COLUMNS_SCORE, NOTION_COLUMNS_EXAM, NOTION_COLUMNS_ABSENCE_HISTORY, NOTION_COLUMNS_EXAM_SCHEDULE, NOTION_STATUS_VALUES } from '../constants/notion';
import { ApiResult } from '../types/api';

const BATCH_CHUNK_SIZE = 10;
const BATCH_CHUNK_DELAY = 100;

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isElectron = (): boolean => {
  return !!(window.wawaAPI || window.location.protocol === 'file:');
};

const getAppSettings = () => useReportStore.getState().appSettings;

const getApiKey = (): string => {
  const settings = getAppSettings();
  return settings.notionApiKey || '';
};

const getDbIds = () => {
  const settings = getAppSettings();
  return {
    teachers: settings.notionTeachersDb || '',
    students: settings.notionStudentsDb || '',
    scores: settings.notionScoresDb || '',
    exams: settings.notionExamsDb || '',
    absenceHistory: settings.notionAbsenceHistoryDb || '',
    examSchedule: settings.notionExamScheduleDb || '',
  };
};

const notionFetch = async (endpoint: string, options: RequestInit = {}, apiKey?: string) => {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('Notion API Key가 설정되지 않았습니다.');
  }

  console.log(`[Notion Request] ${options.method || 'GET'} ${endpoint}`);
  if (options.body) console.log(`[Notion Body]`, JSON.parse(options.body as string));

  if (isElectron() && window.wawaAPI) {
    const result = await window.wawaAPI.notionFetch(endpoint, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
      body: options.body,
    });

    if (!result.success) {
      console.error('Notion API error (Electron):', result.error || result.message);
      throw new Error(result.message || 'Notion API error');
    }

    console.log(`[Notion Response] Success`);
    return result.data;
  }

  // Fallback for web (proxy required)
  const response = await fetch(`/api/notion/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Notion API error (Web):', error);
    throw new Error(error.message || 'Notion API error');
  }

  const data = await response.json();
  console.log(`[Notion Response]`, data);
  return data;
};

export const testNotionConnection = async (
  apiKey: string,
  dbIds: {
    teachers?: string;
    students?: string;
    scores?: string;
    exams?: string;
    absenceHistory?: string;
    examSchedule?: string;
  }
) => {
  const details: any = {};
  const errors: string[] = [];
  let totalConfigured = 0;

  try {
    await notionFetch('/users/me', { method: 'GET' }, apiKey);
  } catch {
    return { success: false, message: 'API Key가 유효하지 않습니다.' };
  }

  const testDb = async (name: string, dbId?: string) => {
    if (!dbId) return false;
    totalConfigured++;
    try {
      await notionFetch(`/databases/${dbId}`, { method: 'GET' }, apiKey);
      return true;
    } catch {
      errors.push(`${name} DB`);
      return false;
    }
  };

  details.teachers = await testDb('선생님', dbIds.teachers);
  details.students = await testDb('학생', dbIds.students);
  details.scores = await testDb('점수', dbIds.scores);
  details.exams = await testDb('시험지', dbIds.exams);
  details.absenceHistory = await testDb('결시이력', dbIds.absenceHistory);
  details.examSchedule = await testDb('시험일정', dbIds.examSchedule);

  const connectedCount = Object.values(details).filter(Boolean).length;

  return {
    success: connectedCount === totalConfigured,
    message: connectedCount === totalConfigured ? '연결 성공' : `일부 연결 실패: ${errors.join(', ')}`,
    details,
  };
};

export const fetchTeachers = async (): Promise<Teacher[]> => {
  const dbIds = getDbIds();
  if (!dbIds.teachers) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.teachers}/query`, { method: 'POST', body: JSON.stringify({}) });
    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['선생님']?.title?.[0]?.plain_text || '',
      subjects: (page.properties['과목']?.rich_text?.[0]?.plain_text || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      pin: String(page.properties['PIN']?.number || '0000'),
      isAdmin: page.properties['isAdmin']?.select?.name === 'True',
    }));
  } catch { return []; }
};

export const fetchStudents = async (): Promise<Student[]> => {
  const dbIds = getDbIds();
  if (!dbIds.students) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({ sorts: [{ property: '이름', direction: 'ascending' }] }),
    });
    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['이름']?.title?.[0]?.plain_text || '',
      grade: page.properties['학년']?.select?.name || page.properties['학년']?.rich_text?.[0]?.plain_text || '',
      subjects: page.properties['수강과목']?.multi_select?.map((s: any) => s.name) || [],
      parentName: page.properties['학부모연락처']?.rich_text?.[0]?.plain_text || page.properties['학부모']?.rich_text?.[0]?.plain_text || '',
      parentPhone: page.properties['전화번호']?.phone_number || page.properties['학부모전화']?.rich_text?.[0]?.plain_text || '',
      examDate: page.properties[NOTION_COLUMNS_STUDENT.EXAM_DATE]?.date?.start || undefined,
      status: page.properties[NOTION_COLUMNS_STUDENT.STATUS]?.select?.name === '비활성' ? 'inactive' : 'active',
      absenceReason: page.properties[NOTION_COLUMNS_STUDENT.ABSENCE_REASON]?.rich_text?.[0]?.plain_text || undefined,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
    }));
  } catch { return []; }
};

export const createStudent = async (student: Omit<Student, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<Student>> => {
  const dbIds = getDbIds();
  if (!dbIds.students) return { success: false, error: { message: "학생 데이터베이스 ID가 설정되지 않았습니다." } };
  try {
    const properties: any = {
      [NOTION_COLUMNS_STUDENT.NAME]: { title: [{ text: { content: student.name } }] },
      [NOTION_COLUMNS_STUDENT.GRADE]: { select: { name: student.grade } },
      [NOTION_COLUMNS_STUDENT.SUBJECTS]: { multi_select: student.subjects.map((s) => ({ name: s })) },
      [NOTION_COLUMNS_STUDENT.STATUS]: { select: { name: NOTION_STATUS_VALUES.ACTIVE } },
    };
    if (student.parentName) properties[NOTION_COLUMNS_STUDENT.PARENT_NAME] = { rich_text: [{ text: { content: student.parentName } }] };
    if (student.parentPhone) properties[NOTION_COLUMNS_STUDENT.PARENT_PHONE] = { phone_number: student.parentPhone };
    if (student.examDate) properties[NOTION_COLUMNS_STUDENT.EXAM_DATE] = { date: { start: student.examDate } };

    const data = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({ parent: { database_id: dbIds.students }, properties }),
    });
    return { success: true, data: { ...student, id: data.id, createdAt: data.created_time, updatedAt: data.last_edited_time } as Student };
  } catch (error: any) {
    console.error("❌ createStudent failed:", error);
    return { success: false, error: { message: error.message || "학생 정보를 생성하는 데 실패했습니다." } };
  }
};

export const updateStudent = async (studentId: string, updates: Partial<Student>): Promise<ApiResult<boolean>> => {
  const dbIds = getDbIds();
  if (!dbIds.students) return { success: false, error: { message: "학생 데이터베이스 ID가 설정되지 않았습니다." } };
  try {
    const properties: any = {};
    if (updates.name) properties[NOTION_COLUMNS_STUDENT.NAME] = { title: [{ text: { content: updates.name } }] };
    if (updates.grade) properties[NOTION_COLUMNS_STUDENT.GRADE] = { select: { name: updates.grade } };
    if (updates.subjects) properties[NOTION_COLUMNS_STUDENT.SUBJECTS] = { multi_select: updates.subjects.map((s) => ({ name: s })) };
    if (updates.parentName !== undefined) properties[NOTION_COLUMNS_STUDENT.PARENT_NAME] = { rich_text: [{ text: { content: updates.parentName } }] };
    if (updates.parentPhone !== undefined) properties[NOTION_COLUMNS_STUDENT.PARENT_PHONE] = { phone_number: updates.parentPhone };
    if (updates.examDate !== undefined) properties[NOTION_COLUMNS_STUDENT.EXAM_DATE] = updates.examDate ? { date: { start: updates.examDate } } : { date: null };
    if (updates.status) properties[NOTION_COLUMNS_STUDENT.STATUS] = { select: { name: updates.status === "inactive" ? NOTION_STATUS_VALUES.INACTIVE : NOTION_STATUS_VALUES.ACTIVE } };

    await notionFetch(`/pages/${studentId}`, { method: "PATCH", body: JSON.stringify({ properties }) });
    return { success: true, data: true };
  } catch (error: any) {
    console.error("❌ updateStudent failed:", error);
    return { success: false, error: { message: error.message || "학생 정보를 수정하는 데 실패했습니다." } };
  }
};

export const deleteStudent = async (studentId: string): Promise<ApiResult<boolean>> => {
  try {
    await notionFetch(`/pages/${studentId}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
    return { success: true, data: true };
  } catch (error: any) {
    console.error('❌ deleteStudent failed:', error);
    return { success: false, error: { message: error.message || "학생 정보를 삭제하는 데 실패했습니다." } };
  }
};

export const saveScore = async (
  studentId: string,
  studentName: string,
  yearMonth: string,
  subject: string,
  score: number,
  teacherId: string,
  comment?: string,
  difficulty?: DifficultyGrade
): Promise<ApiResult<boolean>> => {
  const dbIds = getDbIds();
  if (!dbIds.scores) return { success: false, error: { message: "성적 데이터베이스 ID가 설정되지 않았습니다." } };
  try {
    const existing = await notionFetch(`/databases/${dbIds.scores}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          and: [
            { property: '학생', relation: { contains: studentId } },
            { property: '시험년월', rich_text: { equals: yearMonth } },
            { property: '과목', select: { equals: subject } },
          ],
        },
      }),
    });

    const properties: any = {
      [NOTION_COLUMNS_SCORE.NAME]: { title: [{ text: { content: `${studentName}_${subject}_${yearMonth}` } }] },
      [NOTION_COLUMNS_SCORE.YEAR_MONTH]: { rich_text: [{ text: { content: yearMonth } }] },
      [NOTION_COLUMNS_SCORE.SUBJECT]: { select: { name: subject } },
      [NOTION_COLUMNS_SCORE.SCORE]: { number: score },
      [NOTION_COLUMNS_SCORE.COMMENT]: { rich_text: [{ text: { content: comment || '' } }] },
    };
    if (difficulty) properties[NOTION_COLUMNS_SCORE.DIFFICULTY] = { select: { name: difficulty } };

    if (existing.results.length > 0) {
      await notionFetch(`/pages/${existing.results[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { ...properties, [NOTION_COLUMNS_SCORE.TEACHER]: teacherId ? { relation: [{ id: teacherId }] } : undefined } }),
      });
    } else {
      await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: dbIds.scores },
          properties: { ...properties, [NOTION_COLUMNS_SCORE.STUDENT]: { relation: [{ id: studentId }] }, [NOTION_COLUMNS_SCORE.TEACHER]: teacherId ? { relation: [{ id: teacherId }] } : undefined },
        }),
      });
    }
    return { success: true, data: true };
  } catch (error: any) {
    console.error('❌ saveScore failed:', error);
    return { success: false, error: { message: error.message || "성적 정보를 저장하는 데 실패했습니다." } };
  }
};

export const fetchScores = async (yearMonth: string): Promise<MonthlyReport[]> => {
  const dbIds = getDbIds();
  if (!dbIds.scores) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.scores}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter: { property: NOTION_COLUMNS_SCORE.YEAR_MONTH, rich_text: { equals: yearMonth } } }),
    });

    const reportMap = new Map<string, MonthlyReport>();
    for (const page of data.results) {
      const studentId = page.properties[NOTION_COLUMNS_SCORE.STUDENT]?.relation?.[0]?.id;
      if (!studentId) continue;

      if (!reportMap.has(studentId)) {
        reportMap.set(studentId, {
          id: `${studentId}-${yearMonth}`,
          studentId,
          studentName: '', // Join later
          yearMonth,
          scores: [],
          status: 'draft',
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
        });
      }

      const report = reportMap.get(studentId)!;
      report.scores.push({
        subject: page.properties[NOTION_COLUMNS_SCORE.SUBJECT]?.select?.name || '',
        score: page.properties[NOTION_COLUMNS_SCORE.SCORE]?.number || 0,
        teacherId: page.properties[NOTION_COLUMNS_SCORE.TEACHER]?.relation?.[0]?.id || '',
        teacherName: '',
        comment: page.properties[NOTION_COLUMNS_SCORE.COMMENT]?.rich_text?.[0]?.plain_text || '',
        difficulty: page.properties[NOTION_COLUMNS_SCORE.DIFFICULTY]?.select?.name as DifficultyGrade,
        updatedAt: page.last_edited_time,
      });
    }
    return Array.from(reportMap.values());
  } catch { return []; }
};

export const fetchExams = async (yearMonth?: string): Promise<Exam[]> => {
  const dbIds = getDbIds();
  if (!dbIds.exams) return [];
  try {
    const filter = yearMonth ? { property: NOTION_COLUMNS_EXAM.YEAR_MONTH, rich_text: { equals: yearMonth } } : undefined;
    const data = await notionFetch(`/databases/${dbIds.exams}/query`, { method: 'POST', body: JSON.stringify(filter ? { filter } : {}) });
    return data.results.map((page: any) => ({
      id: page.id,
      subject: page.properties[NOTION_COLUMNS_EXAM.SUBJECT]?.select?.name || '',
      yearMonth: page.properties[NOTION_COLUMNS_EXAM.YEAR_MONTH]?.rich_text?.[0]?.plain_text || '',
      difficulty: page.properties[NOTION_COLUMNS_EXAM.DIFFICULTY]?.select?.name as DifficultyGrade || 'C',
      examFileUrl: page.properties[NOTION_COLUMNS_EXAM.EXAM_FILE]?.files?.[0]?.external?.url || page.properties[NOTION_COLUMNS_EXAM.EXAM_FILE]?.files?.[0]?.file?.url || '',
      scope: page.properties[NOTION_COLUMNS_EXAM.SCOPE]?.rich_text?.[0]?.plain_text || '',
      uploadedBy: page.properties[NOTION_COLUMNS_EXAM.UPLOADER]?.rich_text?.[0]?.plain_text || '',
      uploadedAt: page.created_time,
    }));
  } catch { return []; }
};

export const createExamEntry = async (exam: Omit<Exam, 'id' | 'uploadedAt'>): Promise<ApiResult<Exam>> => {
  const dbIds = getDbIds();
  if (!dbIds.exams) return { success: false, error: { message: "시험 데이터베이스 ID가 설정되지 않았습니다." } };
  try {
    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: dbIds.exams },
        properties: {
          '과목': { select: { name: exam.subject } },
          '년월': { rich_text: [{ text: { content: exam.yearMonth } }] },
          '난이도': { select: { name: exam.difficulty } },
          '범위': { rich_text: [{ text: { content: exam.scope || '' } }] },
          '등록자': { rich_text: [{ text: { content: exam.uploadedBy } }] },
        },
      }),
    });
    return { success: true, data: { ...exam, id: data.id, uploadedAt: data.created_time } as Exam };
  } catch (error: any) {
    console.error('❌ createExamEntry failed:', error);
    return { success: false, error: { message: error.message || "시험 정보를 등록하는 데 실패했습니다." } };
  }
};

export const updateExamDifficulty = async (examId: string, difficulty: DifficultyGrade): Promise<ApiResult<boolean>> => {
  try {
    await notionFetch(`/pages/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          '난이도': { select: { name: difficulty } },
        },
      }),
    });
    return { success: true, data: true };
  } catch (error: any) {
    console.error('❌ updateExamDifficulty failed:', error);
    return { success: false, error: { message: error.message || "난이도 수정에 실패했습니다." } };
  }
};

export const fetchExamSchedules = async (yearMonth: string): Promise<ExamSchedule[]> => {
  const dbIds = getDbIds();
  if (!dbIds.examSchedule) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.examSchedule}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH, rich_text: { equals: yearMonth } },
      }),
    });
    return data.results.map((page: any) => ({
      id: page.id,
      studentId: page.properties[NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT]?.relation?.[0]?.id ||
        page.properties[NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT]?.rich_text?.[0]?.plain_text || '',
      yearMonth: page.properties[NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]?.rich_text?.[0]?.plain_text || '',
      examDate: page.properties[NOTION_COLUMNS_EXAM_SCHEDULE.EXAM_DATE]?.date?.start || '',
    }));
  } catch (error) {
    console.error('❌ fetchExamSchedules failed:', error);
    return [];
  }
};

export const updateExamSchedulesBatch = async (
  studentIds: string[],
  yearMonth: string,
  examDate: string
): Promise<ApiResult<boolean>> => {
  const dbIds = getDbIds();
  if (!dbIds.examSchedule) return { success: false, error: { message: "시험표 데이터베이스 ID가 설정되지 않았습니다." } };

  try {
    const results = await Promise.all(studentIds.map(async (studentId) => {
      // Try to find by relation first, if it fails, the user might have a text field
      // The error suggested 'database property text does not match filter relation'
      // This means the property IS text but we filtered by relation.
      const existing = await notionFetch(`/databases/${dbIds.examSchedule}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            and: [
              { property: NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT, rich_text: { contains: studentId } },
              { property: NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH, rich_text: { equals: yearMonth } },
            ],
          },
        }),
      });

      if (existing.results.length > 0) {
        return notionFetch(`/pages/${existing.results[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: { [NOTION_COLUMNS_EXAM_SCHEDULE.EXAM_DATE]: { date: { start: examDate } } },
          }),
        });
      } else {
        return notionFetch('/pages', {
          method: 'POST',
          body: JSON.stringify({
            parent: { database_id: dbIds.examSchedule },
            properties: {
              [NOTION_COLUMNS_EXAM_SCHEDULE.NAME]: { title: [{ text: { content: `${studentId}_${yearMonth}` } }] },
              [NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT]: { rich_text: [{ text: { content: studentId } }] },
              [NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]: { rich_text: [{ text: { content: yearMonth } }] },
              [NOTION_COLUMNS_EXAM_SCHEDULE.EXAM_DATE]: { date: { start: examDate } },
            },
          }),
        });
      }
    }));
    return { success: true, data: true };
  } catch (error: any) {
    console.error('❌ updateExamSchedulesBatch failed:', error);
    return { success: false, error: { message: error.message || "일괄 날짜 지정에 실패했습니다." } };
  }
};

// Compatibility aliases for timer module
export const getStudents = async () => {
  const dbIds = getDbIds();
  if (!dbIds.students) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({ sorts: [{ property: '이름', direction: 'ascending' }] }),
    });
    return data.results;
  } catch { return []; }
};

const notionClient = {
  getStudents,
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  fetchTeachers,
  saveScore,
  fetchScores,
  fetchExams,
  createExamEntry,
  updateExamDifficulty,
  fetchExamSchedules,
  updateExamSchedulesBatch,
  testNotionConnection,
};

export default notionClient;
