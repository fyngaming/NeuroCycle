import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  AtSign,
  Mail,
  Camera,
  Edit3,
  QrCode,
  Sparkles,
  Award,
  Flame,
  ShieldCheck,
  Building2,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { ProfileAvatarFrame } from './ProfileAvatarFrame';
import { ProfileEditModal } from './ProfileEditModal';
import { isBadgeActive } from './badgeExpiryUtils';
import type { UserData, UserBadge } from '../../types';

interface UserProfileHeaderProps {
  userData: UserData;
  onSaveUserData: (data: UserData) => void;
  onShowQR: () => void;
  onShowPartnerTx?: () => void;
  isPartner?: boolean;
  partnerDoc?: any;
  isDesktop?: boolean;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  userData,
  onSaveUserData,
  onShowQR,
  onShowPartnerTx,
  isPartner = false,
  partnerDoc,
  isDesktop = true
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Determine highest active rank for avatar frame
  const activeBadges = (userData.badges || []).filter(isBadgeActive);
  let highestRank: 1 | 2 | 3 | null = null;
  if (activeBadges.some(b => b.rank === 1)) highestRank = 1;
  else if (activeBadges.some(b => b.rank === 2)) highestRank = 2;
  else if (activeBadges.some(b => b.rank === 3)) highestRank = 3;

