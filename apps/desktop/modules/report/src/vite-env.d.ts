/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_JS_KEY: string;
  readonly VITE_NOTION_API_KEY: string;
  readonly VITE_NOTION_TEACHERS_DB: string;
  readonly VITE_NOTION_STUDENTS_DB: string;
  readonly VITE_NOTION_SCORES_DB: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
