import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  Camera,
  Recycle,
  Brain,
  Sparkles,
  Gift,
  Award,
  Crown,
  ChevronRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  Medal,
  Star
} from 'lucide-react';
import { collection, onSnapshot, query, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BadgeMedal, BadgeCategory, BadgeRank, BADGE_DEFINITIONS } from './BadgeMedal';
import { RewardClaimDialog } from './RewardClaimDialog';
import type { UserData, UserBadge, LeaderboardRewardConfig } from '../../types';

interface LeaderboardViewProps {
  currentUser: UserData;
  onBack: () => void;
  onOpenAchievements: () => void;
  onUpdateUserData: (newData: UserData) => void;
}

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  level: string;
  score: number;
  secondaryScore?: string;
  isCurrentUser: boolean;
}

const DEFAULT_REWARDS: LeaderboardRewardConfig = {
  scanner: { rank1: 1000, rank2: 500, rank3: 250 },
  collector: { rank1: 1500, rank2: 750, rank3: 350 },
  quiz: { rank1: 1000, rank2: 500, rank3: 250 }
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  onBack,
  onOpenAchievements,
  onUpdateUserData
}) => {
  const [activeCategory, setActiveCategory] = useState<BadgeCategory>('scanner');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [quizProgressList, setQuizProgressList] = useState<any[]>([]);
  const [allMissions, setAllMissions] = useState<any[]>([]);
  const [rewardConfig, setRewardConfig] = useState<LeaderboardRewardConfig>(DEFAULT_REWARDS);
  const [loading, setLoading] = useState(true);

  // Claim Dialog State
  const [claimDialogData, setClaimDialogData] = useState<{
    isOpen: boolean;
    category: BadgeCategory;
    rank: BadgeRank;
    points: number;
    isAlreadyClaimed?: boolean;
  } | null>(null);

  // 1. Fetch Users Realtime
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setAllUsers(list);
      setLoading(false);
    });

    const unsubProgress = onSnapshot(collection(db, 'missionProgress'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuizProgressList(list);
    });

    const unsubRewards = onSnapshot(collection(db, 'systemSettings'), (snap) => {
      const configDoc = snap.docs.find(d => d.id === 'leaderboardRewards');
      if (configDoc && configDoc.exists()) {
        setRewardConfig({ ...DEFAULT_REWARDS, ...configDoc.data() });
      }
    });

    const unsubMissions = onSnapshot(collection(db, 'missions'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllMissions(list);
    });

    return () => {
      unsubUsers();
      unsubProgress();
      unsubRewards();
      unsubMissions();
    };
  }, []);

  // 2. Compute Rankings per Category (dengan Deduplikasi Akun agar 1 user hanya memiliki 1 peringkat)
  const leaderboardData = useMemo<LeaderboardEntry[]>(() => {
    if (!allUsers.length) return [];

    // Filter dan deduplikasi pengguna unik berdasarkan nama tampilan & identitas
    const userMap = new Map<string, any>();
    const uidToDedupeKey = new Map<string, string>();

    allUsers.forEach(u => {
      const email = (u.email || '').toLowerCase().trim();
      const displayName = (u.displayName || u.email?.split('@')[0] || 'Pemilah').trim();
      const cleanName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Deteksi identitas yang sama:
      // 1. Akun dengan awalan nama atau email yang sama (misal favianyusuf & favianyusufashari14)
      let dedupeKey = cleanName || email || u.uid;
      if (cleanName.startsWith('favianyusuf') || email.includes('favian') || email.includes('fyanz')) {
        dedupeKey = 'favianyusuf';
      }

      if (!dedupeKey) return;
      if (u.uid) {
        uidToDedupeKey.set(u.uid, dedupeKey);
      }

      const existing = userMap.get(dedupeKey);
      if (!existing) {
        userMap.set(dedupeKey, u);
      } else {
        // Tentukan data mana yang dipertahankan:
        const isCurrent = (currentUser.uid && u.uid === currentUser.uid) ||
                          (currentUser.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
                          (currentUser.displayName && u.displayName?.toLowerCase() === currentUser.displayName.toLowerCase());
        const existingIsCurrent = (currentUser.uid && existing.uid === currentUser.uid) ||
                                  (currentUser.email && existing.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
                                  (currentUser.displayName && existing.displayName?.toLowerCase() === currentUser.displayName.toLowerCase());

        // Hitung skor terbesar berdasarkan kategori aktif
        let uScore = 0;
        let existScore = 0;
        if (activeCategory === 'scanner') {
          uScore = u.scans || u.scanHistory?.length || 0;
          existScore = existing.scans || existing.scanHistory?.length || 0;
        } else if (activeCategory === 'collector') {
          const uDep = u.depositHistory || [];
          const exDep = existing.depositHistory || [];
          uScore = uDep.reduce((sum: number, d: any) => sum + (Number(d.totalWeight) || 0), 0);
          existScore = exDep.reduce((sum: number, d: any) => sum + (Number(d.totalWeight) || 0), 0);
        } else if (activeCategory === 'quiz') {
          const uQuiz = quizProgressList.filter(p => p.userId === u.uid && (p.completed || p.quizScore !== undefined || p.claimed));
          const exQuiz = quizProgressList.filter(p => p.userId === existing.uid && (p.completed || p.quizScore !== undefined || p.claimed));
          const calcQuizPts = (list: any[]) => list.reduce((sum, p) => {
            const m = allMissions.find(m => m.id === p.missionId);
            const reward = Number(m?.rewardPoints) || 100;
            if (p.completed || p.claimed) return sum + reward;
            const raw = Number(p.quizScore) || 0;
            return sum + (raw > 0 && raw <= 10 ? raw * 10 : raw);
          }, 0);
          uScore = calcQuizPts(uQuiz);
          existScore = calcQuizPts(exQuiz);
        }

        if (isCurrent && !existingIsCurrent) {
          // Prioritaskan akun yang sedang login saat ini agar bisa klaim medali
          userMap.set(dedupeKey, {
            ...u,
            scans: Math.max(u.scans || 0, existing.scans || 0),
            scanHistory: (u.scanHistory?.length || 0) >= (existing.scanHistory?.length || 0) ? u.scanHistory : existing.scanHistory,
            depositHistory: (u.depositHistory?.length || 0) >= (existing.depositHistory?.length || 0) ? u.depositHistory : existing.depositHistory,
          });
        } else if (!existingIsCurrent) {
          if (uScore >= existScore) {
            userMap.set(dedupeKey, u);
          }
        } else if (existingIsCurrent) {
          // Jika existing adalah currentUser, pertahankan currentUser dengan skor tertinggi
          userMap.set(dedupeKey, {
            ...existing,
            scans: Math.max(existing.scans || 0, u.scans || 0),
            scanHistory: (existing.scanHistory?.length || 0) >= (u.scanHistory?.length || 0) ? existing.scanHistory : u.scanHistory,
            depositHistory: (existing.depositHistory?.length || 0) >= (u.depositHistory?.length || 0) ? existing.depositHistory : u.depositHistory,
          });
        }
      }
    });

    const dedupedUsers = Array.from(userMap.values());
    let entries: LeaderboardEntry[] = [];

    if (activeCategory === 'scanner') {
      entries = dedupedUsers.map(u => {
        const scanCount = u.scans || u.scanHistory?.length || 0;
        return {
          uid: u.uid,
          displayName: u.displayName || u.email?.split('@')[0] || 'Pemilah',
          email: u.email || '',
          level: u.level || 'Pemula',
          score: scanCount,
          secondaryScore: `${scanCount} Scan AI`,
          isCurrentUser: (currentUser.uid && u.uid === currentUser.uid) ||
                         (currentUser.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
                         (currentUser.displayName && u.displayName?.toLowerCase() === currentUser.displayName.toLowerCase())
        };
      });
      entries.sort((a, b) => b.score - a.score);
    } else if (activeCategory === 'collector') {
      entries = dedupedUsers.map(u => {
        const deposits = u.depositHistory || [];
        const totalKg = deposits.reduce((sum: number, d: any) => sum + (Number(d.totalWeight) || 0), 0);
        return {
          uid: u.uid,
          displayName: u.displayName || u.email?.split('@')[0] || 'Pemilah',
          email: u.email || '',
          level: u.level || 'Pemula',
          score: Number(totalKg.toFixed(1)),
          secondaryScore: `${totalKg.toFixed(1)} Kg Setoran`,
          isCurrentUser: (currentUser.uid && u.uid === currentUser.uid) ||
                         (currentUser.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
                         (currentUser.displayName && u.displayName?.toLowerCase() === currentUser.displayName.toLowerCase())
        };
      });
      entries.sort((a, b) => b.score - a.score);
    } else if (activeCategory === 'quiz') {
      const userQuizMap = new Map<string, { completedCount: number; totalScore: number }>();
      quizProgressList.forEach(p => {
        if (!p.userId) return;
        const targetKey = uidToDedupeKey.get(p.userId) || p.userId;
        const prev = userQuizMap.get(targetKey) || { completedCount: 0, totalScore: 0 };
        const isDone = Boolean(p.completed || p.quizScore !== undefined || p.claimed);
        if (!isDone) return;

        const m = allMissions.find(m => m.id === p.missionId);
        const reward = Number(m?.rewardPoints) || 100;

        let pts = 0;
        if (p.completed || p.claimed) {
          pts = reward;
        } else if (p.quizScore !== undefined) {
          const rawScore = Number(p.quizScore) || 0;
          if (rawScore > 0 && rawScore <= 10) {
            pts = rawScore * 10;
          } else {
            pts = rawScore;
          }
        } else {
          pts = reward;
        }

        userQuizMap.set(targetKey, {
          completedCount: prev.completedCount + 1,
          totalScore: prev.totalScore + pts
        });
      });

      entries = dedupedUsers.map(u => {
        const targetKey = uidToDedupeKey.get(u.uid) || u.uid;
        const qStats = userQuizMap.get(targetKey) || { completedCount: 0, totalScore: 0 };
        return {
          uid: u.uid,
          displayName: u.displayName || u.email?.split('@')[0] || 'Pemilah',
          email: u.email || '',
          level: u.level || 'Pemula',
          score: qStats.totalScore,
          secondaryScore: `${qStats.completedCount} Kuis (${qStats.totalScore.toLocaleString('id-ID')} Poin)`,
          isCurrentUser: (currentUser.uid && u.uid === currentUser.uid) ||
                         (currentUser.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
                         (currentUser.displayName && u.displayName?.toLowerCase() === currentUser.displayName.toLowerCase())
        };
      });
      entries.sort((a, b) => b.score - a.score);
    }

    return entries;
  }, [allUsers, quizProgressList, allMissions, activeCategory, currentUser]);

  // Find current user's rank
  const currentUserRankIndex = leaderboardData.findIndex(e => e.isCurrentUser);
  const currentUserRank = currentUserRankIndex >= 0 ? currentUserRankIndex + 1 : null;
  const isTop3 = currentUserRank !== null && currentUserRank <= 3;
  const myBadgesCount = (currentUser.badges || []).length;

  // Single-Claim Enforcement: Cek apakah pengguna sudah pernah mengklaim hadiah di kategori ini (hanya boleh 1x klaim per kategori)
  const isCategoryAlreadyClaimed = useMemo(() => {
    const claimedList = currentUser.claimedLeaderboardRewards || [];
    const hasClaimKey = claimedList.some(k => k === activeCategory || k.startsWith(`${activeCategory}_`));
    const hasActiveBadge = (currentUser.badges || []).some(b => b.category === activeCategory);
    return hasClaimKey || hasActiveBadge;
  }, [currentUser.claimedLeaderboardRewards, currentUser.badges, activeCategory]);

  // Helper untuk membuka dialog klaim hadiah juara
  const triggerClaim = (rank: BadgeRank) => {
    if (isCategoryAlreadyClaimed) return;

    const categoryRewards = rewardConfig[activeCategory] || DEFAULT_REWARDS[activeCategory];
    const points = rank === 1
      ? categoryRewards.rank1
      : rank === 2
      ? categoryRewards.rank2
      : categoryRewards.rank3;

    setClaimDialogData({
      isOpen: true,
      category: activeCategory,
      rank,
      points: points || (rank === 1 ? 1000 : rank === 2 ? 500 : 250),
      isAlreadyClaimed: false
    });
  };

  // Check if current user is Top 3 and hasn't claimed reward yet
  useEffect(() => {
    if (isTop3 && currentUserRank) {
      if (!isCategoryAlreadyClaimed) {
        triggerClaim(currentUserRank as BadgeRank);
      }
    }
  }, [activeCategory, currentUserRank, isTop3, isCategoryAlreadyClaimed, rewardConfig]);

  // Handle Claim
  const handleRewardClaim = async (badge: UserBadge, points: number) => {
    // Guard ketat: cegah klaim ganda, 1 pengguna hanya boleh klaim 1x per kategori
    const alreadyClaimed = (currentUser.claimedLeaderboardRewards || []).some(k =>
      k === badge.category || k.startsWith(`${badge.category}_`)
    ) || (currentUser.badges || []).some(b => b.category === badge.category);

    if (alreadyClaimed) {
      console.warn('Hadiah untuk kategori ini sudah pernah diklaim sebelumnya.');
      return;
    }

    const claimKey = `${badge.category}_${badge.rank}`;
    const updatedClaimed = Array.from(new Set([
      ...(currentUser.claimedLeaderboardRewards || []),
      claimKey,
      badge.category
    ]));
    const existingBadges = currentUser.badges || [];
    // 1 Kategori hanya 1 gelar/medali aktif: ganti atau timpa medali pada kategori yang sama
    const updatedBadges = [...existingBadges.filter(b => b.category !== badge.category), badge];
    const updatedPoints = (currentUser.points || 0) + points;

    const categoryLabels: Record<string, string> = {
      scanner: 'Scanner Sampah AI',
      collector: 'Pengumpul Sampah',
      quiz: 'Si Paling Kuis'
    };

    const todayDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const newClaimHistoryItem = {
      id: `lb_claim_${Date.now()}`,
      title: `Hadiah Juara #${badge.rank} (${categoryLabels[badge.category] || 'Papan Peringkat'})`,
      points: points,
      date: todayDate,
      status: 'Success' as const,
      userEmail: currentUser.email,
      userUid: currentUser.uid
    };

    const claimNotif = {
      id: 'claim_notif_' + Date.now(),
      title: `Hadiah Juara #${badge.rank} Diterima!`,
      message: `Selamat! Anda berhasil mengklaim hadiah posisi Juara #${badge.rank} sebesar +${points.toLocaleString()} NeuroPoints. Medali kehormatan telah aktif di profil Anda!`,
      date: new Date().toLocaleString('id-ID'),
      type: 'success' as const,
      isRead: false
    };

    const updatedClaimHistory = [newClaimHistoryItem, ...(currentUser.claimHistory || [])];
    const updatedNotifs = [claimNotif, ...(currentUser.notifications || [])];

    const updatedUser: UserData = {
      ...currentUser,
      points: updatedPoints,
      badges: updatedBadges,
      notifications: updatedNotifs,
      claimHistory: updatedClaimHistory,
      claimedLeaderboardRewards: updatedClaimed
    };

    // Update real-time state di aplikasi
    onUpdateUserData(updatedUser);

    // Save directly to Firestore users and transactions
    if (currentUser.uid) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          points: updatedPoints,
          badges: updatedBadges,
          notifications: updatedNotifs,
          claimHistory: updatedClaimHistory,
          claimedLeaderboardRewards: updatedClaimed
        }, { merge: true });

        // Catat mutasi poin ke koleksi Firestore transactions dengan ID deterministik (1 klaim per kategori per pengguna)
        const txDocId = `lb_reward_${currentUser.uid}_${badge.category}`;
        await setDoc(doc(db, 'transactions', txDocId), {
          id: txDocId,
          userUid: currentUser.uid,
          userEmail: currentUser.email || '',
          type: 'leaderboard_reward',
          rank: badge.rank,
          partnerName: `Hadiah Juara #${badge.rank} Leaderboard`,
          category: badge.category,
          categoryLabel: categoryLabels[badge.category] || 'Papan Peringkat',
          totalPoints: points,
          points: points,
          totalWeight: 0,
          weight: 0,
          status: 'approved',
          photoUrl: 'leaderboard_reward_badge',
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error('Failed to save claimed reward or transaction:', e);
      }
    }
  };

  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];
  const restEntries = leaderboardData.slice(3);

  const categoryPrizes = rewardConfig[activeCategory] || DEFAULT_REWARDS[activeCategory];

  const isClaimedRank1 = isCategoryAlreadyClaimed || (currentUser.claimedLeaderboardRewards || []).includes(`${activeCategory}_1`);
  const isClaimedRank2 = isCategoryAlreadyClaimed || (currentUser.claimedLeaderboardRewards || []).includes(`${activeCategory}_2`);
  const isClaimedRank3 = isCategoryAlreadyClaimed || (currentUser.claimedLeaderboardRewards || []).includes(`${activeCategory}_3`);
  const isCurrentUserRewardClaimed = isCategoryAlreadyClaimed || (currentUserRank ? (currentUser.claimedLeaderboardRewards || []).includes(`${activeCategory}_${currentUserRank}`) : false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-stone-50 to-stone-100/70 text-stone-900 pb-36 relative">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-48 right-10 w-80 h-80 bg-amber-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Header Sticky */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200/80 px-4 sm:px-6 py-4 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 border border-stone-200/80 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-display font-black text-stone-900 flex items-center gap-2">
                Papan Peringkat <Trophy size={20} className="text-amber-500 fill-amber-400" />
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-stone-500 font-medium">Prestasi Pemilah Sampah Komunitas</p>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Live Sync
                </span>
              </div>
            </div>
          </div>

          {/* Tombol Medali Utama di Header */}
          <button
            onClick={onOpenAchievements}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-stone-950 text-xs font-black flex items-center gap-2 shadow-md shadow-amber-400/25 transition-all cursor-pointer active:scale-95 group"
            title="Buka Rak Medali Saya"
          >
            <div className="w-5 h-5 rounded-full bg-white/40 flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Medal size={14} className="text-stone-950" />
            </div>
            <span>Rak Medali</span>
            {myBadgesCount > 0 && (
              <span className="bg-stone-950 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {myBadgesCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6 relative z-10">
        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/90 rounded-2xl border border-stone-200/80 shadow-xs backdrop-blur-sm">
          {[
            { id: 'scanner', label: 'Scanner AI', icon: Camera, sub: 'Scan Sampah' },
            { id: 'collector', label: 'Pengumpul', icon: Recycle, sub: 'Setoran Fisik' },
            { id: 'quiz', label: 'Si Paling Quiz', icon: Brain, sub: 'Skor Misi' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as BadgeCategory)}
                className={`py-3 px-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md shadow-emerald-700/25 scale-[1.02]'
                    : 'text-stone-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <Icon size={18} />
                <span className="truncate">{tab.label}</span>
                <span className={`text-[9px] font-medium truncate ${isActive ? 'text-emerald-100' : 'text-stone-400'}`}>
                  {tab.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Prize Pool Info Card for Top 3 */}
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50/80 to-emerald-50 border-2 border-amber-200/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/60 shadow-inner">
              <Gift size={24} />
            </div>
            <div>
              <p className="text-[10px] text-amber-800 font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500 animate-spin" />
                <span>Hadiah Musim Ini (Khusus Juara Top 3)</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-black text-stone-800 mt-1">
                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-300/60">
                  🥇 {categoryPrizes.rank1.toLocaleString()} NP
                </span>
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-300">
                  🥈 {categoryPrizes.rank2.toLocaleString()} NP
                </span>
                <span className="bg-orange-100 text-orange-900 px-2 py-0.5 rounded-lg border border-amber-300">
                  🥉 {categoryPrizes.rank3.toLocaleString()} NP
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAchievements}
            className="self-end sm:self-auto text-[11px] font-black text-amber-900 bg-white hover:bg-amber-100/60 px-3.5 py-1.5 rounded-xl border border-amber-300 shadow-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Medal size={13} className="text-amber-600" />
            <span>Lihat Semua Medali</span>
          </button>
        </div>

        {/* Podium Top 3 (Cerak & Bernuansa Emas, Perak, Perunggu) */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end justify-center px-1">
            
            {/* Rank 2 (Silver) */}
            <div className="flex flex-col items-center">
              {top2 ? (
                <>
                  <div
                    onClick={onOpenAchievements}
                    className="relative mb-2 flex flex-col items-center cursor-pointer group"
                    title="Klik untuk lihat medali"
                  >
                    <BadgeMedal category={activeCategory} rank={2} size="sm" />
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center font-bold text-sm text-slate-700 shadow-md mt-1 overflow-hidden group-hover:scale-105 transition-transform">
                      {top2.displayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h4 className="font-bold text-xs text-stone-800 text-center truncate max-w-[95px]">
                    {top2.displayName}
                  </h4>
                  <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                    {top2.secondaryScore}
                  </p>
                  {top2.isCurrentUser && (
                    isClaimedRank2 ? (
                      <span className="mt-1 px-2.5 py-0.5 bg-stone-100 text-stone-500 font-bold text-[10px] rounded-full border border-stone-200 cursor-not-allowed inline-flex items-center gap-1 shadow-xs">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        <span>Sudah Diklaim</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerClaim(2)}
                        className="mt-1 px-2.5 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black text-[10px] rounded-full shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Klaim Hadiah
                      </button>
                    )
                  )}
                </>
              ) : (
                <p className="text-[10px] text-stone-400 italic mb-2">Kosong</p>
              )}
              {/* Podium Bar */}
              <div className="w-full h-24 bg-gradient-to-t from-slate-200 via-slate-100 to-white rounded-t-2xl border-t-4 border-slate-300 flex flex-col items-center justify-center shadow-md mt-2 text-slate-700">
                <span className="text-2xl font-black text-slate-600">2</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Perak</span>
              </div>
            </div>

            {/* Rank 1 (Gold) - Elevated Center */}
            <div className="flex flex-col items-center -mt-6">
              {top1 ? (
                <>
                  <div
                    onClick={onOpenAchievements}
                    className="relative mb-2 flex flex-col items-center cursor-pointer group"
                    title="Klik untuk lihat medali"
                  >
                    <Crown size={24} className="text-amber-500 fill-amber-400 mb-1 animate-bounce" />
                    <BadgeMedal category={activeCategory} rank={1} size="md" />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-2 border-yellow-400 flex items-center justify-center font-black text-base text-stone-900 shadow-xl mt-1 overflow-hidden ring-4 ring-yellow-400/40 group-hover:scale-105 transition-transform">
                      {top1.displayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h4 className="font-black text-sm text-stone-900 text-center truncate max-w-[110px]">
                    {top1.displayName}
                  </h4>
                  <p className="text-[11px] text-amber-700 font-black mt-0.5">
                    {top1.secondaryScore}
                  </p>
                  {top1.isCurrentUser && (
                    isClaimedRank1 ? (
                      <span className="mt-1 px-3 py-1 bg-stone-100 text-stone-500 font-bold text-[11px] rounded-full border border-stone-200 cursor-not-allowed inline-flex items-center gap-1 shadow-xs">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>Sudah Diklaim</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerClaim(1)}
                        className="mt-1 px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black text-[11px] rounded-full shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Klaim Hadiah
                      </button>
                    )
                  )}
                </>
              ) : (
                <p className="text-[10px] text-stone-400 italic mb-2">Kosong</p>
              )}
              {/* Podium Bar */}
              <div className="w-full h-32 bg-gradient-to-t from-amber-200 via-yellow-100 to-yellow-50 rounded-t-3xl border-t-4 border-yellow-400 flex flex-col items-center justify-center shadow-xl mt-2 ring-2 ring-yellow-300/50 text-stone-900">
                <span className="text-3xl font-black text-amber-700">1</span>
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Emas Murni</span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="flex flex-col items-center">
              {top3 ? (
                <>
                  <div
                    onClick={onOpenAchievements}
                    className="relative mb-2 flex flex-col items-center cursor-pointer group"
                    title="Klik untuk lihat medali"
                  >
                    <BadgeMedal category={activeCategory} rank={3} size="sm" />
                    <div className="w-12 h-12 rounded-full bg-orange-100 border-2 border-amber-400 flex items-center justify-center font-bold text-sm text-amber-900 shadow-md mt-1 overflow-hidden group-hover:scale-105 transition-transform">
                      {top3.displayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h4 className="font-bold text-xs text-stone-800 text-center truncate max-w-[95px]">
                    {top3.displayName}
                  </h4>
                  <p className="text-[10px] text-orange-700 font-bold mt-0.5">
                    {top3.secondaryScore}
                  </p>
                  {top3.isCurrentUser && (
                    isClaimedRank3 ? (
                      <span className="mt-1 px-2.5 py-0.5 bg-stone-100 text-stone-500 font-bold text-[10px] rounded-full border border-stone-200 cursor-not-allowed inline-flex items-center gap-1 shadow-xs">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        <span>Sudah Diklaim</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerClaim(3)}
                        className="mt-1 px-2.5 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black text-[10px] rounded-full shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Klaim Hadiah
                      </button>
                    )
                  )}
                </>
              ) : (
                <p className="text-[10px] text-stone-400 italic mb-2">Kosong</p>
              )}
              {/* Podium Bar */}
              <div className="w-full h-20 bg-gradient-to-t from-orange-200 via-orange-100 to-white rounded-t-2xl border-t-4 border-amber-500 flex flex-col items-center justify-center shadow-md mt-2 text-amber-900">
                <span className="text-2xl font-black text-amber-800">3</span>
                <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider">Perunggu</span>
              </div>
            </div>

          </div>
        </div>

        {/* List Rankings 4 and Below */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            <span>Peringkat 4 ke Bawah</span>
            <span>Skor Capaian</span>
          </div>

          {restEntries.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-stone-200/80 text-stone-400 text-xs italic shadow-xs">
              Belum ada pemilah lain di kategori ini...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {restEntries.map((entry, idx) => {
                const rankNum = idx + 4;
                return (
                  <div
                    key={entry.uid}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      entry.isCurrentUser
                        ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white border-stone-200/80 hover:border-emerald-300 shadow-xs hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center text-xs font-black text-stone-400">
                        #{rankNum}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-xs text-stone-700 shrink-0">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-xs text-stone-900 truncate">
                            {entry.displayName}
                          </h5>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] font-black text-emerald-800 bg-emerald-200/80 px-2 py-0.2 rounded-md">
                              Anda
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-500 font-medium">
                          Level: {entry.level}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-700">
                        {entry.secondaryScore}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar: "Peringkat Saya" */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-stone-200/90 p-4 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm border-2 border-emerald-200 shrink-0 shadow-xs">
              {currentUserRank ? `#${currentUserRank}` : '-'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                Posisi Anda Saat Ini
              </p>
              <h5 className="font-bold text-xs text-stone-900 truncate">
                {currentUserRank
                  ? currentUserRank <= 3
                    ? `🎉 Anda di Top 3 (${currentUserRank === 1 ? 'Juara 1 Emas' : currentUserRank === 2 ? 'Juara 2 Perak' : 'Juara 3 Perunggu'})!`
                    : `Peringkat #${currentUserRank} dari ${leaderboardData.length} Pemilah`
                  : 'Belum tercatat aktivitas'}
              </h5>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isTop3 && currentUserRank ? (
              isCurrentUserRewardClaimed ? (
                <button
                  type="button"
                  disabled
                  className="py-2.5 px-4 bg-stone-100 text-stone-500 font-bold text-xs rounded-xl border border-stone-200 cursor-not-allowed flex items-center gap-1.5 opacity-90 shadow-xs"
                >
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>Hadiah Juara #{currentUserRank} Sudah Diklaim</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerClaim(currentUserRank as BadgeRank)}
                  className="py-2.5 px-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black text-xs rounded-xl shadow-lg shadow-amber-400/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer animate-bounce"
                >
                  <Gift size={15} />
                  <span>Klaim Hadiah Juara #{currentUserRank}</span>
                </button>
              )
            ) : null}

            {/* Tombol Medali yang selalu bisa diakses */}
            <button
              onClick={onOpenAchievements}
              className="py-2.5 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xs rounded-xl border border-stone-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Buka Koleksi Medali"
            >
              <Medal size={15} className="text-amber-600" />
              <span className="hidden sm:inline">Rak</span> Medali
            </button>
          </div>
        </div>
      </div>

      {/* Claim Dialog Modal */}
      {claimDialogData && (
        <RewardClaimDialog
          isOpen={claimDialogData.isOpen}
          onClaim={handleRewardClaim}
          onClose={() => setClaimDialogData(null)}
          onOpenAchievements={onOpenAchievements}
          category={claimDialogData.category}
          rank={claimDialogData.rank}
          pointsReward={claimDialogData.points}
          userName={currentUser.displayName || currentUser.email?.split('@')[0] || 'Pemilah'}
          isAlreadyClaimed={claimDialogData.isAlreadyClaimed}
        />
      )}
    </div>
  );
};

export default LeaderboardView;
