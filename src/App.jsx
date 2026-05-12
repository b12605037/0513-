import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Home from './screens/Home';
import CreateEvent from './screens/CreateEvent';
import SignIn from './screens/SignIn';
import TimeGrid from './screens/TimeGrid';
import Results from './screens/Results';
import Confirm from './screens/Confirm';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/grid" element={<TimeGrid />} />
          <Route path="/results" element={<Results />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
