// Skills System - 모든 모듈 스킬 등록
import { skillRegistry } from './registry';
import { reportSkills } from './report.skills';
import { timerSkills } from './timer.skills';
import { studentSkills } from './student.skills';
import { makeupSkills } from './makeup.skills';
import { dmSkills } from './dm.skills';
import { graderSkills } from './grader.skills';
import { systemSkills } from './system.skills';

// 모든 스킬을 레지스트리에 등록
export function initializeSkills(): void {
  skillRegistry.registerAll(reportSkills);
  skillRegistry.registerAll(timerSkills);
  skillRegistry.registerAll(studentSkills);
  skillRegistry.registerAll(makeupSkills);
  skillRegistry.registerAll(dmSkills);
  skillRegistry.registerAll(graderSkills);
  skillRegistry.registerAll(systemSkills);
}

// Re-exports
export { skillRegistry } from './registry';
export type { SkillDefinition, SkillResult, SkillExecuteContext, ChatMessage, ChatSession, LLMProvider, LLMChatRequest, LLMChatResponse, ToolDefinition } from './types';
