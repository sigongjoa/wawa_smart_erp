import type { Teacher, Student, Score, MonthlyReport, SubjectScore, Exam, DifficultyGrade, AbsenceHistory, ExamSchedule, Enrollment, DayType, MakeupRecord, MakeupStatus, DirectMessage, DMContact } from '../types';
import { useReportStore } from '../stores/reportStore';
import { NOTION_COLUMNS_STUDENT, NOTION_COLUMNS_SCORE, NOTION_COLUMNS_EXAM, NOTION_COLUMNS_ABSENCE_HISTORY, NOTION_COLUMNS_EXAM_SCHEDULE, NOTION_COLUMNS_ENROLLMENT, NOTION_STATUS_VALUES, NOTION_COLUMNS_MAKEUP, NOTION_COLUMNS_DM, NOTION_MAKEUP_STATUS } from '../constants/notion';
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
    enrollment: settings.notionEnrollmentDb || '',
    makeup: settings.notionMakeupDb || '',
    dmMessages: settings.notionDmMessagesDb || '',
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
    // 500 에러 시 빈 응답일 수 있으므로 안전하게 처리
    let errorMessage = `Notion API error: ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        const error = JSON.parse(text);
        errorMessage = error.message || errorMessage;
      }
    } catch {
      // 빈 응답이거나 JSON 파싱 실패 - 기본 에러 메시지 사용
    }
    console.error('Notion API error (Web):', errorMessage);
    throw new Error(errorMessage);
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
    enrollment?: string;
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
  details.enrollment = await testDb('수강일정', dbIds.enrollment);

  const connectedCount = Object.values(details).filter(Boolean).length;

  return {
    success: connectedCount === totalConfigured,
    message: connectedCount === totalConfigured ? '연결 성공' : `일부 연결 실패: ${errors.join(', ')}`,
    details,
  };
};

export const fetchTeachers = async (): Promise<Teacher[]> => {
  const dbIds = getDbIds();
  if (!dbIds.teachers) {
    console.warn('[Notion] Teachers DB ID not configured');
    return [];
  }
  try {
    const data = await notionFetch(`/databases/${dbIds.teachers}/query`, { method: 'POST', body: JSON.stringify({}) });
    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['선생님']?.title?.[0]?.plain_text || '',
      subjects: page.properties['과목']?.multi_select?.map((s: any) => s.name) || [],
      pin: String(page.properties['PIN']?.number || '0000'),
      isAdmin: page.properties['isAdmin']?.select?.name === 'True',
    }));
  } catch (error) {
    console.error('[Notion] fetchTeachers failed:', error);
    return [];
  }
};

export const fetchStudents = async (): Promise<Student[]> => {
  const dbIds = getDbIds();
  if (!dbIds.students) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({ sorts: [{ property: '이름', direction: 'ascending' }] }),
    });

    return data.results
      .map((page: any) => {
        const props = page.properties;
        // Debug: Log properties to identify column names
        // if (data.results.indexOf(page) === 0) {
        //     console.log('[fetchStudents] Student Properties:', Object.keys(props));
        // }
        const name = props['이름']?.title?.[0]?.plain_text || '';
        if (!name) return null;

        // 학년 파싱 강화 (Select, MultiSelect, RichText, Formula, Rollup 지원)
        let grade = '';
        const gradeProp = props['학년'];
        if (gradeProp) {
          if (gradeProp.type === 'select') grade = gradeProp.select?.name || '';
          else if (gradeProp.type === 'multi_select') grade = gradeProp.multi_select?.[0]?.name || '';
          else if (gradeProp.type === 'rich_text') grade = gradeProp.rich_text?.[0]?.plain_text || '';
          else if (gradeProp.type === 'formula') grade = gradeProp.formula?.string || '';
          else if (gradeProp.type === 'rollup') {
            const arr = gradeProp.rollup?.array;
            if (arr && arr.length > 0) {
              const first = arr[0];
              if (first.type === 'select') grade = first.select?.name || '';
              else if (first.type === 'multi_select') grade = first.multi_select?.[0]?.name || '';
              else if (first.type === 'rich_text') grade = first.rich_text?.[0]?.plain_text || '';
              else if (first.type === 'formula') grade = first.formula?.string || '';
            }
          }
        }

        return {
          id: page.id,
          name,
          grade,
          day: props['요일']?.select?.name || props['요일']?.rich_text?.[0]?.plain_text || '월',
          startTime: props['시작시간']?.rich_text?.[0]?.plain_text || props['시간']?.rich_text?.[0]?.plain_text || '',
          endTime: props['종료시간']?.rich_text?.[0]?.plain_text || '',
          subject: props['주력과목']?.select?.name || props['수강과목']?.multi_select?.[0]?.name || '',
          subjects: props['수강과목']?.multi_select?.map((s: any) => s.name) || [],
          teacherIds: props['담당선생님']?.relation?.map((r: any) => r.id) || [],
          parentName: props['학부모연락처']?.rich_text?.[0]?.plain_text || props['학부모']?.rich_text?.[0]?.plain_text || '',
          parentPhone: props['전화번호']?.phone_number || props['학부모전화']?.rich_text?.[0]?.plain_text || '',
          examDate: props[NOTION_COLUMNS_STUDENT.EXAM_DATE]?.date?.start || undefined,
          status: props[NOTION_COLUMNS_STUDENT.STATUS]?.select?.name === '비활성' ? 'inactive' : 'active',
          absenceReason: props[NOTION_COLUMNS_STUDENT.ABSENCE_REASON]?.rich_text?.[0]?.plain_text || undefined,
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
        };
      })
      .filter((s: Student | null): s is Student => s !== null);
  } catch (error) {
    console.error('❌ fetchStudents failed:', error);
    return [];
  }
};

export const createStudent = async (student: Omit<Student, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<Student>> => {
  const dbIds = getDbIds();
  if (!dbIds.students) return { success: false, error: { message: "학생 데이터베이스 ID가 설정되지 않았습니다." } };
  try {
    const properties: any = {
      [NOTION_COLUMNS_STUDENT.NAME]: { title: [{ text: { content: student.name } }] },
      [NOTION_COLUMNS_STUDENT.GRADE]: {
        multi_select: [{ name: student.grade }],
      },
      // [NOTION_COLUMNS_STUDENT.STATUS]: {
      //   select: { name: NOTION_STATUS_VALUES.ACTIVE },
      // },
      [NOTION_COLUMNS_STUDENT.SUBJECTS]: {
        multi_select: student.subjects.map((sub) => ({ name: sub })),
      },
      // [NOTION_COLUMNS_STUDENT.PARENT_NAME]: {
      //   rich_text: [{ text: { content: student.parentName || '' } }],
      // },
      // [NOTION_COLUMNS_STUDENT.PARENT_PHONE]: {
      //   phone_number: student.parentPhone || null,
      // },
    };
    if (student.examDate) properties[NOTION_COLUMNS_STUDENT.EXAM_DATE] = { date: { start: student.examDate } };
    if (student.teacherIds && student.teacherIds.length > 0) {
      properties[NOTION_COLUMNS_STUDENT.TEACHERS] = { relation: student.teacherIds.map(id => ({ id })) };
    }

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
    if (updates.grade) properties[NOTION_COLUMNS_STUDENT.GRADE] = { multi_select: [{ name: updates.grade }] };
    if (updates.subjects) properties[NOTION_COLUMNS_STUDENT.SUBJECTS] = { multi_select: updates.subjects.map((s) => ({ name: s })) };
    // if (updates.parentName !== undefined) properties[NOTION_COLUMNS_STUDENT.PARENT_NAME] = { rich_text: [{ text: { content: updates.parentName } }] };
    // if (updates.parentPhone !== undefined) properties[NOTION_COLUMNS_STUDENT.PARENT_PHONE] = { phone_number: updates.parentPhone };
    if (updates.examDate !== undefined) properties[NOTION_COLUMNS_STUDENT.EXAM_DATE] = updates.examDate ? { date: { start: updates.examDate } } : { date: null };
    // if (updates.status) properties[NOTION_COLUMNS_STUDENT.STATUS] = { select: { name: updates.status === "inactive" ? NOTION_STATUS_VALUES.INACTIVE : NOTION_STATUS_VALUES.ACTIVE } };
    if (updates.teacherIds) properties[NOTION_COLUMNS_STUDENT.TEACHERS] = { relation: updates.teacherIds.map(id => ({ id })) };

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

    // No debug logs needed


    const reportMap = new Map<string, MonthlyReport>();
    for (const page of data.results) {
      const studentId = page.properties[NOTION_COLUMNS_SCORE.STUDENT]?.relation?.[0]?.id;
      if (!studentId) {
        console.warn('[fetchScores] No studentId found, skipping. Property value:', page.properties[NOTION_COLUMNS_SCORE.STUDENT]);
        continue;
      }

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
      const subject = page.properties[NOTION_COLUMNS_SCORE.SUBJECT]?.select?.name || '';
      const comment = page.properties[NOTION_COLUMNS_SCORE.COMMENT]?.rich_text?.[0]?.plain_text || '';

      if (subject === '__TOTAL_COMMENT__') {
        // Special subject for total comment
        reportMap.get(studentId)!.totalComment = comment;
      } else {
        report.scores.push({
          subject,
          score: page.properties[NOTION_COLUMNS_SCORE.SCORE]?.number || 0,
          teacherId: page.properties[NOTION_COLUMNS_SCORE.TEACHER]?.relation?.[0]?.id || '',
          teacherName: '',
          comment,
          difficulty: page.properties[NOTION_COLUMNS_SCORE.DIFFICULTY]?.select?.name as DifficultyGrade,
          updatedAt: page.last_edited_time,
        });
      }
    }
    return Array.from(reportMap.values());
  } catch (error) {
    console.error('[Notion] fetchScores failed:', error);
    return [];
  }
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
  } catch (error) {
    console.error('[Notion] fetchExams failed:', error);
    return [];
  }
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
    // 년월 필터가 가끔 타입 문제(Text vs Date)를 일으키므로,
    // 우선 전체 데이터를 가져온 후 JS에서 필터링하여 타입 불일치 오류를 방지합니다.
    const data = await notionFetch(`/databases/${dbIds.examSchedule}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return data.results
      .map((page: any) => {
        const props = page.properties;
        const ymText = props[NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]?.rich_text?.[0]?.plain_text ||
          props[NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]?.select?.name ||
          props[NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]?.date?.start?.substring(0, 7) || '';

        return {
          id: page.id,
          studentId: props[NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT]?.relation?.[0]?.id ||
            props[NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT]?.rich_text?.[0]?.plain_text || '',
          yearMonth: ymText,
          examDate: props[NOTION_COLUMNS_EXAM_SCHEDULE.EXAM_DATE]?.date?.start || '',
        };
      })
      .filter((s: any) => s.yearMonth === yearMonth);
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
    // 년월을 date 형식으로 변환 (YYYY-MM → YYYY-MM-01)
    const yearMonthDate = `${yearMonth}-01`;

    const results = await Promise.all(studentIds.map(async (studentId) => {
      // ExamSchedule DB: 학생=rich_text, 년월=date
      const existing = await notionFetch(`/databases/${dbIds.examSchedule}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            and: [
              { property: NOTION_COLUMNS_EXAM_SCHEDULE.STUDENT, rich_text: { contains: studentId } },
              { property: NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH, date: { equals: yearMonthDate } },
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
              [NOTION_COLUMNS_EXAM_SCHEDULE.YEAR_MONTH]: { date: { start: yearMonthDate } },
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
  if (!dbIds.students) {
    console.warn('[Notion] Students DB ID not configured');
    return [];
  }
  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({ sorts: [{ property: '이름', direction: 'ascending' }] }),
    });
    return data.results;
  } catch (error) {
    console.error('[Notion] getStudents failed:', error);
    return [];
  }
};

export const fetchEnrollments = async (): Promise<Enrollment[]> => {
  const dbIds = getDbIds();
  if (!dbIds.enrollment) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.enrollment}/query`, {
      method: 'POST',
      body: JSON.stringify({ sorts: [{ property: '요일', direction: 'ascending' }] }),
    });
    console.log('[fetchEnrollments] Raw data count:', data.results.length);
    if (data.results.length > 0) {
      console.log('[fetchEnrollments] First item properties:', JSON.stringify(data.results[0].properties, null, 2));
    }
    return data.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        studentId: props[NOTION_COLUMNS_ENROLLMENT.STUDENT]?.relation?.[0]?.id || '',
        day: (props[NOTION_COLUMNS_ENROLLMENT.DAY]?.select?.name || '월') as DayType,
        startTime: props[NOTION_COLUMNS_ENROLLMENT.START_TIME]?.rich_text?.[0]?.plain_text || '',
        endTime: props[NOTION_COLUMNS_ENROLLMENT.END_TIME]?.rich_text?.[0]?.plain_text || '',
        subject: props[NOTION_COLUMNS_ENROLLMENT.SUBJECT]?.rich_text?.[0]?.plain_text ||
          props[NOTION_COLUMNS_ENROLLMENT.SUBJECT]?.select?.name || '',
        tuition: 0, // Column missing in DB
        createdAt: page.created_time,
        updatedAt: page.last_edited_time,
      };
    });
  } catch (error) {
    console.error('❌ fetchEnrollments failed:', error);
    return [];
  }
};


