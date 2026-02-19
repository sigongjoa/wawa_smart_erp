import { SkillDefinition } from './types';

// 시스템 공통 스킬 정의 (모든 모듈에서 사용 가능)
export const systemSkills: SkillDefinition[] = [
  {
    name: 'system.getNotifications',
    description: '시스템 알림 목록을 조회합니다.',
    module: 'system',
    type: 'read',
    parameters: [
      { name: 'unreadOnly', type: 'boolean', description: '읽지 않은 알림만 조회', required: false },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'system.navigate',
    description: '특정 페이지로 이동합니다.',
    module: 'system',
    type: 'navigate',
    parameters: [
      { name: 'module', type: 'string', description: '이동할 모듈', required: true, enum: ['report', 'timer', 'grader', 'student', 'makeup'] },
      { name: 'page', type: 'string', description: '이동할 페이지', required: false },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'system.getCurrentUser',
    description: '현재 로그인한 사용자 정보를 조회합니다.',
    module: 'system',
    type: 'read',
    parameters: [],
    requiresConfirmation: false,
  },
];
