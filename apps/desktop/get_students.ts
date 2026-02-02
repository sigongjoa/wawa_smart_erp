
import { fetchStudents } from './src/services/notion';

async function main() {
    const students = await fetchStudents();
    console.log('STUDENTS_LIST_START');
    console.log(JSON.stringify(students, null, 2));
    console.log('STUDENTS_LIST_END');
}

main().catch(console.error);
