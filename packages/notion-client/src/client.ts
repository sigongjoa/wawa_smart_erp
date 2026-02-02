import fs from 'fs';
import path from 'path';
import { NotionClient, NotionConfig } from './index';

const configPath = path.resolve(process.cwd(), 'notion_config.json');
const config: NotionConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const notionClient = new NotionClient(config);