export const fetchEnrollmentsByStudent = async (studentId: string): Promise<Enrollment[]> => {
  const dbIds = getDbIds();
  if (!dbIds.enrollment) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.enrollment}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: NOTION_COLUMNS_ENROLLMENT.STUDENT,
          relation: { contains: studentId },
        },
        sorts: [{ property: '요일', direction: 'ascending' }],
      }),
    });

    return data.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        studentId: props[NOTION_COLUMNS_ENROLLMENT.STUDENT]?.relation?.[0]?.id || '',
        day: (props[NOTION_COLUMNS_ENROLLMENT.DAY]?.select?.name || '월') as DayType,
        startTime: props[NOTION_COLUMNS_ENROLLMENT.START_TIME]?.rich_text?.[0]?.plain_text || '',
        endTime: props[NOTION_COLUMNS_ENROLLMENT.END_TIME]?.rich_text?.[0]?.plain_text || '',
        subject: props[NOTION_COLUMNS_ENROLLMENT.SUBJECT]?.rich_text?.[0]?.plain_text ||
          props[NOTION_COLUMNS_ENROLLMENT.SUBJECT]?.select?.name || '',
        tuition: 0,
        createdAt: page.created_time,
        updatedAt: page.last_edited_time,
      };
    });
  } catch (error) {
    console.error('❌ fetchEnrollmentsByStudent failed:', error);
    return [];
  }
};

