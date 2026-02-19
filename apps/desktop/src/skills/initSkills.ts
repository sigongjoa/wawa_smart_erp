import { skillRegistry } from './registry';
import { reportSkills } from './report.skills';
import { studentSkills } from './student.skills';
import { timerSkills } from './timer.skills';
import { makeupSkills } from './makeup.skills';

export function initializeSkills() {
  console.log('Initializing skills...');
  skillRegistry.registerAll(reportSkills);
  skillRegistry.registerAll(studentSkills);
  skillRegistry.registerAll(timerSkills);
  skillRegistry.registerAll(makeupSkills);
  console.log('Skills initialized.');
  console.log('Registered skills:', skillRegistry.getAllSkills().map(s => s.id));
}
