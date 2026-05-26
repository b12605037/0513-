import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import CreateEvent from './screens/CreateEvent';
import TimeGrid from './screens/TimeGrid';
import Results from './screens/Results';
import Confirm from './screens/Confirm';
import Join from './screens/Join';
import ViewResults from './screens/ViewResults';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateEvent />} />
      <Route path="/grid" element={<TimeGrid />} />
      <Route path="/results" element={<Results />} />
      <Route path="/confirm" element={<Confirm />} />
      <Route path="/join/:id" element={<Join />} />
      <Route path="/view/:id" element={<ViewResults />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