export const updateStudentEnrollments = async (
  studentId: string,
  enrollments: { subject: string; day: string; startTime: string; endTime: string }[]
): Promise<ApiResult<boolean>> => {
  const dbIds = getDbIds();
  if (!dbIds.enrollment) return { success: false, error: { message: "수강일정 데이터베이스 ID가 설정되지 않았습니다." } };

  try {
    // Upsert 패턴: 기존 레코드 조회 → 매칭되면 업데이트, 없으면 생성, 불필요한 것 삭제
    const existingEnrollments = await fetchEnrollmentsByStudent(studentId);

    // 새 enrollment 키 생성 (subject+day)
    const newEnrollmentKeys = new Set(
      enrollments
        .filter(e => e.startTime && e.endTime)
        .map(e => `${e.subject}_${e.day}`)
    );

    // 기존 enrollment를 Map으로 (subject+day → enrollment)
    const existingMap = new Map<string, Enrollment>();
    for (const e of existingEnrollments) {
      const key = `${e.subject}_${e.day}`;
      existingMap.set(key, e);
    }

    console.log('[updateStudentEnrollments] Existing:', existingEnrollments.length, 'New:', enrollments.length);

    // 1. 불필요한 기존 레코드 삭제 (새 목록에 없는 것)
    const toDelete = existingEnrollments.filter(e => !newEnrollmentKeys.has(`${e.subject}_${e.day}`));
    await Promise.all(toDelete.map(e =>
      notionFetch(`/pages/${e.id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) })
    ));
    console.log('[updateStudentEnrollments] Deleted:', toDelete.length);

    // 2. Upsert: 매칭되면 업데이트, 없으면 생성
    await Promise.all(enrollments.map(async (e) => {
      if (!e.startTime || !e.endTime) return;

      const key = `${e.subject}_${e.day}`;
      const existing = existingMap.get(key);

      const properties: any = {
        [NOTION_COLUMNS_ENROLLMENT.SUBJECT]: { rich_text: [{ text: { content: e.subject } }] },
        [NOTION_COLUMNS_ENROLLMENT.DAY]: { select: { name: e.day } },
        [NOTION_COLUMNS_ENROLLMENT.START_TIME]: { rich_text: [{ text: { content: e.startTime } }] },
        [NOTION_COLUMNS_ENROLLMENT.END_TIME]: { rich_text: [{ text: { content: e.endTime } }] },
      };

      if (existing) {
        // 업데이트 (시간만 변경될 수 있음)
        await notionFetch(`/pages/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ properties }),
        });
      } else {
        // 새로 생성
        await notionFetch('/pages', {
          method: 'POST',
          body: JSON.stringify({
            parent: { database_id: dbIds.enrollment },
            properties: {
              ...properties,
              [NOTION_COLUMNS_ENROLLMENT.STUDENT]: { relation: [{ id: studentId }] },
              [NOTION_COLUMNS_ENROLLMENT.NAME]: { title: [{ text: { content: `${e.subject}_${e.day}` } }] },
            },
          }),
        });
      }
    }));

    return { success: true, data: true };
  } catch (error: any) {
    console.error('❌ updateStudentEnrollments failed:', error);
    return { success: false, error: { message: error.message || "수강일정 업데이트 실패" } };
  }
};

