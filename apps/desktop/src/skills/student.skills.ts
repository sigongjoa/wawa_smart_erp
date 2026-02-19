import { SkillDefinition } from './types';

// 학생 관리 모듈 스킬 정의
export const studentSkills: SkillDefinition[] = [
  {
    name: 'student.list',
    description: '학생 목록을 조회합니다. 학년, 상태로 필터링할 수 있습니다.',
    module: 'student',
    type: 'read',
    parameters: [
      { name: 'grade', type: 'string', description: '학년 필터', required: false, enum: ['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3','검정고시'] },
      { name: 'status', type: 'string', description: '상태 필터', required: false, enum: ['active', 'inactive'] },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'student.getInfo',
    description: '특정 학생의 상세 정보(학년, 과목, 담당 선생님, 학부모 연락처 등)를 조회합니다.',
    module: 'student',
    type: 'read',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'student.create',
    description: '신규 학생을 등록합니다.',
    module: 'student',
    type: 'write',
    parameters: [
      { name: 'name', type: 'string', description: '학생 이름', required: true },
      { name: 'grade', type: 'string', description: '학년', required: true },
      { name: 'subjects', type: 'string', description: '수강 과목 (쉼표 구분)', required: false },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'student.update',
    description: '학생 정보를 수정합니다.',
    module: 'student',
    type: 'write',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
      { name: 'grade', type: 'string', description: '학년', required: false },
      { name: 'subjects', type: 'string', description: '수강 과목 (쉼표 구분)', required: false },
      { name: 'status', type: 'string', description: '상태', required: false, enum: ['active', 'inactive'] },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'student.getEnrollments',
    description: '학생의 수강 정보(요일, 시간, 과목)를 조회합니다.',
    module: 'student',
    type: 'read',
    parameters: [
      { name: 'studentName', type: 'string', description: '학생 이름', required: true },
    ],
    requiresConfirmation: false,
  },
];
