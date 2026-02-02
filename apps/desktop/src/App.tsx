import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';

// Timer 모듈 페이지
import TimerDayView from './modules/timer/DayView';
import TimerRealtimeView from './modules/timer/RealtimeView';
import TimerStudentView from './modules/timer/StudentView';
import TimerTimeslotView from './modules/timer/TimeslotView';
import TimerSettings from './modules/timer/Settings';

// Report 모듈 페이지
import ReportDashboard from './modules/report/Dashboard';
import ReportStudents from './modules/report/Students';
import ReportExams from './modules/report/Exams';
import ReportInput from './modules/report/Input';
import ReportPreview from './modules/report/Preview';
import ReportSend from './modules/report/Send';
import ReportSettings from './modules/report/Settings';

// Grader 모듈 페이지
import GraderSingle from './modules/grader/Single';
import GraderBatch from './modules/grader/Batch';
import GraderHistory from './modules/grader/History';
import GraderStats from './modules/grader/Stats';
import GraderSettings from './modules/grader/Settings';

// Schedule 모듈 페이지
import ScheduleToday from './modules/schedule/Today';
import SchedulePending from './modules/schedule/Pending';
import ScheduleUpcoming from './modules/schedule/Upcoming';
import ScheduleHistory from './modules/schedule/History';
import ScheduleSettings from './modules/schedule/Settings';

import ToastContainer from './components/common/ToastContainer';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          {/* 기본 리다이렉트 */}
          <Route index element={<Navigate to="/timer/day" replace />} />

          {/* Timer 모듈 */}
          <Route path="timer">
            <Route index element={<Navigate to="/timer/day" replace />} />
            <Route path="day" element={<TimerDayView />} />
            <Route path="realtime" element={<TimerRealtimeView />} />
            <Route path="student" element={<TimerStudentView />} />
            <Route path="timeslot" element={<TimerTimeslotView />} />
            <Route path="settings" element={<TimerSettings />} />
          </Route>

          {/* Report 모듈 */}
          <Route path="report">
            <Route index element={<ReportDashboard />} />
            <Route path="students" element={<ReportStudents />} />
            <Route path="exams" element={<ReportExams />} />
            <Route path="input" element={<ReportInput />} />
            <Route path="preview" element={<ReportPreview />} />
            <Route path="send" element={<ReportSend />} />
            <Route path="settings" element={<ReportSettings />} />
          </Route>

          {/* Grader 모듈 */}
          <Route path="grader">
            <Route index element={<GraderSingle />} />
            <Route path="batch" element={<GraderBatch />} />
            <Route path="history" element={<GraderHistory />} />
            <Route path="stats" element={<GraderStats />} />
            <Route path="settings" element={<GraderSettings />} />
          </Route>

          {/* Schedule 모듈 */}
          <Route path="schedule">
            <Route index element={<ScheduleToday />} />
            <Route path="pending" element={<SchedulePending />} />
            <Route path="upcoming" element={<ScheduleUpcoming />} />
            <Route path="history" element={<ScheduleHistory />} />
            <Route path="settings" element={<ScheduleSettings />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </HashRouter>
  );
}

export default App;