// ========== 보강관리 함수 ==========

export const fetchMakeupRecords = async (status?: MakeupStatus): Promise<MakeupRecord[]> => {
  const dbIds = getDbIds();
  if (!dbIds.makeup) return [];
  try {
    const filter = status
      ? { property: NOTION_COLUMNS_MAKEUP.STATUS, multi_select: { contains: status } }
      : undefined;
    const data = await notionFetch(`/databases/${dbIds.makeup}/query`, {
      method: 'POST',
      body: JSON.stringify(filter ? { filter, sorts: [{ timestamp: 'created_time', direction: 'descending' }] } : { sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
    });
    return data.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        studentId: props[NOTION_COLUMNS_MAKEUP.STUDENT]?.relation?.[0]?.id || '',
        studentName: props[NOTION_COLUMNS_MAKEUP.NAME]?.title?.[0]?.plain_text || '',
        subject: props[NOTION_COLUMNS_MAKEUP.SUBJECT]?.rich_text?.[0]?.plain_text || '',
        teacherId: props[NOTION_COLUMNS_MAKEUP.TEACHER]?.relation?.[0]?.id || '',
        absentDate: props[NOTION_COLUMNS_MAKEUP.ABSENT_DATE]?.date?.start || '',
        absentReason: props[NOTION_COLUMNS_MAKEUP.ABSENT_REASON]?.rich_text?.[0]?.plain_text || '',
        makeupDate: props[NOTION_COLUMNS_MAKEUP.MAKEUP_DATE]?.date?.start || '',
        makeupTime: props[NOTION_COLUMNS_MAKEUP.MAKEUP_TIME]?.rich_text?.[0]?.plain_text || '',
        status: (props[NOTION_COLUMNS_MAKEUP.STATUS]?.multi_select?.[0]?.name || '시작 전') as MakeupStatus,
        memo: props[NOTION_COLUMNS_MAKEUP.MEMO]?.rich_text?.[0]?.plain_text || '',
        createdAt: page.created_time,
      };
    });
  } catch (error) {
    console.error('[Notion] fetchMakeupRecords failed:', error);
    return [];
  }
};

