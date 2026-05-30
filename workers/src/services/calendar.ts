/**
 * Calendar 공통 서비스 — 강사/학생 두 핸들러가 공유하는 DB 액세스.
 *
 * 가시성 규칙:
 *  - 학생: 학원 공통(owner_type=academy) + 본인 일정(owner_id = student_id)
 *  - 강사: academy_id 일치한 학원 공통 + student_teachers 매핑된 담당 학생 일정
 *
 * 멱등성: 모든 변경은 deleted_at IS NULL 가드.
 */
import { executeQuery, executeFirst } from '@/utils/db';

export type EventCategory =
  | 'performance'
  | 'school_exam'
  | 'external_exam'
  | 'academy'
  | 'personal';

export type OwnerType = 'academy' | 'student';

export const CATEGORIES: EventCategory[] = [
  'performance',
  'school_exam',
  'external_exam',
  'academy',
  'personal',
];

export interface EventRow {
  id: string;
  academy_id: string;
  owner_type: OwnerType;
  owner_id: string;
  category: EventCategory;
  title: string;
  memo: string | null;
  link: string | null;
  start_date: string;
  end_date: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface EventDto {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  category: EventCategory;
  title: string;
  memo: string | null;
  link: string | null;
  start_date: string;
  end_date: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  // 학생 응답에만 채워짐
  read_at?: number | null;
  completed_at?: number | null;
}

export function rowToDto(r: EventRow): EventDto {
  return {
    id: r.id,
    owner_type: r.owner_type,
    owner_id: r.owner_id,
    category: r.category,
    title: r.title,
    memo: r.memo,
    link: r.link,
    start_date: r.start_date,
    end_date: r.end_date,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** YYYY-MM-DD 형식 검증 */
export function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 학생용 이벤트 목록 — 본인 일정 + 학원 공통.
 * ack 정보(read_at, completed_at)를 LEFT JOIN으로 합쳐 1쿼리로 N+1 회피.
 */
export async function loadEventsForStudent(
  db: D1Database,
  academyId: string,
  studentId: string,
  from: string,
  to: string,
): Promise<EventDto[]> {
  const rows = await executeQuery<EventRow & { read_at: number | null; completed_at: number | null }>(
    db,
    `SELECT e.*, a.read_at AS read_at, a.completed_at AS completed_at
     FROM calendar_events e
     LEFT JOIN calendar_event_acks a
       ON a.event_id = e.id AND a.student_id = ?
     WHERE e.academy_id = ?
       AND e.deleted_at IS NULL
       AND e.start_date <= ?
       AND COALESCE(e.end_date, e.start_date) >= ?
       AND (
         (e.owner_type = 'academy')
         OR (e.owner_type = 'student' AND e.owner_id = ?)
       )
     ORDER BY e.start_date ASC, e.created_at ASC`,
    [studentId, academyId, to, from, studentId],
  );
  return rows.map((r) => ({
    ...rowToDto(r),
    read_at: r.read_at,
    completed_at: r.completed_at,
  }));
}

/**
 * 강사용 이벤트 목록 — 학원 공통 + 학원 전체 학생 일정.
 *
 * 참고: 원래 student_teachers 매핑으로 담당 학생만 필터하려 했으나,
 * student_teachers.student_id ('student-XXX')와 PIN 인증으로 생성된 학생 ID
 * ('gst-sb-XXX')의 prefix 체계가 달라 매핑이 실제로 동작하지 않음.
 * 운영자 admin 권한도 학원 전체 학생을 봐야 함. → academy_id 격리만 적용.
 */
export async function loadEventsForTeacher(
  db: D1Database,
  academyId: string,
  _teacherId: string,
  from: string,
  to: string,
): Promise<EventDto[]> {
  const rows = await executeQuery<EventRow>(
    db,
    `SELECT e.*
     FROM calendar_events e
     WHERE e.academy_id = ?
       AND e.deleted_at IS NULL
       AND e.start_date <= ?
       AND COALESCE(e.end_date, e.start_date) >= ?
     ORDER BY e.start_date ASC, e.created_at ASC`,
    [academyId, to, from],
  );
  return rows.map(rowToDto);
}

/**
 * 강사 위젯용 — 기간 내 학원 공통 이벤트 각각의 미확인 학생 수.
 * 미확인 = 담당 학생 중 ack가 없거나 completed_at IS NULL.
 *
 * N+1 회피: 단일 쿼리로 GROUP BY.
 * 분모(담당 학생 수)는 student_teachers에서 별도 1쿼리로 가져온다.
 */
export interface WidgetEvent {
  id: string;
  category: EventCategory;
  title: string;
  start_date: string;
  end_date: string | null;
  total_students: number;
  unconfirmed_count: number;
}

export async function loadTeacherWidget(
  db: D1Database,
  academyId: string,
  _teacherId: string,
  from: string,
  to: string,
): Promise<WidgetEvent[]> {
  // 학원 전체 활성 학생 수 (students 기준)
  const totalRow = await executeFirst<{ cnt: number }>(
    db,
    `SELECT COUNT(*) AS cnt FROM students WHERE academy_id = ?`,
    [academyId],
  );
  const totalStudents = totalRow?.cnt ?? 0;

  const rows = await executeQuery<{
    id: string;
    category: EventCategory;
    title: string;
    start_date: string;
    end_date: string | null;
    completed_count: number;
  }>(
    db,
    `SELECT e.id, e.category, e.title, e.start_date, e.end_date,
            (
              SELECT COUNT(*) FROM calendar_event_acks a
              WHERE a.event_id = e.id
                AND a.completed_at IS NOT NULL
            ) AS completed_count
     FROM calendar_events e
     WHERE e.academy_id = ?
       AND e.deleted_at IS NULL
       AND e.owner_type = 'academy'
       AND e.start_date <= ?
       AND COALESCE(e.end_date, e.start_date) >= ?
     ORDER BY e.start_date ASC`,
    [academyId, to, from],
  );

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    start_date: r.start_date,
    end_date: r.end_date,
    total_students: totalStudents,
    unconfirmed_count: Math.max(0, totalStudents - r.completed_count),
  }));
}
