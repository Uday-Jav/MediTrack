import React, { useEffect, useRef, useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const LanguageSwitcher = () => {
  const { language, setLanguage, supportedLanguages } = useAppSettings();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const current = supportedLanguages.find((entry) => entry.code === language) || supportedLanguages[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
      >
        <Languages className="h-4 w-4" />
        Translate Page
        <span className="hidden md:inline text-slate-500">({current.label})</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg p-1 z-20 dark:bg-slate-800 dark:border-slate-700">
          {supportedLanguages.map((entry) => (
            <button
              key={entry.code}
              type="button"
              onClick={() => {
                setLanguage(entry.code);
                setIsOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                language === entry.code
                  ? 'bg-brand-50 text-brand-700 dark:bg-slate-700 dark:text-brand-200'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;