  const displayName = userData.displayName || 'Pemilah NeuroCycle';
  const username = userData.username ||
    (userData.displayName ? userData.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '') : '') ||
    (userData.email ? userData.email.split('@')[0] : 'pemilah');

  const copyEmailToClipboard = () => {
    if (userData.email) {
      navigator.clipboard.writeText(userData.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <>
      <div className={`bg-gradient-to-br from-white via-stone-50 to-emerald-50/40 border-2 border-emerald-100/90 rounded-4xl ${
        isDesktop ? 'p-6 sm:p-8 mb-8' : 'p-5 mb-6'
      } shadow-sm relative overflow-hidden`}>
        {/* Ambient Decorative Blurs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-200/15 rounded-full blur-3xl pointer-events-none" />

        {isDesktop ? (
          /* ── DESKTOP HEADER LAYOUT ── */
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: Avatar with Frame + Name, Username, Email */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              {/* Avatar Frame with Quick Edit trigger */}
              <div className="relative shrink-0">
                <ProfileAvatarFrame
                  photoUrl={userData.photoURL || userData.avatarUrl}
                  displayName={displayName}
                  size="xl"
                  frameType={(userData.avatarFrame as any) || 'auto'}
                  highestRank={highestRank}
                  onClick={() => setShowEditModal(true)}
                  showEditHint={true}
                />
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg border-2 border-white transition-all active:scale-95 cursor-pointer"
                  title="Ubah Foto Profil & Frame"
                >
                  <Camera size={14} />
                </button>
              </div>

              {/* User Details */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl sm:text-3xl font-display font-black text-stone-900 leading-tight">
                    {displayName}
                  </h2>
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs" title="Terverifikasi">
                    ✓
                  </span>
                </div>

                {/* Username & Email */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-1 text-xs">
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    @{username}
                  </span>

                  <button
                    type="button"
                    onClick={copyEmailToClipboard}
                    className="flex items-center gap-1 text-stone-500 hover:text-stone-800 font-medium transition-colors bg-stone-100 hover:bg-stone-200/80 px-2.5 py-0.5 rounded-full border border-stone-200 cursor-pointer"
                    title="Salin Email"
                  >
                    <Mail size={12} className="text-stone-400" />
                    <span className="truncate max-w-[200px]">{userData.email || 'Email belum tersedia'}</span>
                    {copiedEmail ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-stone-400" />}
                  </button>
                </div>

                {/* Status / Level Badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300 shadow-xs">
                    <Award size={13} className="text-amber-600" />
                    <span>Level: {userData.level || 'Pemilah'}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-orange-900 bg-orange-100 px-3 py-1 rounded-xl border border-orange-300 shadow-xs">
                    <Flame size={13} className="text-orange-600" />
                    <span>{userData.streak || 0} Hari Streak</span>
                  </span>

                  {isPartner ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-teal-900 bg-teal-100 px-3 py-1 rounded-xl border border-teal-300">
                      <Building2 size={13} className="text-teal-600" />
                      <span>Partner Bank Sampah</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-900 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-300">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Pemilah Komunitas</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onShowQR}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <QrCode size={16} className="text-emerald-400" />
                <span>My QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-stone-100 text-stone-800 rounded-2xl font-bold text-xs border border-stone-300 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Edit3 size={14} className="text-stone-600" />
                <span>Ubah Profil & Frame</span>
              </button>

              {isPartner ? (
                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl text-[10px] font-black border border-amber-300">
                  <span>Akun Terdaftar Partner</span>
                </div>
              ) : userData.role === 'partner' && onShowPartnerTx ? (
                <button
                  type="button"
                  onClick={onShowPartnerTx}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-100 text-teal-900 rounded-xl text-xs font-black border border-teal-300 hover:bg-teal-200 transition-colors cursor-pointer"
                >
                  <span>Kirim Setoran</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          /* ── MOBILE HEADER LAYOUT (Vertical Stack, Clean, Centered & Native) ── */
          <div className="relative z-10 flex flex-col items-center text-center gap-3.5">
            {/* Avatar Frame with Quick Edit trigger */}
            <div className="relative shrink-0">
              <ProfileAvatarFrame
                photoUrl={userData.photoURL || userData.avatarUrl}
                displayName={displayName}
                size="xl"
                frameType={(userData.avatarFrame as any) || 'auto'}
                highestRank={highestRank}
                onClick={() => setShowEditModal(true)}
                showEditHint={true}
              />
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg border-2 border-white transition-all active:scale-95 cursor-pointer"
                title="Ubah Foto Profil & Frame"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* User Details */}
            <div className="w-full">
              <div className="flex items-center justify-center gap-1.5">
                <h2 className="text-xl font-display font-black text-stone-900 leading-tight">
                  {displayName}
                </h2>
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-xs shrink-0" title="Terverifikasi">
                  ✓
                </span>
              </div>

              {/* Username & Email */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1 text-xs">
                <span className="font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 text-[11px]">
                  @{username}
                </span>

                <button
                  type="button"
                  onClick={copyEmailToClipboard}
                  className="flex items-center gap-1 text-stone-500 hover:text-stone-800 font-medium transition-colors bg-stone-100 hover:bg-stone-200/80 px-2 py-0.5 rounded-full border border-stone-200 cursor-pointer"
                  title="Salin Email"
                >
                  <Mail size={11} className="text-stone-400 shrink-0" />
                  <span className="truncate max-w-[150px] text-[11px]">{userData.email || 'Email belum tersedia'}</span>
                  {copiedEmail ? <Check size={11} className="text-emerald-600 shrink-0" /> : <Copy size={11} className="text-stone-400 shrink-0" />}
                </button>
              </div>

              {/* Badges / Status */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-xl border border-amber-300 shadow-xs">
                  <Award size={12} className="text-amber-600 shrink-0" />
                  <span>Level: {userData.level || 'Pemilah'}</span>
                </span>

                <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-900 bg-orange-100/90 px-2.5 py-0.5 rounded-xl border border-orange-300 shadow-xs">
                  <Flame size={12} className="text-orange-600 shrink-0" />
                  <span>{userData.streak || 0} Hari</span>
                </span>

                {isPartner ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-xl border border-teal-300">
                    <Building2 size={12} className="text-teal-600 shrink-0" />
                    <span>Partner</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-xl border border-emerald-300">
                    <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                    <span>Komunitas</span>
                  </span>
                )}
              </div>
            </div>

            {/* Mobile Action Buttons (Grid 2 Kolom Presisi) */}
            <div className="w-full pt-1 space-y-2">
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={onShowQR}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <QrCode size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">My QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-stone-100 text-stone-800 rounded-2xl font-bold text-xs border border-stone-300 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <Edit3 size={13} className="text-stone-600 shrink-0" />
                  <span className="truncate">Ubah Profil</span>
                </button>
              </div>

              {isPartner ? (
                <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-100/90 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 text-center">
                  <span>Akun Terdaftar sebagai Partner</span>
                </div>
              ) : userData.role === 'partner' && onShowPartnerTx ? (
                <button
                  type="button"
                  onClick={onShowPartnerTx}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-100 text-teal-900 rounded-xl text-xs font-black border border-teal-300 hover:bg-teal-200 transition-colors cursor-pointer"
                >
                  <span>Kirim Setoran</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile & Frame Modal */}
      <ProfileEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        userData={userData}
        onSave={onSaveUserData}
      />
    </>
  );
};

export default UserProfileHeader;

