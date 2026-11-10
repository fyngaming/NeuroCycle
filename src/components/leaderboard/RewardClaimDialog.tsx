import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Gift, ArrowRight, X, Award, Medal, Coins, CheckCircle2 } from 'lucide-react';
import { BadgeMedal, BADGE_DEFINITIONS, BadgeCategory, BadgeRank } from './BadgeMedal';
import type { UserBadge } from '../../types';

interface RewardClaimDialogProps {
  isOpen: boolean;
  onClaim: (badge: UserBadge, points: number) => void;
  onClose: () => void;
  onOpenAchievements?: () => void;
  category: BadgeCategory;
  rank: BadgeRank;
  pointsReward?: number;
  userName: string;
  isAlreadyClaimed?: boolean;
}

export const RewardClaimDialog: React.FC<RewardClaimDialogProps> = ({
  isOpen,
  onClaim,
  onClose,
  onOpenAchievements,
  category,
  rank,
  pointsReward,
  userName,
  isAlreadyClaimed = false
}) => {
  const [isClaimed, setIsClaimed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const safePoints = typeof pointsReward === 'number' && pointsReward > 0
    ? pointsReward
    : (rank === 1 ? 1000 : rank === 2 ? 500 : 250);

  const badgeKey = `${category}_${rank}`;
  const def = BADGE_DEFINITIONS[badgeKey] || {
    name: `Juara #${rank}`,
    title: `Peringkat #${rank}`,
    description: 'Peringkat Terbaik Leaderboard',
    colorName: rank === 1 ? 'Emas Murni' : rank === 2 ? 'Perak Mengkilap' : 'Perunggu Berkilau'
  };

  const categoryLabels = {
    scanner: 'Scanner Sampah AI',
    collector: 'Pengumpul Sampah',
    quiz: 'Si Paling Quiz'
  };

  const handleClaim = () => {
    if (isSubmitting || isClaimed) return;
    setIsSubmitting(true);

    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const now = Date.now();
    const newBadge: UserBadge = {
      id: `${badgeKey}_${now}`,
      category,
      rank,
      title: def.title,
      description: def.description,
      awardedAt: today,
      awardedTimestamp: now,
      pointsReward: safePoints
    };

    try {
      onClaim(newBadge, safePoints);
      setIsClaimed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsClaimed(false);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-white rounded-[36px] max-w-sm w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 text-center shadow-2xl relative border-2 border-amber-300"
        >
          {/* Close button X */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all cursor-pointer z-30 shadow-xs"
            title="Tutup dialog"
          >
            <X size={18} />
          </button>

          {/* Confetti & Golden Sparkle Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-amber-100/60 via-white to-white pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-yellow-300/35 blur-3xl pointer-events-none" />

          {!isClaimed ? (
            /* ── FASE 1: DIALOG PENAWARAN KLAIM ── */
            <>
              {/* Floating Sparkles Header */}
              <div className="flex items-center justify-center gap-1.5 text-amber-700 font-black text-[11px] uppercase tracking-widest mt-1 mb-1 relative z-10">
                <Sparkles size={16} className="text-amber-500 animate-spin" />
                <span>PENGHARGAAN JUARA TOP 3</span>
                <Sparkles size={16} className="text-amber-500 animate-spin" />
              </div>

              <h3 className="text-2xl font-display font-black text-stone-900 leading-tight relative z-10">
                Selamat, {userName}!
              </h3>
              <p className="text-xs text-stone-600 font-medium mt-1 relative z-10">
                Anda berhasil menduduki posisi <span className="font-bold text-amber-800">{def.title}</span> di kategori <span className="font-bold text-emerald-700">{categoryLabels[category]}</span>!
              </p>

              {/* Animated Medal Showcase */}
              <div className="my-5 flex justify-center scale-105 relative z-10">
                <BadgeMedal
                  category={category}
                  rank={rank}
                  size="lg"
                  isLocked={false}
                />
              </div>

              {/* Reward Box */}
              <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300/80 rounded-3xl p-4 shadow-sm mb-5 text-center relative z-10">
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full mb-1.5 border border-amber-300">
                  <Gift size={14} className="text-amber-700" />
                  <span>Hadiah Pemenang</span>
                </div>
                <p className="text-3xl font-display font-black text-amber-600">
                  +{safePoints.toLocaleString()} <span className="text-base font-bold text-amber-800">NP</span>
                </p>
                <p className="text-[11px] text-stone-600 font-medium mt-1">
                  {isAlreadyClaimed
                    ? 'Hadiah ini sudah pernah Anda klaim dan poin telah masuk ke akun Anda.'
                    : 'NeuroPoints & Medali Kehormatan akan langsung dipasang di akun Anda!'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 relative z-10">
                {/* Tombol Utama: Klaim atau Status Sudah Diklaim */}
                {isAlreadyClaimed ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-emerald-800 text-xs font-bold shadow-xs">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>Hadiah posisi ini sudah pernah diklaim!</span>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="w-full py-3.5 bg-stone-100 text-stone-400 font-bold text-xs rounded-2xl border border-stone-200 cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>Hadiah Sudah Diklaim</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-700/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/50 disabled:opacity-50"
                  >
                    <Trophy size={18} className="text-yellow-300" />
                    <span>{isSubmitting ? 'Memproses Klaim...' : `Klaim ${safePoints.toLocaleString()} NP & Pasang Medali`}</span>
                    <ArrowRight size={16} />
                  </button>
                )}

                {/* Tombol Buka Rak Medali */}
                {onOpenAchievements && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenAchievements();
                    }}
                    className="w-full py-2.5 bg-amber-100/70 hover:bg-amber-200 text-amber-900 font-black text-xs rounded-xl border border-amber-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Medal size={15} className="text-amber-700" />
                    <span>Buka Rak Medali Saya</span>
                  </button>
                )}

                {/* Tombol Nanti Saja */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full text-xs text-stone-500 hover:text-stone-700 font-bold py-1.5 transition-colors cursor-pointer"
                >
                  Nanti Saja
                </button>
              </div>
            </>
          ) : (
            /* ── FASE 2: ALERT PERAYAAN KLAIM BERHASIL (COIN CELEBRATION MODAL) ── */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-4 relative z-10 text-center"
            >
              {/* Golden Coin Icon with Glow */}
              <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
                <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-xl animate-ping" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-stone-950 flex items-center justify-center shadow-xl border-4 border-yellow-200 relative z-10 animate-bounce">
                  <Coins size={38} className="text-amber-950" />
                </div>
                <div className="absolute -top-1 -right-1 w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md z-20">
                  <CheckCircle2 size={16} />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 mb-2">
                <Sparkles size={12} className="text-emerald-600" />
                <span>Klaim Poin Sukses</span>
              </div>

              <h3 className="text-2xl font-display font-black text-stone-900">
                Poin Berhasil Diterima!
              </h3>

              {/* Big Golden Points Alert */}
              <div className="my-4 p-4 rounded-3xl bg-gradient-to-br from-amber-100/90 via-yellow-50 to-emerald-50 border-2 border-amber-300 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Total NeuroPoints Ditambahkan
                </p>
                <h4 className="text-4xl font-display font-black text-amber-600 my-1">
                  +{safePoints.toLocaleString()} <span className="text-lg font-bold text-amber-900">NP</span>
                </h4>
                <p className="text-xs text-stone-600 font-medium">
                  Medali <span className="font-bold text-stone-900">{def.title}</span> telah aktif di profil Anda selama 7 hari!
                </p>
              </div>

              <div className="space-y-2 mt-5">
                {onOpenAchievements && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenAchievements();
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Medal size={15} />
                    <span>Lihat Medali di Profil</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-2xl transition-all cursor-pointer active:scale-95"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RewardClaimDialog;
