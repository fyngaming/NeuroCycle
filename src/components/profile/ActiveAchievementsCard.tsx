import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Sparkles, Clock, Award, ChevronRight, Crown, Medal, Flame } from 'lucide-react';
import { BadgeMedal } from '../leaderboard/BadgeMedal';
import { isBadgeActive, getBadgeExpiryInfo } from './badgeExpiryUtils';
import type { UserBadge } from '../../types';

interface ActiveAchievementsCardProps {
  badges: UserBadge[];
  onOpenAchievements: () => void;
  onOpenLeaderboard: () => void;
  isDesktop?: boolean;
}

export const ActiveAchievementsCard: React.FC<ActiveAchievementsCardProps> = ({
  badges = [],
  onOpenAchievements,
  onOpenLeaderboard,
  isDesktop = true
}) => {
  // Deduplikasi medali aktif: HANYA 1 medali terbaik per kategori (Scanner, Collector, Quiz)
  const uniqueActiveBadges = useMemo(() => {
    const categoryMap = new Map<string, UserBadge>();
    const activeOnly = badges.filter(isBadgeActive);

    activeOnly.forEach(b => {
      const existing = categoryMap.get(b.category);
      if (!existing) {
        categoryMap.set(b.category, b);
      } else {
        // Ambil yang peringkatnya lebih tinggi (rank 1 > 2 > 3)
        // Jika rank sama, ambil yang tanggalnya lebih baru
        const isBetterRank = b.rank < existing.rank;
        const isSameRankNewer = b.rank === existing.rank && (b.awardedTimestamp || 0) >= (existing.awardedTimestamp || 0);
        if (isBetterRank || isSameRankNewer) {
          categoryMap.set(b.category, b);
        }
      }
    });

    // Urutkan berdasarkan rank: Juara 1 dulu, lalu 2, lalu 3
    return Array.from(categoryMap.values()).sort((a, b) => a.rank - b.rank);
  }, [badges]);

  const activeBadges = uniqueActiveBadges;
  const totalBadges = uniqueActiveBadges.length;
  const expiredCount = badges.filter(b => !isBadgeActive(b)).length;

  if (activeBadges.length === 0) {
    return (
      <div className="bg-gradient-to-r from-stone-50 via-amber-50/40 to-stone-50 border-2 border-dashed border-amber-300/80 rounded-4xl p-5 sm:p-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-amber-400/20 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/60 shadow-inner">
            <Trophy size={28} className="text-amber-500 fill-amber-300/50" />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h4 className="font-display font-black text-stone-900 text-base">
                {expiredCount > 0 ? 'Masa Aktif Medali Telah Berakhir (1 Minggu)' : 'Prestasi & Medali Kehormatan'}
              </h4>
              <span className="text-[10px] font-black text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                Berlaku 7 Hari
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 max-w-md">
              {expiredCount > 0
                ? 'Medali leaderboard aktif di profil selama 1 minggu sejak diraih. Rebut kembali posisi Juara Top 3 untuk memamerkan medali baru!'
                : 'Masuk ke posisi Top 3 Papan Peringkat di kategori Scanner, Pengumpul, atau Quiz untuk memamerkan medali berkilau di profil selama 1 minggu!'}
            </p>
          </div>
        </div>

        <div className={isDesktop ? "flex items-center gap-2 shrink-0" : "grid grid-cols-2 gap-2 w-full pt-2"}>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-700/20 active:scale-95 cursor-pointer"
          >
            <Trophy size={14} className="text-yellow-300 shrink-0" />
            <span className="truncate">Kejar Juara</span>
          </button>
          <button
            type="button"
            onClick={onOpenAchievements}
            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-stone-100 text-stone-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border border-stone-200 transition-all cursor-pointer shadow-xs"
          >
            <Medal size={14} className="text-amber-600 shrink-0" />
            <span className="truncate">Rak Medali {totalBadges > 0 ? `(${totalBadges})` : ''}</span>
          </button>
        </div>
      </div>
    );
  }

  const categoryLabels = {
    scanner: '📸 Scanner Sampah AI',
    collector: '♻️ Pengumpul Sampah',
    quiz: '🧠 Si Paling Quiz'
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-yellow-400/15 to-emerald-500/10 border-2 border-amber-300 rounded-4xl p-5 sm:p-7 mb-8 shadow-sm relative overflow-hidden">
      {/* Ambient glowing radial effects */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Card */}
      {isDesktop ? (
        /* ── DESKTOP HEADER (Horizontal Row with Right-Aligned Buttons) ── */
        <div className="flex items-center justify-between gap-3 mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/25 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300 shadow-inner">
              <Trophy size={22} className="text-amber-600 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-display font-black text-stone-900 text-base sm:text-lg flex items-center gap-1.5">
                  <span>Medali Aktif Profil</span>
                  <Sparkles size={15} className="text-amber-500 animate-spin" />
                </h4>
                <span className="text-[10px] font-black text-amber-900 bg-amber-300/90 px-2.5 py-0.5 rounded-full border border-amber-400 shadow-xs">
                  {activeBadges.length} Aktif
                </span>
              </div>
              <p className="text-[11px] text-stone-600 font-medium mt-0.5">
                Top 3 Kehormatan • Aktif 7 hari sejak diraih
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAchievements}
              className="px-3.5 py-2 bg-white/90 hover:bg-white text-stone-800 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border border-amber-300 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Buka Rak Medali Lengkap"
            >
              <Medal size={14} className="text-amber-600" />
              <span>Rak Medali</span>
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
              title="Lihat Papan Peringkat"
            >
              <Trophy size={14} />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── MOBILE HEADER (Vertical Stack, 2-Col Clean Buttons, No Overflow) ── */
        <div className="flex flex-col gap-3 mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/25 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300 shadow-inner">
              <Trophy size={20} className="text-amber-600 fill-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display font-black text-stone-900 text-sm flex items-center gap-1.5 truncate">
                  <span>Medali Aktif Profil</span>
                  <Sparkles size={13} className="text-amber-500 animate-spin shrink-0" />
                </h4>
                <span className="text-[10px] font-black text-amber-900 bg-amber-300/95 px-2 py-0.5 rounded-full border border-amber-400 shadow-xs shrink-0">
                  {activeBadges.length} Aktif
                </span>
              </div>
              <p className="text-[10px] text-stone-600 font-medium truncate mt-0.5">
                Top 3 Kehormatan • Aktif 7 hari
              </p>
            </div>
          </div>

          {/* Clean 2-Column Buttons on Mobile */}
          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <button
              type="button"
              onClick={onOpenAchievements}
              className="w-full py-2 px-2.5 bg-white/95 hover:bg-white text-stone-800 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border border-amber-300 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Buka Rak Medali Lengkap"
            >
              <Medal size={13} className="text-amber-600 shrink-0" />
              <span className="truncate">Rak Medali</span>
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="w-full py-2 px-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
              title="Lihat Papan Peringkat"
            >
              <Trophy size={13} className="shrink-0" />
              <span className="truncate">Leaderboard</span>
            </button>
          </div>
        </div>
      )}

      {/* Badges Layout: Desktop 3-Column Grid vs Mobile Clean List */}
      {isDesktop ? (
        /* ── DESKTOP GRID (3 Columns) ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
          {activeBadges.map((badge) => {
            const expiry = getBadgeExpiryInfo(badge);
            return (
              <motion.div
                key={badge.id}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={onOpenAchievements}
                className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border-2 border-amber-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer flex flex-col items-center text-center relative group"
              >
                {/* Top Row: Category Pill & Rank Tag */}
                <div className="w-full flex items-center justify-between gap-1 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full truncate">
                    {badge.category === 'scanner' ? 'Scanner' : badge.category === 'collector' ? 'Kolektor' : 'Quiz'}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                    badge.rank === 1
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : badge.rank === 2
                      ? 'bg-slate-100 text-slate-800 border-slate-300'
                      : 'bg-orange-100 text-orange-900 border-orange-300'
                  }`}>
                    Juara #{badge.rank}
                  </span>
                </div>

                {/* 3D Shiny Medal Graphic */}
                <div className="my-1.5 scale-100 group-hover:scale-105 transition-transform">
                  <BadgeMedal
                    category={badge.category}
                    rank={badge.rank}
                    size="md"
                    isLocked={false}
                  />
                </div>

                <h5 className="font-display font-black text-sm text-stone-900 mt-1 line-clamp-1">
                  {badge.title}
                </h5>
                <p className="text-[10px] text-stone-500 font-semibold line-clamp-1 mt-0.5">
                  {categoryLabels[badge.category] || badge.description}
                </p>

                {/* 1-Week Expiry Countdown Pill */}
                <div className="mt-3 w-full bg-amber-50/80 rounded-2xl p-2.5 border border-amber-200/80 text-left">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-black text-amber-900 flex items-center gap-1">
                      <Clock size={12} className="text-amber-600 animate-pulse" />
                      <span>{expiry.badgeLabel}</span>
                    </span>
                    <span className="text-[9px] font-bold text-amber-700/80">
                      Aktif 1 Minggu
                    </span>
                  </div>

                  {/* Remaining Progress Bar */}
                  <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${expiry.progressPercent}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* ── MOBILE LIST (Clean Full-Width Horizontal Cards, No Squeezing) ── */
        <div className="flex flex-col gap-3 relative z-10">
          {activeBadges.map((badge) => {
            const expiry = getBadgeExpiryInfo(badge);
            return (
              <motion.div
                key={badge.id}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenAchievements}
                className="bg-white/95 backdrop-blur-md rounded-3xl p-3.5 border-2 border-amber-200/90 shadow-xs flex items-center gap-3.5 cursor-pointer relative"
              >
                {/* 3D Shiny Medal Graphic on Left */}
                <div className="shrink-0 scale-90">
                  <BadgeMedal
                    category={badge.category}
                    rank={badge.rank}
                    size="sm"
                    isLocked={false}
                  />
                </div>

                {/* Content on Right */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                      badge.rank === 1
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : badge.rank === 2
                        ? 'bg-slate-100 text-slate-800 border-slate-300'
                        : 'bg-orange-100 text-orange-900 border-orange-300'
                    }`}>
                      Juara #{badge.rank}
                    </span>
                    <span className="text-[9px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                      <Clock size={11} className="animate-pulse" />
                      <span>{expiry.badgeLabel}</span>
                    </span>
                  </div>

                  <h5 className="font-display font-black text-xs text-stone-900 truncate">
                    {badge.title}
                  </h5>
                  <p className="text-[10px] text-stone-500 font-medium truncate mt-0.5">
                    {categoryLabels[badge.category] || badge.description}
                  </p>

                  {/* Countdown Progress Bar */}
                  <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                      style={{ width: `${expiry.progressPercent}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveAchievementsCard;
