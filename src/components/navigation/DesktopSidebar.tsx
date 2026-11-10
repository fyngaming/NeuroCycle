import React from 'react';
import { motion } from 'framer-motion';
import {
  Leaf,
  MapPin,
  Camera,
  Award,
  User,
  Trophy,
  Gift,
  BookOpen,
  Info,
  Bell,
  LogOut,
  QrCode,
  Flame,
  Monitor,
  Smartphone,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import type { UserData } from '../../types';
import type { ViewMode } from './ViewModeSwitcher';

interface DesktopSidebarProps {
  activeState: string;
  onNavigate: (state: any) => void;
  onScan: () => void;
  onShowQR: () => void;
  onShowNotifications: () => void;
  onLogout: () => void;
  userData: UserData;
  unreadCount?: number;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeState,
  onNavigate,
  onScan,
  onShowQR,
  onShowNotifications,
  onLogout,
  userData,
  unreadCount = 0,
  viewMode,
  onToggleViewMode,
}) => {
  const navItems = [
    { id: 'main', label: 'Beranda', icon: Leaf, badge: undefined },
    { id: 'map', label: 'Lokasi & Bank Sampah', icon: MapPin, badge: undefined },
    { id: 'daily_missions', label: 'Misi Harian', icon: Award, badge: 'Misi' },
    { id: 'leaderboard', label: 'Papan Peringkat', icon: Trophy, badge: 'Top 3' },
    { id: 'user_dashboard', label: 'Profil Saya', icon: User, badge: undefined },
    { id: 'redemption', label: 'Tukar Poin', icon: Gift, badge: undefined },
    { id: 'education_list', label: 'Pusat Edukasi', icon: BookOpen, badge: undefined },
    { id: 'about', label: 'Tentang Kami', icon: Info, badge: undefined },
  ];

  return (
    <aside className="w-64 xl:w-72 h-screen sticky top-0 shrink-0 bg-white/95 backdrop-blur-xl border-r border-stone-200/90 shadow-sm flex flex-col z-[100] select-none">
      {/* ── 1. Top Brand Logo & Title ── */}
      <div className="p-5 border-b border-stone-100 shrink-0">
        <div
          onClick={() => onNavigate('main')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center p-2 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform shrink-0">
            <img
              src="/logo_NeuroCycle.png"
              alt="NeuroCycle"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-display font-black text-stone-900 tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                NeuroCycle
              </h1>
              <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                Portal
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-medium mt-1 truncate">
              Cerdas Memilah & Berkelanjutan
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Primary Action: Pindai Sampah Button ── */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onScan}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
        >
          <Camera size={18} className="animate-pulse" />
          <span>Pindai Sampah AI</span>
        </motion.button>
      </div>

      {/* ── 3. Scrollable Navigation Menu (Scroll Down Enabled) ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-stone-200 hover:scrollbar-thumb-stone-300">
        <p className="px-3 pt-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-stone-400">
          Menu Navigasi
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeState === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer group ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-black shadow-xs border border-emerald-200/80'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-emerald-600'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-emerald-200/80 text-emerald-900'
                    : 'bg-stone-100 text-stone-500 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 4. Bottom Pinned Section: Streak, User Card & Utilities ── */}
      <div className="p-3 border-t border-stone-200/80 bg-stone-50/70 space-y-2.5 shrink-0">
        {/* Streak Pill */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-500 animate-pulse" />
            <span className="text-xs font-black text-orange-950">
              {userData.streak || 1} Hari
            </span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
            NeuroStreak
          </span>
        </div>

        {/* User Mini Profile */}
        <div
          onClick={() => onNavigate('user_dashboard')}
          className="flex items-center gap-3 p-2 rounded-2xl bg-white hover:bg-stone-100/90 transition-all cursor-pointer border border-stone-200/80 shadow-xs"
          title="Buka Dashboard Profil"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
            {userData.photoURL || userData.avatarUrl ? (
              <img src={userData.photoURL || userData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (userData.displayName || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-black text-stone-900 truncate">
              {userData.displayName || 'Pemilah'}
            </p>
            <p className="text-[10px] text-stone-400 truncate">
              {userData.level || 'Pemula'}
            </p>
          </div>
          <ChevronRight size={14} className="text-stone-300" />
        </div>

        {/* Utility Buttons: QR, Notifikasi, Mode Switcher, Logout */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {/* QR Code */}
          <button
            type="button"
            onClick={onShowQR}
            className="w-8 h-8 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
            title="QR Code Profil"
          >
            <QrCode size={15} />
          </button>

          {/* Notifikasi */}
          <button
            type="button"
            onClick={onShowNotifications}
            className="relative w-8 h-8 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
            title="Notifikasi"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white text-white text-[8px] font-black flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* View Mode Toggle: Desktop / Mobile */}
          <div className="flex items-center bg-stone-200/80 rounded-xl p-0.5 border border-stone-300">
            <button
              type="button"
              onClick={() => onToggleViewMode('desktop')}
              className={`p-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Desktop Mode"
            >
              <Monitor size={13} />
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('mobile')}
              className={`p-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Mobile Mode"
            >
              <Smartphone size={13} />
            </button>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="w-8 h-8 rounded-xl bg-white hover:bg-red-50 text-stone-400 hover:text-red-600 border border-stone-200 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;

