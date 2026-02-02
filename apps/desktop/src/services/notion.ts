import { NotionClient } from '@wawa/notion-client';

const notionClient = new NotionClient({
  apiKey: import.meta.env.VITE_NOTION_API_KEY,
  databases: {
    students: import.meta.env.VITE_NOTION_DB_STUDENTS,
    schedules: import.meta.env.VITE_NOTION_DB_SCHEDULES,
    grades: import.meta.env.VITE_NOTION_DB_GRADES,
    reports: import.meta.env.VITE_NOTION_DB_REPORTS,
  },
});

export default notionClient;
