import React from 'react';
import { motion } from 'framer-motion';
import {
  Leaf,
  MapPin,
  Camera,
  Award,
  User,
  Trophy,
  Coins,
  Bell,
  LogOut,
  QrCode,
  Flame,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { UserData } from '../../types';
import type { ViewMode } from './ViewModeSwitcher';

interface DesktopNavProps {
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

export const DesktopNav: React.FC<DesktopNavProps> = ({
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
    { id: 'main', label: 'Beranda', icon: Leaf },
    { id: 'map', label: 'Lokasi', icon: MapPin },
    { id: 'daily_missions', label: 'Misi', icon: Award },
    { id: 'leaderboard', label: 'Peringkat', icon: Trophy },
    { id: 'user_dashboard', label: 'Profil', icon: User },
  ];

  return (
    <header className="sticky top-0 z-[120] bg-white/95 backdrop-blur-2xl border-b border-stone-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Single Row: Brand | Nav | NP Card | Controls */}
        <div className="h-[72px] flex items-center gap-6">

          {/* ── Brand Logo (Pojok Kiri) ── */}
          <div
            onClick={() => onNavigate('main')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center p-2 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <img
                src="/logo_NeuroCycle.png"
                alt="NeuroCycle"
                className="w-full h-full object-contain drop-shadow-md"
              />
            </div>
            <div className="hidden xl:block">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-black text-stone-900 tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                  NeuroCycle
                </h1>
                <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                  Portal
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-medium mt-0.5">
                Cerdas Memilah, Berkah Berkelanjutan
              </p>
            </div>
          </div>

          {/* ── Navigation Links (Tengah) ── */}
          <nav className="hidden lg:flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl border border-stone-200/80 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeState === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-stone-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Pindai Sampah Button */}
            <button
              type="button"
              onClick={onScan}
              className="ml-0.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Camera size={14} />
              <span>Pindai</span>
            </button>
          </nav>

          {/* ── Spacer ── */}
          <div className="flex-1" />

          {/* ── NeuroPoints Card (Lebih Besar & Menonjol) ── */}
          <div
            onClick={() => onNavigate('redemption')}
            className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200/80 rounded-2xl cursor-pointer hover:border-amber-300 hover:shadow-md hover:shadow-amber-200/40 transition-all shrink-0 group"
            title="Tukar NeuroPoints"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Coins size={20} className="text-amber-900" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-none mb-0.5">NeuroPoints</p>
              <p className="text-xl font-display font-black text-amber-900 leading-none">
                {(userData.points || 0).toLocaleString('id-ID')}
                <span className="text-xs text-amber-600 ml-1 font-bold">NP</span>
              </p>
            </div>
          </div>

          {/* ── Streak Pill ── */}
          <div
            className="hidden lg:flex items-center gap-2 px-3.5 py-2 bg-orange-50 border border-orange-200 rounded-xl shadow-xs shrink-0"
            title="Streak Aktivitas Harian"
          >
            <Flame size={18} className="text-orange-500" />
            <div>
              <p className="text-base font-black text-orange-900 leading-none">{userData.streak || 1}</p>
              <p className="text-[9px] text-orange-500 font-bold uppercase leading-none mt-0.5">Hari</p>
            </div>
          </div>

          {/* ── Icon Buttons (QR, Notifikasi) ── */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onShowQR}
              className="w-9 h-9 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              title="Tampilkan QR Code"
            >
              <QrCode size={16} />
            </button>
            <button
              type="button"
              onClick={onShowNotifications}
              className="relative w-9 h-9 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              title="Notifikasi"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white text-white text-[8px] font-black flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* ── User Profile Pill ── */}
          <div
            onClick={() => onNavigate('user_dashboard')}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 transition-all cursor-pointer border border-stone-200 shrink-0"
            title="Buka Dashboard Profil"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              {userData.photoURL || userData.avatarUrl ? (
                <img src={userData.photoURL || userData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (userData.displayName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden xl:block text-left min-w-0">
              <p className="text-[11px] font-bold text-stone-900 truncate max-w-[90px]">
                {userData.displayName || 'Pemilah'}
              </p>
            </div>
          </div>

          {/* ── View Mode Switcher (Terintegrasi di Nav) ── */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => onToggleViewMode('desktop')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Desktop Mode"
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('mobile')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Mobile Mode"
            >
              <Smartphone size={14} />
            </button>
          </div>

          {/* ── Logout ── */}
          <button
            type="button"
            onClick={onLogout}
            className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 border border-stone-200 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Keluar / Logout"
          >
            <LogOut size={14} />
          </button>

        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