export const createMakeupRecord = async (record: {
  studentId: string;
  studentName: string;
  subject: string;
  teacherId?: string;
  absentDate: string;
  absentReason: string;
  makeupDate?: string;
  makeupTime?: string;
  memo?: string;
}): Promise<ApiResult<MakeupRecord>> => {
  const dbIds = getDbIds();
  if (!dbIds.makeup) return { success: false, error: { message: '보강 데이터베이스 ID가 설정되지 않았습니다.' } };
  try {
    const properties: any = {
      [NOTION_COLUMNS_MAKEUP.NAME]: { title: [{ text: { content: `${record.studentName}_${record.absentDate}` } }] },
      [NOTION_COLUMNS_MAKEUP.STUDENT]: { relation: [{ id: record.studentId }] },
      [NOTION_COLUMNS_MAKEUP.SUBJECT]: { rich_text: [{ text: { content: record.subject } }] },
      [NOTION_COLUMNS_MAKEUP.ABSENT_DATE]: { date: { start: record.absentDate } },
      [NOTION_COLUMNS_MAKEUP.ABSENT_REASON]: { rich_text: [{ text: { content: record.absentReason } }] },
      [NOTION_COLUMNS_MAKEUP.STATUS]: { multi_select: [{ name: NOTION_MAKEUP_STATUS.PENDING }] },
    };
    if (record.teacherId) properties[NOTION_COLUMNS_MAKEUP.TEACHER] = { relation: [{ id: record.teacherId }] };
    if (record.makeupDate) properties[NOTION_COLUMNS_MAKEUP.MAKEUP_DATE] = { date: { start: record.makeupDate } };
    if (record.makeupTime) properties[NOTION_COLUMNS_MAKEUP.MAKEUP_TIME] = { rich_text: [{ text: { content: record.makeupTime } }] };
    if (record.memo) properties[NOTION_COLUMNS_MAKEUP.MEMO] = { rich_text: [{ text: { content: record.memo } }] };

    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: dbIds.makeup }, properties }),
    });
    return { success: true, data: { ...record, id: data.id, status: '시작 전' as MakeupStatus, createdAt: data.created_time } };
  } catch (error: any) {
    console.error('[Notion] createMakeupRecord failed:', error);
    return { success: false, error: { message: error.message || '보강 기록 추가에 실패했습니다.' } };
  }
};

