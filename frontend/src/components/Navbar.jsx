import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, FileUp, LogOut, Moon, Sun } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useAppSettings } from '../context/AppSettingsContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useAppSettings();
  const isLoggedIn = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password';

  if (isAuthPage) return null;

  return (
    <div className="sticky top-3 sm:top-4 z-50 px-3 sm:px-4 pointer-events-none">
      <nav className="glass-panel max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pointer-events-auto transition-all duration-300">
        <div className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
            <div className="bg-gradient-to-br from-brand-400 to-brand-600 p-2 rounded-xl shadow-glow group-hover:scale-105 transition-transform duration-300">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800 group-hover:text-brand-600 transition-colors duration-300">
              Medi<span className="text-gradient">Vault</span>
            </span>
          </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-700 hover:border-brand-300 hover:text-brand-700 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

          {isLoggedIn && (
            <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap justify-end">
              <Link 
                to="/dashboard" 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${location.pathname === '/dashboard' ? 'text-brand-700 bg-brand-50 shadow-sm' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'}`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:block">Dashboard</span>
              </Link>
              
              <Link 
                to="/upload" 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${location.pathname === '/upload' ? 'text-brand-700 bg-brand-50 shadow-sm' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'}`}
              >
                <FileUp className="h-4 w-4" />
                <span className="hidden sm:block">Upload</span>
              </Link>

              <div className="h-6 w-px bg-slate-200/60 mx-2 hidden sm:block"></div>

              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50/80 transition-all duration-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          )}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
