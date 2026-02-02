import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DayView from './pages/DayView';
import RealtimeView from './pages/RealtimeView';
import StudentView from './pages/StudentView';
import TimeslotView from './pages/TimeslotView';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/day" replace />} />
          <Route path="day" element={<DayView />} />
          <Route path="realtime" element={<RealtimeView />} />
          <Route path="student" element={<StudentView />} />
          <Route path="timeslot" element={<TimeslotView />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
