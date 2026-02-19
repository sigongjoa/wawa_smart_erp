import { SkillDefinition } from './types';

// 자동채점 모듈 스킬 정의
export const graderSkills: SkillDefinition[] = [
  {
    name: 'grader.gradeOMR',
    description: 'OMR 카드를 채점합니다. 학생, 과목, 시험 파일이 필요합니다.',
    module: 'grader',
    type: 'write',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
      { name: 'subject', type: 'string', description: '과목명', required: true },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'grader.getHistory',
    description: '채점 이력을 조회합니다.',
    module: 'grader',
    type: 'read',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름 (전체 조회 시 생략)', required: false },
      { name: 'subject', type: 'string', description: '과목 필터', required: false },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'grader.getStats',
    description: '채점 통계를 조회합니다 (성적 분포, 평균 등).',
    module: 'grader',
    type: 'read',
    parameters: [
      { name: 'subject', type: 'string', description: '과목 필터', required: false },
    ],
    requiresConfirmation: false,
  },
];