export const updateMakeupRecord = async (id: string, updates: {
  makeupDate?: string;
  makeupTime?: string;
  status?: MakeupStatus;
  memo?: string;
}): Promise<ApiResult<boolean>> => {
  try {
    const properties: any = {};
    if (updates.makeupDate !== undefined) properties[NOTION_COLUMNS_MAKEUP.MAKEUP_DATE] = updates.makeupDate ? { date: { start: updates.makeupDate } } : { date: null };
    if (updates.makeupTime !== undefined) properties[NOTION_COLUMNS_MAKEUP.MAKEUP_TIME] = { rich_text: [{ text: { content: updates.makeupTime } }] };
    if (updates.status) properties[NOTION_COLUMNS_MAKEUP.STATUS] = { multi_select: [{ name: updates.status }] };
    if (updates.memo !== undefined) properties[NOTION_COLUMNS_MAKEUP.MEMO] = { rich_text: [{ text: { content: updates.memo } }] };

    await notionFetch(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify({ properties }) });
    return { success: true, data: true };
  } catch (error: any) {
    console.error('[Notion] updateMakeupRecord failed:', error);
    return { success: false, error: { message: error.message || '보강 기록 수정에 실패했습니다.' } };
  }
};

export const deleteMakeupRecord = async (id: string): Promise<ApiResult<boolean>> => {
  try {
    await notionFetch(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
    return { success: true, data: true };
  } catch (error: any) {
    console.error('[Notion] deleteMakeupRecord failed:', error);
    return { success: false, error: { message: error.message || '보강 기록 삭제에 실패했습니다.' } };
  }
};

// ========== DM (쪽지) 함수 ==========

export const fetchDMMessages = async (userId: string, partnerId: string): Promise<DirectMessage[]> => {
  const dbIds = getDbIds();
  if (!dbIds.dmMessages) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.dmMessages}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          or: [
            {
              and: [
                { property: NOTION_COLUMNS_DM.SENDER_ID, rich_text: { equals: userId } },
                { property: NOTION_COLUMNS_DM.RECEIVER_ID, rich_text: { equals: partnerId } },
              ],
            },
            {
              and: [
                { property: NOTION_COLUMNS_DM.SENDER_ID, rich_text: { equals: partnerId } },
                { property: NOTION_COLUMNS_DM.RECEIVER_ID, rich_text: { equals: userId } },
              ],
            },
          ],
        },
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
      }),
    });
    return data.results.map((page: any) => ({
      id: page.id,
      senderId: page.properties[NOTION_COLUMNS_DM.SENDER_ID]?.rich_text?.[0]?.plain_text || '',
      receiverId: page.properties[NOTION_COLUMNS_DM.RECEIVER_ID]?.rich_text?.[0]?.plain_text || '',
      content: page.properties[NOTION_COLUMNS_DM.CONTENT]?.rich_text?.[0]?.plain_text || '',
      createdAt: page.created_time,
    }));
  } catch (error) {
    console.error('[Notion] fetchDMMessages failed:', error);
    return [];
  }
};

