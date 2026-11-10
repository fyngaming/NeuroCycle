import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Sparkles, Trophy, CheckCircle2, Lock, Info, Medal, ArrowRight, ExternalLink } from 'lucide-react';
import { BadgeMedal, BADGE_DEFINITIONS, BadgeCategory, BadgeRank } from './BadgeMedal';
import type { UserBadge } from '../../types';

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBadges: UserBadge[];
  userName: string;
  onOpenLeaderboard?: () => void;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
  userBadges = [],
  userName,
  onOpenLeaderboard
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | BadgeCategory>('all');
  const [activeBadgeDetail, setActiveBadgeDetail] = useState<any | null>(null);

  if (!isOpen) return null;

  // Compute deduplicated badge counts (1 badge per category + rank)
  const uniqueUserBadges = userBadges.filter((b, idx, arr) => 
    arr.findIndex(x => x.category === b.category && x.rank === b.rank) === idx
  );
  const goldCount = uniqueUserBadges.filter(b => b.rank === 1).length;
  const silverCount = uniqueUserBadges.filter(b => b.rank === 2).length;
  const bronzeCount = uniqueUserBadges.filter(b => b.rank === 3).length;
  const totalBadges = uniqueUserBadges.length;

  // Filtered definitions
  const allDefinitions = Object.values(BADGE_DEFINITIONS);
  const filteredBadges = allDefinitions.filter(badge => {
    if (selectedCategory === 'all') return true;
    return badge.category === selectedCategory;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 25 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-[36px] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200"
        >
          {/* Header Banner - Emerald & Gold Glossy */}
          <div className="relative p-6 sm:p-7 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white overflow-hidden shrink-0">
            {/* Ambient glossy shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/20 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-emerald-400/25 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg text-yellow-300">
                  <Medal size={26} />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-display font-black text-white leading-tight flex items-center gap-2">
                    Rak Medali & Prestasi
                  </h3>
                  <p className="text-xs text-white/80 font-medium mt-0.5">
                    Koleksi lencana kehormatan Top 3 untuk {userName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm shadow-xs"
                title="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Statistik Medali User */}
            <div className="grid grid-cols-4 gap-2.5 mt-5 relative z-10">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-2.5 text-center border border-white/25">
                <p className="text-[10px] text-white/80 font-black uppercase tracking-wider">Total</p>
                <p className="text-lg font-black text-white mt-0.5">{totalBadges}</p>
              </div>
              <div className="bg-amber-400/25 backdrop-blur-md rounded-2xl p-2.5 text-center border border-yellow-300/40">
                <p className="text-[10px] text-yellow-200 font-black uppercase tracking-wider">🥇 Emas</p>
                <p className="text-lg font-black text-yellow-300 mt-0.5">{goldCount}</p>
              </div>
              <div className="bg-slate-200/20 backdrop-blur-md rounded-2xl p-2.5 text-center border border-slate-200/30">
                <p className="text-[10px] text-slate-200 font-black uppercase tracking-wider">🥈 Perak</p>
                <p className="text-lg font-black text-slate-100 mt-0.5">{silverCount}</p>
              </div>
              <div className="bg-orange-400/20 backdrop-blur-md rounded-2xl p-2.5 text-center border border-orange-300/35">
                <p className="text-[10px] text-orange-200 font-black uppercase tracking-wider">🥉 Perunggu</p>
                <p className="text-lg font-black text-orange-300 mt-0.5">{bronzeCount}</p>
              </div>
            </div>
          </div>

          {/* Filter Kategori */}
          <div className="px-6 py-3 border-b border-stone-100 flex items-center gap-2 overflow-x-auto no-scrollbar bg-stone-50/80 shrink-0">
            {[
              { id: 'all', label: 'Semua Kategori' },
              { id: 'scanner', label: '📸 Scanner AI' },
              { id: 'collector', label: '♻️ Pengumpul' },
              { id: 'quiz', label: '🧠 Si Paling Quiz' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid Medali */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredBadges.map(def => {
                const earned = userBadges.find(
                  b => b.category === def.category && b.rank === def.rank
                );
                const isLocked = !earned;

                return (
                  <motion.div
                    key={def.id}
                    whileHover={{ y: -3 }}
                    onClick={() => setActiveBadgeDetail({ ...def, earned })}
                    className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center text-center relative overflow-hidden ${
                      isLocked
                        ? 'bg-stone-50 border-stone-200/70 opacity-80 hover:opacity-100'
                        : 'bg-white border-amber-300 shadow-sm hover:shadow-md hover:border-amber-400'
                    }`}
                  >
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {isLocked ? (
                        <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center">
                          <Lock size={12} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <CheckCircle2 size={13} />
                        </div>
                      )}
                    </div>

                    {/* Medal Graphic */}
                    <div className="my-2">
                      <BadgeMedal
                        category={def.category}
                        rank={def.rank}
                        size="md"
                        isLocked={isLocked}
                      />
                    </div>

                    <h4 className="font-display font-black text-sm text-stone-900 mt-2">
                      {def.name}
                    </h4>
                    <p className="text-[10px] text-stone-500 font-semibold line-clamp-1 mt-0.5">
                      {def.title}
                    </p>

                    {/* Tombol Aksi di setiap kartu */}
                    <div className="mt-3 w-full pt-2.5 border-t border-stone-100 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-stone-400">
                        {def.colorName}
                      </span>
                      {earned ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          Aktif ✓
                        </span>
                      ) : (
                        <span className="font-bold text-stone-500 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-lg">
                          Terkunci
                        </span>
                      )}
                    </div>

                    <div className="mt-2 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBadgeDetail({ ...def, earned });
                        }}
                        className={`w-full py-1.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${
                          earned
                            ? 'bg-amber-400 hover:bg-amber-500 text-stone-950 shadow-xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                        }`}
                      >
                        <Medal size={11} />
                        <span>{earned ? 'Lihat Detail Medali' : 'Cara Meraih'}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer Info */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <p className="text-[11px] text-stone-500 font-medium text-center sm:text-left">
              💡 Masuk ke posisi <span className="text-emerald-700 font-black">Top 3 Leaderboard</span> untuk mendapatkan medali berkilau dan bonus NeuroPoints!
            </p>
            {onOpenLeaderboard && (
              <button
                onClick={() => {
                  onClose();
                  onOpenLeaderboard();
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Trophy size={14} className="text-yellow-300" />
                <span>Papan Peringkat</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Modal Detail Badge Tertentu */}
        <AnimatePresence>
          {activeBadgeDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveBadgeDetail(null)}
              className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-[32px] p-6 max-w-sm w-full text-center shadow-2xl relative border-2 border-amber-300"
              >
                <button
                  onClick={() => setActiveBadgeDetail(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <X size={16} />
                </button>

                <div className="flex justify-center my-3">
                  <BadgeMedal
                    category={activeBadgeDetail.category}
                    rank={activeBadgeDetail.rank}
                    size="lg"
                    isLocked={!activeBadgeDetail.earned}
                  />
                </div>

                <h3 className="text-xl font-display font-black text-stone-900">
                  {activeBadgeDetail.name}
                </h3>
                <p className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 py-1 px-3 rounded-full inline-block mt-1">
                  {activeBadgeDetail.title} • {activeBadgeDetail.colorName}
                </p>

                <p className="text-xs text-stone-600 mt-4 leading-relaxed bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-left">
                  {activeBadgeDetail.description}
                </p>

                {activeBadgeDetail.earned ? (
                  <div className="mt-4 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-left text-xs">
                    <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Medali Telah Dikuasai!
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      Diraih pada: {activeBadgeDetail.earned.awardedAt || 'Musim Ini'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs">
                    <p className="font-bold text-amber-800 flex items-center gap-1.5">
                      <Lock size={14} /> Belum Terbuka
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">
                      Raih posisi Juara #{activeBadgeDetail.rank} di papan peringkat kategori ini untuk membuka medali ini secara permanen!
                    </p>
                  </div>
                )}

                <div className="mt-5 space-y-2">
                  {onOpenLeaderboard && (
                    <button
                      onClick={() => {
                        setActiveBadgeDetail(null);
                        onClose();
                        onOpenLeaderboard();
                      }}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trophy size={15} className="text-yellow-300" />
                      <span>{activeBadgeDetail.earned ? 'Lihat Papan Peringkat' : 'Kejar Juara di Leaderboard'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveBadgeDetail(null)}
                    className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-xl font-bold text-xs hover:bg-stone-200 transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementModal;
