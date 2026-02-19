import { SkillDefinition } from './types';

export const timerSkills: SkillDefinition[] = [
  {
    name: 'timer.getActiveSessions',
    module: 'timer',
    description: '현재 출석중인 학생 실시간 세션 목록 조회',
    type: 'read',
    parameters: [],
    requiresConfirmation: false,
  },
  {
    name: 'timer.checkIn',
    module: 'timer',
    description: '학생 출석 체크인',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '학생 이름',
        required: true,
      },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'timer.checkOut',
    module: 'timer',
    description: '학생 체크아웃(수업 종료)',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '학생 이름',
        required: true,
      },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'timer.getTodaySchedule',
    module: 'timer',
    description: '오늘 시간표 전체 조회',
    type: 'read',
    parameters: [],
    requiresConfirmation: false,
  },
  {
    name: 'timer.getStudentsByDay',
    module: 'timer',
    description: '특정 요일의 학생 목록 조회',
    type: 'read',
    parameters: [
      {
        name: 'day',
        type: 'string',
        description: '요일 (월/화/수/목/금/토/일)',
        required: true,
        enum: ['월', '화', '수', '목', '금', '토', '일'],
      },
    ],
    requiresConfirmation: false,
  },
];
