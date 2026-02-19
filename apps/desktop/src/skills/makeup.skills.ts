import { SkillDefinition } from './types';

// 보강관리 모듈 스킬 정의
export const makeupSkills: SkillDefinition[] = [
  {
    name: 'makeup.getStatus',
    description: '보강 현황을 조회합니다 (대기/진행/완료 건수).',
    module: 'makeup',
    type: 'read',
    parameters: [
      { name: 'status', type: 'string', description: '필터할 보강 상태', required: false, enum: ['시작 전', '진행 중', '완료'] },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'makeup.addAbsence',
    description: '학생의 결석 기록을 추가합니다.',
    module: 'makeup',
    type: 'write',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
      { name: 'subject', type: 'string', description: '과목명', required: true },
      { name: 'absentDate', type: 'date', description: '결석일', required: true },
      { name: 'reason', type: 'string', description: '결석 사유', required: false },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'makeup.schedule',
    description: '보강 일정을 잡습니다.',
    module: 'makeup',
    type: 'write',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
      { name: 'subject', type: 'string', description: '과목명', required: true },
      { name: 'makeupDate', type: 'date', description: '보강 예정일', required: true },
      { name: 'makeupTime', type: 'string', description: '보강 시간 (예: 14:00~15:00)', required: false },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'makeup.complete',
    description: '보강을 완료 처리합니다.',
    module: 'makeup',
    type: 'write',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
      { name: 'subject', type: 'string', description: '과목명', required: true },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'makeup.getCalendar',
    description: '보강 일정 캘린더를 조회합니다.',
    module: 'makeup',
    type: 'read',
    parameters: [
      { name: 'month', type: 'string', description: '조회할 월 (YYYY-MM)', required: false },
    ],
    requiresConfirmation: false,
  },
];
