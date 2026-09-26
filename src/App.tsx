import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './store';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Lesson from './pages/Lesson';
import LessonReview from './pages/LessonReview';
import LessonComplete from './pages/LessonComplete';
import Vocabulary from './pages/Vocabulary';
import Profile from './pages/Profile';

function App() {
  const user = getUser();
  console.log('[App] User from store:', user);
  console.log('[App] Current path:', window.location.pathname);
  
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Routes>
          <Route 
            path="/onboarding" 
            element={user ? <Navigate to="/dashboard" /> : <Onboarding />} 
          />
          <Route 
            path="/dashboard" 
            element={user ? <Dashboard /> : <Navigate to="/onboarding" />} 
          />
          <Route 
            path="/lesson" 
            element={user ? <Lesson /> : <Navigate to="/onboarding" />} 
          />
          <Route 
            path="/review" 
            element={user ? <LessonReview /> : <Navigate to="/onboarding" />} 
          />
          <Route 
            path="/complete" 
            element={user ? <LessonComplete /> : <Navigate to="/onboarding" />} 
          />
          <Route 
            path="/vocabulary" 
            element={user ? <Vocabulary /> : <Navigate to="/onboarding" />} 
          />
          <Route 
            path="/profile" 
            element={user ? <Profile /> : <Navigate to="/onboarding" />} 
          />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/onboarding"} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
