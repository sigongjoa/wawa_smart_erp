import { SkillDefinition } from './types';

// DM(쪽지) 모듈 스킬 정의
export const dmSkills: SkillDefinition[] = [
  {
    name: 'dm.getUnread',
    description: '읽지 않은 메시지 수를 조회합니다.',
    module: 'dm',
    type: 'read',
    parameters: [],
    requiresConfirmation: false,
  },
  {
    name: 'dm.getMessages',
    description: '특정 선생님과의 대화 내역을 조회합니다.',
    module: 'dm',
    type: 'read',
    parameters: [
      { name: 'teacherName', type: 'string', description: '대화 상대 선생님 이름', required: true },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'dm.send',
    description: '선생님에게 메시지를 전송합니다.',
    module: 'dm',
    type: 'write',
    parameters: [
      { name: 'teacherName', type: 'string', description: '수신 선생님 이름', required: true },
      { name: 'content', type: 'string', description: '메시지 내용', required: true },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'dm.getContacts',
    description: '연락 가능한 선생님 목록을 조회합니다.',
    module: 'dm',
    type: 'read',
    parameters: [],
    requiresConfirmation: false,
  },
];