export const sendDMMessage = async (senderId: string, receiverId: string, content: string): Promise<ApiResult<DirectMessage>> => {
  const dbIds = getDbIds();
  if (!dbIds.dmMessages) return { success: false, error: { message: 'DM 데이터베이스 ID가 설정되지 않았습니다.' } };
  try {
    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: dbIds.dmMessages },
        properties: {
          [NOTION_COLUMNS_DM.SENDER_ID]: { rich_text: [{ text: { content: senderId } }] },
          [NOTION_COLUMNS_DM.RECEIVER_ID]: { rich_text: [{ text: { content: receiverId } }] },
          [NOTION_COLUMNS_DM.CONTENT]: { rich_text: [{ text: { content } }] },
        },
      }),
    });
    return {
      success: true,
      data: { id: data.id, senderId, receiverId, content, createdAt: data.created_time },
    };
  } catch (error: any) {
    console.error('[Notion] sendDMMessage failed:', error);
    return { success: false, error: { message: error.message || '메시지 전송에 실패했습니다.' } };
  }
};

export const fetchRecentDMForUser = async (userId: string): Promise<DirectMessage[]> => {
  const dbIds = getDbIds();
  if (!dbIds.dmMessages) return [];
  try {
    const data = await notionFetch(`/databases/${dbIds.dmMessages}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          or: [
            { property: NOTION_COLUMNS_DM.SENDER_ID, rich_text: { equals: userId } },
            { property: NOTION_COLUMNS_DM.RECEIVER_ID, rich_text: { equals: userId } },
          ],
        },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 100,
      }),
    });
    return data.results.map((page: any) => ({
      id: page.id,
      senderId: page.properties[NOTION_COLUMNS_DM.SENDER_ID]?.rich_text?.[0]?.plain_text || '',
      receiverId: page.properties[NOTION_COLUMNS_DM.RECEIVER_ID]?.rich_text?.[0]?.plain_text || '',
      content: page.properties[NOTION_COLUMNS_DM.CONTENT]?.rich_text?.[0]?.plain_text || '',
      createdAt: page.created_time,
    }));
  } catch (error) {
    console.error('[Notion] fetchRecentDMForUser failed:', error);
    return [];
  }
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
  fetchEnrollments,
  fetchEnrollmentsByStudent,
  updateStudentEnrollments,
  testNotionConnection,
  fetchMakeupRecords,
  createMakeupRecord,
  updateMakeupRecord,
  deleteMakeupRecord,
  fetchDMMessages,
  sendDMMessage,
  fetchRecentDMForUser,
};

export default notionClient;
