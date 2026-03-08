import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import UploadRecord from './pages/UploadRecord';
import Records from './pages/Records';
import IndexPage from './pages/index';
import { AppSettingsProvider, useAppSettings } from './context/AppSettingsContext';
import { applyPageTranslation } from './services/pageTranslator';

// Custom PrivateRoute component can be added to protect routes
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  // Temporary for hackathon: return children automatically if no auth context needed.
  // Real implementation: if (!token) return <Navigate to="/login" />
  return token ? children : <Navigate to="/login" />;
};

const AppShell = () => {
  const location = useLocation();
  const { language } = useAppSettings();
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password';

  useEffect(() => {
    let cancelled = false;
    const runTranslation = () => {
      if (cancelled) {
        return;
      }

      applyPageTranslation(language).catch((error) => {
        console.error('Page translation failed:', error);
      });
    };

    runTranslation();
    const timer = window.setTimeout(runTranslation, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [language, location.pathname]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col font-sans text-slate-900 relative dark:text-slate-100">
      <div className="mesh-bg"></div>
      <Navbar />
      
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute><UploadRecord /></PrivateRoute>} />
          <Route path="/records" element={<PrivateRoute><Records /></PrivateRoute>} />
          <Route path="/" element={<IndexPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      {!isAuthPage && <ChatWidget />}
    </div>
  );
};

function App() {
  return (
    <AppSettingsProvider>
      <Router>
        <AppShell />
      </Router>
    </AppSettingsProvider>
  );
}

export default App;
