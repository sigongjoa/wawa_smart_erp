import { SkillDefinition } from './types';

export const reportSkills: SkillDefinition[] = [
  {
    name: 'report.getStatus',
    description: '이번 달 리포트 현황 (전체/완료/대기/전송)을 조회합니다.',
    module: 'report',
    type: 'read',
    parameters: [
      {
        name: 'yearMonth',
        type: 'string',
        description: '조회할 연월 (YYYY-MM 형식)',
        required: false,
      },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'report.getScores',
    description: '특정 학생의 성적을 조회합니다.',
    module: 'report',
    type: 'read',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '성적을 조회할 학생의 이름',
        required: true,
      },
      {
        name: 'yearMonth',
        type: 'string',
        description: '조회할 연월 (YYYY-MM 형식)',
        required: false,
      },
    ],
    requiresConfirmation: false,
  },
  {
    name: 'report.inputScore',
    description: '학생의 점수 및 선생님 코멘트를 입력합니다.',
    module: 'report',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '점수를 입력할 학생의 이름',
        required: true,
      },
      {
        name: 'subject',
        type: 'string',
        description: '점수를 입력할 과목명',
        required: true,
      },
      {
        name: 'score',
        type: 'number',
        description: '입력할 점수 (0-100 사이)',
        required: true,
      },
      {
        name: 'comment',
        type: 'string',
        description: '선생님 코멘트',
        required: false,
      },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'report.generateEvaluation',
    description: '학생에 대한 AI 종합평가를 생성합니다.',
    module: 'report',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '종합평가를 생성할 학생의 이름',
        required: true,
      },
    ],
    requiresConfirmation: true, // As per instruction for write type
  },
  {
    name: 'report.setTotalComment',
    description: '학생의 종합평가 코멘트를 저장합니다.',
    module: 'report',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '종합평가 코멘트를 저장할 학생의 이름',
        required: true,
      },
      {
        name: 'comment',
        type: 'string',
        description: '저장할 종합평가 내용',
        required: true,
      },
    ],
    requiresConfirmation: true,
  },
  {
    name: 'report.preview',
    description: '리포트 미리보기 페이지로 이동합니다.',
    module: 'report',
    type: 'navigate',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '미리보기를 볼 학생의 이름 (선택 사항)',
        required: false,
      },
    ],
    requiresConfirmation: false, // Navigate type is typically false
  },
  {
    name: 'report.exportJPG',
    description: '생성된 리포트를 JPG 이미지 파일로 내보냅니다.',
    module: 'report',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: 'JPG로 내보낼 리포트의 학생 이름',
        required: true,
      },
    ],
    requiresConfirmation: true, // As per instruction for write type
  },
  {
    name: 'report.sendAlimtalk',
    description: '생성된 리포트를 학부모에게 알림톡으로 전송합니다.',
    module: 'report',
    type: 'write',
    parameters: [
      {
        name: 'studentName',
        type: 'string',
        description: '알림톡을 전송할 학생의 이름',
        required: true,
      },
    ],
    requiresConfirmation: true,
  },
];
