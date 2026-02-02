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

  async createStudent(data: { name: string; grade: string; contact: string; parentContact: string }) {
    return await this.client.pages.create({
      parent: { database_id: this.config.databases.students },
      properties: {
        '이름': { title: [{ text: { content: data.name } }] },
        '학년': { rich_text: [{ text: { content: data.grade } }] },
        '연락처': { phone_number: data.contact },
        '학부모 연락처': { phone_number: data.parentContact },
      },
    });
  }

  async updateStudent(id: string, data: { name?: string; grade?: string; contact?: string; parentContact?: string }) {
    const properties: any = {};
    if (data.name) properties['이름'] = { title: [{ text: { content: data.name } }] };
    if (data.grade) properties['학년'] = { rich_text: [{ text: { content: data.grade } }] };
    if (data.contact) properties['연락처'] = { phone_number: data.contact };
    if (data.parentContact) properties['학부모 연락처'] = { phone_number: data.parentContact };

    return await this.client.pages.update({
      page_id: id,
      properties,
    });
  }

  async deleteStudent(id: string) {
    return await this.client.pages.update({
      page_id: id,
      archived: true,
    });
  }

  // 시간표 관련 메서드
  async getSchedules(filter?: { date?: string; studentId?: string }) {
    const response = await this.client.databases.query({
      database_id: this.config.databases.schedules,
      filter: filter ? this.buildFilter(filter) : undefined,
    });
    return response.results;
  }

  async createSchedule(data: { studentId: string; day: string; startTime: string; endTime: string; subject: string }) {
    return await this.client.pages.create({
      parent: { database_id: this.config.databases.schedules },
      properties: {
        '학생ID': { rich_text: [{ text: { content: data.studentId } }] },
        '요일': { select: { name: data.day } },
        '시작시간': { rich_text: [{ text: { content: data.startTime } }] },
        '종료시간': { rich_text: [{ text: { content: data.endTime } }] },
        '과목': { title: [{ text: { content: data.subject } }] },
      },
    });
  }

  async updateSchedule(id: string, data: { day?: string; startTime?: string; endTime?: string; subject?: string }) {
    const properties: any = {};
    if (data.day) properties['요일'] = { select: { name: data.day } };
    if (data.startTime) properties['시작시간'] = { rich_text: [{ text: { content: data.startTime } }] };
    if (data.endTime) properties['종료시간'] = { rich_text: [{ text: { content: data.endTime } }] };
    if (data.subject) properties['과목'] = { title: [{ text: { content: data.subject } }] };

    return await this.client.pages.update({
      page_id: id,
      properties,
    });
  }

  async deleteSchedule(id: string) {
    return await this.client.pages.update({
      page_id: id,
      archived: true,
    });
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

  async updateGrade(id: string, data: { score?: number; date?: string; }) {
    const properties: any = {};
    if (data.score) properties['score'] = { number: data.score };
    if (data.date) properties['date'] = { date: { start: data.date } };

    return await this.client.pages.update({
      page_id: id,
      properties,
    });
  }

  async deleteGrade(id: string) {
    return await this.client.pages.update({
      page_id: id,
      archived: true,
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

  async updateReport(id: string, data: { content: string }) {
    return await this.client.blocks.children.append({
        block_id: id,
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

  async deleteReport(id: string) {
    return await this.client.pages.update({
      page_id: id,
      archived: true,
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
