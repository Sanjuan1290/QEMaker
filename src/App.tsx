import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './components/Toast';

import LoginPage      from './pages/admin/LoginPage';
import DashboardPage  from './pages/admin/DashboardPage';
import ClassDetailPage from './pages/admin/ClassDetailPage';
import CreateQuizPage from './pages/admin/CreateQuizPage';
import QuizDetailPage from './pages/admin/QuizDetailPage';
import TakeQuizPage   from './pages/student/TakeQuizPage';
import QuizResultPage from './pages/student/QuizResultPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuthStore();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" style={{ width:40, height:40, borderTopColor:'#f59e0b' }} />
      <span style={{ fontSize:'0.875rem', color:'#7a6e5c' }}>Loading…</span>
    </div>
  );
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { initAuth } = useAuthStore();
  useEffect(() => { const unsub = initAuth(); return unsub; }, [initAuth]);

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/admin/login"                   element={<LoginPage />} />
          <Route path="/admin"                         element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin/class/:classId"          element={<ProtectedRoute><ClassDetailPage /></ProtectedRoute>} />
          <Route path="/admin/class/:classId/quiz/create" element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
          <Route path="/admin/quiz/:id"                element={<ProtectedRoute><QuizDetailPage /></ProtectedRoute>} />
          <Route path="/quiz/:id"                      element={<TakeQuizPage />} />
          <Route path="/quiz/:id/result"               element={<QuizResultPage />} />
          <Route path="/"  element={<Navigate to="/admin" replace />} />
          <Route path="*"  element={<Navigate to="/admin" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}