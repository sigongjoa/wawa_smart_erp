import { Client } from '@notionhq/client';

export interface NotionConfig {
  apiKey: string;
  databases: {
    students: string;    // 학생 DB ID
    schedules: string;   // 시간표 DB ID
    grades: string;      // 성적 DB ID
    reports: string;     // 보고서 DB ID
  };
}

export class NotionClient {
  private client: Client;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.client = new Client({ auth: config.apiKey });
  }

  // 학생 관련 메서드
  async getStudents() {
    const response = await this.client.databases.query({
      database_id: this.config.databases.students,
    });
    return response.results;
  }

  async getStudentById(id: string) {
    return await this.client.pages.retrieve({ page_id: id });
  }

  // 시간표 관련 메서드
  async getSchedules(filter?: { date?: string; studentId?: string }) {
    const response = await this.client.databases.query({
      database_id: this.config.databases.schedules,
      filter: filter ? this.buildFilter(filter) : undefined,
    });
    return response.results;
  }

  // 성적 관련 메서드
  async getGrades(studentId?: string) {
    const response = await this.client.databases.query({
      database_id: this.config.databases.grades,
      filter: studentId
        ? { property: 'student_id', rich_text: { equals: studentId } }
        : undefined,
    });
    return response.results;
  }

  async saveGrade(data: {
    studentId: string;
    subject: string;
    score: number;
    date: string;
    details?: any;
  }) {
    return await this.client.pages.create({
      parent: { database_id: this.config.databases.grades },
      properties: {
        student_id: { rich_text: [{ text: { content: data.studentId } }] },
        subject: { title: [{ text: { content: data.subject } }] },
        score: { number: data.score },
        date: { date: { start: data.date } },
      },
    });
  }

  // 보고서 관련 메서드
  async getReports(filter?: { month?: string; studentId?: string }) {
    const response = await this.client.databases.query({
      database_id: this.config.databases.reports,
    });
    return response.results;
  }

  async createReport(data: {
    studentId: string;
    month: string;
    content: string;
  }) {
    return await this.client.pages.create({
      parent: { database_id: this.config.databases.reports },
      properties: {
        student_id: { rich_text: [{ text: { content: data.studentId } }] },
        month: { title: [{ text: { content: data.month } }] },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: data.content } }],
          },
        },
      ],
    });
  }

  private buildFilter(filter: Record<string, any>): any {
    // 필터 조건 빌드 로직
    const conditions: any[] = [];

    if (filter.date) {
      conditions.push({
        property: 'date',
        date: { equals: filter.date },
      });
    }

    if (filter.studentId) {
      conditions.push({
        property: 'student_id',
        rich_text: { equals: filter.studentId },
      });
    }

    return conditions.length > 1
      ? { and: conditions }
      : conditions[0];
  }
}

export default NotionClient;
