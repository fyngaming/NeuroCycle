import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Sparkles } from 'lucide-react';

export type ViewMode = 'desktop' | 'mobile';

interface ViewModeSwitcherProps {
  currentMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
  className?: string;
}

export const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({
  currentMode,
  onToggle,
  className = ''
}) => {
  return (
    <div
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-[250] flex items-center bg-white/95 backdrop-blur-xl border border-stone-200/90 shadow-xl shadow-stone-900/10 rounded-full p-1 text-xs select-none ${className}`}
      title="Ubah Mode Tampilan Aplikasi"
    >
      <div className="flex items-center gap-1">
        {/* Tombol Desktop Mode */}
        <button
          type="button"
          onClick={() => onToggle('desktop')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black text-xs transition-all cursor-pointer ${
            currentMode === 'desktop'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
          }`}
          title="Mode Desktop (Widescreen Portal)"
        >
          <Monitor size={14} className={currentMode === 'desktop' ? 'text-white' : 'text-stone-500'} />
          <span className="hidden sm:inline">Desktop</span>
        </button>

        {/* Tombol Mobile Mode */}
        <button
          type="button"
          onClick={() => onToggle('mobile')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black text-xs transition-all cursor-pointer ${
            currentMode === 'mobile'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
          }`}
          title="Mode Mobile (Smartphone View)"
        >
          <Smartphone size={14} className={currentMode === 'mobile' ? 'text-white' : 'text-stone-500'} />
          <span className="hidden sm:inline">Mobile</span>
        </button>
      </div>
    </div>
  );
};

export default ViewModeSwitcher;

