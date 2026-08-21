/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Leaf,
  Trash2,
  User,
  Award,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  Info,
  CheckCircle2,
  AlertTriangle,
  Recycle,
  Droplets,
  Zap,
  Flame,
  Sprout,
  TrendingDown,
  ChevronRight,
  BookOpen,
  Plus,
  MapPin,
  Sparkles,
  BarChart3,
  Lightbulb,
  Instagram,
  ShoppingBag,
  Trees,
  Coins,
  Check,
  Minus,
  LogOut,
  Eye,
  EyeOff,
  ShieldAlert,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  MoreVertical,
  Bell,
  X,
  Gift,
  Activity,
  Bug,
  Filter,
  Building2,
  Search,
  Copy,
  Lock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { auth, db, googleProvider } from './lib/firebase';
import { normalizePhotoUrl } from './lib/photoUrl';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { analyzeWaste, WasteAnalysis, genAI } from './services/gemini';
import { detectWasteWithONNX, isONNXModelAvailable } from './services/wasteDetection';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logError } from './lib/errorLogger';
import { EDUCATIONAL_ARTICLES } from './constants';
import { MapContainer } from './components/MapContainer';
import { DailyMissions } from './components/DailyMissions';
import UserQR from './components/UserQR';
import PartnerOnboarding from './components/PartnerOnboarding';
import PartnerSelfSubmit from './components/PartnerSelfSubmit';
import PartnerDashboard from './components/PartnerDashboard';
import PartnerTransactionSubmit from './components/PartnerTransactionSubmit';
import UserDepositSubmit from './components/UserDepositSubmit';
import { syncMissionStatuses } from './services/missionService';
import type { Mission, MissionProgress, QuizQuestion } from './types';
import RewardManagement from './components/RewardManagement';
import QuizScreen from './components/QuizScreen';

// --- Type Definitions ---
type AppState =
  | 'login' | 'welcome' | 'main' | 'scanning' | 'result'
  | 'user_dashboard' | 'redemption' | 'education_list' | 'education_detail'
  | 'map' | 'about' | 'scan_options' | 'admin_dashboard' | 'super_admin_dashboard' | 'institution_admin_dashboard' | 'partner_dashboard'
  | 'waste_bank_list' | 'waste_bank_calculate' | 'waste_bank_verify'
  | 'daily_missions' | 'welcome'
  | 'quiz';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'success' | 'warning' | 'info';
  isRead: boolean;
  depositId?: string;
  userName?: string;
  depositItems?: { category: string; name?: string; weight: number; points: number }[];
  totalWeight?: number;
  totalPoints?: number;
}

interface ScanHistoryItem {
  id: string;
  name: string;
  category: string;
  date: string;
  impact: { co2: number; water: number; energy: number };
  image?: string;
}

interface DepositHistoryItem {
  id: string;
  date: string;
  items: { category: string; weight: number; points: number }[];
  totalPoints: number;
  totalWeight: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  image?: string;
  location?: string;
  userEmail?: string;
  userUid?: string;
}

interface ClaimHistoryItem {
  id: string;
  title: string;
  points: number;
  date: string;
  status: 'Pending' | 'Success' | 'Rejected';
  userEmail?: string;
  userUid?: string;
}

interface UserData {
  uid?: string;
  email: string;
  displayName: string;
  role?: string;
  institutionId?: string;
  institutionCode?: string;
  qrToken?: string;
  points: number;
  scans: number;
  level: string;
  streak: number;
  lastLogin: string;
  mascotName: string;
  isBanned?: boolean;
  history: { date: string; co2: number; water: number; energy: number }[];
  scanHistory: ScanHistoryItem[];
  claimHistory: ClaimHistoryItem[];
  depositHistory: DepositHistoryItem[];
  notifications: NotificationItem[];
}

// --- About Screen ---
const AboutScreen = ({ onBack }: { onBack: () => void }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="p-6 pb-40"
  >
    <header className="flex items-center justify-between mb-8">
      <h2 className="text-2xl font-display font-black text-stone-900">Tentang</h2>
      <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-transform">
        <ArrowLeft size={20} className="text-stone-600" />
      </button>
    </header>
    <div className="bg-white rounded-[40px] p-8 border border-stone-100 shadow-sm space-y-4">
      <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-4">
        <Recycle size={32} />
      </div>
      <h3 className="text-xl font-display font-bold text-stone-900 text-center">NeuroCycle</h3>
      <p className="text-sm text-stone-500 text-center leading-relaxed">
        Aplikasi pengelolaan sampah cerdas berbasis AI untuk membantu masyarakat memilah, mendaur ulang, dan mendapatkan reward dari aktivitas ramah lingkungan.
      </p>
      <div className="pt-4 border-t border-stone-100 text-center">
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Versi 1.0.0</p>
      </div>
    </div>
  </motion.div>
);

const RedemptionCenter = ({ points, onBack, onClaim }: { points: number, onBack: () => void, onClaim: (offer: any) => void }) => {
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'rewards'), where('isActive', '==', true)),
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        list.sort((a: any, b: any) => a.points - b.points);
        setOffers(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading offers:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const renderOfferIcon = (offer: any) => {
    if (offer.imageUrl) {
      return (
        <img
          src={offer.imageUrl}
          alt={offer.title}
          className="w-full h-full object-cover rounded-2xl"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    // Fallback based on category
    switch (offer.category) {
      case 'E-Wallet':
        return <Zap size={24} className="text-blue-500 fill-blue-500" />;
      case 'Donasi':
      case 'Donasi / Lingkungan':
        return <Trees size={24} className="text-emerald-500" />;
      case 'Energi':
        return <Zap size={24} className="text-amber-500 fill-amber-500" />;
      case 'Merchandise':
        return <ShoppingBag size={24} className="text-orange-500" />;
      case 'Telekomunikasi':
        return <Zap size={24} className="text-purple-500 fill-purple-500" />;
      default:
        return <Gift size={24} className="text-emerald-500" />;
    }
  };

  const handleClaim = () => {
    if (selectedOffer) {
      onClaim(selectedOffer);
      setSelectedOffer(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="fixed inset-0 bg-stone-50 z-150 overflow-y-auto"
    >
      <div className="p-6 max-w-md mx-auto min-h-screen pb-32">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-stone-600" />
          </button>
          <div className="bg-emerald-600 px-6 py-2 rounded-2xl text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-100">
            <Coins size={18} />
            {points.toLocaleString()} <span className="text-[10px] opacity-70">NP</span>
          </div>
        </header>

        <div className="mb-10">
          <h2 className="text-3xl font-display font-black text-stone-900 mb-2">Penukaran Poin</h2>
          <p className="text-sm text-stone-500">Ubah kepedulianmu menjadi manfaat nyata.</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Memuat daftar hadiah...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[40px] border border-stone-100 p-8 shadow-sm">
            <Gift className="mx-auto text-stone-300 mb-4" size={48} />
            <h3 className="font-bold text-stone-800 mb-1">Belum Ada Hadiah</h3>
            <p className="text-stone-500 text-sm">Silakan hubungi admin atau kembali lagi nanti untuk melihat penukaran poin terbaru.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all"
              >
                <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden shrink-0 border border-stone-100">
                  {renderOfferIcon(offer)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest truncate">{offer.category}</p>
                  <h4 className="font-bold text-stone-800 truncate">{offer.title}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Coins size={12} className="text-amber-500" />
                    <span className="text-xs font-bold text-amber-600">{offer.points.toLocaleString()} NP</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOffer(offer)}
                  disabled={points < offer.points}
                  className={`py-3 px-6 rounded-2xl font-bold text-xs shadow-sm transition-all shrink-0 ${points >= offer.points
                    ? 'bg-emerald-600 text-white shadow-emerald-100 active:scale-95'
                    : 'bg-stone-100 text-stone-300 pointer-events-none'
                    }`}
                >
                  {points >= offer.points ? 'Tukar' : 'Kurang'}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-12 p-8 bg-linear-to-br from-emerald-100 to-teal-50 rounded-[40px] text-center border border-emerald-200/50">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Sparkles size={24} className="text-emerald-600" />
          </div>
          <p className="text-xs font-black text-emerald-800 mb-2 uppercase tracking-widest">Coming Soon</p>
          <p className="text-stone-600 text-sm font-medium">Evolusi Maskot: NeuroDragon & Voucher Merchant Lokal</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-200 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />

              <div className="w-20 h-20 bg-emerald-50 rounded-4xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                <CheckCircle2 size={40} />
              </div>

              <div className="text-center mb-8">
                <h3 className="text-2xl font-display font-black text-stone-900 mb-2">Selamat!</h3>
                <p className="text-stone-500 text-sm leading-relaxed">
                  Kamu sudah bisa mendapatkan <span className="font-bold text-emerald-600">"{selectedOffer.title}"</span>. Apakah kamu ingin klaim sekarang?
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleClaim}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Instagram size={20} />
                  DM Admin Instagram
                </button>
                <button
                  onClick={() => setSelectedOffer(null)}
                  className="w-full py-4 bg-stone-50 text-stone-400 rounded-2xl font-bold text-sm hover:bg-stone-100 transition-colors"
                >
                  Nanti Saja
                </button>
              </div>

              <p className="text-[10px] text-stone-300 text-center mt-6 uppercase font-black tracking-widest leading-relaxed">
                Poin terpotong otomatis &<br />Instagram DM admin akan terbuka
              </p>
            </motion.div>
          </motion.div>
        )}
        
      </AnimatePresence>
    </motion.div>
  );
};

// Helper map for dynamic icon rendering
const IconMap: Record<string, React.ElementType> = {
  MapPin: MapPin,
  X: X,
  Trash2: Trash2,
  Camera: Camera,
  Leaf: Leaf,
  User: User,
  Award: Award,
  ImageIcon: ImageIcon,
  Loader2: Loader2,
  ArrowLeft: ArrowLeft,
  Info: Info,
  CheckCircle2: CheckCircle2,
  Recycle: Recycle,
  Droplets: Droplets,
  Zap: Zap,
  Flame: Flame,
  Sprout: Sprout,
  TrendingDown: TrendingDown,
  ChevronRight: ChevronRight,
  BookOpen: BookOpen,
  Plus: Plus,
  Sparkles: Sparkles,
  BarChart3: BarChart3,
  Lightbulb: Lightbulb,
  Instagram: Instagram,
  ShoppingBag: ShoppingBag,
  Trees: Trees,
  Coins: Coins,
  Check: Check,
  Minus: Minus,
  AlertTriangle: AlertTriangle,
};

const EducationList = ({ onBack, onSelectArticle }: {
  onBack: () => void,
  onSelectArticle: (article: any) => void
}) => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    import('./services/missionService').then(({ getPublishedArticles }) => {
      const unsub = getPublishedArticles((fetched: any[]) => {
        setArticles(fetched.length > 0 ? fetched : EDUCATIONAL_ARTICLES);
        setLoadingArticles(false);
      });
      return unsub;
    });
  }, []);

  const displayArticles = loadingArticles ? [] : articles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 pb-40"
    >
      <header className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-black text-stone-900">Pusat Edukasi</h2>
        <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-transform">
          <ArrowLeft size={20} className="text-stone-600" />
        </button>
      </header>

      {loadingArticles ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-emerald-500" size={40} />
        </div>
      ) : (
        <div className="space-y-4">
          {displayArticles.map((article) => (
            <motion.div
              key={article.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectArticle(article)}
              className="bg-white p-5 rounded-4xl shadow-sm border border-stone-100 flex items-center gap-5 cursor-pointer group"
            >
              <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-colors">
                {IconMap[article.icon] && React.createElement(IconMap[article.icon], { className: `text-${article.color}-500` })}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-stone-800 text-sm mb-1">{article.title}</h4>
                <p className="text-[10px] text-stone-400 line-clamp-2 leading-relaxed">{article.excerpt}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">{article.readTime}</span>
                  <span className="text-[8px] font-bold text-stone-300 uppercase tracking-widest">{article.author}</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </motion.div>
          ))}
              </div>
            )}
          </motion.div>
  );
};


const UserDashboard = ({ userData, onPointsClick, onBack, onDeleteHistory, saveUserData, onShowQR, onShowPartner, onShowPartnerTx, onShowUserDeposit }: {
  userData: UserData,
  onPointsClick: () => void,
  onBack: () => void,
  onDeleteHistory: (id: string) => void,
  saveUserData: (data: UserData) => void,
  onShowQR: () => void,
  onShowPartner: () => void,
  onShowPartnerTx: () => void,
  onShowUserDeposit?: () => void,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'deposit' | 'claim' | 'transactions'>('scan');
  const [filterDay, setFilterDay] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isPartner, setIsPartner] = useState(false);
  const [partnerDoc, setPartnerDoc] = useState<any>(null);

  useEffect(() => {
    if (!userData.uid) return;
    const checkPartner = async () => {
      const q1 = query(collection(db, 'partners'), where('ownerUid', '==', userData.uid));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        setIsPartner(true);
        setPartnerDoc(snap1.docs[0].data());
        return;
      }
      const q2 = query(collection(db, 'partners'), where('email', '==', userData.email));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        setIsPartner(true);
        setPartnerDoc(snap2.docs[0].data());
      }
    };
    checkPartner();
  }, [userData.uid, userData.email]);

  useEffect(() => {
    if (isPartner && partnerDoc) {
      const partnerNotification: NotificationItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Akun Terdaftar sebagai Partner',
        message: `Akun Google ini (${userData.email}) sudah terdaftar sebagai Partner: ${partnerDoc.name}. Silakan login melalui menu Partner untuk mengakses dashboard partner.`,
        date: new Date().toLocaleString('id-ID'),
        type: 'warning',
        isRead: false
      };
      const updatedNotifications = [partnerNotification, ...(userData.notifications || [])];
      saveUserData({ ...userData, notifications: updatedNotifications });
    }
  }, [isPartner, partnerDoc, userData.email, userData, saveUserData]);

  const filteredScanHistory = useMemo(() => {
    const history = userData.scanHistory || [];
    if (!filterDay && !filterMonth && !filterYear) return history;

    return history.filter(item => {
      // item.date format: D/M/YYYY HH.MM.SS or DD/MM/YYYY HH.MM.SS (potentially with a comma before time)
      const datePart = item.date.split(' ')[0]; // Get "D/M/YYYY" or "DD/MM/YYYY,"
      const dateSegments = datePart.split('/'); // Get ['D', 'M', 'YYYY'] or ['DD', 'MM', 'YYYY,']

      const itemDayRaw = dateSegments[0];
      const itemMonthRaw = dateSegments[1];
      const itemYearRaw = dateSegments[2]; // Could be "YYYY" or "YYYY,"

      const itemDay = itemDayRaw.padStart(2, '0'); // Pad to 'DD' format
      const itemMonth = itemMonthRaw.padStart(2, '0'); // Pad to 'MM' format
      const itemYear = itemYearRaw.replace(',', ''); // Remove potential trailing comma

      let match = true;
      if (filterYear) match = match && itemYear === filterYear; // filterYear is already a string like '2024'
      if (filterMonth) match = match && itemMonth === filterMonth.padStart(2, '0'); // filterMonth is 'M' or 'MM'
      if (filterDay) match = match && itemDay === filterDay.padStart(2, '0'); // filterDay is 'D' or 'DD'
      return match;
    });
  }, [userData.scanHistory, filterDay, filterMonth, filterYear]);

  useEffect(() => {
    if (!userData.uid) return;
    const q = query(collection(db, 'transactions'), where('userUid', '==', userData.uid));
    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserTransactions(txs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
  }, [userData.uid]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="p-6 pb-40 min-h-screen bg-stone-50"
    >
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-display font-black text-stone-800">Dashboard Saya</h2>
            <p className="text-sm text-stone-500 mt-1">Kelola setoran dan akses partner bank sampah.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onShowQR}
              className="flex items-center gap-2 py-2 px-4 bg-white rounded-3xl text-stone-700 font-semibold text-xs uppercase tracking-[0.18em] hover:bg-stone-100 active:scale-95 transition-all border border-stone-200">
              <span className="text-base">🪪</span>
              My QR
            </button>
            {isPartner ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 rounded-3xl text-amber-400 font-semibold text-xs uppercase tracking-[0.18em] border border-amber-700">
                <span className="text-base">⚠️</span>
                Akun ini sudah terdaftar sebagai Partner
              </div>
            ) : userData.role === 'partner' ? (
              <>
                <button type="button" onClick={onShowPartnerTx}
                  className="flex items-center gap-2 py-2 px-4 bg-teal-900/30 rounded-3xl text-teal-400 font-semibold text-xs uppercase tracking-[0.18em] hover:bg-teal-800/30 active:scale-95 transition-all border border-teal-700">
                  <span className="text-base">➕</span>
                  Kirim Setoran
                </button>
              </>
            ) : (
              null
            )}
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-emerald-100 rounded-full blur-xl group-hover:scale-150 transition-transform" />
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3 relative z-10">
            <Camera size={20} />
          </div>
          <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest relative z-10">Total Aktivitas</p>
          <h4 className="text-2xl font-display font-bold text-stone-800 relative z-10">{userData.scans + (userData.depositHistory?.length || 0)}</h4>
        </div>
        <div className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-orange-100 rounded-full blur-xl group-hover:scale-150 transition-transform" />
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 mb-3 relative z-10">
            <Award size={20} />
          </div>
          <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest relative z-10">Level</p>
          <h4 className="text-lg font-bold text-stone-800 truncate relative z-10">{userData.level}</h4>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 p-1.5 rounded-3xl mb-8 overflow-x-auto hide-scrollbar border border-stone-200">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex-1 min-w-20 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'scan' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'}`}
        >
          Scan
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 min-w-20 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'deposit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'}`}
        >
          Setor
        </button>
        <button
          onClick={() => setActiveTab('claim')}
          className={`flex-1 min-w-20 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'claim' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'}`}
        >
          Klaim
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 min-w-20 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'}`}
        >
          Transaksi
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'scan' && (
          <motion.div
            key="scan-tab"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-stone-800">Riwayat Scan</h3>
              <div className="flex gap-1.5">
                <input
                  type="number" placeholder="DD" value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="text-[10px] w-10 py-1.5 bg-white border border-stone-200 rounded-lg text-center focus:ring-1 focus:ring-emerald-500 outline-none text-stone-700"
                />
                <input
                  type="number" placeholder="MM" value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="text-[10px] w-10 py-1.5 bg-white border border-stone-200 rounded-lg text-center focus:ring-1 focus:ring-emerald-500 outline-none text-stone-700"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredScanHistory.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[40px] border border-dashed border-stone-200">
                  <p className="text-stone-400 text-sm italic">Belum ada riwayat scan...</p>
                </div>
              ) : (
                filteredScanHistory.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    className="bg-white p-4 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-4 group"
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                      {item.image ? (
                        <img src={item.image} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400"><Trash2 size={24} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[9px] text-stone-500 font-medium">{item.date}</p>
                    </div>
                    <button
                      onClick={() => onDeleteHistory(item.id)}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'deposit' && (
          <motion.div
            key="deposit-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <h3 className="font-display font-bold text-stone-800 px-1">Riwayat Setor Sampah</h3>
            <div className="space-y-4">
              {(!userData.depositHistory || userData.depositHistory.length === 0) ? (
                  <div className="text-center py-16 bg-white rounded-[40px] border border-dashed border-stone-200">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
                      <Recycle size={32} />
                    </div>
                    <p className="text-stone-400 text-sm font-medium">Belum ada setoran sampah.</p>
                  </div>
                ) : (
                  userData.depositHistory.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${deposit.status === 'Pending' ? 'text-amber-600' : deposit.status === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {deposit.status === 'Pending' ? 'Pengajuan Menunggu' : deposit.status === 'Approved' ? 'Setoran Disetujui' : 'Setoran Ditolak'}
                          </p>
                          <h4 className="font-bold text-stone-800 text-sm">{deposit.date}</h4>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-display font-bold ${deposit.status === 'Approved' ? 'text-emerald-600' : deposit.status === 'Pending' ? 'text-amber-600' : 'text-red-600'}`}>
                            +{deposit.totalPoints} NP
                          </p>
                          <p className="text-[9px] text-stone-400 font-bold uppercase">{deposit.totalWeight.toFixed(1)} kg</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {deposit.items.map((item, idx) => (
                          <span key={idx} className="px-3 py-1 bg-stone-50 rounded-full text-[9px] font-bold text-stone-500 border border-stone-100">
                            {item.category}: {item.weight}kg
                          </span>
                        ))}
                      </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'claim' && (
          <motion.div
            key="claim-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <h3 className="font-display font-bold text-stone-800 px-1">Riwayat Hadiah</h3>
            <div className="space-y-4">
              {(!userData.claimHistory || userData.claimHistory.length === 0) ? (
                <div className="text-center py-16 bg-white rounded-[40px] border border-dashed border-stone-200">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
                    <Award size={32} />
                  </div>
                  <p className="text-stone-400 text-sm font-medium">Belum ada hadiah diklaim.</p>
                </div>
              ) : (
                userData.claimHistory.map((claim) => (
                  <div
                    key={claim.id}
                    className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      claim.status === 'Success' ? 'bg-emerald-50 text-emerald-500' :
                      claim.status === 'Rejected' ? 'bg-red-50 text-red-400' :
                      'bg-amber-50 text-amber-500'
                    }`}>
                      <Sparkles size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-stone-800 text-sm">{claim.title}</h4>
                      <p className="text-[9px] text-stone-500 font-medium mt-0.5">{claim.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${
                        claim.status === 'Success' ? 'text-stone-400 line-through' :
                        claim.status === 'Rejected' ? 'text-red-400 line-through' :
                        'text-amber-600'
                      }`}>
                        {claim.status === 'Pending' ? '-' : ''}{claim.points.toLocaleString()} NP
                      </p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full mt-1 inline-block ${
                        claim.status === 'Success' ? 'bg-emerald-50 text-emerald-600' :
                        claim.status === 'Rejected' ? 'bg-red-50 text-red-500' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {claim.status === 'Success' ? 'Diterima' : claim.status === 'Rejected' ? 'Ditolak' : 'Menunggu'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div
            key="transactions-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <h3 className="font-display font-bold text-stone-800 px-1">Riwayat Transaksi</h3>
            <div className="space-y-4">
              {userTransactions.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[40px] border border-dashed border-stone-200">
                  <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4 text-teal-300">
                    <Activity size={32} />
                  </div>
                  <p className="text-stone-400 text-sm font-medium">Belum ada transaksi.</p>
                </div>
              ) : (
                userTransactions.map((tx: any) => (
                  <div key={tx.id} className="bg-white p-5 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      tx.status === 'approved' ? 'bg-emerald-50 text-emerald-500' :
                      tx.status === 'pending' ? 'bg-amber-50 text-amber-500' :
                      tx.status === 'rejected' ? 'bg-red-50 text-red-400' :
                      'bg-stone-50 text-stone-400'
                    }`}>
                      <Activity size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-stone-800 text-sm">{tx.partnerName || 'Partner'}</h4>
                      <p className="text-[9px] text-stone-400 font-medium mt-0.5 capitalize">{tx.category || '-'} • {tx.totalWeight || tx.weight || 0} kg</p>
                      <p className="text-[9px] text-stone-400">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('id-ID') : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600">+{tx.totalPoints || 0} NP</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full mt-1 inline-block ${
                        tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        tx.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        tx.status === 'rejected' ? 'bg-red-50 text-red-500' :
                        'bg-stone-50 text-stone-500'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

type NavTab = {
  id: AppState | 'scan';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  isSpecial?: boolean;
};

const BottomNav = ({ active, onChange, onScan }: { active: AppState, onChange: (state: AppState) => void, onScan: () => void }) => {
  const tabs: NavTab[] = [
    { id: 'main', icon: Leaf, label: 'Home' },
    { id: 'map', icon: MapPin, label: 'Lokasi' },
    { id: 'scan', icon: Camera, label: 'Pindai', isSpecial: true },
    { id: 'daily_missions', icon: Award, label: 'Misi' },
    { id: 'user_dashboard', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-6 left-4 right-4 h-20 bg-stone-900/95 backdrop-blur-2xl rounded-4xl border border-white/10 shadow-2xl z-80 flex items-center justify-between px-2">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        if (tab.isSpecial) {
          return (
            <button
              key={tab.id}
              onClick={onScan}
              className="relative -top-10 flex flex-col items-center"
            >
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 border-4 border-stone-900 active:scale-90 transition-transform">
                <Camera size={28} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-2">Pindai</span>
            </button>
          );
        }
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id as AppState)}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 flex-1 ${isActive ? 'text-emerald-400' : 'text-stone-500 hover:text-stone-300'
              }`}
          >
            <motion.div
              animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
            >
              <tab.icon size={20} />
            </motion.div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-40'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute -bottom-1 w-1 h-1 bg-emerald-400 rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

// --- Components ---

const Mascot = ({ streak, name, onRename }: { streak: number, name?: string, onRename: () => void }) => {
  const getStage = () => {
    if (streak >= 60) return {
      icon: <Sparkles size={44} className="text-white" />,
      aura: true, face: "🌌", label: "Galactic Guardian",
      bgColor: "from-violet-600 via-purple-500 to-indigo-600",
      borderColor: "border-violet-300"
    };
    if (streak >= 30) return {
      icon: <Sparkles size={44} className="text-white" />,
      aura: true, face: "👑", label: "Supreme Phoenix",
      bgColor: "from-amber-400 via-orange-500 to-red-600",
      borderColor: "border-amber-300"
    };
    if (streak >= 21) return {
      icon: <Flame size={40} className="text-white" />,
      aura: true, face: "🔥", label: "Inferno Master",
      bgColor: "from-red-500 via-orange-500 to-yellow-400",
      borderColor: "border-orange-300"
    };
    if (streak >= 14) return {
      icon: <Flame size={40} className="text-white" />,
      aura: true, face: "🔥", label: "Flame Knight",
      bgColor: "from-orange-500 to-red-500",
      borderColor: "border-orange-200"
    };
    if (streak >= 7) return {
      icon: <Zap size={36} className="text-white" />,
      aura: false, face: "⚡", label: "Thunder Spark",
      bgColor: "from-yellow-400 to-orange-500",
      borderColor: "border-yellow-200"
    };
    if (streak >= 3) return {
      icon: <Zap size={36} className="text-white" />,
      aura: false, face: "✨", label: "Bright Spark",
      bgColor: "from-orange-400 to-orange-600",
      borderColor: "border-orange-100"
    };
    return {
      icon: <Sprout size={32} className="text-white" />,
      aura: false, face: "🌱", label: "Little Ember",
      bgColor: "from-orange-300 to-orange-500",
      borderColor: "border-stone-200"
    };
  };

  const stage = getStage();

  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative cursor-pointer" onClick={onRename}>
        <AnimatePresence>
          {stage.aura && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.5, 1],
                rotate: [0, 90, 180, 270, 360],
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className={`absolute -inset-8 bg-linear-to-tr ${stage.bgColor} rounded-full blur-3xl`}
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <div className={`w-20 h-20 rounded-4xl bg-linear-to-br ${stage.bgColor} shadow-2xl flex items-center justify-center border-4 ${stage.borderColor} overflow-hidden`}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {stage.icon}
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center text-xl pt-1 pointer-events-none opacity-30">
              {stage.face}
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.1, y: -2 }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-stone-900 border-2 border-white px-4 py-1.5 rounded-full shadow-xl z-20 flex items-center gap-2"
        >
          <span className="text-[10px] font-black text-white tracking-widest uppercase">{name || "NeuroFlame"}</span>
          <div className="w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
            <Plus size={8} className="text-white" />
          </div>
        </motion.div>
      </div>

      <div className="text-center pt-2">
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] leading-none mb-1">
          {stage.label}
        </p>
        <div className="flex items-center gap-1.5 justify-center bg-white px-3 py-1 rounded-full shadow-sm border border-stone-100">
          <motion.div
            animate={{ scale: streak >= 7 ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Zap size={12} className={streak >= 14 ? 'text-red-500 fill-red-500' : streak >= 7 ? 'text-orange-500 fill-orange-500' : 'text-amber-400 fill-amber-400'} />
          </motion.div>
          <span className="text-[9px] font-black text-orange-600 uppercase italic tracking-tighter">
            {streak} Day Streak
          </span>
        </div>
      </div>
    </div>
  );
};

const LevelTimeline = ({ currentScans, currentDeposits, totalDepositKg }: {
  currentScans: number;
  currentDeposits: number;
  totalDepositKg: number;
}) => {
  // Skor gabungan: scan + (deposit × 3) + (kg × 0.5)
  const score = currentScans + (currentDeposits * 3) + Math.floor(totalDepositKg * 0.5);

  const milestones = [
    { score: 0,    label: "Pemula",        icon: "🌱", color: "stone" },
    { score: 10,   label: "Penjelajah",    icon: "🌿", color: "emerald" },
    { score: 25,   label: "Pecinta Hijau", icon: "♻️", color: "green" },
    { score: 50,   label: "Pemilah Aktif", icon: "📦", color: "blue" },
    { score: 100,  label: "Penjaga Alam",  icon: "🌳", color: "teal" },
    { score: 200,  label: "Pahlawan Bumi", icon: "🌍", color: "cyan" },
    { score: 350,  label: "Eco Warrior",   icon: "🛡️", color: "indigo" },
    { score: 500,  label: "Green Master",  icon: "🏆", color: "violet" },
    { score: 750,  label: "Eco Legend",    icon: "👑", color: "purple" },
    { score: 1000, label: "NeuroHero",     icon: "🌟", color: "amber" },
  ];

  const currentMilestone = milestones.filter(m => score >= m.score).pop();
  const nextMilestone = milestones.find(m => score < m.score);
  const progress = nextMilestone
    ? ((score - (currentMilestone?.score || 0)) / (nextMilestone.score - (currentMilestone?.score || 0))) * 100
    : 100;

  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-stone-100 mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <Award size={18} />
          </div>
          <h3 className="text-lg font-display font-bold text-stone-800">Linimasa Level</h3>
        </div>
        <div className="px-3 py-1 bg-emerald-100 rounded-full text-[10px] font-bold text-emerald-700">
          Skor: {score} pts
        </div>
      </div>

      {/* Current level & progress */}
      <div className="mb-5 p-4 bg-stone-50 rounded-3xl border border-stone-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentMilestone?.icon}</span>
            <div>
              <p className="font-black text-stone-800 text-sm">{currentMilestone?.label}</p>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Level Saat Ini</p>
            </div>
          </div>
          {nextMilestone && (
            <div className="text-right">
              <p className="text-[10px] text-stone-400 font-bold">Menuju {nextMilestone.label}</p>
              <p className="text-xs font-black text-emerald-600">{nextMilestone.score - score} pts lagi</p>
            </div>
          )}
        </div>
        {nextMilestone && (
          <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
        )}
        <div className="flex justify-between mt-1">
          <p className="text-[9px] text-stone-400">Scan: {currentScans} · Setor: {currentDeposits}x · {totalDepositKg.toFixed(1)}kg</p>
          <p className="text-[9px] text-stone-400">{Math.round(progress)}%</p>
        </div>
      </div>

      {/* Milestone scroll */}
      <div className="relative overflow-x-auto pb-4 hide-scrollbar">
        <div className="flex gap-6 px-2 items-end min-w-max py-2">
          {milestones.map((m, idx) => {
            const isReached = score >= m.score;
            const isCurrent = m === currentMilestone;
            return (
              <div key={m.score} className="shrink-0 flex flex-col items-center gap-2 relative">
                {idx > 0 && (
                  <div className={`absolute right-full top-5 w-6 h-1 ${isReached ? 'bg-emerald-400' : 'bg-stone-100'}`} />
                )}
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 ${
                    isCurrent ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-300 ring-offset-2' :
                    isReached ? 'bg-emerald-100 text-white shadow-sm' :
                    'bg-stone-50 text-stone-300'
                  }`}>
                  {isReached ? m.icon : '?'}
                </motion.div>
                <div className="text-center">
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${
                    isCurrent ? 'text-emerald-600' : isReached ? 'text-stone-600' : 'text-stone-300'
                  }`}>{m.label}</p>
                  <p className="text-[8px] text-stone-400">{m.score} pts</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const generateInstitutionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const InstitutionSetupScreen = ({ onComplete, onSkip }: { onComplete: (institutionId: string) => void, onSkip: () => void }) => {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCreateInstitution = async () => {
    if (!institutionName.trim()) {
      alert('Nama institusi harus diisi!');
      return;
    }

    setLoading(true);
    try {
      const code = generateInstitutionCode();
      const instRef = await addDoc(collection(db, 'institutions'), {
        name: institutionName.trim(),
        code: code,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || ''
      });

      await updateDoc(doc(db, 'users', auth.currentUser?.uid || ''), {
        institutionId: instRef.id,
        role: 'user'
      });

      onComplete(instRef.id);
    } catch (e) {
      console.error('Gagal membuat institusi:', e);
      alert('Gagal membuat institusi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinInstitution = async () => {
    if (!institutionCode.trim()) {
      alert('Kode institusi harus diisi!');
      return;
    }

    setLoading(true);
    try {
      const instRef = collection(db, 'institutions');
      const q = query(instRef, where('code', '==', institutionCode.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Kode institusi tidak ditemukan!');
        setLoading(false);
        return;
      }

      const instDoc = snap.docs[0];
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || ''), {
        institutionId: instDoc.id,
        role: 'user'
      });

      onComplete(instDoc.id);
    } catch (e) {
      console.error('Gagal bergabung dengan institusi:', e);
      alert('Gagal bergabung dengan institusi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'select') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6"
      >
        <div className="w-full max-w-sm">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl mb-6 mx-auto">
            <Building2 size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-black text-center mb-3">Pilih Institusi</h1>
          <p className="text-stone-400 text-center text-sm mb-8">
            Bergabung dengan institusi untuk mendapatkan fitur lengkap NeuroCycle
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
            >
              Buat Institusi Baru
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-stone-800 text-white font-bold py-4 rounded-2xl hover:bg-stone-700 border border-stone-700 active:scale-95 transition-all"
            >
              Bergabung dengan Kode
            </button>
            <button
              onClick={onSkip}
              className="w-full text-stone-500 text-sm font-medium py-3 hover:text-stone-300 transition-colors"
            >
              Lewati untuk saat ini
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (mode === 'create') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
        className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6"
      >
        <div className="w-full max-w-sm">
          <button onClick={() => setMode('select')} className="mb-6 text-stone-400 hover:text-white flex items-center gap-2">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Kembali</span>
          </button>
          <h2 className="text-2xl font-display font-black mb-2">Buat Institusi Baru</h2>
          <p className="text-stone-400 text-sm mb-6">
            Buat institusi untuk mengelola partner dan transaksi
          </p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nama Institusi"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full bg-stone-800 text-white px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 border border-stone-700"
            />
            <button
              onClick={handleCreateInstitution}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Membuat...' : 'Buat Institusi'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-sm">
        <button onClick={() => setMode('select')} className="mb-6 text-stone-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Kembali</span>
        </button>
        <h2 className="text-2xl font-display font-black mb-2">Bergabung dengan Institusi</h2>
        <p className="text-stone-400 text-sm mb-6">
          Masukkan kode institusi yang diberikan oleh admin
        </p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Kode Institusi"
            value={institutionCode}
            onChange={(e) => setInstitutionCode(e.target.value.toUpperCase())}
            className="w-full bg-stone-800 text-white px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 border border-stone-700 uppercase tracking-widest text-center text-lg font-mono"
          />
          <button
            onClick={handleJoinInstitution}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Menggabungkan...' : 'Gabung'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const WelcomeScreen = ({ onStart }: { onStart: () => void }) => {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      icon: <Leaf size={100} />,
      title: "Selamat Datang di NeuroCycle",
      desc: "Langkah kecilmu hari ini adalah nafas baru bagi Bumi kita di masa depan.",
      color: "bg-emerald-600"
    },
    {
      icon: <Camera size={100} />,
      title: "AI Pemindai Cerdas",
      desc: "Cukup ambil foto, dan biarkan AI kami mengidentifikasi jenis serta komposisi sampahmu secara akurat.",
      color: "bg-blue-600"
    },
    {
      icon: <Award size={100} />,
      title: "Kumpulkan NeuroPoints",
      desc: "Dapatkan poin setiap kali kamu memilah sampah dengan benar dan tukarkan dengan hadiah menarik.",
      color: "bg-amber-600"
    }
  ];

  return (
    <motion.div
      key={slide}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${slides[slide].color} flex flex-col items-center justify-center text-white px-8 text-center z-50 transition-colors duration-700`}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 12 }}
        className="mb-12 p-8 bg-white/10 rounded-[40px] backdrop-blur-xl border border-white/20 shadow-2xl"
      >
        {slides[slide].icon}
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-display font-bold mb-4 tracking-tight leading-tight"
      >
        {slides[slide].title}
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-white/80 text-lg mb-16 max-w-xs leading-relaxed"
      >
        {slides[slide].desc}
      </motion.p>

      <div className="flex gap-2 mb-12">
        {slides.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-8 bg-white' : 'w-2 bg-white/30'}`} />
        ))}
      </div>

      <div className="flex gap-4 w-full max-w-xs">
        {slide < slides.length - 1 ? (
          <button
            onClick={() => setSlide(slide + 1)}
            className="flex-1 py-4 bg-white text-stone-900 rounded-2xl font-bold text-lg shadow-xl"
          >
            Lanjut
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex-1 py-4 bg-white text-emerald-700 rounded-2xl font-bold text-lg shadow-xl shadow-black/10"
          >
            Mulai Sekarang
          </button>
        )}
      </div>
    </motion.div>
  );
};

// --- UserQR with Partner Selection ---
const UserQRWithPartner = ({
  uid, qrToken, selectedPartner, onClose
}: {
  uid?: string;
  qrToken?: string;
  selectedPartner?: any;
  onClose: () => void;
}) => {
  const qrPayload = qrToken ? `user:${qrToken}` : 'no-token';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrPayload)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-stone-900/70 backdrop-blur-md flex items-center justify-center z-60 p-6"
    >
      <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 to-teal-400" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Setor ke Bank Sampah</p>
            <h3 className="font-display font-bold text-xl text-stone-900">
              {selectedPartner ? selectedPartner.name : 'QR Pengguna'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-100 rounded-xl text-stone-500 hover:bg-stone-200">
            <X size={18} />
          </button>
        </div>

        {/* Partner Info */}
        {selectedPartner && (
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mb-5 space-y-1">
            <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
              <MapPin size={13} className="text-emerald-600 shrink-0" />
              {selectedPartner.address || 'Alamat belum tersedia'}
            </div>
            <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
              <span className="text-emerald-600 shrink-0">📞</span>
              {selectedPartner.phone || 'Telp belum tersedia'}
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="flex flex-col items-center mb-5">
          <div className="bg-white p-3 rounded-3xl border-2 border-stone-100 shadow-sm mb-3">
            <img src={qrSrc} alt="QR" className="w-48 h-48" />
          </div>
        </div>

        {/* Instruction */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-5">
          <p className="text-xs font-bold text-amber-700 text-center leading-relaxed">
            Tunjukkan QR ini ke petugas Bank Sampah saat Anda datang menyetorkan sampah.
            Petugas akan memindai QR Anda dan mencatat setoran.
          </p>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center justify-center gap-2 text-stone-400">
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Clock size={14} />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-widest">Menunggu pemindaian...</p>
        </div>

        <button onClick={onClose}
          className="w-full mt-4 py-3.5 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-all active:scale-95">
          Tutup
        </button>
      </div>
    </motion.div>
  );
};

// --- Waste Bank Data & Components ---

interface WasteCategory {
  id: string;
  name: string;
  pointsPerKg: number;
  image: string;
}

const WASTE_CATEGORIES: WasteCategory[] = [
  { id: 'plastik', name: 'Plastik', pointsPerKg: 1000, image: '/images/categories/plastik.jpg' },
  { id: 'kertas', name: 'Kertas', pointsPerKg: 800, image: '/images/categories/kertas.jpg' },
  { id: 'logam', name: 'Logam', pointsPerKg: 1500, image: '/images/categories/logam.jpg' },
  { id: 'kaca', name: 'Kaca', pointsPerKg: 1200, image: '/images/categories/kaca.jpg' },
  { id: 'kardus', name: 'Kardus', pointsPerKg: 900, image: '/images/categories/kardus.jpg' },
  { id: 'residu', name: 'Residu', pointsPerKg: 500, image: '/images/categories/residu.jpg' },
];


const WasteBankList = ({
  onNext,
  onBack,
  selectedItems,
  onToggleItem,
  onUpdateWeight
}: {
  onNext: () => void;
  onBack: () => void;
  selectedItems: Record<string, number>;
  onToggleItem: (id: string) => void;
  onUpdateWeight: (id: string, weight: number) => void;
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white rounded-2xl text-stone-400 shadow-sm border border-stone-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold font-display text-emerald-900">Bank Sampah</h1>
      </header>

      <div className="flex-1 space-y-4 mb-24 overflow-y-auto">
        <div className="mb-6">
          <p className="text-stone-500 font-medium">Pilih jenis sampah yang ingin Anda setor:</p>
          <p className="text-xs text-stone-400 mt-2">Ketuk ikon centang untuk memilih sampah. Tombol 'Lanjutkan' akan aktif setelah setidaknya satu item dipilih.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {WASTE_CATEGORIES.map((category) => {
            const isSelected = selectedItems[category.id] !== undefined;
            return (
              <motion.div
                key={category.id}
                whileTap={{ scale: 0.98 }}
                className={`relative p-5 rounded-4xl border-2 transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-stone-100 shadow-sm'
                  }`}
              >
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-3xl overflow-hidden bg-stone-100 border border-stone-100">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${category.name}&background=random`;
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-stone-800">{category.name}</h3>
                    <p className="text-sm text-stone-400 font-bold uppercase tracking-widest">{category.pointsPerKg} Poin/kg</p>
                  </div>
                  <button
                    onClick={() => onToggleItem(category.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-stone-50 text-stone-300'}`}
                  >
                    <Check size={20} />
                  </button>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-5 pt-5 border-t border-emerald-100"
                  >
                    <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-emerald-100">
                      <span className="text-sm font-bold text-stone-500 uppercase tracking-widest">Berat (kg):</span>
                      <div className="flex items-center gap-5">
                        <button
                          onClick={() => onUpdateWeight(category.id, Math.max(0.1, (selectedItems[category.id] || 0) - 0.5))}
                          className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="text-xl font-display font-bold w-12 text-center text-emerald-700">
                          {(selectedItems[category.id] || 0).toFixed(1)}
                        </span>
                        <button
                          onClick={() => onUpdateWeight(category.id, (selectedItems[category.id] || 0) + 0.5)}
                          className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 text-right">
                      <span className="text-emerald-600 font-display font-bold text-lg">
                        Est. {((selectedItems[category.id] || 0) * category.pointsPerKg).toLocaleString()} Poin
                      </span>
                    </div>
          </motion.div>
        )}
               </motion.div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-stone-100 flex gap-4 z-50 max-w-md mx-auto">
        <button
          onClick={onBack}
          className="flex-1 py-4 px-6 rounded-2xl bg-stone-100 text-stone-600 font-bold hover:bg-stone-200 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={onNext}
          disabled={Object.keys(selectedItems).length === 0}
          className="flex-2 py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
        >
          Lanjutkan
        </button>
      </div>
    </div>
  );
};

const WasteBankCalculate = ({
  selectedItems,
  onNext,
  onCancel
}: {
  selectedItems: Record<string, number>;
  onNext: () => void;
  onCancel: () => void;
}) => {
  const totalPoints = WASTE_CATEGORIES.reduce((acc, cat) => {
    const weight = selectedItems[cat.id] || 0;
    return acc + (weight * cat.pointsPerKg);
  }, 0);

  const totalWeight = Object.values(selectedItems).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 p-6">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-display font-bold text-emerald-900 mb-2">Ringkasan Setoran</h1>
        <p className="text-stone-400 font-medium">Estimasi poin yang akan didapatkan</p>
      </header>

      <div className="flex-1 space-y-8 max-w-md mx-auto w-full">
        <div className="bg-emerald-600 rounded-[40px] p-8 text-center text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <p className="text-emerald-100 text-xs uppercase tracking-widest font-bold mb-3 opacity-80">Total Estimasi NeuroPoints</p>
          <div className="flex items-center justify-center gap-4">
            <Award className="text-white" size={40} />
            <span className="text-6xl font-display font-bold">{totalPoints.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest px-2">Rincian Per Kategori</h3>
          <div className="space-y-3">
            {WASTE_CATEGORIES.filter(cat => selectedItems[cat.id]).map(cat => (
              <div key={cat.id} className="bg-white border border-stone-100 rounded-[28px] p-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-stone-50 overflow-hidden border border-stone-100">
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800">{cat.name}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{selectedItems[cat.id]} kg × {cat.pointsPerKg}</p>
                  </div>
                </div>
                <div className="text-right pr-2">
                  <p className="font-display font-bold text-emerald-600 text-lg">{(selectedItems[cat.id] * cat.pointsPerKg).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-stone-200 flex justify-between items-center px-4">
            <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Total Berat</span>
            <span className="text-2xl font-display font-bold text-stone-800">{totalWeight.toFixed(1)} kg</span>
          </div>
        </div>

        <div className="bg-white rounded-4xl p-6 border border-stone-100 shadow-sm flex gap-5 items-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
            <MapPin size={24} />
          </div>
          <div>
            <p className="font-bold text-stone-800">Unit 01 (Pusat)</p>
            <p className="text-xs text-stone-400 font-medium">Bank Sampah Neuro - Lokasi Terdekat</p>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-4 max-w-md mx-auto w-full">
        <button
          onClick={onNext}
          className="w-full py-5 rounded-[28px] bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
        >
          Lanjutkan ke Navigasi
        </button>
        <button
          onClick={onCancel}
          className="w-full py-4 rounded-3xl bg-stone-100 text-stone-500 font-bold hover:bg-stone-200 transition-all"
        >
          Ubah Pilihan
        </button>
      </div>
    </div>
  );
};

const WasteBankVerify = ({
  onSuccess,
  onCancel,
  qrToken,
  selectedItems,
  userUid,
  userData
}: {
  onSuccess: (image: string, location: string) => void;
  onCancel: () => void;
  qrToken?: string;
  selectedItems?: Record<string, number>;
  userUid?: string;
  userData?: any;
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [partnerList, setPartnerList] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('manual');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const loadPartners = async () => {
      try {
        const q = query(collection(db, 'partners'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        setPartnerList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    loadPartners();
  }, []);

  const selectedPartner = partnerList.find(p => p.id === selectedPartnerId);

  const compressForFirestore = (base64: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = () => resolve(base64);
    });

  const [txCreated, setTxCreated] = useState(false);

  const handleSubmit = async () => {
    // Jika pilih partner terdaftar → tampilkan QR
    if (selectedPartnerId !== 'manual') {
      if (selectedItems && userUid && userData && !txCreated && qrToken) {
        setIsUploading(true);
        try {
          const itemsList = WASTE_CATEGORIES.filter(c => selectedItems[c.id]).map(c => ({
            category: c.id,
            name: c.name,
            weight: selectedItems[c.id],
            points: selectedItems[c.id] * c.pointsPerKg
          }));
          const totalWeight = itemsList.reduce((acc, curr) => acc + curr.weight, 0);
          
          const txRef = doc(collection(db, 'transactions'));
          await setDoc(txRef, {
            partnerUid: selectedPartner?.id || null,
            partnerId: selectedPartnerId,
            partnerName: selectedPartner?.name || '',
            institutionId: selectedPartner?.institutionId || null,
            userUid,
            userToken: qrToken,
            status: 'pending',
            createdAt: new Date().toISOString(),
            items: itemsList,
            totalWeight,
            // for backwards compatibility:
            category: itemsList[0]?.category || 'campuran',
            weight: totalWeight
          });

          // Also add to user's depositHistory as Pending
          const depositLog = {
            id: txRef.id,
            date: new Date().toLocaleString('id-ID'),
            items: itemsList.map(i => ({ category: i.name, weight: i.weight, points: i.points })),
            totalPoints: itemsList.reduce((acc, i) => acc + i.points, 0),
            totalWeight,
            status: 'Pending',
            image: '',
            location: selectedPartner?.name || 'Bank Sampah Partner',
            userEmail: userData.email || '',
            userUid
          };
          const updatedHistory = [depositLog, ...(userData.depositHistory || [])];
          await setDoc(doc(db, 'users', userUid), { depositHistory: updatedHistory }, { merge: true });
          setTxCreated(true);
        } catch (e) {
          console.error("Gagal membuat transaksi", e);
        } finally {
          setIsUploading(false);
        }
      }
      setShowQr(true);
      return;
    }
    // Jika manual → flow lama ke admin review
    if (!preview || !location.trim()) {
      alert('Harap lengkapi foto bukti dan lokasi TPA/TPU!');
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    try {
      const compressed = await compressForFirestore(preview);
      onSuccess(compressed, location.trim());
    } catch {
      onSuccess(preview || '', location.trim());
    }
  };

  // Modal QR untuk partner terdaftar
  if (showQr && selectedPartner) {
    const qrPayload = qrToken ? `user:${qrToken}` : 'no-token';
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrPayload)}`;
    return (
      <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 to-teal-400" />

          <div className="text-center mb-5">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Setor ke Bank Sampah</p>
            <h3 className="font-display font-bold text-xl text-stone-900 mt-1">{selectedPartner.name}</h3>
          </div>

          {/* Info partner */}
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mb-5 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
              <MapPin size={13} className="text-emerald-600 shrink-0" />
              {selectedPartner.address || 'Alamat belum tersedia'}
            </div>
            <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
              <span className="text-emerald-600 shrink-0">📞</span>
              {selectedPartner.phone || 'Telp belum tersedia'}
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center mb-5">
            <div className="bg-white p-3 rounded-3xl border-2 border-stone-100 shadow-sm mb-3">
              <img src={qrSrc} alt="QR" className="w-48 h-48" />
            </div>
          </div>

          {/* Instruksi */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-5">
            <p className="text-xs font-bold text-amber-700 text-center leading-relaxed">
              Tunjukkan QR ini ke petugas Bank Sampah saat Anda datang menyetorkan sampah.
              Petugas akan memindai QR Anda dan mencatat setoran.
            </p>
          </div>

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 text-stone-400 mb-4">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Clock size={14} />
            </motion.div>
            <p className="text-[10px] font-black uppercase tracking-widest">Menunggu pemindaian...</p>
          </div>

          <button
            onClick={() => { setShowQr(false); onCancel(); }}
            className="w-full py-3.5 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-all active:scale-95"
          >
            Tutup
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900">
      <div className="flex-1 overflow-y-auto p-6">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold text-emerald-900 mb-2">Verifikasi Akhir</h1>
          <p className="text-stone-400 font-medium text-sm">Pilih bank sampah atau upload bukti setoran</p>
        </header>

        <div className="flex flex-col gap-5 max-w-md mx-auto w-full">

          {/* Pilih Bank Sampah Terdaftar */}
          <div className="bg-white p-6 rounded-4xl border border-stone-100 shadow-sm">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Recycle size={12} className="text-emerald-600" /> Pilih Bank Sampah Terdaftar
            </h4>
            <select
              value={selectedPartnerId}
              onChange={e => setSelectedPartnerId(e.target.value)}
              className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="manual">✏️ Input manual (review admin)</option>
              {partnerList.map(p => (
                <option key={p.id} value={p.id}>🏢 {p.name}</option>
              ))}
            </select>

            {/* Info partner yang dipilih */}
            {selectedPartnerId !== 'manual' && selectedPartner && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                <div className="flex items-center gap-2 text-stone-600 text-xs">
                  <MapPin size={12} className="text-emerald-600 shrink-0" />
                  {selectedPartner.address || '-'}
                </div>
                <div className="flex items-center gap-2 text-stone-600 text-xs">
                  <span className="text-emerald-600">📞</span>
                  {selectedPartner.phone || '-'}
                </div>
                <div className="mt-2 p-2 bg-emerald-100 rounded-xl">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">✅ Bank Sampah Terverifikasi</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Klik "Ajukan" untuk tampilkan QR Code Anda</p>
                </div>
              </div>
            )}
          </div>

          {/* Form manual — hanya tampil jika pilih manual */}
          {selectedPartnerId === 'manual' && (
            <>
              <div className="w-full max-w-xs aspect-square rounded-[48px] border-4 border-dashed border-stone-200 flex flex-col items-center justify-center relative overflow-hidden bg-white group hover:border-emerald-300 transition-all shadow-inner mx-auto">
                {preview ? (
                  <div className="relative w-full h-full">
                    <img src={preview} alt="Bukti" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPreview(null)}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Camera className="text-emerald-600" size={40} />
                    </div>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-10 text-center leading-relaxed">Ketuk untuk foto bukti setoran</p>
                    <input
                      type="file" accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </>
                )}
              </div>

              <div className="bg-white p-6 rounded-4xl border border-stone-100 shadow-sm">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Lokasi TPA/TPU (Manual)</h4>
                <div className="flex items-center gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-100 focus-within:border-emerald-500 transition-colors">
                  <MapPin size={20} className="text-stone-400" />
                  <input
                    type="text"
                    placeholder="cth: TPA Benowo, Surabaya"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-transparent border-none outline-none w-full font-bold text-stone-700 placeholder:text-stone-300"
                  />
                </div>
              </div>

              <div className="p-5 bg-amber-50 rounded-4xl border border-amber-100 flex items-start gap-3">
                <div className="p-2 bg-white rounded-xl text-amber-600">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Input Manual → Review Admin</p>
                  <p className="text-[10px] font-medium text-amber-800 leading-relaxed">Setoran akan diverifikasi manual oleh Admin. Poin diberikan setelah Admin menyetujui.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-6 bg-white border-t border-stone-100 flex flex-col gap-3">
        <button
          type="button"
          disabled={isUploading || (selectedPartnerId === 'manual' && (!preview || !location.trim()))}
          onClick={handleSubmit}
          className="w-full py-5 rounded-[28px] bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isUploading ? (
            <><Loader2 className="animate-spin" size={24} /><span>Mengirim...</span></>
          ) : selectedPartnerId !== 'manual' ? (
            <><CheckCircle size={24} /><span>Ajukan Verifikasi</span></>
          ) : (
            <><CheckCircle size={24} /><span>Ajukan ke Admin</span></>
          )}
        </button>
        <button type="button" onClick={onCancel}
          className="w-full py-4 text-stone-400 font-bold text-sm uppercase tracking-widest">
          Kembali
        </button>
      </div>
    </div>
  );
};

const NotificationModal = ({
  notifications,
  onClose,
  onMarkAsRead
}: {
  notifications: NotificationItem[],
  onClose: () => void,
  onMarkAsRead: (id: string) => void
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-stone-50 z-120 overflow-y-auto"
    >
      <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col">
        <header className="flex items-center justify-between mb-8 sticky top-0 bg-stone-50/80 backdrop-blur-md py-4 z-10">
          <button
            onClick={onClose}
            className="p-3 bg-white rounded-2xl text-stone-400 shadow-sm border border-stone-100 active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-display font-bold text-stone-800">Notifikasi</h2>
          <div className="w-10" />
        </header>

        <div className="flex-1 space-y-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <Bell size={64} className="mb-4" />
              <p className="font-bold text-sm uppercase tracking-widest">Belum ada notifikasi</p>
            </div>
          ) : (
            notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                onClick={() => onMarkAsRead(n.id)}
                className={`p-5 rounded-4xl border transition-all cursor-pointer ${n.isRead ? 'bg-white border-stone-100' : 'bg-emerald-50 border-emerald-100 shadow-md shadow-emerald-100/50'
                  }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                    n.type === 'warning' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                    {n.type === 'success' ? <CheckCircle size={24} /> : n.type === 'warning' ? <AlertTriangle size={24} /> : <Info size={24} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-stone-800 text-sm leading-tight">{n.title}</h4>
                      {!n.isRead && <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />}
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed mb-2">{n.message}</p>
                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{n.date}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

const LoginScreen = ({ onGoogleLogin, onAdminLogin, onSuperAdminLogin, onInstAdminLogin, onInstAdminRegister, onPartnerLogin }: { onGoogleLogin: () => void, onAdminLogin: (u: string, p: string) => void, onSuperAdminLogin: (email: string, password: string) => void, onInstAdminLogin: (email: string, password: string) => void, onInstAdminRegister: (email: string, password: string, name: string, type: string, address: string, phone: string) => Promise<boolean>, onPartnerLogin: (email: string, password: string) => void }) => {
  // ── State untuk setiap form ──
  const [openForm, setOpenForm] = useState<'none' | 'partner' | 'admin' | 'super_admin' | 'inst_admin'>('none');
  const [instMode, setInstMode] = useState<'login' | 'register'>('login');

  // Partner
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPassword, setPartnerPassword] = useState('');

  // Admin
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Super Admin
  const [superEmail, setSuperEmail] = useState('');
  const [superPassword, setSuperPassword] = useState('');

  // Institution Admin
  const [instEmail, setInstEmail] = useState('');
  const [instPassword, setInstPassword] = useState('');
  const [instName, setInstName] = useState('');
  const [instType, setInstType] = useState('school');
  const [instAddress, setInstAddress] = useState('');
  const [instPhone, setInstPhone] = useState('');

  // Shared
  const [showPassword, setShowPassword] = useState(false);

  // Partner self-submit & set-password
  const [showPartnerSelfSubmit, setShowPartnerSelfSubmit] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [setPasswordEmail, setSetPasswordEmail] = useState('');
  const [setPasswordValue, setSetPasswordValue] = useState('');
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('');

  // Forgot password & register success
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegisterSuccess, setShowRegisterSuccess] = useState(false);
  const [registeredInstName, setRegisteredInstName] = useState('');

  const inputClass = 'w-full bg-stone-800/60 text-white px-5 py-4 rounded-2xl outline-none focus:ring-2 border border-stone-700 placeholder:text-stone-500 transition-all';

  const toggleForm = (form: typeof openForm) => {
    setOpenForm(prev => prev === form ? 'none' : form);
    setShowPassword(false);
  };

  const handleSetPassword = async () => {
    if (!setPasswordEmail.trim() || !setPasswordValue || !setPasswordConfirm) {
      alert('Semua field harus diisi!'); return;
    }
    if (setPasswordValue !== setPasswordConfirm) {
      alert('Password dan konfirmasi password tidak cocok!'); return;
    }
    if (setPasswordValue.length < 6) {
      alert('Password minimal 6 karakter!'); return;
    }
    try {
      const q = query(collection(db, 'partners'), where('email', '==', setPasswordEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { alert('Akun partner tidak ditemukan!'); return; }
      const partnerDoc = snap.docs[0];
      if (partnerDoc.data().password) {
        alert('Akun ini sudah memiliki password. Silakan login langsung.'); setShowSetPasswordModal(false); return;
      }
      await updateDoc(doc(db, 'partners', partnerDoc.id), { password: setPasswordValue });
      alert('Password berhasil diatur! Silakan login.');
      setShowSetPasswordModal(false); setSetPasswordEmail(''); setSetPasswordValue(''); setSetPasswordConfirm('');
    } catch (e) { alert('Gagal mengatur password.'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 w-full h-full bg-stone-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center py-8">
        {/* Logo */}
        <div className="w-20 h-20 bg-linear-to-tr from-emerald-400 to-emerald-600 rounded-4xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-6">
          <Recycle size={40} className="text-white" />
        </div>

        <h1 className="text-4xl font-display font-black text-center mb-3 text-emerald-50">NeuroCycle</h1>
        <p className="text-stone-400 text-center mb-8 text-sm leading-relaxed px-4">
          Silakan masuk untuk melanjutkan ke layanan pengelolaan sampah cerdas.
        </p>

        {/* ── TOMBOL LOGIN DENGAN GOOGLE (USER) ── */}
        <button
          onClick={onGoogleLogin}
          className="w-full bg-white text-stone-900 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/20 mb-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Lanjutkan dengan Google
        </button>

        <div className="w-full flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-stone-700/60" />
          <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">atau login sebagai</span>
          <div className="flex-1 h-px bg-stone-700/60" />
        </div>

        <div className="w-full space-y-2">
          {/* ── PARTNER ── */}
          <div className="w-full">
            <button
              onClick={() => toggleForm('partner')}
              className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-[0.98] ${
                openForm === 'partner'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30'
                  : 'bg-stone-800/70 text-stone-300 border border-stone-700 hover:border-teal-600/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Login sebagai Partner</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openForm === 'partner' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <AnimatePresence>
              {openForm === 'partner' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <input
                      type="email"
                      placeholder="Partner Email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onPartnerLogin(partnerEmail, partnerPassword)}
                      className={`${inputClass} focus:ring-teal-500`}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Partner Password"
                        value={partnerPassword}
                        onChange={(e) => setPartnerPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onPartnerLogin(partnerEmail, partnerPassword)}
                        className={`${inputClass} focus:ring-teal-500 pr-12`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      onClick={() => onPartnerLogin(partnerEmail, partnerPassword)}
                      className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl hover:bg-teal-700 shadow-lg shadow-teal-900/20 active:scale-95 transition-all"
                    >
                      Masuk sebagai Partner
                    </button>
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => setShowPartnerSelfSubmit(true)} className="text-teal-400 text-xs font-bold uppercase tracking-widest hover:text-teal-300 transition-colors">
                        Daftar Partner Baru
                      </button>
                      <button onClick={() => setShowSetPasswordModal(true)} className="text-stone-500 text-xs font-bold uppercase tracking-widest hover:text-stone-300 transition-colors">
                        Atur Password
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── ADMIN ── */}
          <div className="w-full">
            <button
              onClick={() => toggleForm('admin')}
              className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-[0.98] ${
                openForm === 'admin'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'bg-stone-800/70 text-stone-300 border border-stone-700 hover:border-emerald-600/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={18} />
                <span>Login sebagai Admin</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openForm === 'admin' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <AnimatePresence>
              {openForm === 'admin' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <input
                      type="text"
                      placeholder="Admin Username"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onAdminLogin(adminUsername, adminPassword)}
                      className={`${inputClass} focus:ring-emerald-500`}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Admin Password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onAdminLogin(adminUsername, adminPassword)}
                        className={`${inputClass} focus:ring-emerald-500 pr-12`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      onClick={() => onAdminLogin(adminUsername, adminPassword)}
                      className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                    >
                      Masuk sebagai Admin
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── SUPER ADMIN ── */}
          <div className="w-full">
            <button
              onClick={() => toggleForm('super_admin')}
              className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-[0.98] ${
                openForm === 'super_admin'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                  : 'bg-stone-800/70 text-stone-300 border border-stone-700 hover:border-amber-600/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Award size={18} />
                <span>Login sebagai Super Admin</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openForm === 'super_admin' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <AnimatePresence>
              {openForm === 'super_admin' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <input
                      type="email"
                      placeholder="Super Admin Email"
                      value={superEmail}
                      onChange={(e) => setSuperEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSuperAdminLogin(superEmail, superPassword)}
                      className={`${inputClass} focus:ring-amber-500`}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Super Admin Password"
                        value={superPassword}
                        onChange={(e) => setSuperPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSuperAdminLogin(superEmail, superPassword)}
                        className={`${inputClass} focus:ring-amber-500 pr-12`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      onClick={() => onSuperAdminLogin(superEmail, superPassword)}
                      className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl hover:bg-amber-700 shadow-lg shadow-amber-900/20 active:scale-95 transition-all"
                    >
                      Masuk sebagai Super Admin
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── INSTITUTION ADMIN ── */}
          <div className="w-full">
            <button
              onClick={() => toggleForm('inst_admin')}
              className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-[0.98] ${
                openForm === 'inst_admin'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-stone-800/70 text-stone-300 border border-stone-700 hover:border-blue-600/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 size={18} />
                <span>Login sebagai Institution Admin</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openForm === 'inst_admin' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <AnimatePresence>
              {openForm === 'inst_admin' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    {/* Login / Daftar toggle */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setInstMode('login')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          instMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'bg-stone-800 text-stone-500 hover:text-stone-300 border border-stone-700'
                        }`}
                      >Login</button>
                      <button
                        onClick={() => setInstMode('register')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          instMode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'bg-stone-800 text-stone-500 hover:text-stone-300 border border-stone-700'
                        }`}
                      >Daftar</button>
                    </div>

                    {instMode === 'login' ? (
                      <div className="space-y-3">
                        <input
                          type="email"
                          placeholder="Institution Admin Email"
                          value={instEmail}
                          onChange={(e) => setInstEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && onInstAdminLogin(instEmail, instPassword)}
                          className={`${inputClass} focus:ring-blue-500`}
                        />
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Institution Admin Password"
                            value={instPassword}
                            onChange={(e) => setInstPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onInstAdminLogin(instEmail, instPassword)}
                            className={`${inputClass} focus:ring-blue-500 pr-12`}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <button
                          onClick={() => onInstAdminLogin(instEmail, instPassword)}
                          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                        >
                          Masuk sebagai Institution Admin
                        </button>
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="w-full py-2 text-stone-500 text-xs font-bold uppercase tracking-widest hover:text-stone-300 transition-colors">
                          Lupa Password?
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Nama Institusi *</label>
                          <input type="text" placeholder="contoh: SDN Sukamaju" value={instName} onChange={(e) => setInstName(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Tipe Institusi *</label>
                          <select value={instType} onChange={(e) => setInstType(e.target.value)} className={`${inputClass} focus:ring-blue-500`}>
                            <option value="school">Sekolah</option>
                            <option value="company">Perusahaan</option>
                            <option value="government">Instansi Pemerintah</option>
                            <option value="community">Komunitas</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Email Institusi *</label>
                          <input type="email" placeholder="admin@institusi.com" value={instEmail} onChange={(e) => setInstEmail(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">No. Telepon</label>
                          <input type="text" placeholder="08123456789" value={instPhone} onChange={(e) => setInstPhone(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Alamat Institusi *</label>
                          <textarea placeholder="Alamat lengkap institusi" value={instAddress} onChange={(e) => setInstAddress(e.target.value)} rows={3} className={`${inputClass} focus:ring-blue-500 resize-none`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Password Login *</label>
                          <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} placeholder="Buat password untuk login" value={instPassword} onChange={(e) => setInstPassword(e.target.value)} className={`${inputClass} focus:ring-blue-500 pr-12`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
                          <p className="text-[10px] text-amber-400 leading-relaxed">⚠️ Data Anda akan diverifikasi Super Admin. Setelah disetujui, Anda dapat login.</p>
                        </div>
                        <button
                          onClick={async () => {
                            const success = await onInstAdminRegister(instEmail, instPassword, instName, instType, instAddress, instPhone);
                            if (success) {
                              setRegisteredInstName(instName);
                              setInstEmail(''); setInstPassword(''); setInstName(''); setInstType('school'); setInstAddress(''); setInstPhone('');
                              setInstMode('login');
                              setShowRegisterSuccess(true);
                            }
                          }}
                          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                        >
                          Daftar sebagai Institution Admin
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── MODALS ── */}

        {/* Forgot Password */}
        <AnimatePresence>
          {showForgotPassword && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-6"
              onClick={() => setShowForgotPassword(false)}
            >
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-black text-stone-900">Lupa Password?</h3>
                  <button onClick={() => setShowForgotPassword(false)} className="p-2 hover:bg-stone-100 rounded-xl"><X size={20} className="text-stone-600" /></button>
                </div>
                <p className="text-xs text-stone-500 mb-4">Hubungi Super Admin untuk mereset password Institution Admin Anda.</p>
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mb-4">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Email Super Admin</p>
                  <p className="text-sm font-bold text-stone-800">superadmin@neurocycle.id</p>
                </div>
                <button onClick={() => setShowForgotPassword(false)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 transition-all">Mengerti</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partner Self-Submit */}
        <AnimatePresence>
          {showPartnerSelfSubmit && (
            <PartnerSelfSubmit
              onClose={() => setShowPartnerSelfSubmit(false)}
              onSuccess={() => setShowPartnerSelfSubmit(false)}
            />
          )}
        </AnimatePresence>

        {/* Register Success */}
        <AnimatePresence>
          {showRegisterSuccess && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-70 flex items-center justify-center p-6"
            >
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl text-center"
              >
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-black text-stone-900 mb-2">Pendaftaran Berhasil!</h3>
                <p className="text-stone-500 text-sm mb-5 leading-relaxed">
                  Data institusi <span className="font-bold text-stone-800">"{registeredInstName}"</span> telah diterima sistem.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left mb-5 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⏳</span>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">Mohon tunggu persetujuan <strong>Super Admin</strong>. Biasanya 1×24 jam kerja.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">📧</span>
                    <p className="text-xs text-blue-800 font-medium leading-relaxed">Setelah disetujui, login menggunakan email & password yang didaftarkan.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">🔔</span>
                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">Notifikasi dikirim ketika status pendaftaran diperbarui.</p>
                  </div>
                </div>
                <button onClick={() => setShowRegisterSuccess(false)} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl hover:bg-blue-700 transition-all active:scale-95">
                  Mengerti, Saya Akan Menunggu
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Set Password (Partner Lama) */}
        <AnimatePresence>
          {showSetPasswordModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-6"
              onClick={() => setShowSetPasswordModal(false)}
            >
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-black text-stone-900">Atur Password Partner</h3>
                  <button onClick={() => setShowSetPasswordModal(false)} className="p-2 hover:bg-stone-100 rounded-xl"><X size={20} className="text-stone-600" /></button>
                </div>
                <p className="text-xs text-stone-500 mb-4">Untuk partner lama yang belum memiliki password.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-stone-700 mb-1.5 block">Email Partner</label>
                    <input type="email" placeholder="contoh: partner@mail.com" value={setPasswordEmail} onChange={(e) => setSetPasswordEmail(e.target.value)} className="w-full bg-white px-4 py-3.5 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm text-stone-900 placeholder:text-stone-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-700 mb-1.5 block">Password Baru</label>
                    <input type="password" placeholder="Minimal 6 karakter" value={setPasswordValue} onChange={(e) => setSetPasswordValue(e.target.value)} className="w-full bg-white px-4 py-3.5 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm text-stone-900 placeholder:text-stone-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-700 mb-1.5 block">Konfirmasi Password</label>
                    <input type="password" placeholder="Ulangi password baru" value={setPasswordConfirm} onChange={(e) => setSetPasswordConfirm(e.target.value)} className="w-full bg-white px-4 py-3.5 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm text-stone-900 placeholder:text-stone-400" />
                  </div>
                  <button onClick={handleSetPassword} className="w-full py-3.5 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-all mt-2">Simpan Password</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
};

const AdminDashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'claims' | 'activity' | 'partner_activity' | 'missions' | 'articles' | 'mission_activity' | 'partners' | 'flagged_txs' | 'rewards' | 'error_logs' | 'institutions'>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionForm, setMissionForm] = useState<{
    title: string; description: string; type: string;
    target: number; rewardPoints: number; launchAt: string; expiresAt: string;
    minReadMinutes: number;
  }>({
    title: '', description: '', type: 'scan',
    target: 1, rewardPoints: 100,
    launchAt: new Date().toISOString().slice(0, 16),
    expiresAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    minReadMinutes: 2,
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    {
      id: 'q_' + Math.random().toString(36).substr(2, 9),
      question: '',
      options: { a: '', b: '', c: '', d: '' },
      correctAnswer: 'a',
      points: 10
    } as any
  ]);
  const [quizTimeLimit, setQuizTimeLimit] = useState<number>(300);
  const [savingMission, setSavingMission] = useState(false);
  const [allMissionProgress, setAllMissionProgress] = useState<any[]>([]);
  const [selectedProof, setSelectedProof] = useState<{ image: string; user: string; mission: string } | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<{ image: string; user: string; title: string; date?: string } | null>(null);
  const [firestoreArticles, setFirestoreArticles] = useState<any[]>([]);
  const [articleForm, setArticleForm] = useState({
    title: '', excerpt: '', author: '', readTime: '3 min',
    icon: 'Recycle', color: 'emerald', isPublished: true, pdfUrl: '',
  });
  const [articleThumbFile, setArticleThumbFile] = useState<File | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorLogFilter, setErrorLogFilter] = useState<'all' | 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO'>('all');
  const [errorLogStatus, setErrorLogStatus] = useState<'all' | 'unresolved' | 'acknowledged' | 'fixed'>('all');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ uid: string; name: string; email: string; role: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');

  useEffect(() => {
    import('./services/missionService').then(({ getMissions }) => {
      const unsub = getMissions((m: any[]) => setMissions(m));
      return unsub;
    });
  }, []);

  useEffect(() => {
    import('./services/missionService').then(({ getAllMissionProgress }) => {
      const unsub = getAllMissionProgress((p: any[]) => setAllMissionProgress(p));
      return unsub;
    });
  }, []);

  useEffect(() => {
    import('./services/missionService').then(({ getAllArticles }) => {
      const unsub = getAllArticles((a: any[]) => setFirestoreArticles(a));
      return unsub;
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data() as Partial<UserData>;
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          points: data.points || 0,
          scans: data.scans || 0,
          level: data.level || 'Pemula',
          streak: data.streak || 0,
          lastLogin: data.lastLogin || '',
          mascotName: data.mascotName || 'NeuroFlame',
          isBanned: data.isBanned || false,
          history: data.history || [],
          scanHistory: data.scanHistory || [],
          claimHistory: data.claimHistory || [],
          depositHistory: data.depositHistory || [],
          notifications: data.notifications || []
        } as UserData;
      });
      setUsers(usersList);
      setLoading(false);
    }, (err: any) => {
      console.error("Admin real-time sync error:", err);
      setError(err?.code === 'permission-denied'
        ? 'Akses ditolak Firestore. Buka Firebase Console → Firestore → Rules, lalu ubah rules menjadi allow read, write: if true; untuk development.'
        : `Gagal memuat data: ${err?.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'partners'), (snap) => {
      setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminReviews'), (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'institutions'), (snap) => {
      setInstitutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'errorLogs'), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setErrorLogs(logs);
    });
    return () => unsub();
  }, []);

  const handleUpdateErrorLogStatus = async (logId: string, status: string) => {
    try {
      const logRef = doc(db, 'errorLogs', logId);
      await updateDoc(logRef, { status, resolved: status === 'fixed' });
      setErrorLogs(prev => prev.map(l => l.id === logId ? { ...l, status, resolved: status === 'fixed' } : l));
    } catch (e: any) {
      console.error('Failed to update error log status:', e);
      alert('Gagal memperbarui status error log.');
    }
  };

  const filteredErrorLogs = useMemo(() => {
    return errorLogs.filter((log: any) => {
      const severityMatch = errorLogFilter === 'all' || log.severity === errorLogFilter;
      const statusMatch = errorLogStatus === 'all' || log.status === errorLogStatus;
      return severityMatch && statusMatch;
    });
  }, [errorLogs, errorLogFilter, errorLogStatus]);

  const errorLogStats = useMemo(() => {
    const stats = { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0, total: errorLogs.length, unresolved: 0 };
    errorLogs.forEach((log: any) => {
      if (stats[log.severity as keyof typeof stats] !== undefined) stats[log.severity as keyof typeof stats]++;
      if (!log.resolved && log.status !== 'fixed') stats.unresolved++;
    });
    return stats;
  }, [errorLogs]);

  const handleAction = async (userUid: string, type: 'ban' | 'unban' | 'approve_deposit' | 'reject_deposit' | 'approve_claim' | 'reject_claim', itemId?: string) => {
    try {
      const userRef = doc(db, 'users', userUid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      
      const targetUser = userSnap.data() as UserData;

      let updatedData: Partial<UserData> = {};
      const newNotifications = [...(targetUser.notifications || [])];
      const timestamp = new Date().toLocaleString('id-ID');

      if (type === 'ban') updatedData.isBanned = true;
      if (type === 'unban') updatedData.isBanned = false;

      if (type === 'approve_deposit' || type === 'reject_deposit') {
        const newHistory = targetUser.depositHistory.map(item => {
          if (item.id === itemId) {
            const status: 'Approved' | 'Rejected' = type === 'approve_deposit' ? 'Approved' : 'Rejected';
            if (status === 'Approved') {
              updatedData.points = (targetUser.points || 0) + item.totalPoints;
              newNotifications.unshift({
                id: Math.random().toString(36).substr(2, 9),
                title: 'Setoran Disetujui! 🎉',
                message: `Setoran sampah Anda telah diverifikasi. Selamat, Anda mendapatkan ${item.totalPoints} NeuroPoints!`,
                date: timestamp,
                type: 'success',
                isRead: false,
                depositId: item.id
              });
            } else {
              newNotifications.unshift({
                id: Math.random().toString(36).substr(2, 9),
                title: 'Setoran Ditolak ⚠️',
                message: `Maaf, setoran sampah Anda tidak dapat diverifikasi oleh Admin. Silakan periksa kembali bukti yang dikirimkan.`,
                date: timestamp,
                type: 'warning',
                isRead: false
              });
            }
            return { ...item, status };
          }
          return item;
        });
        updatedData.depositHistory = newHistory;
      }

      if (type === 'approve_claim' || type === 'reject_claim') {
        const newHistory = targetUser.claimHistory.map(item => {
          if (item.id === itemId) {
            const status: 'Success' | 'Rejected' = type === 'approve_claim' ? 'Success' : 'Rejected';
            if (status === 'Success') {
              newNotifications.unshift({
                id: Math.random().toString(36).substr(2, 9),
                title: 'Klaim Hadiah Berhasil! 🎁',
                message: `Klaim untuk "${item.title}" telah disetujui. Silakan cek DM Instagram untuk instruksi pengambilan.`,
                date: timestamp,
                type: 'success',
                isRead: false
              });
            } else {
              newNotifications.unshift({
                id: Math.random().toString(36).substr(2, 9),
                title: 'Klaim Hadiah Ditolak',
                message: `Klaim untuk "${item.title}" ditolak oleh Admin. Poin Anda telah dikembalikan (simulasi).`,
                date: timestamp,
                type: 'warning',
                isRead: false
              });
              // Return points logic could be added here if needed
            }
            return { ...item, status };
          }
          return item;
        });
        updatedData.claimHistory = newHistory;
      }

      updatedData.notifications = newNotifications;

      const seen = new Set<string>();
      const deduped = newNotifications.filter(n => {
        const key = `${n.title}|${n.message}|${n.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      updatedData.notifications = deduped;

      await updateDoc(userRef, updatedData);

      // Update local state (Admin side)
      setUsers(prev => prev.map(u => u.uid === userUid ? { ...u, ...updatedData } : u));
    } catch (error: any) {
      await logError({
        severity: 'ERROR',
        type: 'admin_action_failed',
        message: error?.message || 'Gagal melakukan aksi admin',
        context: 'admin_dashboard',
        functionName: 'handleAction',
        stack: error instanceof Error ? error.stack : undefined,
        metadata: { userUid, actionType: type, itemId }
      });
      alert("Gagal melakukan aksi.");
    }
  };

  const handleOpenResetPassword = (u: any) => {
    setResetPasswordTarget({ uid: u.uid, name: u.displayName || u.email || 'User', email: u.email || '', role: u.role || '' });
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      alert('Password minimal 6 karakter!');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      alert('Password dan konfirmasi tidak cocok!');
      return;
    }
    try {
      const userRef = doc(db, 'users', resetPasswordTarget.uid);
      await updateDoc(userRef, { password: newPasswordInput });
      alert(`Password untuk ${resetPasswordTarget.name} berhasil direset!`);
      setShowResetPasswordModal(false);
      setResetPasswordTarget(null);
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
    } catch (e) {
      console.error('Gagal reset password:', e);
      alert('Gagal mereset password.');
    }
  };

  const handleApprovePartner = async (partnerId: string, ownerUid: string, name: string) => {
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'approved' });
      
      if (ownerUid) {
        const userRef = doc(db, 'users', ownerUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data() as UserData;
          const notifs = [...(uData.notifications || [])];
          notifs.unshift({
            id: Math.random().toString(36).substr(2, 9),
            title: 'Pendaftaran Partner Disetujui! 🏢',
            message: `Selamat, pendaftaran Bank Sampah / TPA Anda (${name}) telah disetujui oleh Admin. Role Anda telah dirubah menjadi Partner. Silahkan masuk ke Dashboard Partner.`,
            date: new Date().toLocaleString('id-ID'),
            type: 'success',
            isRead: false
          });
          await updateDoc(userRef, { role: 'partner', notifications: notifs });
        }
      }
      alert('Partner berhasil disetujui!');
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'approve_partner_failed',
        message: e?.message || 'Gagal menyetujui pendaftaran partner',
        context: 'partner_management',
        functionName: 'handleApprovePartner',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { partnerId, ownerUid, name }
      });
      alert('Gagal menyetujui partner: ' + e.message);
    }
  };

  const handleRejectPartner = async (partnerId: string, ownerUid: string, name: string) => {
    const reason = prompt('Masukkan alasan penolakan pendaftaran partner:') || 'Dokumen tidak lengkap/tidak sesuai kriteria.';
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'rejected', rejectionReason: reason });
      
      if (ownerUid) {
        const userRef = doc(db, 'users', ownerUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data() as UserData;
          const notifs = [...(uData.notifications || [])];
          notifs.unshift({
            id: Math.random().toString(36).substr(2, 9),
            title: 'Pendaftaran Partner Ditolak ⚠️',
            message: `Maaf, pendaftaran Bank Sampah / TPA Anda (${name}) ditolak dengan alasan: ${reason}. Silahkan daftar kembali dengan berkas yang benar.`,
            date: new Date().toLocaleString('id-ID'),
            type: 'warning',
            isRead: false
          });
          await updateDoc(userRef, { notifications: notifs });
        }
      }
      alert('Partner berhasil ditolak.');
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'reject_partner_failed',
        message: e?.message || 'Gagal menolak pendaftaran partner',
        context: 'partner_management',
        functionName: 'handleRejectPartner',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { partnerId, ownerUid, name, reason }
      });
      alert('Gagal menolak partner: ' + e.message);
    }
  };

  const handleToggleSuspendPartner = async (partnerId: string, currentStatus: string, name: string) => {
    const isSuspending = currentStatus === 'approved';
    const newStatus = isSuspending ? 'suspended' : 'approved';
    const actionText = isSuspending ? 'men-suspend' : 'mengaktifkan kembali';
    
    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} partner "${name}"?`)) return;

    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: newStatus });
      alert(`Partner berhasil ${isSuspending ? 'di-suspend' : 'diaktifkan kembali'}.`);
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'toggle_partner_status_failed',
        message: e?.message || `Gagal ${actionText} partner`,
        context: 'partner_management',
        functionName: 'handleToggleSuspendPartner',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { partnerId, currentStatus, name }
      });
      alert(`Gagal ${actionText} partner: ` + e.message);
    }
  };

  const [showAssignInstModal, setShowAssignInstModal] = useState(false);
  const [assigningPartnerId, setAssigningPartnerId] = useState('');
  const [selectedInstId, setSelectedInstId] = useState('');

  const handleAssignPartnerInstitution = async (partnerId: string) => {
    setAssigningPartnerId(partnerId);
    setSelectedInstId('');
    setShowAssignInstModal(true);
  };

  const confirmAssignInstitution = async () => {
    if (!assigningPartnerId || !selectedInstId) {
      alert('Pilih institusi terlebih dahulu!');
      return;
    }
    try {
      const partnerRef = doc(db, 'partners', assigningPartnerId);
      await updateDoc(partnerRef, { institutionId: selectedInstId });
      alert('Institusi partner berhasil diubah!');
      setShowAssignInstModal(false);
      setAssigningPartnerId('');
      setSelectedInstId('');
    } catch (e: any) {
      console.error('Gagal assign institution:', e);
      alert('Gagal mengubah institusi partner.');
    }
  };

  const handleApproveFlagged = async (txId: string, userToken: string, category: string, weight: number, partnerUid: string) => {
    try {
      // 1. Update status transaksi
      const txRef = doc(db, 'transactions', txId);
      await updateDoc(txRef, { status: 'approved' });

      // 2. Resolve adminReview
      const reviewRef = doc(db, 'adminReviews', txId);
      await setDoc(reviewRef, { status: 'approved', resolvedAt: new Date().toISOString() }, { merge: true });

      // 3. Cari user berdasarkan qrToken
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('qrToken', '==', userToken));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const userUid = userDoc.id;
        const uData = userDoc.data() as UserData;

        // Cari poin per kg dari kategori
        const categoryData = WASTE_CATEGORIES.find(c => c.id === category);
        const pointsPerKg = categoryData ? categoryData.pointsPerKg : 1000;
        const totalPoints = weight * pointsPerKg;

        // Cari nama partner
        let partnerName = 'Bank Sampah Partner';
        const partnerQuery = query(collection(db, 'partners'), where('ownerUid', '==', partnerUid));
        const partnerSnap = await getDocs(partnerQuery);
        if (!partnerSnap.empty) {
          partnerName = partnerSnap.docs[0].data().name || 'Bank Sampah Partner';
        }

        // Buat log depositHistory baru untuk user
        const newDeposit: DepositHistoryItem = {
          id: txId,
          date: new Date().toLocaleString('id-ID'),
          items: [{ category: categoryData?.name || category, weight, points: totalPoints }],
          totalPoints,
          totalWeight: weight,
          status: 'Approved',
          image: (await getDoc(txRef)).data()?.photoUrl || '',
          location: partnerName,
          userEmail: uData.email || '',
          userUid
        };

        const updatedPoints = (uData.points || 0) + totalPoints;
        const updatedHistory = [newDeposit, ...(uData.depositHistory || []).filter(item => item.id !== txId)];
        const notifs = [...(uData.notifications || [])];
        notifs.unshift({
          id: Math.random().toString(36).substr(2, 9),
          title: 'Transaksi Flagged Disetujui! 💰',
          message: `Transaksi setoran sampah Anda sebesar ${weight}kg (${category}) telah diverifikasi oleh Admin. Anda mendapatkan ${totalPoints} NeuroPoints!`,
          date: new Date().toLocaleString('id-ID'),
          type: 'success',
          isRead: false,
          depositId: txId
        });

        await updateDoc(doc(db, 'users', userUid), {
          points: updatedPoints,
          depositHistory: updatedHistory,
          notifications: notifs
        });
      }
      alert('Transaksi flagged berhasil disetujui dan poin dikirim!');
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'approve_flagged_transaction_failed',
        message: e?.message || 'Gagal menyetujui transaksi flagged',
        context: 'admin_transaction_review',
        functionName: 'handleApproveFlagged',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { txId, userToken, category, weight, partnerUid }
      });
      alert('Gagal menyetujui transaksi: ' + e.message);
    }
  };

  const handleRejectFlagged = async (txId: string, userToken: string, category: string, weight: number, partnerUid: string) => {
    const reason = prompt('Masukkan alasan penolakan transaksi:') || 'Bukti foto tidak jelas atau data tidak sesuai.';
    try {
      // 1. Update status transaksi
      const txRef = doc(db, 'transactions', txId);
      await updateDoc(txRef, { status: 'rejected', rejectionReason: reason });

      // 2. Resolve adminReview
      const reviewRef = doc(db, 'adminReviews', txId);
      await setDoc(reviewRef, { status: 'rejected', reason, resolvedAt: new Date().toISOString() }, { merge: true });

      // 3. Cari user untuk dikasih notifikasi
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('qrToken', '==', userToken));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const userUid = userDoc.id;
        const uData = userDoc.data() as UserData;

         // Cari nama partner
        let partnerName = 'Bank Sampah Partner';
        const partnerQuery = query(collection(db, 'partners'), where('ownerUid', '==', partnerUid));
        const partnerSnap = await getDocs(partnerQuery);
        if (!partnerSnap.empty) {
          partnerName = partnerSnap.docs[0].data().name || 'Bank Sampah Partner';
        }

        const newDeposit: DepositHistoryItem = {
          id: txId,
          date: new Date().toLocaleString('id-ID'),
          items: [{ category: category, weight, points: 0 }],
          totalPoints: 0,
          totalWeight: weight,
          status: 'Rejected',
          image: (await getDoc(txRef)).data()?.photoUrl || '',
          location: partnerName,
          userEmail: uData.email || '',
          userUid
        };

        const updatedHistory = [newDeposit, ...(uData.depositHistory || []).filter(item => item.id !== txId)];
        const notifs = [...(uData.notifications || [])];
        notifs.unshift({
          id: Math.random().toString(36).substr(2, 9),
          title: 'Setoran QR Ditolak ⚠️',
          message: `Transaksi setoran sampah Anda sebesar ${weight}kg (${category}) ditolak oleh Admin dengan alasan: ${reason}`,
          date: new Date().toLocaleString('id-ID'),
          type: 'warning',
          isRead: false
        });

        await updateDoc(doc(db, 'users', userUid), {
          depositHistory: updatedHistory,
          notifications: notifs
        });
      }
      alert('Transaksi flagged berhasil ditolak.');
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'reject_flagged_transaction_failed',
        message: e?.message || 'Gagal menolak transaksi flagged',
        context: 'admin_transaction_review',
        functionName: 'handleRejectFlagged',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { txId, userToken, category, weight, partnerUid, reason }
      });
      alert('Gagal menolak transaksi: ' + e.message);
    }
  };

  const allDeposits = users.flatMap(u => (u.depositHistory || []).map(d => ({ ...d, userEmail: u.email, userUid: u.uid, displayName: u.displayName })));
  
  // partnerDeposits: deposit yang jelas dari bank sampah terdaftar (ada tx.partnerUid valid, atau lokasi cocok nama partner)
  const registeredPartnerNames = partners.filter(p => p.status === 'approved').map((p: any) => p.name).filter(Boolean);
  const partnerDeposits = allDeposits.filter(d => {
    const tx = transactions.find(t => t.id === d.id);
    if (tx) {
      // tx dari bank sampah terdaftar memiliki partnerUid yang valid
      return !!(tx.partnerUid || tx.partnerId);
    }
    // Jika tidak ada tx, cek apakah lokasi cocok dengan nama partner terdaftar
    return registeredPartnerNames.some(name => name && d.location && d.location.includes(name));
  });

  // manualDeposits: semua deposit yang BUKAN dari partner terdaftar (termasuk data lama)
  const manualDeposits = allDeposits.filter(d => !partnerDeposits.some(pd => pd.id === d.id));
  const partnerActivityRows = transactions
    .filter((tx: any) => tx.partnerUid || tx.partnerId)
    .map((tx: any) => {
      const partner = partners.find((p: any) => p.ownerUid === tx.partnerUid || p.id === tx.partnerId);
      const txUser = users.find(u => u.uid === tx.userUid || u.qrToken === tx.userToken);
      const historyItem = txUser?.depositHistory?.find((d: any) => d.id === tx.id);
      const categoryData = WASTE_CATEGORIES.find(c => c.id === tx.category);
      const items = tx.items || historyItem?.items || [{
        category: categoryData?.name || tx.category || 'Campuran',
        weight: tx.weight || 0,
        points: (tx.weight || 0) * (categoryData?.pointsPerKg || 1000)
      }];
      const totalWeight = tx.totalWeight || historyItem?.totalWeight || tx.weight || items.reduce((sum: number, item: any) => sum + (Number(item.weight) || 0), 0);
      const totalPoints = historyItem?.totalPoints ?? items.reduce((sum: number, item: any) => sum + (Number(item.points) || 0), 0);
      return {
        id: tx.id,
        partnerName: partner?.name || tx.partnerName || historyItem?.location || tx.partnerNameManual || 'Bank Sampah Partner',
        partnerEmail: partner?.email || '',
        userName: txUser?.displayName || 'User',
        userEmail: txUser?.email || historyItem?.userEmail || tx.userToken || '-',
        items,
        totalWeight,
        totalPoints,
        status: tx.status || historyItem?.status || 'pending',
        date: tx.createdAt || historyItem?.date || '',
        image: tx.photoUrl || historyItem?.image || '',
        reason: tx.rejectionReason || tx.anomalyReason || ''
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const allClaims = users.flatMap(u => (u.claimHistory || []).map(c => ({ ...c, userEmail: u.email, userUid: u.uid, displayName: u.displayName })));
  const allScans = users.flatMap(u => (u.scanHistory || []).map(s => ({
    ...s,
    type: 'Scan AI' as const,
    userEmail: u.email,
    userUid: u.uid,
    displayName: u.displayName
  })));
  const allActivities = [
    ...allScans.map(item => ({
      id: item.id,
      type: item.type,
      title: item.name,
      status: 'Success' as const,
      points: 25,
      date: item.date,
      userEmail: item.userEmail,
      displayName: item.displayName,
      extra: item.category,
      image: item.image
    })),
    ...allDeposits.map(item => ({
      id: item.id,
      type: 'Setoran TPA' as const,
      title: `${item.totalWeight.toFixed(1)} kg - ${item.status}`,
      status: item.status,
      points: item.totalPoints,
      date: item.date,
      userEmail: item.userEmail,
      displayName: item.displayName,
      extra: item.location || 'Lokasi belum diisi',
      image: item.image
    })),
    ...allClaims.map(item => ({
      id: item.id,
      type: 'Klaim Hadiah' as const,
      title: item.title,
      status: item.status,
      points: item.points,
      date: item.date,
      userEmail: item.userEmail,
      displayName: item.displayName,
      extra: item.title,
      image: undefined
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      {/* Admin Header */}
      <header className="bg-white border-b border-stone-200 p-6 sticky top-0 z-100">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-xl font-display font-black text-stone-900 tracking-tight">NeuroCycle Admin</h1>
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em]">Pusat Kendali Ekosistem</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-6 flex-1 pb-24">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: 'Total Pengguna', value: users.length, icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Setoran Menunggu', value: manualDeposits.filter(d => d.status === 'Pending').length, icon: MapPin, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Klaim Hadiah', value: allClaims.filter(c => c.status === 'Pending').length, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm flex items-center gap-6"
            >
              <div className={`w-16 h-16 ${stat.bg} ${stat.color} rounded-3xl flex items-center justify-center`}>
                <stat.icon size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-4xl font-display font-black text-stone-900">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-10 bg-stone-200/50 p-1.5 rounded-3xl w-fit flex-wrap">
          {[
            { id: 'institutions', label: 'Institusi', icon: Building2 },
            { id: 'users', label: 'Daftar User', icon: User },
            { id: 'partners', label: 'Verifikasi Partner', icon: Recycle },
            { id: 'flagged_txs', label: 'Transaksi Flagged', icon: AlertTriangle },
            { id: 'deposits', label: 'Verifikasi Setoran', icon: Clock },
            { id: 'partner_activity', label: 'Aktivitas Bank Sampah', icon: Activity },
            { id: 'claims', label: 'Persetujuan Klaim', icon: Award },
            { id: 'activity', label: 'Semua Aktivitas', icon: BarChart3 },
            { id: 'missions', label: 'Kelola Misi', icon: Sparkles },
            { id: 'articles', label: 'Artikel', icon: BookOpen },
            { id: 'mission_activity', label: 'Aktivitas Misi', icon: Award },
            { id: 'rewards', label: 'Kelola Reward', icon: Gift },
            { id: 'error_logs', label: 'Error Logs', icon: Bug },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-stone-900 shadow-xl' : 'text-stone-500 hover:text-stone-800'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.id === 'institutions' && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-widest">
                  {institutions.length}
                </span>
              )}
              {tab.id === 'partners' && partners.filter(p => p.status === 'pending').length > 0 && (
                <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">
                  {partners.filter(p => p.status === 'pending').length}
                </span>
              )}
              {tab.id === 'flagged_txs' && transactions.filter(t => t.status === 'flagged' || t.status === 'flagged_offline').length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest">
                  {transactions.filter(t => t.status === 'flagged' || t.status === 'flagged_offline').length}
                </span>
              )}
              {tab.id === 'deposits' && manualDeposits.filter(d => d.status === 'Pending').length > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">
                  {manualDeposits.filter(d => d.status === 'Pending').length}
                </span>
              )}
              {tab.id === 'mission_activity' && allMissionProgress.filter(p => p.proofStatus === 'pending_review').length > 0 && (
                <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">
                  {allMissionProgress.filter(p => p.proofStatus === 'pending_review').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-emerald-500" size={64} />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Memuat Data Sinkron...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-[40px] p-10 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-red-500">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-3">Gagal Memuat Data</h3>
            <p className="text-sm text-red-600 leading-relaxed max-w-lg mx-auto">{error}</p>
            <div className="mt-6 p-4 bg-white rounded-2xl border border-red-100 text-left">
              <p className="text-xs font-black text-stone-500 uppercase tracking-widest mb-2">Cara Fix Firestore Rules:</p>
              <code className="text-xs text-stone-700 leading-relaxed block">
                rules_version = '2';<br/>
                service cloud.firestore {'{'}<br/>
                &nbsp;&nbsp;match /databases/{'{'}'{'}'}/documents {'{'}<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;match /{'{'}document=**{'}'} {'{'}<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                &nbsp;&nbsp;{'}'}<br/>
                {'}'}
              </code>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
              >
                {users.length === 0 ? (
                  <div className="p-16 text-center text-stone-500">
                    <p className="text-xl font-bold mb-2">Belum ada pengguna terdaftar</p>
                    <p className="text-sm text-stone-400">Tidak ada akun user reguler di koleksi <span className="font-mono">users</span>. Akun partner/institution admin hanya bisa dilihat di dashboard Super Admin.</p>
                  </div>
                ) : (
                  <>
                    <div className="p-6 flex flex-col sm:flex-row gap-4 border-b border-stone-100">
                      <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input
                          type="text"
                          placeholder="Cari nama, email, atau institution..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 placeholder:text-stone-400"
                        />
                      </div>
                    </div>
                    <table className="w-full text-left">
                    <thead className="bg-stone-50/80 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Identitas Pengguna</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Institusi</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">Aktivitas</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Saldo Poin</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {users.filter(u => {
                        const matchesSearch = !searchQuery || 
                          (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.institutionId || '').toLowerCase().includes(searchQuery.toLowerCase());
                        const isRegularUser = !u.role || u.role === 'user';
                        return matchesSearch && isRegularUser;
                      }).map(u => {
                        const inst = institutions.find(i => i.id === u.institutionId);
                        const userRole = u.role || 'user';
                        return (
                          <tr key={u.uid} className="hover:bg-stone-50/50 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                                  <User size={24} />
                                </div>
                                <div>
                                  <p className="font-bold text-stone-900 leading-tight">{u.displayName || 'Tanpa Nama'}</p>
                                  <p className="text-xs text-stone-400 font-medium">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              {inst ? (
                                <div>
                                  <p className="text-sm font-bold text-stone-800">{inst.name}</p>
                                  <p className="text-[9px] text-stone-400 font-mono">{u.institutionId}</p>
                                </div>
                              ) : (
                                <span className="px-3 py-1 bg-stone-100 text-stone-400 rounded-full text-[10px] font-black uppercase tracking-widest">Belum Ditentukan</span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-center">
                              <span className="text-xs font-black text-stone-800">{(u.scanHistory?.length || 0) + (u.depositHistory?.length || 0)}</span>
                              <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Total Aksi</p>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2">
                                <Coins size={14} className="text-amber-500" />
                                <p className="font-display font-black text-emerald-600 text-lg">{u.points?.toLocaleString() || 0}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              {u.isBanned ? (
                                <span className="px-4 py-1.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-200">Terbanned</span>
                              ) : (
                                <span className="px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">Aktif</span>
                              )}
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className="p-2.5 bg-stone-100 text-stone-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                  title="Detail"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                      if (window.confirm(`Yakin ingin ${u.isBanned ? 'membuka ban' : 'mem-ban'} user ${u.displayName}?`)) {
                                        handleAction(u.uid!, u.isBanned ? 'unban' : 'ban');
                                      }
                                    }}
                                  className={`p-2.5 rounded-xl transition-all shadow-sm ${u.isBanned ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-red-100 text-red-600 hover:bg-red-500 hover:text-white'}`}
                                >
                                  <Ban size={16} />
                                </button>
                                {(userRole === 'institution_admin') && (
                                  <button
                                    onClick={() => handleOpenResetPassword(u)}
                                    className="p-2.5 rounded-xl bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                    title="Reset Password"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </motion.div>
          )}

        {activeTab === 'institutions' && (
          <motion.div
            key="institutions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
          >
            {institutions.length === 0 ? (
              <div className="p-16 text-center text-stone-500">
                <p className="text-xl font-bold mb-2">Belum ada institusi</p>
                <p className="text-sm text-stone-400">Belum ada dokumen di koleksi <span className="font-mono">institutions</span>.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-stone-50/80 border-b border-stone-100">
                    <tr>
                      <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Nama Institusi</th>
                      <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Kode</th>
                      <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Dibuat Oleh</th>
                      <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">Total Partner</th>
                      <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {institutions.map(inst => (
                      <tr key={inst.id} className="hover:bg-stone-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <Building2 size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-stone-900 leading-tight">{inst.name || 'Tanpa Nama'}</p>
                              <p className="text-xs text-stone-400 font-medium">ID: {inst.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-black tracking-widest border border-amber-200">
                            {inst.code || '-'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm text-stone-700">{inst.createdBy || '-'}</p>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100">
                            {partners.filter(p => p.institutionId === inst.id).length}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm text-stone-500">{inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('id-ID') : '-'}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'partners' && (
              <motion.div
                key="partners"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
              >
                {partners.length === 0 ? (
                  <div className="p-16 text-center text-stone-500">
                    <p className="text-xl font-bold mb-2">Belum ada pengajuan partner</p>
                    <p className="text-sm text-stone-400">Tidak ada pengajuan partner di Firestore saat ini.</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {partners.map(p => (
                      <div key={p.id} className="bg-stone-50/60 rounded-3xl border border-stone-100 p-6 hover:shadow-md transition-all">
                        {/* Header: Nama + Status */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-stone-900 leading-tight">{p.name}</h4>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-1">ID: {p.id.substring(0, 12)}...</p>
                          </div>
                          <span className={`shrink-0 ml-3 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : p.status === 'rejected' ? 'bg-red-100 text-red-600 border-red-200' : p.status === 'suspended' ? 'bg-stone-100 text-stone-600 border-stone-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
                            {p.status}
                          </span>
                        </div>

                        {/* Detail Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                          <div className="bg-white rounded-2xl p-4 border border-stone-100">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Kontak</p>
                            <p className="text-sm font-semibold text-stone-700 break-all">{p.email}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{p.phone}</p>
                          </div>
                          <div className="bg-white rounded-2xl p-4 border border-stone-100">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Alamat</p>
                            <p className="text-sm text-medium text-stone-600 leading-relaxed">{p.address}</p>
                          </div>
                          <div className="bg-white rounded-2xl p-4 border border-stone-100">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Password</p>
                            <p className="text-sm font-mono font-semibold text-stone-800 break-all">{p.password || '-'}</p>
                          </div>
                         {/* Institution Info */}
                         <div className="bg-white rounded-2xl p-4 border border-stone-100 mb-5">
                           <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Institusi</p>
                           {p.institutionId ? (
                             <div className="flex items-center gap-2">
                               <Building2 size={14} className="text-blue-600" />
                               <p className="text-sm font-bold text-stone-800">
                                 {institutions.find((i: any) => i.id === p.institutionId)?.name || p.institutionId}
                               </p>
                               <span className="text-[10px] text-stone-400 font-mono bg-stone-100 px-2 py-0.5 rounded-full">
                                 {institutions.find((i: any) => i.id === p.institutionId)?.code || '-'}
                               </span>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2">
                               <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200">
                                 Belum Ada Institusi
                               </span>
                               <button
                                 onClick={() => handleAssignPartnerInstitution(p.id)}
                                 className="px-3 py-1 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                               >
                                 Assign Institusi
                               </button>
                             </div>
                           )}
                         </div>
                        </div>

                        {/* Catatan jika ada */}
                        {p.notes && (
                          <div className="bg-white rounded-2xl p-4 border border-stone-100 mb-5">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Catatan Partner</p>
                            <p className="text-sm text-stone-600">{p.notes}</p>
                          </div>
                        )}

                        {/* Alasan penolakan jika rejected */}
                        {p.status === 'rejected' && p.rejectionReason && (
                          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 mb-5">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">⚠️ Alasan Penolakan</p>
                            <p className="text-sm text-red-700 font-medium">{p.rejectionReason}</p>
                          </div>
                        )}

                        {/* Action Buttons - Selalu terlihat untuk status pending */}
                        {p.status === 'pending' && (
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => {
                                if (window.confirm(`Setujui kemitraan dengan "${p.name}"?`)) {
                                  handleApprovePartner(p.id, p.ownerUid, p.name);
                                }
                              }}
                              className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={16} />
                              Setujui Partner
                            </button>
                            <button
                              onClick={() => {
                                handleRejectPartner(p.id, p.ownerUid, p.name);
                              }}
                              className="flex-1 py-3.5 bg-red-50 text-red-600 rounded-2xl text-sm font-bold hover:bg-red-100 border border-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              <AlertTriangle size={16} />
                              Tolak Partner
                            </button>
                          </div>
                        )}

                        {/* Status info for approved and suspended with toggle action */}
                        {(p.status === 'approved' || p.status === 'suspended') && (
                          <div className="flex items-center justify-between gap-4 pt-4 border-t border-stone-100 mt-2">
                            <div className="flex items-center gap-2">
                              {p.status === 'approved' ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                  <CheckCircle2 size={14} />
                                  <span className="text-xs font-bold">Partner telah diverifikasi dan aktif</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-red-600">
                                  <AlertTriangle size={14} />
                                  <span className="text-xs font-bold">Partner sedang disuspend</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleToggleSuspendPartner(p.id, p.status, p.name)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                p.status === 'approved' 
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {p.status === 'approved' ? 'Suspend Partner' : 'Aktifkan Kembali'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'flagged_txs' && (
              <motion.div
                key="flagged_txs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
              >
                {transactions.filter(t => t.status === 'flagged' || t.status === 'flagged_offline').length === 0 ? (
                  <div className="p-16 text-center text-stone-500">
                    <p className="text-xl font-bold mb-2">Tidak ada transaksi flagged</p>
                    <p className="text-sm text-stone-400">Semua transaksi berjalan lancar tanpa terdeteksi anomali.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-stone-50/80 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Detail Transaksi</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Token User</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Kategori & Berat</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Alasan Flagging</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti Foto</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {transactions.filter(t => t.status === 'flagged' || t.status === 'flagged_offline').map(t => {
                        const review = reviews.find(r => r.txId === t.id);
                        return (
                          <tr key={t.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-8 py-6">
                              <div>
                                <p className="font-bold text-stone-900 leading-tight">Tx ID: {t.id}</p>
                                <p className="text-xs text-stone-400 mt-1">{t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="font-mono text-sm bg-stone-100 px-3 py-1.5 rounded-lg">{t.userToken}</span>
                            </td>
                            <td className="px-8 py-6">
                              <p className="text-sm font-bold text-stone-800">{t.category}</p>
                              <p className="text-xs text-stone-500 font-medium">{t.weight} kg</p>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 w-fit">
                                <AlertTriangle size={12} />
                                {review?.reason || (t.weight > 50 ? 'Berat melebihi 50kg' : 'Frekuensi transaksi tinggi')}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              {t.photoUrl ? (
                                <button onClick={() => setSelectedPhotoPreview({ image: t.photoUrl, user: t.userToken || 'User', title: `Bukti Transaksi ${t.id}`, date: t.createdAt ? new Date(t.createdAt).toLocaleString() : undefined })} className="text-emerald-600 hover:text-emerald-800 font-bold text-xs underline">Lihat Foto</button>
                              ) : (
                                <span className="text-stone-400 text-xs italic">Tanpa foto</span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right space-x-2">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Setujui transaksi ini dan kirimkan poin ke user?`)) {
                                    handleApproveFlagged(t.id, t.userToken, t.category, t.weight, t.partnerUid);
                                  }
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  handleRejectFlagged(t.id, t.userToken, t.category, t.weight, t.partnerUid);
                                }}
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-200 transition-all shadow-sm"
                              >
                              Reject
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {activeTab === 'deposits' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {manualDeposits.length === 0 && (
                  <div className="text-center py-32 bg-white rounded-[48px] border border-stone-100 shadow-sm">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[40px] flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="text-emerald-200" size={64} />
                    </div>
                    <h3 className="text-xl font-display font-bold text-stone-900 mb-2">Belum ada setoran manual</h3>
                    <p className="text-stone-400 text-sm max-w-xs mx-auto">Pengguna belum mengajukan setoran manual atau data belum tercatat.</p>
                  </div>
                )}
                {manualDeposits.filter(d => d.status === 'Pending').length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-black uppercase tracking-widest text-amber-600">Permintaan Setoran Menunggu</div>
                    {manualDeposits.filter(d => d.status === 'Pending').map(d => (
                      <div key={d.id} className="bg-white p-8 rounded-[48px] border border-stone-100 shadow-xl flex flex-col md:flex-row gap-10">
                        <div className="w-full md:w-64 h-64 bg-stone-100 rounded-4xl overflow-hidden shrink-0 border-4 border-white shadow-inner">
                          {d.image ? (
                            <button onClick={() => setSelectedPhotoPreview({ image: d.image || '', user: d.displayName || d.userEmail || 'User', title: 'Bukti Setoran Manual', date: d.date })} className="w-full h-full block focus:outline-none">
                              <img src={d.image} alt="Waste Proof" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 bg-stone-50">
                              <ImageIcon size={64} className="mb-4 opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Tanpa Foto</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-8">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Menunggu Verifikasi</p>
                              </div>
                              <h3 className="text-2xl font-display font-bold text-stone-900 mb-1">{d.displayName || 'User'}</h3>
                              <p className="text-xs text-stone-400 font-medium">{d.userEmail}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Diajukan Pada</p>
                              <p className="text-sm font-bold text-stone-700">{d.date}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6 mb-10">
                            <div className="bg-stone-50 p-6 rounded-[28px] border border-stone-100">
                              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <MapPin size={12} className="text-blue-500" />
                                Lokasi TPA/TPU
                              </p>
                              <p className="text-base font-bold text-stone-800 leading-tight">{d.location || 'Lokasi tidak disertakan'}</p>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-[28px] border border-emerald-100">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Coins size={12} className="text-amber-500" />
                                Imbalan Poin
                              </p>
                              <p className="text-2xl font-display font-black text-emerald-700">+{d.totalPoints?.toLocaleString()} NP</p>
                            </div>
                          </div>

                          <div className="flex gap-4 mt-auto">
                            <button
                              onClick={() => handleAction(d.userUid!, 'approve_deposit', d.id)}
                              className="flex-1 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest py-5 rounded-3xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-3"
                            >
                              <CheckCircle size={20} />
                              Setujui & Kirim Poin
                            </button>
                            <button
                              onClick={() => handleAction(d.userUid!, 'reject_deposit', d.id)}
                              className="px-8 bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest py-5 rounded-3xl hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                              <XCircle size={20} />
                              Tolak
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {manualDeposits.filter(d => d.status !== 'Pending').length > 0 && (
                  <div className="bg-white rounded-[48px] border border-stone-100 shadow-sm p-8">
                    <h3 className="text-xl font-display font-bold text-stone-900 mb-6">Riwayat Setoran Manual</h3>
                    <div className="space-y-4">
                      {manualDeposits.filter(d => d.status !== 'Pending').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                        <div key={d.id} className="flex items-center justify-between p-6 rounded-[28px] bg-stone-50 border border-stone-100 hover:bg-white hover:shadow-md transition-all">
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                              d.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                              d.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                              'bg-stone-200 text-stone-500'
                            }`}>
                              {d.status === 'Approved' ? <CheckCircle size={24} /> :
                               d.status === 'Rejected' ? <XCircle size={24} /> :
                               <Clock size={24} />}
                            </div>
                            <div>
                              <h4 className="font-bold text-stone-900 text-base mb-1">{d.displayName || 'User'}</h4>
                              <p className="text-xs text-stone-500 font-medium">{d.userEmail} • {d.date}</p>
                              <p className="text-xs font-bold text-stone-400 mt-1">{d.location || 'Lokasi tidak tersedia'}</p>
                              {d.items && d.items.length > 0 && (
                                <p className="text-xs text-stone-400 mt-0.5">{d.items.map((i: any) => `${i.category} (${i.weight}kg)`).join(', ')}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-black text-lg text-stone-900">{d.totalWeight?.toFixed(1)} kg</p>
                            <p className={`text-sm font-bold mt-1 ${
                              d.status === 'Approved' ? 'text-emerald-600' :
                              d.status === 'Rejected' ? 'text-red-500' :
                              'text-stone-400'
                            }`}>
                              {d.status === 'Approved' ? `+${d.totalPoints?.toLocaleString()} NP` : d.status}
                            </p>
                            {d.image && (
                              <button onClick={() => setSelectedPhotoPreview({ image: d.image || '', user: d.displayName || d.userEmail || 'User', title: 'Riwayat Bukti Setoran', date: d.date })} className="text-[10px] uppercase font-black tracking-widest text-emerald-600 underline mt-1 block">Lihat Bukti</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'claims' && (
              <motion.div
                key="claims"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid gap-6"
              >
                {allClaims.length === 0 && (
                  <div className="text-center py-32 bg-white rounded-[48px] border border-stone-100 shadow-sm col-span-full">
                    <div className="w-24 h-24 bg-blue-50 rounded-[40px] flex items-center justify-center mx-auto mb-6">
                      <Award className="text-blue-200" size={64} />
                    </div>
                    <h3 className="text-xl font-display font-bold text-stone-900 mb-2">Belum Ada Klaim</h3>
                    <p className="text-stone-400 text-sm max-w-xs mx-auto">Pengguna belum mengajukan klaim hadiah atau data belum tersedia di dashboard admin.</p>
                  </div>
                )}
                {allClaims.filter(c => c.status === 'Pending').length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-black uppercase tracking-widest text-amber-600">Klaim Menunggu</div>
                    {allClaims.filter(c => c.status === 'Pending').map(c => (
                      <div key={c.id} className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-xl flex items-center justify-between">
                        <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <Award size={40} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[8px] font-black uppercase tracking-widest">Reward Claim</span>
                              <span className="text-[10px] text-stone-400 font-bold">{c.date}</span>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-stone-900 mb-1">{c.title}</h3>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-stone-500 font-medium">Oleh: <span className="text-stone-800 font-bold">{c.displayName || c.userEmail}</span></p>
                              <span className="text-stone-300">|</span>
                              <p className="text-xs text-stone-500 font-medium">{c.userEmail}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-10">
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mb-1">Harga Poin</p>
                            <p className="text-2xl font-display font-black text-red-500">-{c.points?.toLocaleString()} NP</p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAction(c.userUid!, 'approve_claim', c.id)}
                              className="p-5 bg-emerald-600 text-white rounded-3xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                              title="Selesaikan Klaim"
                            >
                              <CheckCircle size={24} />
                            </button>
                            <button
                              onClick={() => handleAction(c.userUid!, 'reject_claim', c.id)}
                              className="p-5 bg-red-50 text-red-600 rounded-3xl hover:bg-red-100 transition-all active:scale-95"
                              title="Tolak Klaim"
                            >
                              <XCircle size={24} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {allClaims.filter(c => c.status !== 'Pending').length > 0 && (
                  <div className="bg-white rounded-[48px] border border-stone-100 shadow-sm p-8">
                    <h3 className="text-xl font-display font-bold text-stone-900 mb-6">Riwayat Klaim</h3>
                    <div className="space-y-4">
                      {allClaims.filter(c => c.status !== 'Pending').map(c => (
                        <div key={c.id} className="p-6 rounded-3xl border border-stone-100 bg-stone-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{c.displayName || c.userEmail}</p>
                            <h4 className="font-bold text-stone-900">{c.title}</h4>
                            <p className="text-xs text-stone-500 mt-1">{c.date}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black uppercase tracking-widest ${c.status === 'Success' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</p>
                            <p className="text-xl font-display font-black text-stone-900 mt-2">-{c.points} NP</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'partner_activity' && (
              <motion.div
                key="partner-activity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
              >
                {partnerActivityRows.length === 0 ? (
                  <div className="p-16 text-center">
                    <Activity size={48} className="text-stone-200 mx-auto mb-4" />
                    <p className="text-stone-400 font-bold">Belum ada aktivitas bank sampah.</p>
                    <p className="text-stone-400 text-xs mt-2">Transaksi partner akan tampil saat user mengajukan setoran atau petugas mencatat transaksi.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-stone-50/80 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Bank Sampah</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Pengguna</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Setoran</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {partnerActivityRows.map((item) => {
                        const normalizedStatus = String(item.status || '').toLowerCase();
                        const proofUrl = normalizePhotoUrl(item.image || '');
                        const isApproved = normalizedStatus === 'approved';
                        const isRejected = normalizedStatus === 'rejected';
                        const isFlagged = normalizedStatus.includes('flagged');
                        const isPending = normalizedStatus.includes('pending');
                        return (
                          <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-8 py-5">
                              <p className="font-bold text-stone-800 text-sm">{item.partnerName}</p>
                              <p className="text-[10px] text-stone-400">{item.partnerEmail || 'Mitra terdaftar'}</p>
                            </td>
                            <td className="px-8 py-5">
                              <p className="font-bold text-stone-800 text-sm">{item.userName}</p>
                              <p className="text-[10px] text-stone-400">{item.userEmail}</p>
                            </td>
                            <td className="px-8 py-5">
                              <p className="font-display font-black text-lg text-stone-900">{Number(item.totalWeight || 0).toFixed(1)} kg</p>
                              <p className="text-xs text-stone-500 font-medium mt-1">
                                {item.items.map((i: any) => `${i.category || i.name} (${i.weight}kg)`).join(', ')}
                              </p>
                              <p className="text-xs font-black text-emerald-600 mt-1">+{Number(item.totalPoints || 0).toLocaleString()} NP</p>
                              {item.reason && (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{item.reason}</p>
                              )}
                            </td>
                            <td className="px-8 py-5">
                              {item.image ? (
                                <button onClick={() => setSelectedPhotoPreview({ image: item.image, user: item.userName || item.userEmail || 'User', title: 'Bukti Setoran Bank Sampah', date: item.date ? new Date(item.date).toLocaleString('id-ID') : undefined })} className="inline-block group/thumb">
                                  <img
                                    src={proofUrl}
                                    alt="Bukti Setoran Bank Sampah"
                                    className="w-12 h-12 object-cover rounded-xl border border-stone-200 group-hover/thumb:scale-110 group-hover/thumb:shadow-md transition-all duration-200"
                                  />
                                </button>
                              ) : (
                                <span className="text-stone-300 text-xs italic">Tanpa foto</span>
                              )}
                            </td>
                            <td className="px-8 py-5">
                              <p className="text-xs text-stone-500 font-medium">
                                {item.date ? new Date(item.date).toLocaleString('id-ID') : '-'}
                              </p>
                            </td>
                            <td className="px-8 py-5">
                              <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                isApproved ? 'bg-emerald-100 text-emerald-700' :
                                isRejected ? 'bg-red-100 text-red-600' :
                                isFlagged ? 'bg-orange-100 text-orange-700' :
                                isPending ? 'bg-amber-100 text-amber-700' :
                                'bg-stone-100 text-stone-600'
                              }`}>
                                {isApproved ? 'Diterima' :
                                 isRejected ? 'Ditolak' :
                                 isFlagged ? 'Flagged' :
                                 isPending ? 'Menunggu' : item.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div
                key="activity-all"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden"
              >
                {allActivities.length === 0 ? (
                  <div className="p-16 text-center">
                    <BarChart3 size={48} className="text-stone-200 mx-auto mb-4" />
                    <p className="text-stone-400 font-bold">Belum ada aktivitas tercatat.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-stone-50/80 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Pengguna</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Aktivitas</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti Foto</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Poin</th>
                        <th className="px-8 py-6 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {allActivities.map((item, i) => (
                        <tr key={`${item.id}-${i}`} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <p className="font-bold text-stone-800 text-sm">{item.displayName || item.userEmail}</p>
                            <p className="text-[10px] text-stone-400">{item.userEmail}</p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                item.type === 'Scan AI' ? 'bg-blue-50 text-blue-600' :
                                item.type === 'Setoran TPA' ? 'bg-emerald-50 text-emerald-600' :
                                'bg-amber-50 text-amber-600'
                              }`}>
                                {item.type === 'Scan AI' ? <Camera size={16} /> : item.type === 'Setoran TPA' ? <Recycle size={16} /> : <Award size={16} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{item.type}</p>
                                <p className="font-bold text-stone-800 text-sm truncate max-w-45">{item.title}</p>
                                {item.type === 'Setoran TPA' && (
                                  <p className="text-[9px] text-stone-500 font-bold">Mitra: {item.extra}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            {item.image ? (
                              <button onClick={() => setSelectedPhotoPreview({ image: item.image || '', user: item.displayName || item.userEmail || 'User', title: item.title || item.type, date: item.date })} className="inline-block group/thumb">
                                <img 
                                  src={normalizePhotoUrl(item.image)} 
                                  alt="Bukti Aktivitas" 
                                  className="w-10 h-10 object-cover rounded-lg border border-stone-200 group-hover/thumb:scale-110 group-hover/thumb:shadow-md transition-all duration-200" 
                                />
                              </button>
                            ) : (
                              <span className="text-stone-300 text-xs italic">-</span>
                            )}
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-xs text-stone-500 font-medium">{item.date}</p>
                          </td>
                          <td className="px-8 py-5">
                            <p className={`font-display font-black text-lg ${
                              item.type === 'Klaim Hadiah' ? 'text-red-500' : 'text-emerald-600'
                            }`}>
                              {item.type === 'Klaim Hadiah' ? '-' : '+'}{item.points?.toLocaleString()} NP
                            </p>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              item.status === 'Success' || item.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                              item.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                              item.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {item.status === 'Success' ? 'Diterima' :
                               item.status === 'Approved' ? 'Diterima' :
                               item.status === 'Pending' ? 'Menunggu' :
                               item.status === 'Rejected' ? 'Ditolak' : item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}
            {activeTab === 'missions' && (
              <motion.div
                key="missions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Create Mission Form */}
                <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl p-10">
                  <h3 className="text-xl font-display font-bold text-stone-900 mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Plus size={20} />
                    </div>
                    Buat Misi Baru
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Judul Misi</label>
                      <input
                        value={missionForm.title}
                        onChange={e => setMissionForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="cth: Scan 3 Sampah Hari Ini"
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Deskripsi</label>
                      <textarea
                        value={missionForm.description}
                        onChange={e => setMissionForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Jelaskan cara menyelesaikan misi ini..."
                        rows={2}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-medium text-stone-700 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Tipe Misi</label>
                      <select
                        value={missionForm.type}
                        onChange={e => setMissionForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="scan">📷 Scan Sampah</option>
                        <option value="login">🔑 Login Harian</option>
                        <option value="read_article">📖 Baca Artikel</option>
                        <option value="photo_proof">📸 Upload Foto Bukti</option>
                        <option value="deposit">♻️ Setor Sampah</option>
                        <option value="quiz">🧠 Quiz Pengetahuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Target</label>
                      <input
                        type="number" min={1} max={10}
                        value={missionForm.target}
                        onChange={e => setMissionForm(p => ({ ...p, target: +e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Reward (NP)</label>
                      <input
                        type="number" min={50} step={50}
                        value={missionForm.rewardPoints}
                        onChange={e => setMissionForm(p => ({ ...p, rewardPoints: +e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Durasi baca — hanya untuk read_article */}
                    {missionForm.type === 'read_article' && (
                      <div className="col-span-2">
                        <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
                          <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Clock size={12} /> Durasi Baca Minimum (menit)
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="number" min={1} max={30}
                              value={missionForm.minReadMinutes}
                              onChange={e => setMissionForm(p => ({ ...p, minReadMinutes: +e.target.value }))}
                              className="w-28 px-5 py-4 bg-white border border-purple-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-purple-500 text-center text-xl"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-purple-700">Tombol "Selesai Baca" baru muncul setelah user membaca selama {missionForm.minReadMinutes} menit.</p>
                              <p className="text-[10px] text-purple-500 mt-1">Rekomendasi: 2–5 menit untuk artikel pendek, 5–10 menit untuk artikel panjang.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form Input Soal & Jawaban Quiz — hanya untuk quiz */}
                    {missionForm.type === 'quiz' && (
                      <div className="col-span-2 space-y-6 p-6 bg-indigo-50/50 rounded-[32px] border border-indigo-100">
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
                          <h4 className="font-display font-bold text-indigo-900 text-sm flex items-center gap-2">
                            <span>🧠 Atur Pertanyaan & Kunci Jawaban</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setQuizQuestions(p => [
                                ...p,
                                {
                                  id: 'q_' + Math.random().toString(36).substr(2, 9),
                                  question: '',
                                  options: { a: '', b: '', c: '', d: '' },
                                  correctAnswer: 'a',
                                  points: 10
                                } as any
                              ]);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                          >
                            <Plus size={14} /> Tambah Soal
                          </button>
                        </div>

                        {quizQuestions.map((q, idx) => (
                          <div key={q.id} className="p-5 bg-white rounded-2xl border border-indigo-100/50 space-y-4 shadow-sm relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-100/50 px-3 py-1 rounded-lg">
                                Soal #{idx + 1}
                              </span>
                              {quizQuestions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizQuestions(p => p.filter(item => item.id !== q.id));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                                >
                                  <Trash2 size={14} /> Hapus Soal
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Pertanyaan / Soal</label>
                              <input
                                value={q.question}
                                onChange={e => {
                                  const text = e.target.value;
                                  setQuizQuestions(prev => prev.map(item => item.id === q.id ? { ...item, question: text } : item));
                                }}
                                placeholder="Tuliskan pertanyaan disini..."
                                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                                <div key={opt}>
                                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Pilihan {opt.toUpperCase()}</label>
                                  <input
                                    value={q.options[opt]}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setQuizQuestions(prev => prev.map(item => item.id === q.id ? {
                                        ...item,
                                        options: { ...item.options, [opt]: val }
                                      } : item));
                                    }}
                                    placeholder={`Pilihan jawaban ${opt}...`}
                                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Kunci Jawaban</label>
                                <select
                                  value={q.correctAnswer}
                                  onChange={e => {
                                    const val = e.target.value as 'a' | 'b' | 'c' | 'd';
                                    setQuizQuestions(prev => prev.map(item => item.id === q.id ? { ...item, correctAnswer: val } : item));
                                  }}
                                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="a">A</option>
                                  <option value="b">B</option>
                                  <option value="c">C</option>
                                  <option value="d">D</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Poin Soal ini</label>
                                <input
                                  type="number"
                                  value={(q as any).points || 10}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setQuizQuestions(prev => {
                                      const updated = prev.map(item => item.id === q.id ? { ...item, points: val } : item);
                                      const totalPoints = updated.reduce((acc, curr) => acc + ((curr as any).points || 0), 0);
                                      setMissionForm(prevForm => ({ ...prevForm, rewardPoints: totalPoints }));
                                      return updated;
                                    });
                                  }}
                                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="pt-4 border-t border-indigo-100">
                          <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2 flex items-center gap-1">
                            <Clock size={12} /> Total Timer yang dibutuhkan (detik)
                          </label>
                          <input
                            type="number"
                            min={10}
                            value={quizTimeLimit}
                            onChange={e => setQuizTimeLimit(parseInt(e.target.value) || 300)}
                            className="w-full px-5 py-4 bg-white border border-indigo-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="cth: 300 (5 menit)"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Mulai</label>
                      <input
                        type="datetime-local"
                        value={missionForm.launchAt}
                        onChange={e => setMissionForm(p => ({ ...p, launchAt: e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Berakhir</label>
                      <input
                        type="datetime-local"
                        value={missionForm.expiresAt}
                        onChange={e => setMissionForm(p => ({ ...p, expiresAt: e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <button
                    disabled={savingMission || !missionForm.title.trim()}
                    onClick={async () => {
                      setSavingMission(true);
                      try {
                        const { createMission } = await import('./services/missionService');
                        await createMission({
                          title: missionForm.title,
                          description: missionForm.description,
                          type: missionForm.type as any,
                          target: missionForm.target,
                          rewardPoints: missionForm.rewardPoints,
                          minReadMinutes: missionForm.type === 'read_article' ? missionForm.minReadMinutes : undefined,
                          questions: missionForm.type === 'quiz' ? quizQuestions : undefined,
                          timeLimitSeconds: missionForm.type === 'quiz' ? quizTimeLimit : undefined,
                          launchAt: new Date(missionForm.launchAt).toISOString(),
                          expiresAt: new Date(missionForm.expiresAt).toISOString(),
                          status: 'active',
                          createdAt: new Date().toISOString(),
                          icon: missionForm.type === 'quiz' ? '🧠' : '🎯',
                        });
                        setMissionForm(p => ({ ...p, title: '', description: '' }));
                        setQuizQuestions([
                          {
                            id: 'q_' + Math.random().toString(36).substr(2, 9),
                            question: '',
                            options: { a: '', b: '', c: '', d: '' },
                            correctAnswer: 'a',
                            points: 10
                          } as any
                        ]);
                        alert('Misi berhasil dibuat!');
                      } catch (e) {
                        alert('Gagal membuat misi.');
                      } finally {
                        setSavingMission(false);
                      }
                    }}
                    className="mt-8 w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-30 flex items-center justify-center gap-3"
                  >
                    {savingMission ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Plus size={18} /> Buat Misi</>}
                  </button>
                </div>

                {/* Mission List */}
                <div className="bg-white rounded-[48px] border border-stone-100 shadow-sm p-10">
                  <h3 className="text-xl font-display font-bold text-stone-900 mb-6">Daftar Misi ({missions.length})</h3>
                  {missions.length === 0 ? (
                    <div className="text-center py-16 text-stone-400">
                      <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold">Belum ada misi dibuat.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {missions.sort((a, b) => b.createdAt?.localeCompare(a.createdAt || '') || 0).map((m: any) => (
                        <div key={m.id} className="p-6 rounded-3xl border border-stone-100 bg-stone-50 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                              m.status === 'active' ? 'bg-emerald-100' : m.status === 'expired' ? 'bg-stone-100' : 'bg-amber-100'
                            }`}>
                              {m.icon || '🎯'}
                            </div>
                            <div>
                              <h4 className="font-bold text-stone-800">{m.title}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  m.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                  m.status === 'expired' ? 'bg-stone-200 text-stone-500' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{m.status}</span>
                                <span className="text-[10px] text-stone-400 font-bold">{m.type} · Target: {m.target} · +{m.rewardPoints} NP</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Hapus misi ini?')) return;
                              const { updateMissionStatus } = await import('./services/missionService');
                              await updateMissionStatus(m.id, 'expired');
                            }}
                            className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'articles' && (
              <motion.div
                key="articles"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Form Tambah Artikel */}
                <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl p-10">
                  <h3 className="text-xl font-display font-bold text-stone-900 mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                      <BookOpen size={20} />
                    </div>
                    Tambah Artikel Edukasi
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Judul Artikel</label>
                      <input
                        value={articleForm.title}
                        onChange={e => setArticleForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="cth: Bahaya Sampah Plastik di Laut"
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Ringkasan (Excerpt)</label>
                      <input
                        value={articleForm.excerpt}
                        onChange={e => setArticleForm(p => ({ ...p, excerpt: e.target.value }))}
                        placeholder="Deskripsi singkat artikel..."
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-medium text-stone-700 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Input URL PDF Google Drive */}
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">URL PDF Google Drive <span className="text-red-400">*</span></label>
                      <div className="flex items-center gap-3 bg-stone-50 border-2 border-stone-200 rounded-2xl px-5 py-4 focus-within:border-blue-400 transition-colors">
                        <BookOpen size={20} className="text-stone-400 shrink-0" />
                        <input
                          value={articleForm.pdfUrl}
                          onChange={e => setArticleForm(p => ({ ...p, pdfUrl: e.target.value }))}
                          placeholder="https://drive.google.com/file/d/..."
                          className="flex-1 bg-transparent outline-none font-medium text-stone-700 placeholder:text-stone-300 text-sm"
                        />
                        {articleForm.pdfUrl && (
                          <button type="button" onClick={() => setArticleForm(p => ({ ...p, pdfUrl: '' }))}
                            className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {/* Panduan Google Drive */}
                      <div className="mt-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-1.5">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Cara dapat link Google Drive:</p>
                        <ol className="text-[10px] text-blue-600 space-y-1 list-decimal list-inside leading-relaxed">
                          <li>Upload PDF ke Google Drive</li>
                          <li>Klik kanan file → <strong>Share</strong></li>
                          <li>Ubah akses ke <strong>"Anyone with the link"</strong></li>
                          <li>Klik <strong>Copy link</strong> → paste di sini</li>
                        </ol>
                        <p className="text-[10px] text-blue-500 mt-2">Format: <span className="font-mono">https://drive.google.com/file/d/ID_FILE/view</span></p>
                      </div>
                      {/* Preview link jika valid */}
                      {articleForm.pdfUrl.includes('drive.google.com') && (
                        <div className="mt-2 flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                          <p className="text-[10px] font-bold text-emerald-700">Link Google Drive terdeteksi ✓</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Penulis</label>
                      <input
                        value={articleForm.author}
                        onChange={e => setArticleForm(p => ({ ...p, author: e.target.value }))}
                        placeholder="cth: Tim NeuroCycle"
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Waktu Baca</label>
                      <input
                        value={articleForm.readTime}
                        onChange={e => setArticleForm(p => ({ ...p, readTime: e.target.value }))}
                        placeholder="cth: 5 min"
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Icon</label>
                      <select
                        value={articleForm.icon}
                        onChange={e => setArticleForm(p => ({ ...p, icon: e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Recycle">♻️ Recycle</option>
                        <option value="Leaf">🌿 Leaf</option>
                        <option value="Droplets">💧 Droplets</option>
                        <option value="TrendingDown">📉 TrendingDown</option>
                        <option value="Sprout">🌱 Sprout</option>
                        <option value="Trees">🌳 Trees</option>
                        <option value="AlertTriangle">⚠️ AlertTriangle</option>
                        <option value="Lightbulb">💡 Lightbulb</option>
                        <option value="ShoppingBag">🛍️️ ShoppingBag</option>
                        <option value="Zap">⚡ Zap</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Warna</label>
                      <select
                        value={articleForm.color}
                        onChange={e => setArticleForm(p => ({ ...p, color: e.target.value }))}
                        className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="emerald">Emerald (Hijau)</option>
                        <option value="blue">Blue (Biru)</option>
                        <option value="amber">Amber (Kuning)</option>
                        <option value="red">Red (Merah)</option>
                        <option value="indigo">Indigo (Ungu)</option>
                        <option value="rose">Rose (Pink)</option>
                        <option value="teal">Teal (Tosca)</option>
                        <option value="green">Green (Hijau Tua)</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                      <label className="text-sm font-bold text-stone-700 flex-1">Langsung Publish?</label>
                      <button
                        type="button"
                        onClick={() => setArticleForm(p => ({ ...p, isPublished: !p.isPublished }))}
                        className={`w-14 h-7 rounded-full transition-colors relative ${
                          articleForm.isPublished ? 'bg-emerald-500' : 'bg-stone-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                          articleForm.isPublished ? 'left-8' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                  <button
                    disabled={savingArticle || !articleForm.title.trim() || !articleForm.pdfUrl.trim()}
                    onClick={async () => {
                      if (!articleForm.pdfUrl.trim()) { alert('Masukkan URL PDF Google Drive terlebih dahulu!'); return; }
                      setSavingArticle(true);
                      try {
                        const { uploadArticle } = await import('./services/missionService');
                        // Konversi link Google Drive ke embed URL
                        let pdfUrl = articleForm.pdfUrl.trim();
                        const match = pdfUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match) {
                          pdfUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                        }
                        await uploadArticle({
                          title: articleForm.title,
                          excerpt: articleForm.excerpt,
                          content: '',
                          author: articleForm.author || 'Admin NeuroCycle',
                          readTime: articleForm.readTime,
                          icon: articleForm.icon,
                          color: articleForm.color,
                          isPublished: articleForm.isPublished,
                          contentType: 'pdf',
                          pdfUrl,
                          createdAt: new Date().toISOString(),
                        });
                        setArticleForm({ title: '', excerpt: '', author: '', readTime: '3 min', icon: 'Recycle', color: 'emerald', isPublished: true, pdfUrl: '' });
                        alert('Artikel berhasil disimpan!');
                      } catch (e) {
                        console.error(e);
                        alert('Gagal menyimpan artikel.');
                      } finally {
                        setSavingArticle(false);
                      }
                    }}
                    className="mt-8 w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-30 flex items-center justify-center gap-3"
                  >
                    {savingArticle ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Plus size={18} /> Simpan Artikel</>}
                  </button>
                </div>

                {/* Daftar Artikel */}
                <div className="bg-white rounded-[48px] border border-stone-100 shadow-sm p-10">
                  <h3 className="text-xl font-display font-bold text-stone-900 mb-6">Daftar Artikel ({firestoreArticles.length})</h3>
                  {firestoreArticles.length === 0 ? (
                    <div className="text-center py-16 text-stone-400">
                      <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold">Belum ada artikel. Tambahkan artikel pertama!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {firestoreArticles.map((a: any) => (
                        <div key={a.id} className="p-6 rounded-3xl border border-stone-100 bg-stone-50 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              a.isPublished ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-400'
                            }`}>
                              <BookOpen size={20} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-stone-800 truncate">{a.title}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  a.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'
                                }`}>
                                  {a.isPublished ? 'Published' : 'Draft'}
                                </span>
                                <span className="text-[10px] text-stone-400 font-bold">{a.author} · {a.readTime}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                const { toggleArticlePublish } = await import('./services/missionService');
                                await toggleArticlePublish(a.id, !a.isPublished);
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                                a.isPublished
                                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                            >
                              {a.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm('Hapus artikel ini?')) return;
                                const { deleteArticle } = await import('./services/missionService');
                                await deleteArticle(a.id);
                              }}
                              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'mission_activity' && (() => {
              const enriched = allMissionProgress
                .filter(p => p.current > 0 || p.completed || p.proofStatus === 'pending_review')
                .map(p => {
                  const u = users.find(u => u.uid === p.userId);
                  const m = missions.find(m => m.id === p.missionId);
                  return { ...p, user: u, mission: m };
                })
                .filter(p => p.mission)
                .sort((a, b) => {
                  // Pending review selalu di atas
                  if (a.proofStatus === 'pending_review' && b.proofStatus !== 'pending_review') return -1;
                  if (b.proofStatus === 'pending_review' && a.proofStatus !== 'pending_review') return 1;
                  return (b.startedAt || '').localeCompare(a.startedAt || '');
                });

              const pendingProofs = enriched.filter(p => p.proofStatus === 'pending_review');
              const others = enriched.filter(p => p.proofStatus !== 'pending_review');

              return (
                <motion.div key="mission_activity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

                  {/* Foto Bukti Menunggu Review */}
                  {pendingProofs.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        <p className="text-sm font-black uppercase tracking-widest text-orange-600">Foto Bukti Menunggu Verifikasi ({pendingProofs.length})</p>
                      </div>
                      {pendingProofs.map((p: any, i: number) => (
                        <div key={i} className="bg-white p-6 rounded-[40px] border-2 border-orange-200 shadow-xl">
                          <div className="flex items-start gap-6">
                            {/* Foto bukti */}
                            <button
                              onClick={() => setSelectedProof({ image: p.pendingProofImage, user: p.user?.displayName || 'User', mission: p.mission?.title || '' })}
                              className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-orange-200 hover:border-orange-500 transition-colors shrink-0"
                            >
                              <img src={p.pendingProofImage} alt="Bukti" className="w-full h-full object-cover" />
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{p.mission?.icon || '🎯'}</span>
                                <p className="font-bold text-stone-800">{p.mission?.title}</p>
                              </div>
                              <p className="text-xs text-stone-500 mb-1">{p.user?.displayName} · {p.user?.email}</p>
                              <p className="text-[10px] text-stone-400">Progress saat ini: {p.current}/{p.target}</p>
                              <div className="flex gap-3 mt-4">
                                <button
                                  onClick={async () => {
                                    const u = users.find(u => u.uid === p.userId);
                                    const { approvePhotoProof } = await import('./services/missionService');
                                    await approvePhotoProof(p.userId, p.missionId, p.current, p.target, p.pendingProofImage, u?.notifications || []);
                                  }}
                                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                                >
                                  <CheckCircle size={16} /> Setujui
                                </button>
                                <button
                                  onClick={async () => {
                                    const u = users.find(u => u.uid === p.userId);
                                    const { rejectPhotoProof } = await import('./services/missionService');
                                    await rejectPhotoProof(p.userId, p.missionId, u?.notifications || []);
                                  }}
                                  className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                >
                                  <XCircle size={16} /> Tolak
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Semua Aktivitas Misi */}
                  <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden">
                    {others.length === 0 && pendingProofs.length === 0 ? (
                      <div className="p-16 text-center">
                        <Award size={48} className="text-stone-200 mx-auto mb-4" />
                        <p className="text-stone-400 font-bold">Belum ada aktivitas misi.</p>
                      </div>
                    ) : others.length === 0 ? (
                      <div className="p-10 text-center text-stone-400 text-sm">Tidak ada aktivitas lain.</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-stone-50/80 border-b border-stone-100">
                          <tr>
                            <th className="px-6 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Pengguna</th>
                            <th className="px-6 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Misi</th>
                            <th className="px-6 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Detail</th>
                            <th className="px-6 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Progress</th>
                            <th className="px-6 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {others.map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                              <td className="px-6 py-5">
                                <p className="font-bold text-stone-800 text-sm">{p.user?.displayName || 'Unknown'}</p>
                                <p className="text-[10px] text-stone-400">{p.user?.email}</p>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{p.mission?.icon || '🎯'}</span>
                                  <div>
                                    <p className="font-bold text-stone-800 text-sm">{p.mission?.title}</p>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                      p.mission?.type === 'scan' ? 'bg-emerald-100 text-emerald-700' :
                                      p.mission?.type === 'read_article' ? 'bg-purple-100 text-purple-700' :
                                      p.mission?.type === 'photo_proof' ? 'bg-orange-100 text-orange-700' :
                                      p.mission?.type === 'deposit' ? 'bg-teal-100 text-teal-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>{p.mission?.type}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                {p.mission?.type === 'read_article' && p.articlesRead?.length > 0 && (
                                  <div className="space-y-1">
                                    {p.articlesRead.map((aid: string, idx: number) => (
                                      <p key={idx} className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                        <BookOpen size={10} /> Artikel #{idx + 1}
                                      </p>
                                    ))}
                                  </div>
                                )}
                               {p.mission?.type === 'photo_proof' && p.proofImages?.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {p.proofImages.map((img: string, idx: number) => (
                                      <button key={idx}
                                        onClick={() => setSelectedProof({ image: img, user: p.user?.displayName || 'User', mission: p.mission?.title || '' })}
                                        className="w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-200 hover:border-emerald-500 transition-colors">
                                        <img src={img} alt="Bukti" className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {p.mission?.type === 'scan' && <p className="text-[10px] text-emerald-600 font-bold">{p.current}x scan</p>}
                                {p.mission?.type === 'deposit' && <p className="text-[10px] text-teal-600 font-bold">{p.current}x setor</p>}
                                {p.mission?.type === 'login' && <p className="text-[10px] text-blue-600 font-bold">Login ✓</p>}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-20 bg-stone-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.min((p.current / p.target) * 100, 100)}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-stone-600">{p.current}/{p.target}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                  p.claimed ? 'bg-emerald-100 text-emerald-700' :
                                  p.completed ? 'bg-amber-100 text-amber-700' :
                                  'bg-stone-100 text-stone-500'
                                }`}>
                                  {p.claimed ? 'Diklaim' : p.completed ? 'Selesai' : 'Berjalan'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </motion.div>
              );
            })()}
            {activeTab === 'rewards' && (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RewardManagement />
              </motion.div>
            )}

            {activeTab === 'error_logs' && (
              <motion.div
                key="error_logs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden">
                  <div className="p-8 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-2xl font-display font-black text-stone-900">Error Logs</h2>
                      <p className="text-xs text-stone-400 font-bold mt-1">Monitor dan kelola error yang tercatat di sistem.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-stone-50 rounded-2xl p-1.5 border border-stone-100">
                        <Filter size={16} className="text-stone-400 ml-2" />
                        <select
                          value={errorLogFilter}
                          onChange={e => setErrorLogFilter(e.target.value as any)}
                          className="bg-transparent text-xs font-black uppercase tracking-widest text-stone-700 outline-none px-2 py-2"
                        >
                          <option value="all">Semua Severity</option>
                          <option value="CRITICAL">Critical</option>
                          <option value="ERROR">Error</option>
                          <option value="WARNING">Warning</option>
                          <option value="INFO">Info</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-stone-50 rounded-2xl p-1.5 border border-stone-100">
                        <select
                          value={errorLogStatus}
                          onChange={e => setErrorLogStatus(e.target.value as any)}
                          className="bg-transparent text-xs font-black uppercase tracking-widest text-stone-700 outline-none px-2 py-2"
                        >
                          <option value="all">Semua Status</option>
                          <option value="unresolved">Unresolved</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-stone-50/50 border-b border-stone-100">
                    <div className="bg-white rounded-2xl p-4 border border-stone-100 text-center">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-2xl font-display font-black text-stone-900">{errorLogStats.total}</p>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Critical</p>
                      <p className="text-2xl font-display font-black text-red-600">{errorLogStats.CRITICAL}</p>
                    </div>
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 text-center">
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Error</p>
                      <p className="text-2xl font-display font-black text-orange-600">{errorLogStats.ERROR}</p>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Warning</p>
                      <p className="text-2xl font-display font-black text-amber-600">{errorLogStats.WARNING}</p>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Unresolved</p>
                      <p className="text-2xl font-display font-black text-blue-600">{errorLogStats.unresolved}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {filteredErrorLogs.length === 0 ? (
                      <div className="p-16 text-center text-stone-500">
                        <Bug size={48} className="mx-auto mb-4 text-stone-300" />
                        <p className="text-xl font-bold mb-2">Tidak ada error logs</p>
                        <p className="text-sm text-stone-400">Belum ada error yang tercatat atau filter tidak menghasilkan data.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-stone-50/80 border-b border-stone-100">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Severity</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Type</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Message</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Context</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Function</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Count</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {filteredErrorLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                  log.severity === 'CRITICAL' ? 'bg-red-100 text-red-600 border-red-200' :
                                  log.severity === 'ERROR' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                  log.severity === 'WARNING' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                                  'bg-blue-100 text-blue-600 border-blue-200'
                                }`}>
                                  {log.severity}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-stone-700 font-mono">{log.type}</span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs font-semibold text-stone-800 max-w-xs truncate" title={log.message}>{log.message}</p>
                                {log.metadata?.errorMessage && (
                                  <p className="text-[10px] text-stone-400 mt-1 truncate max-w-xs" title={log.metadata.errorMessage}>{log.metadata.errorMessage}</p>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-medium text-stone-500">{log.context}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-mono text-stone-500">{log.functionName}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-black text-stone-800">{log.count || 1}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                  log.status === 'fixed' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                                  log.status === 'acknowledged' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                  'bg-red-100 text-red-600 border-red-200'
                                }`}>
                                  {log.status || 'unresolved'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {log.status !== 'acknowledged' && (
                                    <button
                                      onClick={() => handleUpdateErrorLogStatus(log.id, 'acknowledged')}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-100 transition-all"
                                    >
                                      Ack
                                    </button>
                                  )}
                                  {log.status !== 'fixed' && (
                                    <button
                                      onClick={() => handleUpdateErrorLogStatus(log.id, 'fixed')}
                                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-all"
                                    >
                                      Fix
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Modal Preview Foto Aktivitas Admin */}
      <AnimatePresence>
        {selectedPhotoPreview && (
          <div className="fixed inset-0 z-210 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedPhotoPreview(null)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">📸 Preview Bukti Foto</p>
                  <h3 className="font-bold text-stone-800">{selectedPhotoPreview.user}</h3>
                  <p className="text-xs text-stone-400">{selectedPhotoPreview.title}{selectedPhotoPreview.date ? ` · ${selectedPhotoPreview.date}` : ''}</p>
                </div>
                <button onClick={() => setSelectedPhotoPreview(null)} className="p-2 bg-stone-100 rounded-xl text-stone-500">
                  <X size={18} />
                </button>
              </div>
              <div className="rounded-[28px] overflow-hidden border border-stone-100 bg-stone-50">
                <img src={normalizePhotoUrl(selectedPhotoPreview.image)} alt="Preview Bukti" className="w-full max-h-[65vh] object-contain" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Preview Foto Bukti Misi */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedProof(null)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">📸 Bukti Foto Misi</p>
                  <h3 className="font-bold text-stone-800">{selectedProof.user}</h3>
                  <p className="text-xs text-stone-400">{selectedProof.mission}</p>
                </div>
                <button onClick={() => setSelectedProof(null)} className="p-2 bg-stone-100 rounded-xl text-stone-500">
                  <X size={18} />
                </button>
              </div>
              <div className="rounded-[28px] overflow-hidden border border-stone-100">
                <img src={normalizePhotoUrl(selectedProof.image)} alt="Bukti" className="w-full object-cover" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[48px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-10 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white rounded-4xl shadow-sm flex items-center justify-center text-stone-400">
                    <User size={40} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-display font-bold text-stone-900">{selectedUser.displayName}</h2>
                    <p className="text-stone-500 font-medium">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-4 bg-white rounded-2xl text-stone-400 hover:text-stone-600 shadow-sm border border-stone-100"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                <div className="grid grid-cols-3 gap-6 mb-10">
                  <div className="bg-emerald-50 p-6 rounded-4xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Saldo Saat Ini</p>
                    <p className="text-3xl font-display font-black text-emerald-700">{selectedUser.points?.toLocaleString()} NP</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-4xl border border-blue-100 text-center">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Total Pemindaian</p>
                    <p className="text-3xl font-display font-black text-blue-700">{selectedUser.scanHistory?.length || 0}</p>
                  </div>
                  <div className="bg-stone-50 p-6 rounded-4xl border border-stone-100 text-center">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Setoran Sukses</p>
                    <p className="text-3xl font-display font-black text-stone-700">{selectedUser.depositHistory?.filter(d => d.status === 'Approved').length || 0}</p>
                  </div>
                </div>

                <div className="space-y-10">
                  {/* Coin Log / Activity History */}
                  <section>
                    <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <BarChart3 size={16} />
                      Log Aktivitas & Transaksi Poin
                    </h3>
                    <div className="space-y-3">
                      {[
                        ...(selectedUser.scanHistory || []).map(s => ({ ...s, type: 'Scan AI', p: '+25', color: 'emerald' })),
                        ...(selectedUser.depositHistory || []).map(d => ({ ...d, type: 'Setoran TPA', p: d.status === 'Approved' ? `+${d.totalPoints}` : `(${d.status})`, color: d.status === 'Approved' ? 'emerald' : 'amber' })),
                        ...(selectedUser.claimHistory || []).map(c => ({ ...c, type: 'Klaim Hadiah', p: `-${c.points}`, color: 'red' }))
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, i) => {
                        const logLabel = 'name' in log ? log.name : 'title' in log ? log.title : 'Setoran Sampah';
                        return (
                          <div key={i} className="flex items-center justify-between p-4 bg-white border border-stone-100 rounded-2xl">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 bg-${log.color}-50 text-${log.color}-600 rounded-xl flex items-center justify-center`}>
                                {log.type === 'Scan AI' ? <Camera size={18} /> : log.type === 'Setoran TPA' ? <MapPin size={18} /> : <Award size={18} />}
                              </div>
                              <div>
                                <p className="font-bold text-stone-800 text-sm">{log.type}: {logLabel}</p>
                                <p className="text-[10px] text-stone-400 font-bold">{log.date}</p>
                              </div>
                            </div>
                            <p className={`font-display font-black text-lg text-${log.color}-600`}>{log.p} NP</p>
                          </div>
                        );
                      })}
                      {(!selectedUser.scanHistory?.length && !selectedUser.depositHistory?.length && !selectedUser.claimHistory?.length) && (
                        <p className="text-center py-10 text-stone-400 italic text-sm">Belum ada riwayat aktivitas.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showAssignInstModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-6"
            onClick={() => setShowAssignInstModal(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-display font-black text-stone-900 mb-4">Assign Institusi ke Partner</h3>
              <div className="space-y-3">
<select
                   value={selectedInstId}
                   onChange={(e) => setSelectedInstId(e.target.value)}
                   className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                 >
                   <option value="">-- Pilih Institusi --</option>
                   {institutions.filter((inst: any) => inst.status === 'active').map((inst: any) => (
                     <option key={inst.id} value={inst.id}>{inst.name} ({inst.code || '-'})</option>
                   ))}
                 </select>
                <div className="flex gap-3">
                  <button
                    onClick={confirmAssignInstitution}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => { setShowAssignInstModal(false); setAssigningPartnerId(''); setSelectedInstId(''); }}
                    className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {showResetPasswordModal && resetPasswordTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-display font-black text-stone-900 mb-1">Reset Password</h3>
            <p className="text-xs text-stone-500 mb-4">Atur password baru untuk <span className="font-bold text-stone-800">{resetPasswordTarget.name}</span></p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Password Baru"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-stone-900"
              />
              <input
                type="text"
                placeholder="Konfirmasi Password Baru"
                value={confirmNewPasswordInput}
                onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-stone-900"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleResetPassword}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Simpan Password Baru
                </button>
                <button
                  onClick={() => { setShowResetPasswordModal(false); setResetPasswordTarget(null); setNewPasswordInput(''); setConfirmNewPasswordInput(''); }}
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- NeuroBot Chatbot ---
interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

const NeuroBot = ({ userData }: { userData: UserData }) => {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([{
    role: 'bot',
    text: 'Halo ' + (userData.displayName?.split(' ')[0] || 'Kamu') + '! Saya NeuroBot, asisten NeuroCycle. Ada yang bisa saya bantu?'
  }]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const QUICK_REPLIES = [
    'Cara setor sampah?',
    'Cara klaim hadiah?',
    'Bagaimana sistem poin?',
    'Jenis sampah apa saja?',
    'Kenapa setoran saya pending?',
    'Apa itu flagged transaction?',
  ];

  const totalDeposits = userData.depositHistory?.length || 0;
  const totalKg = userData.depositHistory?.reduce((a: number, d: any) => a + (d.totalWeight || 0), 0) || 0;
  const score = userData.scans + (totalDeposits * 3) + Math.floor(totalKg * 0.5);

  const getQuickAnswer = (text: string) => {
    const q = text.toLowerCase();
    if (q.includes('setor') || q.includes('deposit') || q.includes('bank sampah')) {
      return 'Untuk setor sampah, buka menu Setor/Partner, pilih atau scan QR mitra, isi berat dan kategori, lalu unggah foto bukti. Petugas partner akan konfirmasi agar poin masuk ke akunmu.';
    }
    if (q.includes('klaim') || q.includes('hadiah') || q.includes('reward')) {
      return 'Buka menu Reward/Redeem, pilih hadiah yang tersedia, lalu klik klaim. Klaim akan masuk status pending sampai admin menyetujui. Poin akan berkurang setelah klaim berhasil.';
    }
    if (q.includes('poin') || q.includes('neuropoints') || q.includes('np')) {
      return `Poinmu saat ini ${userData.points.toLocaleString()} NP. Poin didapat dari scan AI, setoran sampah, misi harian, dan klaim reward. Total setoran tercatat ${totalDeposits}x dengan total ${totalKg.toFixed(1)} kg.`;
    }
    if (q.includes('sampah') || q.includes('kategori') || q.includes('plastik')) {
      return 'Kategori utama: Plastik, Kertas, Logam, Kaca, Kardus, Organik, Residu, dan B3. Pilah sesuai jenis material agar lebih mudah didaur ulang dan mendapat poin.';
    }
    if (q.includes('pending')) {
      return 'Setoran pending berarti petugas atau admin belum menyetujui. Jika ada foto bukti dan data sudah sesuai, partner bisa klik Konfirmasi di Partner Dashboard agar poin masuk.';
    }
    if (q.includes('flagged')) {
      return 'Flagged berarti transaksi terdeteksi anomali, misalnya berat terlalu besar, frekuensi tinggi, atau waktu tidak wajar. Transaksi tetap bisa ditinjau dan disetujui oleh partner/admin.';
    }
    return '';
  };

  const getGeminiFallbackMessage = (text: string, err: unknown) => {
    console.error('NeuroBot error:', err);
    return getQuickAnswer(text) || 'Maaf, saya sedang tidak bisa menjawab dengan lengkap. Coba tanyakan seputar setor sampah, klaim hadiah, poin, kategori sampah, pending, atau flagged transaction.';
  };

  const buildPrompt = (text: string) => {
    const quickAnswer = getQuickAnswer(text);
    const recentHistory = [
      ...messages.slice(-8),
      { role: 'user' as const, text },
    ]
      .map(msg => `${msg.role === 'user' ? 'User' : 'NeuroBot'}: ${msg.text}`)
      .join('\n');

    return (
      'Kamu adalah NeuroBot, asisten resmi aplikasi NeuroCycle untuk pengelolaan sampah cerdas di Indonesia.\n\n' +
      'Gaya jawaban:\n' +
      '- Gunakan Bahasa Indonesia yang ramah, singkat, jelas, dan praktis.\n' +
      '- Maksimal 4 kalimat atau 4 bullet point.\n' +
      '- Jangan mengarang fitur yang tidak ada. Jika tidak yakin, arahkan user membuka menu terkait atau hubungi admin/partner.\n' +
      '- Gunakan emoji maksimal 1 per jawaban.\n' +
      '- Prioritaskan jawaban berbasis data user dan fitur NeuroCycle.\n\n' +
      'Data user saat ini:\n' +
      `- Nama: ${userData.displayName || 'User'}\n` +
      `- Poin: ${userData.points.toLocaleString()} NeuroPoints\n` +
      `- Level: ${userData.level} (Skor: ${score})\n` +
      `- Streak: ${userData.streak} hari\n` +
      `- Total Scan AI: ${userData.scans}x\n` +
      `- Total Setor: ${totalDeposits}x (${totalKg.toFixed(1)} kg)\n\n` +
      'Jawaban cepat yang wajib dipakai jika relevan:\n' +
      `${quickAnswer || '- Tidak ada jawaban cepat yang cocok; jawab berdasarkan pertanyaan user.'}\n\n` +
      'Riwayat percakapan terakhir:\n' +
      `${recentHistory || '- Belum ada riwayat.'}\n\n` +
      'Pertanyaan user:\n' +
      text
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(buildPrompt(text));
      const rawText = result.response.text().trim();
      const botText = rawText || 'Maaf, saya belum bisa menjawab dengan jelas. Coba tanyakan seputar fitur NeuroCycle seperti setor sampah, klaim hadiah, poin, atau flagged transaction.';
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: getGeminiFallbackMessage(text, err) }]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <>
      {!open && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-28 right-4 z-90 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-300 flex items-center justify-center"
        >
          <Sparkles size={24} />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-24 right-4 left-4 z-90 bg-white rounded-4xl shadow-2xl border border-stone-100 flex flex-col overflow-hidden"
            style={{ maxHeight: '70vh' }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="font-black text-sm">NeuroBot</p>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Asisten NeuroCycle</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center mr-2 shrink-0 mt-1">
                      <Sparkles size={14} className="text-emerald-600" />
                    </div>
                  )}
                  <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center mr-2 shrink-0">
                    <Sparkles size={14} className="text-emerald-600" />
                  </div>
                  <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                    {[0,1,2].map(i => (
                      <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        className="w-1.5 h-1.5 bg-stone-400 rounded-full" />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length === 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {QUICK_REPLIES.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-stone-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder="Tanya sesuatu..."
                className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
// --- Reading Timer Component ---
const ReadingTimer = ({
  minReadMinutes, missionTitle, progressCurrent, progressTarget, onFinish
}: {
  minReadMinutes: number;
  missionTitle: string;
  progressCurrent: number;
  progressTarget: number;
  onFinish: () => void;
}) => {
  const totalSeconds = minReadMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(id); setDone(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  const pct = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/95 backdrop-blur-md border-t border-stone-100 max-w-md mx-auto">
      <div className="mb-3 p-3 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">📖 {missionTitle}</p>
          <p className="text-[10px] text-purple-500 mt-0.5">Progress: {progressCurrent}/{progressTarget}</p>
        </div>
        {!done && (
          <div className="text-right">
            <p className="text-lg font-display font-black text-purple-700">{mm}:{ss}</p>
            <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">tersisa</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="h-2 bg-purple-100 rounded-full overflow-hidden mb-3">
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-purple-500 rounded-full"
          />
        </div>
      )}

      <button
        disabled={!done}
        onClick={onFinish}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
          done
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 active:scale-95'
            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
        }`}
      >
        {done ? (
          <><CheckCircle size={20} /> Selesai Baca — Hitung Progress Misi</>
        ) : (
          <><Clock size={18} /> Baca dulu {mm}:{ss} lagi...</>
        )}
      </button>
    </div>
  );
};

const SuperAdminDashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'institutions' | 'partners' | 'users' | 'user_assignments' | 'transactions' | 'error_logs' | 'inst_passwords' | 'partner_approvals'>('institutions');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignAdminForm, setShowAssignAdminForm] = useState(false);
  const [assigningInstitution, setAssigningInstitution] = useState<any>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [reassigningUser, setReassigningUser] = useState<any>(null);
  const [reassignInstitutionId, setReassignInstitutionId] = useState('');
  const [expandedInstId, setExpandedInstId] = useState<string | null>(null);
  const [instDetailTab, setInstDetailTab] = useState<'partners' | 'users' | 'transactions'>('partners');
  const [instPartners, setInstPartners] = useState<any[]>([]);
  const [instUsers, setInstUsers] = useState<any[]>([]);
  const [instTransactions, setInstTransactions] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'institutions'), (snap) => {
      setInstitutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, 'partners'), (snap) => {
      setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub4 = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    const unsub5 = onSnapshot(collection(db, 'errorLogs'), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setErrorLogs(logs);
    });
    setLoading(false);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  const stats = useMemo(() => ({
    totalPartners: partners.length,
    totalUsers: users.length,
    totalErrors: errorLogs.length,
    totalInstitutions: institutions.length,
    approvedPartners: partners.filter((p: any) => p.status === 'approved').length,
    pendingPartners: partners.filter((p: any) => p.status === 'pending').length,
  }), [partners, users, errorLogs, institutions]);

  const openAssignAdminForm = (inst: any) => {
    setAssigningInstitution(inst);
    setSelectedUserEmail('');
    setShowAssignAdminForm(true);
  };

  const handleAssignAdmin = async () => {
    if (!assigningInstitution || !selectedUserEmail.trim()) {
      alert('Email user harus diisi!');
      return;
    }
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', selectedUserEmail.trim()));
      const usersSnap = await getDocs(usersQuery);
      
      if (usersSnap.empty) {
        alert('User dengan email tersebut tidak ditemukan!');
        return;
      }

      const userDoc = usersSnap.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        role: 'institution_admin',
        institutionId: assigningInstitution.id,
        institutionName: assigningInstitution.name || ''
      });

      await updateDoc(doc(db, 'institutions', assigningInstitution.id), {
        adminUid: userDoc.id
      });

      alert('Admin institusi berhasil diassign!');
      setShowAssignAdminForm(false);
      setAssigningInstitution(null);
      setSelectedUserEmail('');
    } catch (e) {
      console.error('Gagal assign admin:', e);
      alert('Gagal assign admin institusi');
    }
  };

  const handleReassignInstitution = async () => {
    if (!reassigningUser || !reassignInstitutionId) {
      alert('Pilih institusi terlebih dahulu!');
      return;
    }
    try {
      const instDoc = institutions.find(i => i.id === reassignInstitutionId);
      await updateDoc(doc(db, 'users', reassigningUser.id), {
        institutionId: reassignInstitutionId,
        institutionName: instDoc?.name || ''
      });

      alert('Institusi user berhasil diubah!');
      setReassigningUser(null);
      setReassignInstitutionId('');
    } catch (e) {
      console.error('Gagal reassign institution:', e);
      alert('Gagal mengubah institusi user');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-black">Super Admin Dashboard</h1>
          <p className="text-stone-400 text-xs">Kelola seluruh platform NeuroCycle</p>
        </div>
        <button onClick={onLogout} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold hover:bg-red-700">Logout</button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Total Partners</p>
            <p className="text-2xl font-black text-stone-900">{stats.totalPartners}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Total Users</p>
            <p className="text-2xl font-black text-stone-900">{stats.totalUsers}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Approved Partners</p>
            <p className="text-2xl font-black text-emerald-600">{stats.approvedPartners}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Error Logs</p>
            <p className="text-2xl font-black text-red-600">{stats.totalErrors}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Institutions</p>
            <p className="text-2xl font-black text-blue-600">{stats.totalInstitutions}</p>
          </div>
        </div>

        {showAssignAdminForm && assigningInstitution && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl">
              <h3 className="text-xl font-display font-black mb-2">Assign Admin ke {assigningInstitution.name}</h3>
              <p className="text-sm text-stone-500 mb-6">Masukkan email user yang akan dijadikan institution admin.</p>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email User"
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="w-full bg-stone-50 px-5 py-4 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleAssignAdmin}
                    className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all"
                  >
                    Assign Admin
                  </button>
                  <button
                    onClick={() => {
                      setShowAssignAdminForm(false);
                      setAssigningInstitution(null);
                      setSelectedUserEmail('');
                    }}
                    className="px-6 py-4 bg-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-300 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {reassigningUser && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl">
              <h3 className="text-xl font-display font-black mb-2">Assign Institusi ke {reassigningUser.displayName || reassigningUser.email}</h3>
              <p className="text-sm text-stone-500 mb-6">Pilih institusi yang akan terhubung dengan user ini.</p>
              <div className="space-y-4">
                <select
                  value={reassignInstitutionId}
                  onChange={(e) => setReassignInstitutionId(e.target.value)}
                  className="w-full bg-stone-50 px-5 py-4 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500"
                >
<option value="">-- Pilih Institusi --</option>
                   {institutions.filter((inst: any) => inst.status === 'active').map((inst: any) => (
                     <option key={inst.id} value={inst.id}>{inst.name} ({inst.code || '-'})</option>
                   ))}
                </select>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleReassignInstitution}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => { setReassigningUser(null); setReassignInstitutionId(''); }}
                    className="px-6 py-4 bg-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-300 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

{activeTab === 'institutions' && (
<div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Daftar Institusi</h3>
              <p className="text-xs text-stone-500 mt-1">Verifikasi institusi yang mendaftar sebagai Institution Admin.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tipe</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Approve Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-center">Partner</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {institutions.map((inst: any) => (
                    <tr key={inst.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{inst.name}</td>
                      <td className="px-6 py-4 text-xs text-stone-500 capitalize">{inst.type || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{inst.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${inst.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : inst.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : inst.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                          {inst.approvalStatus === 'approved' ? 'Disetujui' : inst.approvalStatus === 'pending' ? 'Menunggu' : inst.approvalStatus === 'rejected' ? 'Ditolak' : 'Belum Diproses'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${inst.status === 'active' ? 'bg-blue-100 text-blue-700 border-blue-200' : inst.status === 'suspended' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                          {inst.status === 'active' ? 'Aktif' : inst.status === 'suspended' ? 'Suspended' : inst.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-black text-stone-800">{partners.filter((p: any) => p.institutionId === inst.id).length}</td>
                      <td className="px-6 py-4 text-xs text-stone-400">{inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Approve / Tolak — hanya untuk pending */}
                          {inst.approvalStatus === 'pending' && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'institutions', inst.id), { approvalStatus: 'approved', status: 'active' });
                                    const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                    if (adminUser) {
                                      const notifs = [...(adminUser.notifications || [])];
                                      notifs.unshift({
                                        id: Math.random().toString(36).substr(2, 9),
                                        title: 'Institusi Disetujui! 🎊',
                                        message: `Institusi "${inst.name}" Anda telah disetujui oleh Super Admin. Anda sekarang bisa login sebagai Institution Admin.`,
                                        date: new Date().toLocaleString('id-ID'),
                                        type: 'success',
                                        isRead: false
                                      });
                                      await updateDoc(doc(db, 'users', adminUser.id || adminUser.uid), { notifications: notifs });
                                    }
                                    alert(`✅ Institusi "${inst.name}" berhasil disetujui!`);
                                  } catch (e) {
                                    console.error('Gagal approve institusi:', e);
                                    alert('Gagal menyetujui institusi');
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  const reason = prompt(`Alasan penolakan untuk "${inst.name}":`) || 'Tidak memenuhi kriteria';
                                  try {
                                    await updateDoc(doc(db, 'institutions', inst.id), { approvalStatus: 'rejected', status: 'suspended' });
                                    const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                    if (adminUser) {
                                      const notifs = [...(adminUser.notifications || [])];
                                      notifs.unshift({
                                        id: Math.random().toString(36).substr(2, 9),
                                        title: 'Institusi Ditolak',
                                        message: `Institusi "${inst.name}" ditolak oleh Super Admin. Alasan: ${reason}`,
                                        date: new Date().toLocaleString('id-ID'),
                                        type: 'warning',
                                        isRead: false
                                      });
                                      await updateDoc(doc(db, 'users', adminUser.id || adminUser.uid), { notifications: notifs });
                                    }
                                    alert(`❌ Institusi "${inst.name}" ditolak.`);
                                  } catch (e) {
                                    console.error('Gagal reject institusi:', e);
                                    alert('Gagal menolak institusi');
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-all active:scale-95"
                              >
                                Tolak
                              </button>
                            </>
                          )}

                          {/* Tombol Aktifkan — untuk yang status bukan active (suspended/rejected/belum diproses) */}
                          {inst.status !== 'active' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Aktifkan institusi "${inst.name}"? Institusi akan bisa digunakan partner untuk mendaftar.`)) return;
                                try {
                                  await updateDoc(doc(db, 'institutions', inst.id), {
                                    status: 'active',
                                    approvalStatus: 'approved'
                                  });
                                  const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                  if (adminUser) {
                                    const notifs = [...(adminUser.notifications || [])];
                                    notifs.unshift({
                                      id: Math.random().toString(36).substr(2, 9),
                                      title: '✅ Institusi Diaktifkan',
                                      message: `Institusi "${inst.name}" telah diaktifkan oleh Super Admin. Anda sekarang bisa login.`,
                                      date: new Date().toLocaleString('id-ID'),
                                      type: 'success',
                                      isRead: false
                                    });
                                    await updateDoc(doc(db, 'users', adminUser.id || adminUser.uid), { notifications: notifs });
                                  }
                                  alert(`✅ Institusi "${inst.name}" berhasil diaktifkan!`);
                                } catch (e) {
                                  console.error('Gagal aktifkan institusi:', e);
                                  alert('Gagal mengaktifkan institusi');
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
                            >
                              Aktifkan
                            </button>
                          )}

                          {/* Tombol Nonaktifkan/Ban — untuk yang status active atau approved */}
                          {inst.status === 'active' && (
                            <button
                              onClick={async () => {
                                const reason = prompt(`Alasan nonaktifkan/banned "${inst.name}"? (opsional)`);
                                if (reason === null) return; // user cancel
                                try {
                                  await updateDoc(doc(db, 'institutions', inst.id), {
                                    status: 'suspended',
                                    approvalStatus: 'rejected',
                                    suspendReason: reason || 'Dinonaktifkan oleh Super Admin',
                                    suspendedAt: new Date().toISOString()
                                  });
                                  const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                  if (adminUser) {
                                    const notifs = [...(adminUser.notifications || [])];
                                    notifs.unshift({
                                      id: Math.random().toString(36).substr(2, 9),
                                      title: '🚫 Institusi Dinonaktifkan',
                                      message: `Institusi "${inst.name}" telah dinonaktifkan oleh Super Admin.${reason ? ` Alasan: ${reason}` : ''}`,
                                      date: new Date().toLocaleString('id-ID'),
                                      type: 'warning',
                                      isRead: false
                                    });
                                    await updateDoc(doc(db, 'users', adminUser.id || adminUser.uid), { notifications: notifs });
                                  }
                                  alert(`🚫 Institusi "${inst.name}" berhasil dinonaktifkan.`);
                                } catch (e) {
                                  console.error('Gagal nonaktifkan institusi:', e);
                                  alert('Gagal menonaktifkan institusi');
                                }
                              }}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-sm"
                            >
                              Nonaktifkan
                            </button>
                          )}

                          {/* Jika tidak ada aksi yang relevan */}
                          {inst.approvalStatus !== 'pending' && inst.status !== 'active' && inst.status === 'suspended' && (
                            <span className="text-[10px] text-stone-400 italic">Suspended</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {institutions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-stone-400 text-sm">
                        Belum ada institusi terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'institutions', label: 'Institutions' },
            { id: 'partners', label: 'Partners' },
            { id: 'partner_approvals', label: '✅ Persetujuan Partner' },
            { id: 'users', label: 'Users' },
            { id: 'user_assignments', label: 'Kelola User' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'inst_passwords', label: '? Password Institusi' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
              {tab.label}
              {tab.id === 'partner_approvals' && partners.filter((p: any) => p.status === 'pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {partners.filter((p: any) => p.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'partner_approvals' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-display font-black">Persetujuan Partner</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Partner yang mengisi form pendaftaran dan menunggu persetujuan Super Admin.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-center">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Menunggu</p>
                  <p className="text-xl font-black text-amber-700">{partners.filter((p: any) => p.status === 'pending').length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Disetujui</p>
                  <p className="text-xl font-black text-emerald-700">{partners.filter((p: any) => p.status === 'approved').length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-center">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Ditolak</p>
                  <p className="text-xl font-black text-red-700">{partners.filter((p: any) => p.status === 'rejected').length}</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama Partner</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Telepon</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Institusi</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tanggal Daftar</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {partners
                    .slice()
                    .sort((a: any, b: any) => {
                      if (a.status === 'pending' && b.status !== 'pending') return -1;
                      if (a.status !== 'pending' && b.status === 'pending') return 1;
                      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    })
                    .map((p: any) => (
                    <tr key={p.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-stone-800">{p.name}</p>
                          {p.address && <p className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[180px]">{p.address}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-500">{p.email || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{p.phone || '-'}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-stone-700">
                        {institutions.find((i: any) => i.id === p.institutionId)?.name || (
                          <span className="text-stone-300 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-400">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          p.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          p.status === 'pending'  ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          p.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>
                          {p.status === 'approved' ? 'Disetujui' : p.status === 'pending' ? 'Menunggu' : p.status === 'rejected' ? 'Ditolak' : p.status}
                        </span>
                        {p.rejectionReason && (
                          <p className="text-[10px] text-red-500 mt-1 max-w-[140px]">{p.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'partners', p.id), {
                                    status: 'approved',
                                    approvedAt: new Date().toISOString(),
                                    approvedBy: 'super_admin'
                                  });
                                  const instAdmin = users.find((u: any) =>
                                    u.role === 'institution_admin' && u.institutionId === p.institutionId
                                  );
                                  if (instAdmin) {
                                    const notifs = [...(instAdmin.notifications || [])];
                                    notifs.unshift({
                                      id: Math.random().toString(36).substr(2, 9),
                                      title: '✅ Partner Disetujui',
                                      message: `Partner "${p.name}" telah disetujui oleh Super Admin dan sekarang dapat login ke sistem.`,
                                      date: new Date().toLocaleString('id-ID'),
                                      type: 'success',
                                      isRead: false
                                    });
                                    await updateDoc(doc(db, 'users', instAdmin.id), { notifications: notifs });
                                  }
                                  alert(`✅ Partner "${p.name}" berhasil disetujui! Partner sekarang dapat login.`);
                                } catch (e) {
                                  console.error('Gagal approve partner:', e);
                                  alert('Gagal menyetujui partner.');
                                }
                              }}
                              className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                const reason = prompt(`Masukkan alasan penolakan untuk "${p.name}":`);
                                if (reason === null) return;
                                try {
                                  await updateDoc(doc(db, 'partners', p.id), {
                                    status: 'rejected',
                                    rejectionReason: reason || 'Tidak memenuhi kriteria',
                                    rejectedAt: new Date().toISOString(),
                                    rejectedBy: 'super_admin'
                                  });
                                  alert(`❌ Partner "${p.name}" telah ditolak.`);
                                } catch (e) {
                                  console.error('Gagal reject partner:', e);
                                  alert('Gagal menolak partner.');
                                }
                              }}
                              className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-all active:scale-95"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : p.status === 'rejected' ? (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'partners', p.id), {
                                  status: 'pending',
                                  rejectionReason: '',
                                  rejectedAt: null
                                });
                                alert('Status partner direset ke pending.');
                              } catch (e) {
                                alert('Gagal mereset status.');
                              }
                            }}
                            className="px-3 py-2 bg-stone-50 text-stone-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 hover:bg-stone-100 transition-all"
                          >
                            Reset
                          </button>
                        ) : (
                          <span className="text-xs text-stone-300 italic">Sudah diproses</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {partners.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm">
                        Belum ada partner yang mendaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'partners' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Daftar Partner</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Password</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Institusi</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Owner UID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {partners.map((p: any) => (
                    <tr key={p.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{p.name}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{p.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          p.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          p.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-semibold text-stone-700">{p.password || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-600">{institutions.find((i: any) => i.id === p.institutionId)?.name || p.institutionId || '-'}</td>
                      <td className="px-6 py-4 text-[10px] font-mono text-stone-400">{p.ownerUid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Daftar Users</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Role</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{u.displayName || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{u.email || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{u.role || 'user'}</td>
                      <td className="px-6 py-4 text-xs font-black text-stone-800">{u.points || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'error_logs' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Error Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Severity</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Type</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Message</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Context</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {errorLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          log.severity === 'CRITICAL' ? 'bg-red-100 text-red-600 border-red-200' :
                          log.severity === 'ERROR' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                          log.severity === 'WARNING' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                          'bg-blue-100 text-blue-600 border-blue-200'
                        }`}>{log.severity}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-stone-700 font-mono">{log.type}</td>
                      <td className="px-6 py-4 text-xs text-stone-600 max-w-xs truncate">{log.message}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{log.context}</td>
                      <td className="px-6 py-4 text-xs font-black text-stone-800">{log.count || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-black">Semua Transaksi</h3>
                <p className="text-xs text-stone-500 mt-1">Detail setoran sampah per transaksi</p>
              </div>
              <span className="text-xs font-black text-stone-400 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
                {transactions.length} transaksi
              </span>
            </div>

            {/* Header kolom */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_2.5fr_1fr_1fr_1.5fr] gap-4 px-6 py-3 bg-stone-50 border-b border-stone-100">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Partner</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">User</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Setoran</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</span>
            </div>

            <div className="divide-y divide-stone-50">
              {transactions.slice(0, 100).map((tx: any) => {
                const itemsList: {category: string; weight: number}[] = tx.items && tx.items.length > 0
                  ? tx.items
                  : tx.category
                    ? [{ category: tx.category, weight: tx.totalWeight || tx.weight || 0 }]
                    : [];
                const totalW = tx.totalWeight || tx.weight || itemsList.reduce((s: number, i: any) => s + (i.weight || 0), 0);

                return (
                  <div key={tx.id} className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_2.5fr_1fr_1fr_1.5fr] gap-4 px-6 py-5 hover:bg-stone-50/60 transition-colors items-start">

                    {/* Partner */}
                    <div>
                      <p className="text-sm font-bold text-stone-800 leading-tight">{tx.partnerName || '-'}</p>
                      {tx.partnerEmail && <p className="text-[10px] text-stone-400 mt-0.5">{tx.partnerEmail}</p>}
                    </div>

                    {/* User */}
                    <div>
                      <p className="text-xs font-semibold text-stone-700">{tx.userName || tx.userDisplayName || '-'}</p>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5 truncate max-w-[140px]">{tx.userEmail || tx.userToken || ''}</p>
                    </div>

                    {/* Setoran detail */}
                    <div>
                      <p className="text-base font-black text-stone-900">{typeof totalW === 'number' ? totalW.toFixed(1) : totalW} kg</p>
                      {itemsList.length > 0 ? (
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                          {itemsList.map((it: any) => `${it.category} (${it.weight}kg)`).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic mt-0.5">-</p>
                      )}
                      <p className="text-xs font-black text-emerald-600 mt-1">+{(tx.totalPoints || 0).toLocaleString()} NP</p>
                    </div>

                    {/* Bukti foto */}
                    <div>
                      {tx.photoUrl ? (
                        <img
                          src={tx.photoUrl}
                          alt="bukti"
                          className="w-12 h-12 rounded-xl object-cover border border-stone-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(tx.photoUrl, '_blank')}
                        />
                      ) : (
                        <span className="text-[10px] text-stone-300 italic">Tanpa foto</span>
                      )}
                    </div>

                    {/* Tanggal */}
                    <div>
                      <p className="text-[11px] text-stone-600 font-semibold leading-snug">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        tx.status === 'pending'  ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        tx.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                        tx.status === 'flagged_for_review' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-stone-100 text-stone-700 border-stone-200'
                      }`}>
                        {tx.status === 'approved' ? 'Diterima' :
                         tx.status === 'pending' ? 'Menunggu' :
                         tx.status === 'rejected' ? 'Ditolak' :
                         tx.status === 'flagged_for_review' ? 'Flagged' :
                         tx.status || '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {transactions.length === 0 && (
              <div className="px-6 py-12 text-center text-stone-400 text-sm">
                Belum ada transaksi.
              </div>
            )}
          </div>
        )}

        {activeTab === 'user_assignments' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Kelola User & Institusi</h3>
              <p className="text-xs text-stone-500 mt-1">Lihat dan ubah institusi yang terhubung dengan setiap user.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">User</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Role</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Institusi Terhubung</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Kode Institusi</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map((u: any) => {
                    const inst = institutions.find(i => i.id === u.institutionId);
                    const userCode = u.institutionCode || inst?.code || '-';
                    return (
                      <tr key={u.id} className="hover:bg-stone-50/50">
                        <td className="px-6 py-4 text-sm font-bold text-stone-800">{u.displayName || '-'}</td>
                        <td className="px-6 py-4 text-xs text-stone-500">{u.email || '-'}</td>
                        <td className="px-6 py-4 text-xs text-stone-500">{u.role || 'user'}</td>
                        <td className="px-6 py-4 text-xs text-stone-800 font-semibold">{inst?.name || u.institutionName || '-'}</td>
                        <td className="px-6 py-4 text-xs font-mono text-blue-600 font-bold">{userCode}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => { setReassigningUser(u); setReassignInstitutionId(u.institutionId || ''); }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-100"
                          >
                            Assign Institusi
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inst_passwords' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Lock size={18} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-black">Password Admin Institusi</h3>
                  <p className="text-xs text-stone-400">Data lengkap pendaftar institusi — email, password, kode, dan status persetujuan</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-1.5 text-center">
                  <p className="text-[10px] font-black text-amber-600 uppercase">Menunggu</p>
                  <p className="text-lg font-black text-amber-700">{institutions.filter((i: any) => i.approvalStatus === 'pending').length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-1.5 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Aktif</p>
                  <p className="text-lg font-black text-emerald-700">{institutions.filter((i: any) => i.approvalStatus === 'approved').length}</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Institusi</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tipe</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Kode</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email Admin</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Password</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Telepon</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tgl Daftar</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Approval</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {institutions
                    .slice()
                    .sort((a: any, b: any) => {
                      // pending first
                      if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
                      if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') return 1;
                      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    })
                    .map((inst: any) => {
                    const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                    return (
                      <tr key={inst.id} className="hover:bg-stone-50/50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-stone-800">{inst.name}</p>
                          {inst.address && <p className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[160px]">{inst.address}</p>}
                        </td>
                        <td className="px-6 py-4 text-xs text-stone-500 capitalize">{inst.type || '-'}</td>
                        <td className="px-6 py-4">
                          {inst.code ? (
                            <code className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{inst.code}</code>
                          ) : (
                            <span className="text-stone-300 italic text-xs">Belum ada kode</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-stone-600">
                          {adminUser?.email || inst.email || <span className="text-stone-300 italic">Belum ada admin</span>}
                        </td>
                        <td className="px-6 py-4">
                          {adminUser?.password ? (
                            <div className="flex items-center gap-2">
                              <code className="bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-mono text-stone-700 border border-stone-200">{adminUser.password}</code>
                              <button
                                onClick={() => { navigator.clipboard.writeText(adminUser.password); alert('Password berhasil disalin!'); }}
                                className="p-1.5 bg-stone-100 rounded-lg hover:bg-stone-200 transition-all"
                                title="Salin password"
                              >
                                <Copy size={12} className="text-stone-500" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-stone-300 italic text-xs">Belum ada password</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-stone-500">{inst.phone || adminUser?.phone || '-'}</td>
                        <td className="px-6 py-4 text-xs text-stone-400">
                          {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                            inst.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            inst.approvalStatus === 'pending'  ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            inst.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-stone-100 text-stone-500 border-stone-200'
                          }`}>
                            {inst.approvalStatus === 'approved' ? '✓ Disetujui' :
                             inst.approvalStatus === 'pending'  ? '⏳ Menunggu' :
                             inst.approvalStatus === 'rejected' ? '✗ Ditolak' : 'Belum Diproses'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                            adminUser ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-400 border-stone-200'
                          }`}>{adminUser ? 'Terdaftar' : 'Belum Terdaftar'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {institutions.length === 0 && (
                <div className="px-6 py-12 text-center text-stone-400 text-sm">
                  Belum ada institusi terdaftar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InstitutionAdminDashboard = ({ onLogout, adminUserId }: { onLogout: () => void; adminUserId?: string | null }) => {
  const [activeTab, setActiveTab] = useState<'partners' | 'pending_partners' | 'users' | 'transactions'>('partners');
  const [institution, setInstitution] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [institutionId, setInstitutionId] = useState<string>('');
    const [institutionNotFound, setInstitutionNotFound] = useState(false);
    const [showAddPartnerForm, setShowAddPartnerForm] = useState(false);
    const [newPartner, setNewPartner] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
    const [assigningUser, setAssigningUser] = useState<string | null>(null);
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<{ image: string; user: string; title: string; date?: string } | null>(null);

   useEffect(() => {
     const fetchInstitution = async () => {
       try {
         setInstitutionNotFound(false);
         const adminUid = adminUserId || auth.currentUser?.uid || '';
         const userRef = doc(db, 'users', adminUid);
         const userSnap = await getDoc(userRef);
         if (userSnap.exists()) {
           const userData = userSnap.data() as any;
           let instId = userData.institutionId || '';
           let instName = userData.institutionName || '';
           
           if (!instId && userData.institutionCode) {
             const instQuery = query(collection(db, 'institutions'), where('code', '==', userData.institutionCode.toUpperCase()));
             const instSnap = await getDocs(instQuery);
             if (!instSnap.empty) {
               instId = instSnap.docs[0].id;
               instName = instSnap.docs[0].data().name || '';
               await updateDoc(userRef, { institutionId: instId, institutionName: instName });
             }
           }
           
           if (instId) {
             const instRef = doc(db, 'institutions', instId);
             const instSnap = await getDoc(instRef);
             
             if (instSnap.exists()) {
               setInstitutionId(instId);
               setInstitution({ id: instSnap.id, ...instSnap.data() });
             } else {
               setInstitutionId('');
               setInstitution(null);
               setInstitutionNotFound(true);
             }
           } else {
             setInstitutionId('');
             setInstitution(null);
             setInstitutionNotFound(true);
           }
         }
       } catch (e) {
         console.error('Gagal memuat data institusi:', e);
         setInstitutionNotFound(true);
       } finally {
         setLoading(false);
       }
     };

     fetchInstitution();
   }, []);

   useEffect(() => {
     if (!institutionId) return;

     const unsub1 = onSnapshot(query(collection(db, 'partners'), where('institutionId', '==', institutionId)), (snap) => {
       const partnersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setPartners(partnersList);
     });

     const partnerIds = partners.map(p => p.id);

      const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
         let allTx = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
         allTx = allTx.filter(tx => {
           const byPartnerId = tx.partnerId && partnerIds.includes(tx.partnerId);
           const byPartnerUid = tx.partnerUid && partnerIds.includes(tx.partnerUid);
           return byPartnerId || byPartnerUid;
         });
       setTransactions(allTx.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

       const userTxCount = new Map<string, any[]>();
       allTx.forEach(tx => {
         const uid = tx.userUid || tx.userToken;
         if (!uid) return;
         if (!userTxCount.has(uid)) userTxCount.set(uid, []);
         userTxCount.get(uid)!.push(tx);
       });

       const flaggedIds = new Set<string>();
       userTxCount.forEach((txs, uid) => {
         const sorted = txs.sort((a, b) => new Date(a.createdAt || Date.now()).getTime() - new Date(b.createdAt || Date.now()).getTime());
         for (let i = 0; i < sorted.length; i++) {
           const tx = sorted[i];
           const reason: string[] = [];
           if ((tx.totalWeight || tx.weight || 0) > 50) reason.push('Berat melebihi 50kg');
           const sameDay = sorted.filter(t => {
             const d1 = new Date(t.createdAt || Date.now());
             const d2 = new Date(tx.createdAt || Date.now());
             return d1.toDateString() === d2.toDateString();
           });
           if (sameDay.length > 3) reason.push(`Transaksi lebih dari 3x sehari`);
           if (reason.length > 0) {
             flaggedIds.add(tx.id);
             const reviewRef = doc(db, 'adminReviews', tx.id);
             setDoc(reviewRef, { txId: tx.id, reason: reason.join(', '), status: 'pending', createdAt: tx.createdAt || new Date().toISOString() }, { merge: true }).catch(() => {});
           }
         }
       });

       setTransactions(prev => prev.map(tx => ({
         ...tx,
         status: flaggedIds.has(tx.id) ? 'flagged_for_review' : tx.status
       })));
     });

     return () => { 
       unsub1(); 
       unsubTx(); 
     };
   }, [institutionId, partners]);

    useEffect(() => {
      if (!institutionId) return;
      const unsub = onSnapshot(
        query(collection(db, 'users'), where('institutionId', '==', institutionId)),
        (snap) => {
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.error('Error loading institution users:', err);
        }
      );
      return () => unsub();
    }, [institutionId]);

  const handleApprovePartner = async (partnerId: string) => {
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'approved', approvedAt: new Date().toISOString() });
      alert('Partner berhasil disetujui!');
    } catch (e) {
      console.error('Gagal approve partner:', e);
      alert('Gagal menyetujui partner');
    }
  };

  const handleRejectPartner = async (partnerId: string) => {
    const reason = prompt('Masukkan alasan penolakan:') || 'Tidak memenuhi kriteria';
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'rejected', rejectionReason: reason });
      alert('Partner berhasil ditolak.');
    } catch (e) {
      console.error('Gagal reject partner:', e);
      alert('Gagal menolak partner');
    }
  };

  const handleAddPartner = async () => {
    if (!newPartner.name.trim() || !newPartner.email.trim()) {
      alert('Nama dan email partner harus diisi!');
      return;
    }
    try {
      if (!institutionId) {
        alert('Institusi belum terdeteksi. Hubungi Super Admin untuk mengatur institusi Anda.');
        return;
      }
      const partnerRef = doc(collection(db, 'partners'));
      await setDoc(partnerRef, {
        name: newPartner.name.trim(),
        email: newPartner.email.trim(),
        phone: newPartner.phone.trim(),
        address: newPartner.address.trim(),
        notes: newPartner.notes.trim(),
        ownerUid: adminUserId || auth.currentUser?.uid || '',
        institutionId: institutionId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      alert('Partner berhasil ditambahkan dan menunggu persetujuan!');
      setShowAddPartnerForm(false);
      setNewPartner({ name: '', email: '', phone: '', address: '', notes: '' });
    } catch (e) {
      console.error('Gagal menambah partner:', e);
      alert('Gagal menambah partner');
    }
  };

  const handleAssignUserToPartner = async (userId: string) => {
    if (!selectedPartnerId) {
      alert('Pilih partner terlebih dahulu!');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      const partnerRef = doc(db, 'partners', selectedPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (!partnerSnap.exists()) {
        alert('Partner tidak ditemukan!');
        return;
      }
      const partnerData = partnerSnap.data();
      await updateDoc(userRef, {
        partnerId: selectedPartnerId,
        partnerName: partnerData.name || '',
      });
      alert('User berhasil di-assign ke partner!');
      setAssigningUser(null);
      setSelectedPartnerId('');
    } catch (e) {
      console.error('Gagal assign user:', e);
      alert('Gagal assign user ke partner');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus user dari institusi ini?')) return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        institutionId: null,
        partnerId: null,
        partnerName: ''
      });
      alert('User berhasil dihapus dari institusi.');
    } catch (e) {
      console.error('Gagal menghapus user:', e);
      alert('Gagal menghapus user');
    }
  };

  const handleInstitutionApprovePartner = async (partnerId: string) => {
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'approved', approvedAt: new Date().toISOString() });
      alert('Partner berhasil disetujui!');
    } catch (e) {
      console.error('Gagal approve partner:', e);
      alert('Gagal menyetujui partner');
    }
  };

  const handleInstitutionRejectPartner = async (partnerId: string, partnerEmail: string, partnerName: string) => {
    const reason = prompt('Masukkan alasan penolakan:') || 'Tidak memenuhi kriteria';
    try {
      const partnerRef = doc(db, 'partners', partnerId);
      await updateDoc(partnerRef, { status: 'rejected', rejectionReason: reason });

      const usersQuery = query(collection(db, 'users'), where('email', '==', partnerEmail));
      const usersSnap = await getDocs(usersQuery);
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        const userData = userDoc.data() as any;
        const newNotification: NotificationItem = {
          id: Math.random().toString(36).substr(2, 9),
          title: 'Pendaftaran Partner Ditolak',
          message: `Pendaftaran ${partnerName} sebagai partner ditolak oleh admin institusi. Alasan: ${reason}`,
          date: new Date().toLocaleString('id-ID'),
          type: 'warning',
          isRead: false
        };
        const updatedNotifications = [newNotification, ...(userData.notifications || [])];
        await updateDoc(doc(db, 'users', userDoc.id), { notifications: updatedNotifications });
      }

      alert('Partner berhasil ditolak.');
    } catch (e) {
      console.error('Gagal reject partner:', e);
      alert('Gagal menolak partner');
    }
  };

  const handleEditUserRole = async (userId: string, currentRole: string) => {
    const newRole = prompt('Masukkan role baru (user / partner / institution_admin):', currentRole);
    if (!newRole || !['user', 'partner', 'institution_admin'].includes(newRole)) {
      alert('Role tidak valid! Pilih: user, partner, atau institution_admin');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      alert('Role user berhasil diubah!');
    } catch (e) {
      console.error('Gagal mengubah role:', e);
      alert('Gagal mengubah role user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (institutionNotFound) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
        <div className="bg-stone-800 border border-red-700 rounded-[40px] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
            <Ban size={32} />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Institusi Tidak Ditemukan</h2>
          <p className="text-stone-400 text-sm mb-4">
            Akun Anda belum terhubung dengan institusi yang valid. Hubungi Super Admin untuk mengatur institusi Anda.
          </p>
          <div className="bg-stone-900 p-4 rounded-2xl border border-stone-700 text-left mb-4">
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2">Debug Info:</p>
            <p className="text-xs text-stone-400 font-mono break-all">institutionId: {institutionId || '(kosong)'}</p>
            <p className="text-xs text-stone-400 font-mono break-all">adminUserId: {adminUserId || '(kosong)'}</p>
            <p className="text-xs text-stone-400 font-mono break-all">authUid: {auth.currentUser?.uid || '(kosong)'}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-black">Institution Admin Dashboard</h1>
          <p className="text-stone-400 text-xs">{institution?.name || 'Institusi'}</p>
          {!institutionId && (
            <p className="text-red-400 text-[10px] font-black mt-1">Institusi belum terhubung. ID: {institutionId || '(kosong)'}</p>
          )}
        </div>
        <button onClick={onLogout} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold hover:bg-red-700">Logout</button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Total Partners</p>
            <p className="text-2xl font-black text-stone-900">{partners.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Total Users</p>
            <p className="text-2xl font-black text-stone-900">{users.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Approved Partners</p>
            <p className="text-2xl font-black text-emerald-600">{partners.filter((p: any) => p.status === 'approved').length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-black text-stone-400 uppercase">Pending Partners</p>
            <p className="text-2xl font-black text-amber-600">{partners.filter((p: any) => p.status === 'pending').length}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'partners', label: 'Partners' },
            { id: 'pending_partners', label: 'Persetujuan Partner' },
            { id: 'users', label: 'Users' },
            { id: 'transactions', label: 'Transactions' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'pending_partners' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Persetujuan Partner Baru</h3>
              <p className="text-xs text-stone-500 mt-1">Partner yang mendaftar ke institusi ini dan menunggu persetujuan.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Telepon</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Alamat</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {partners.filter((p: any) => p.status === 'pending' && p.institutionId === institutionId).map((p: any) => (
                    <tr key={p.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{p.name}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{p.email}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{p.phone || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500 max-w-xs truncate">{p.address || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleInstitutionApprovePartner(p.id)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleInstitutionRejectPartner(p.id, p.email, p.name)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {partners.filter((p: any) => p.status === 'pending' && p.institutionId === institutionId).length === 0 && (
                <div className="px-6 py-12 text-center text-stone-400 text-sm">
                  Tidak ada partner yang menunggu persetujuan.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'partners' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-lg font-display font-black">Daftar Partner</h3>
              <button
                onClick={() => setShowAddPartnerForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={14} /> Tambah Partner
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Password</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Owner UID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {partners.map((p: any) => {
                    return (
                      <tr key={p.id} className="hover:bg-stone-50/50">
                        <td className="px-6 py-4 text-sm font-bold text-stone-800">{p.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                            p.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            p.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            p.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-stone-100 text-stone-700 border-stone-200'
                          }`}>{p.status}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-semibold text-stone-700">{p.password || '-'}</td>
                        <td className="px-6 py-4 text-[10px] font-mono text-stone-400">{p.ownerUid}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Partner Modal */}
        <AnimatePresence>
          {showAddPartnerForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-6"
              onClick={() => setShowAddPartnerForm(false)}
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-black text-stone-900">Tambah Partner</h3>
                  <button onClick={() => setShowAddPartnerForm(false)} className="p-2 hover:bg-stone-100 rounded-xl">
                    <X size={20} className="text-stone-600" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nama Partner *"
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                    className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-stone-800"
                  />
                  <input
                    type="email"
                    placeholder="Email Partner *"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-stone-800"
                  />
                  <input
                    type="text"
                    placeholder="No. Telepon"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-stone-800"
                  />
                  <textarea
                    placeholder="Alamat"
                    value={newPartner.address}
                    onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                    className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-stone-800"
                    rows={2}
                  />
                  <textarea
                    placeholder="Catatan"
                    value={newPartner.notes}
                    onChange={(e) => setNewPartner({ ...newPartner, notes: e.target.value })}
                    className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-stone-800"
                    rows={2}
                  />
                  <button
                    onClick={handleAddPartner}
                    className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Tambah Partner
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-display font-black">Nasabah &amp; Riwayat Setoran</h3>
              <p className="text-xs text-stone-500 mt-1">User yang pernah setor sampah ke partner institusi ini, lengkap dengan bukti, jenis sampah, poin, dan berat.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Nama</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Email / Token</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Partner</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Kategori</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Berat</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Poin</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Bukti</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {(() => {
                    const rows: any[] = [];
                    transactions.forEach((tx: any) => {
                      const user = users.find((u: any) => u.uid === tx.userUid || u.qrToken === tx.userToken);
                      rows.push({
                        id: tx.id,
                        displayName: user?.displayName || tx.userToken || tx.userEmail || '-',
                        email: user?.email || tx.userEmail || '-',
                        partner: tx.partnerName || '-',
                        category: tx.category || '-',
                        weight: tx.totalWeight || tx.weight || 0,
                        points: tx.totalPoints || 0,
                        photoUrl: tx.photoUrl || '',
                        status: tx.status || 'pending',
                        date: tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID') : '-',
                      });
                    });
                    return rows;
                  })().map((row: any) => (
                    <tr key={row.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{row.displayName}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{row.email}</td>
                      <td className="px-6 py-4 text-xs text-stone-700 font-semibold">{row.partner}</td>
                      <td className="px-6 py-4 text-xs text-stone-500 capitalize">{row.category}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{row.weight} kg</td>
                      <td className="px-6 py-4 text-xs font-black text-emerald-600">{row.points}</td>
<td className="px-6 py-4">
                         {row.photoUrl ? (
                           <button
                             onClick={() => setSelectedPhotoPreview({ image: row.photoUrl, user: row.displayName, title: `Bukti Transaksi ${row.id}`, date: row.date })}
                             className="inline-block relative group"
                           >
                             <img src={normalizePhotoUrl(row.photoUrl)} alt="Bukti" className="w-10 h-10 object-cover rounded-lg border border-stone-200 hover:border-blue-400 transition-all" />
                             <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Lihat</span>
                           </button>
                         ) : (
                           <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center border border-stone-200">
                             <span className="text-stone-300 text-[10px] font-black uppercase">No</span>
                           </div>
                         )}
                       </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          row.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          row.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          row.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                          row.status === 'flagged_for_review' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>{row.status}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-stone-400">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="px-6 py-12 text-center text-stone-400 text-sm">
                  Belum ada transaksi dari partner institusi ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign User to Partner Modal */}
        <AnimatePresence>
          {assigningUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-6"
              onClick={() => { setAssigningUser(null); setSelectedPartnerId(''); }}
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-black text-stone-900">Assign User ke Partner</h3>
                  <button onClick={() => { setAssigningUser(null); setSelectedPartnerId(''); }} className="p-2 hover:bg-stone-100 rounded-xl">
                    <X size={20} className="text-stone-600" />
                  </button>
                </div>
                <p className="text-xs text-stone-500 mb-3">Pilih partner untuk user ini:</p>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-stone-50 px-4 py-3 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
                >
                  <option value="">-- Pilih Partner --</option>
                  {partners.filter((p: any) => p.status === 'approved').map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssignUserToPartner(assigningUser)}
                  disabled={!selectedPartnerId}
                  className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  Assign
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-black">Riwayat Transaksi Partner</h3>
                <p className="text-xs text-stone-500 mt-1">Detail setoran sampah per kategori dari partner institusi</p>
              </div>
              <span className="text-xs font-black text-stone-400 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
                {transactions.length} transaksi
              </span>
            </div>

            {/* Header kolom */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_2.5fr_1fr_1.2fr_1.3fr] gap-4 px-6 py-3 bg-stone-50 border-b border-stone-100">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Bank Sampah</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Pengguna</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Setoran</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</span>
            </div>

            <div className="divide-y divide-stone-50">
              {transactions.map((tx: any) => {
                const partner = partners.find((p: any) => p.id === tx.partnerId || p.id === tx.partnerUid);
                const itemsList: {category: string; weight: number}[] =
                  tx.items && tx.items.length > 0
                    ? tx.items
                    : tx.category
                      ? [{ category: tx.category, weight: tx.totalWeight || tx.weight || 0 }]
                      : [];
                const totalW = tx.totalWeight || tx.weight ||
                  itemsList.reduce((s: number, i: any) => s + (Number(i.weight) || 0), 0);

                return (
                  <div key={tx.id} className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_2.5fr_1fr_1.2fr_1.3fr] gap-4 px-6 py-5 hover:bg-stone-50/60 transition-colors items-start">

                    {/* Bank Sampah */}
                    <div>
                      <p className="text-sm font-bold text-stone-800 leading-tight">
                        {partner?.name || tx.partnerName || '-'}
                      </p>
                      {(partner?.email || tx.partnerEmail) && (
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {partner?.email || tx.partnerEmail}
                        </p>
                      )}
                    </div>

                    {/* Pengguna */}
                    <div>
                      <p className="text-xs font-semibold text-stone-700">
                        {tx.userName || tx.userDisplayName || '-'}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5 truncate max-w-[140px]">
                        {tx.userEmail || tx.userToken || ''}
                      </p>
                    </div>

                    {/* Setoran detail */}
                    <div>
                      <p className="text-base font-black text-stone-900">
                        {typeof totalW === 'number' ? totalW.toFixed(1) : totalW} kg
                      </p>
                      {itemsList.length > 0 ? (
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                          {itemsList.map((it: any) => `${it.category} (${it.weight}kg)`).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic mt-0.5">-</p>
                      )}
                      <p className="text-xs font-black text-emerald-600 mt-1">
                        +{(tx.totalPoints || 0).toLocaleString()} NP
                      </p>
                    </div>

                    {/* Bukti foto */}
                    <div>
                      {tx.photoUrl ? (
                        <button
                          onClick={() => setSelectedPhotoPreview({
                            image: tx.photoUrl,
                            user: tx.userName || tx.userToken || 'User',
                            title: 'Bukti Setoran',
                            date: tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID') : undefined
                          })}
                          className="w-12 h-12 rounded-xl overflow-hidden border border-stone-200 hover:opacity-80 transition-opacity block"
                        >
                          <img src={tx.photoUrl} alt="bukti" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-stone-300 italic">Tanpa foto</span>
                      )}
                    </div>

                    {/* Tanggal */}
                    <div>
                      <p className="text-[11px] text-stone-600 font-semibold leading-snug">
                        {tx.createdAt
                          ? new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-'}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {tx.createdAt
                          ? new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        tx.status === 'approved'         ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        tx.status === 'pending'          ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        tx.status === 'rejected'         ? 'bg-red-100 text-red-700 border-red-200' :
                        tx.status === 'flagged_for_review' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-stone-100 text-stone-700 border-stone-200'
                      }`}>
                        {tx.status === 'approved'          ? 'Diterima'  :
                         tx.status === 'pending'           ? 'Menunggu'  :
                         tx.status === 'rejected'          ? 'Ditolak'   :
                         tx.status === 'flagged_for_review'? 'Flagged'   :
                         tx.status || '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {transactions.length === 0 && (
              <div className="px-6 py-12 text-center text-stone-400 text-sm">
                Belum ada transaksi dari partner institusi ini.
              </div>
            )}
          </div>
        )}
       </div>
       {/* Modal Preview Foto */}
       <AnimatePresence>
         {selectedPhotoPreview && (
           <div className="fixed inset-0 z-[999] flex items-center justify-center p-6">
             <motion.div
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setSelectedPhotoPreview(null)}
               className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
             />
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl"
               onClick={(e) => e.stopPropagation()}
             >
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">📸 Preview Bukti Foto</p>
                   <h3 className="font-bold text-stone-800">{selectedPhotoPreview.user}</h3>
                   <p className="text-xs text-stone-400">{selectedPhotoPreview.title}{selectedPhotoPreview.date ? ` · ${selectedPhotoPreview.date}` : ''}</p>
                 </div>
                 <button onClick={() => setSelectedPhotoPreview(null)} className="p-2 bg-stone-100 rounded-xl text-stone-500 hover:bg-stone-200 transition-colors">
                   <X size={18} />
                 </button>
               </div>
               <div className="rounded-[28px] overflow-hidden border border-stone-100 bg-stone-50">
                 <img src={normalizePhotoUrl(selectedPhotoPreview.image)} alt="Preview Bukti" className="w-full max-h-[65vh] object-contain" />
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
     </div>
   );
 };

 export default function App() {

  const [state, setState] = useState<AppState>('login');
  const stateRef = useRef<AppState>('login');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WasteAnalysis | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [userData, setUserData] = useState<UserData>({
    email: '',
    displayName: '',
    points: 0,
    scans: 0,
    level: 'Pemula',
    streak: 1,
    lastLogin: new Date().toDateString(),
    mascotName: 'NeuroFlame',
    history: [
      { date: '01/05', co2: 50, water: 20, energy: 5 },
      { date: '02/05', co2: 120, water: 45, energy: 12 },
      { date: '03/05', co2: 80, water: 30, energy: 8 },
      { date: '04/05', co2: 150, water: 60, energy: 15 },
      { date: '05/05', co2: 200, water: 80, energy: 20 },
    ],
    scanHistory: [],
    claimHistory: [],
    depositHistory: [],
    notifications: []
  });
  const [progressMsg, setProgressMsg] = useState('Menganalisis gambar...');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [showRewardModal, setShowRewardModal] = useState<{ total: number, bonus: number } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [depositApprovalAlert, setDepositApprovalAlert] = useState<NotificationItem | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [missionArticleContext, setMissionArticleContext] = useState<{ mission: Mission; progress: MissionProgress } | null>(null);
  const [quizMissionContext, setQuizMissionContext] = useState<Mission | null>(null);
  const [showUserQR, setShowUserQR] = useState(false);
  const [showPartnerOnboard, setShowPartnerOnboard] = useState(false);
  const [showPartnerDashboard, setShowPartnerDashboard] = useState(false);
  const [showPartnerTx, setShowPartnerTx] = useState(false);
  const [showUserDeposit, setShowUserDeposit] = useState(false);
  const [prevState, setPrevState] = useState<AppState | null>(null);
  const [instAdminId, setInstAdminId] = useState<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsBootstrappedRef = useRef(false);
  const authHandledRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleMarkAsRead = async (notificationId: string) => {
    const updatedNotifications = userData.notifications.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    saveUserData({ ...userData, notifications: updatedNotifications });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isDepositApprovalNotification = (notification: NotificationItem) => {
    const text = `${notification.title} ${notification.message}`.toLowerCase();
    return (
      notification.type === 'success' &&
      text.includes('setoran') &&
      (text.includes('diterima') || text.includes('disetujui') || text.includes('diverifikasi'))
    );
  };

  const notificationMatchesApprovedDeposit = (notification: NotificationItem) => {
    if (notification.depositId) {
      return (userData.depositHistory || []).some(
        deposit => deposit.id === notification.depositId && deposit.status === 'Approved'
      );
    }

    return (userData.depositHistory || []).some(deposit => deposit.status === 'Approved');
  };

  useEffect(() => {
    const notifications = userData.notifications || [];

    if (state !== 'main') return;

    if (!notificationsBootstrappedRef.current) {
      seenNotificationIdsRef.current = new Set(notifications.map((n) => n.id));
      notificationsBootstrappedRef.current = true;
      return;
    }

    const newApproval = notifications.find((n) => {
      return (
        !seenNotificationIdsRef.current.has(n.id) &&
        isDepositApprovalNotification(n) &&
        notificationMatchesApprovedDeposit(n)
      );
    });

    seenNotificationIdsRef.current = new Set(notifications.map((n) => n.id));

    if (newApproval) {
      setDepositApprovalAlert(newApproval);
    }
  }, [userData.notifications, userData.depositHistory, state]);

  const sendNotificationToInstitutionAdmins = async (institutionId: string, title: string, message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    try {
      const adminsQuery = query(collection(db, 'users'), where('institutionId', '==', institutionId), where('role', '==', 'institution_admin'));
      const adminsSnap = await getDocs(adminsQuery);
      
      const promises = adminsSnap.docs.map(adminDoc => {
        const adminData = adminDoc.data() as UserData;
        const newNotification: NotificationItem = {
          id: Math.random().toString(36).substr(2, 9),
          title,
          message,
          date: new Date().toLocaleString('id-ID'),
          type,
          isRead: false
        };
        const updatedNotifications = [newNotification, ...(adminData.notifications || [])];
        return updateDoc(doc(db, 'users', adminDoc.id), { notifications: updatedNotifications });
      });
      
      await Promise.all(promises);
    } catch (e) {
      console.error('Gagal mengirim notifikasi ke institution admin:', e);
    }
  };

  // --- Waste Bank State & Handlers ---
  const [selectedWaste, setSelectedWaste] = useState<Record<string, number>>({});

  const handleWasteToggle = (id: string) => {
    setSelectedWaste(prev => {
      const newSelected = { ...prev };
      if (newSelected[id] !== undefined) {
        delete newSelected[id];
      } else {
        newSelected[id] = 1.0; // Default 1kg
      }
      return newSelected;
    });
  };

  const handleUpdateWeight = (id: string, weight: number) => {
    setSelectedWaste(prev => ({
      ...prev,
      [id]: weight
    }));
  };

  const handleVerificationSuccess = async (image: string, location: string) => {
    const depositItems = WASTE_CATEGORIES.filter(cat => selectedWaste[cat.id]).map(cat => ({
      category: cat.name,
      weight: selectedWaste[cat.id],
      points: selectedWaste[cat.id] * cat.pointsPerKg
    }));

    const basePoints = depositItems.reduce((acc, item) => acc + item.points, 0);
    const bonus = 150; // Bonus for TPA delivery
    const total = basePoints + bonus;

    const newDeposit: DepositHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleString('id-ID'),
      items: depositItems,
      totalPoints: total,
      totalWeight: (Object.values(selectedWaste) as number[]).reduce((a, b) => a + b, 0),
      status: 'Pending',
      image,
      location,
      userEmail: userData.email || user?.email || '',
      userUid: user?.uid || userData.uid || ''
    };

    await saveUserData({
      ...userData,
      depositHistory: [newDeposit, ...(userData.depositHistory || [])]
    });

    setSelectedWaste({});
    alert("Pengajuan setoran berhasil dikirim! Mohon tunggu verifikasi dari Admin untuk mendapatkan NeuroPoints.");
    setState('main');
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error?.code, error?.message);
      alert("Gagal login dengan Google. Error: " + (error?.code || error?.message || 'Unknown'));
    }
  };

  const handleAdminLogin = async (u: string, p: string) => {
    const adminUser = import.meta.env.VITE_ADMIN_USER || 'adminNeuroCycle';
    const adminPass = import.meta.env.VITE_ADMIN_PASS || 'DaurUlangSampahmu';

    if (u !== adminUser || p !== adminPass) {
      alert('Username atau password salah!');
      return;
    }

    setState('admin_dashboard');
  };

  const handleSuperAdminLogin = async (email: string, password: string) => {
    const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'superadmin@neurocycle.id';
    const superAdminPass = import.meta.env.VITE_SUPER_ADMIN_PASS || 'SuperAdmin123!';

    if (email !== superAdminEmail || password !== superAdminPass) {
      alert('Email atau password super admin salah!');
      return;
    }

    setState('super_admin_dashboard');
  };

  const handleInstAdminLogin = async (email: string, password: string) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Akun institution admin tidak ditemukan.');
        return;
      }

      const userDoc = snap.docs.find((d) => d.data().role === 'institution_admin');
      if (!userDoc) {
        alert('Akun ini bukan institution admin.');
        return;
      }

      const userData = userDoc.data() as any;

      if (userData.password !== password) {
        alert('Password salah!');
        return;
      }

      const instId = userData.institutionId;
      if (instId) {
        const instRef = doc(db, 'institutions', instId);
        const instSnap = await getDoc(instRef);
        if (instSnap.exists()) {
          const instData = instSnap.data() as any;
          if (instData.approvalStatus === 'pending') {
            alert('Institusi Anda belum disetujui oleh Super Admin. Silakan tunggu proses verifikasi.');
            return;
          }
          if (instData.approvalStatus === 'rejected') {
            alert('Institusi Anda telah ditolak oleh Super Admin. Silakan hubungi Super Admin untuk informasi lebih lanjut.');
            return;
          }
        }
      }

      setInstAdminId(userDoc.id);
      setUserData(userData);
      setState('institution_admin_dashboard');
    } catch (e) {
      console.error('Login institution admin failed:', e);
      alert('Gagal login sebagai institution admin.');
    }
  };

  const handleInstAdminRegister = async (email: string, password: string, name: string, type: string, address: string, phone: string): Promise<boolean> => {
    try {
      if (!email || !password || !name || !address) {
        alert('Semua field wajib harus diisi!');
        return false;
      }

      const adminUid = auth.currentUser?.uid || '';

      const usersRef = collection(db, 'users');
      const existingQuery = query(usersRef, where('email', '==', email));
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        const existingData = existingSnap.docs[0].data() as any;
        if (existingData.role === 'institution_admin') {
          alert('Email ini sudah terdaftar sebagai institution admin!');
          return false;
        }
        await deleteDoc(existingSnap.docs[0].ref);
      }

      const newInstRef = doc(collection(db, 'institutions'));
      await setDoc(newInstRef, {
        name: name.trim(),
        type,
        email,
        phone,
        address,
        code: '',
        status: 'pending',
        approvalStatus: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: adminUid,
        adminUid: ''
      });

      const newUserRef = doc(collection(db, 'users'));
      await setDoc(newUserRef, {
        email,
        password,
        role: 'institution_admin',
        institutionId: newInstRef.id,
        institutionName: name.trim(),
        displayName: email.split('@')[0],
        points: 0,
        scans: 0,
        level: 'Pemula',
        streak: 0,
        lastLogin: new Date().toDateString(),
        mascotName: 'Eco',
        qrToken: Math.random().toString(36).substr(2, 9),
        isBanned: false,
        notifications: [],
        scanHistory: [],
        claimHistory: [],
        depositHistory: [],
        history: []
      });

      await updateDoc(newInstRef, { adminUid: newUserRef.id });

      const superAdminUsers = (await getDocs(query(usersRef, where('role', '==', 'super_admin')))).docs;
      const notifPromises = superAdminUsers.map(async (adminDoc) => {
        const adminData = adminDoc.data() as UserData;
        const notifs = [...(adminData.notifications || [])];
        notifs.unshift({
          id: Math.random().toString(36).substr(2, 9),
          title: 'Institusi Baru Mendaftar',
          message: `Institusi "${name.trim()}" (${type}) mendaftar sebagai Institution Admin. Email: ${email}. Harap verifikasi di dashboard Super Admin.`,
          date: new Date().toLocaleString('id-ID'),
          type: 'info',
          isRead: false
        });
        await updateDoc(doc(db, 'users', adminDoc.id), { notifications: notifs });
      });
      await Promise.all(notifPromises);

      alert('Pendaftaran institusi berhasil! Data Anda akan diverifikasi oleh Super Admin. Setelah disetujui, Anda bisa login.');
      return true;
    } catch (e) {
      console.error('Register institution admin failed:', e);
      alert('Gagal mendaftar sebagai institution admin.');
      return false;
    }
  };

  const handlePartnerLogin = async (email: string, password: string) => {
    try {
      const q = query(collection(db, 'partners'), where('email', '==', email));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Akun partner tidak ditemukan.');
        return;
      }

      const partnerDoc = snap.docs[0];
      const partnerData = partnerDoc.data();

      if (!partnerData.password) {
        alert('Akun partner ini belum memiliki password. Akun ini dibuat sebelum sistem password diaktifkan. Silakan klik "Atur Password" di bawah form login untuk membuat password baru.');
        return;
      }

      if (partnerData.password !== password) {
        alert('Password salah!');
        return;
      }

      if (partnerData.status !== 'approved') {
        alert('Akun partner belum disetujui oleh admin institusi.');
        return;
      }

      setPartnerData({ id: partnerDoc.id, ...partnerData });
      setState('partner_dashboard');
    } catch (e) {
      console.error('Partner login failed:', e);
      alert('Gagal login sebagai partner.');
    }
  };

  const handleLogout = async () => {
    authHandledRef.current = false;
    setInstAdminId(null);
    setState('login');
  };


  useEffect(() => {
    syncMissionStatuses();
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        const userRef = doc(db, 'users', currentUser.uid);

        const snapOnce = await getDoc(userRef);
        if (snapOnce.exists()) {
          const data = snapOnce.data() as UserData;
          
          if (stateRef.current === 'login' && !authHandledRef.current) {
            authHandledRef.current = true;
            
            if (data.isBanned) {
              alert("Akun Anda telah ditangguhkan oleh Admin karena pelanggaran kebijakan.");
              await signOut(auth);
              setState('login');
              setIsInitializing(false);
              return;
            }

            let updatedData = { ...data };
            let hasChanges = false;

            if (!data.qrToken) {
              updatedData.qrToken = Math.random().toString(36).substr(2, 9);
              hasChanges = true;
            }

            if (hasChanges) {
              await setDoc(userRef, updatedData, { merge: true });
            }

            setUserData({
              ...updatedData,
              email: currentUser.email || updatedData.email || '',
              uid: currentUser.uid,
              displayName: currentUser.displayName || updatedData.displayName || currentUser.email?.split('@')[0] || 'User',
              notifications: updatedData.notifications || []
            });

            const todayStr = new Date().toDateString();
            const lastLoginStr = updatedData.lastLogin || '';
            const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
            if (lastLoginStr !== todayStr) {
              const newStreak = lastLoginStr === yesterdayStr ? (updatedData.streak || 1) + 1 : 1;
              const userRefStreak = doc(db, 'users', currentUser.uid);
              setDoc(userRefStreak, { streak: newStreak, lastLogin: todayStr }, { merge: true });
            }

            const isReturningUser = !!(updatedData.scanHistory?.length || updatedData.depositHistory?.length || updatedData.claimHistory?.length || updatedData.points > 0 || updatedData.streak > 1);

            if (!updatedData.institutionId && !isReturningUser) {
              setState('welcome');
            } else {
              setState('welcome');
            }
            setIsInitializing(false);
          }
        } else {
          if (stateRef.current === 'login' && !authHandledRef.current) {
            authHandledRef.current = true;
            const initialData: UserData = {
              ...userData,
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              role: 'user',
              qrToken: Math.random().toString(36).substr(2, 9),
              isBanned: false,
              notifications: []
            };
            await setDoc(userRef, initialData);
            setUserData(initialData);
            setState('welcome');
            setIsInitializing(false);
          }
        }

        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (!docSnap.exists()) return;
          
          const data = docSnap.data() as UserData;
          let updatedData = { ...data };
          let hasChanges = false;

          if (!data.qrToken) {
            updatedData.qrToken = Math.random().toString(36).substr(2, 9);
            hasChanges = true;
          }

          if (hasChanges) {
            setDoc(userRef, updatedData, { merge: true });
          }

          setUserData({
            ...updatedData,
            email: currentUser.email || updatedData.email || '',
            uid: currentUser.uid,
            displayName: currentUser.displayName || updatedData.displayName || currentUser.email?.split('@')[0] || 'User',
            notifications: updatedData.notifications || []
          });

          const todayStr = new Date().toDateString();
          const lastLoginStr = updatedData.lastLogin || '';
          const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
          if (lastLoginStr !== todayStr) {
            const newStreak = lastLoginStr === yesterdayStr ? (updatedData.streak || 1) + 1 : 1;
            const userRefStreak = doc(db, 'users', currentUser.uid);
            setDoc(userRefStreak, { streak: newStreak, lastLogin: todayStr }, { merge: true });
          }
        }, (error) => {
          console.error("Firestore snapshot error:", error);
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = null;
        setState('login');
        setIsInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const saveUserData = async (newData: UserData) => {
    const authUser = auth.currentUser || user;
    const persistedData: UserData = {
      ...newData,
      uid: authUser?.uid || newData.uid,
      email: authUser?.email || newData.email || '',
      displayName: authUser?.displayName || newData.displayName || authUser?.email?.split('@')[0] || 'User',
      notifications: newData.notifications || [],
      scanHistory: newData.scanHistory || [],
      depositHistory: newData.depositHistory || [],
      claimHistory: newData.claimHistory || [],
      history: newData.history || []
    };

    setUserData(persistedData);
    if (authUser?.uid) {
      try {
        const userRef = doc(db, 'users', authUser.uid);
        await setDoc(userRef, persistedData, { merge: true });
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Error saving data to Firestore:", error);
        await logError({
          severity: 'ERROR',
          type: 'firebase_user_data_save_failed',
          message: `Failed to save user data: ${errorMsg}`,
          context: 'user_data_sync',
          userId: authUser.uid,
          userEmail: authUser.email || undefined,
          functionName: 'saveUserData',
          stack: error instanceof Error ? error.stack : undefined,
          metadata: { dataSize: JSON.stringify(persistedData).length }
        });
      }
    }
    return persistedData;
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
    });
  };

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setState('scanning');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const originalBase64 = await base64Promise;
      setProgressMsg('Mengoptimalkan gambar...');
      const compressedBase64 = await compressImage(originalBase64);
      setScannedImage(compressedBase64);

      const pureBase64 = compressedBase64.split(',')[1];

setProgressMsg('Mendeteksi jenis sampah...');
       let analysis: WasteAnalysis;
       const onnxAvailable = isONNXModelAvailable();
       if (onnxAvailable) {
         try {
           const onnxResult = await detectWasteWithONNX(compressedBase64);
           if (onnxResult.modelLoaded && !onnxResult.isWaste) {
             throw new Error('BUKAN_SAMPAH: Objek yang Anda pindai tidak terdeteksi sebagai sampah. Silakan pindai objek sampah yang valid.');
           }
         } catch (e: any) {
           if (e?.message?.includes('BUKAN_SAMPAH')) throw e;
           console.warn('ONNX pre-filter skipped, using Gemini:', e?.message || 'unknown');
         }
       }
        try {
          analysis = await analyzeWaste(pureBase64, user?.uid || userData.uid);
        } catch (e: any) {
          if (e?.message?.includes('BUKAN_SAMPAH')) throw e;
          analysis = {
            name: 'Sampah Campuran',
            category: 'Anorganik',
            composition: [{ material: 'mixed', percentage: 100, description: 'Tidak dapat mengidentifikasi jenis sampah secara pasti.' }],
            disposalGuide: 'Pisahkan sampah berdasarkan jenis: organik, anorganik, plastik, kertas, logam, atau kaca.',
            recyclable: true,
            accuracy: 0.3,
            tips: 'Pastikan gambar sampah terlihat jelas dan pencahayaan cukup.',
            environmentalImpact: 'Mengurangi limbah di TPA.',
            creativeIdeas: ['Daur ulang', 'Kompos'],
            impactStats: { co2Saved: 0.1, waterSaved: 1, energySaved: 0.05 },
          };
        }
       setResult(analysis);

      // Handle non-waste items - don't award points
      if (analysis.isNotWaste || analysis.category === 'Bukan Sampah') {
        alert(`🚫 Item ini bukan sampah: ${analysis.name}. Tidak mendapatkan poin.`);
        setState('main');
        return;
      }

      // Award points & update history
      const newPoints = userData.points + 25;
      const newScans = userData.scans + 1;

      const todayDate = new Date();
      const todayFormatted = todayDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
      const fullDate = todayDate.toLocaleString('id-ID');

      // Add to Scan History
      const newScanItem: ScanHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: analysis.name,
        category: analysis.category,
        date: fullDate,
        impact: {
          co2: analysis.impactStats.co2Saved,
          water: analysis.impactStats.waterSaved,
          energy: analysis.impactStats.energySaved,
        },
        image: compressedBase64
      };

      const existingRecordIdx = userData.history.findIndex(h => h.date === todayFormatted);

      let newHistory = [...userData.history];
      const newImpact = analysis.impactStats;

      if (existingRecordIdx >= 0) {
        newHistory[existingRecordIdx] = {
          ...newHistory[existingRecordIdx],
          co2: newHistory[existingRecordIdx].co2 + newImpact.co2Saved,
          water: newHistory[existingRecordIdx].water + newImpact.waterSaved,
          energy: newHistory[existingRecordIdx].energy + newImpact.energySaved,
        };
      } else {
        newHistory.push({
          date: todayFormatted,
          co2: newImpact.co2Saved,
          water: newImpact.waterSaved,
          energy: newImpact.energySaved,
        });
      }

      if (newHistory.length > 7) newHistory = newHistory.slice(-7);

      let newLevel = userData.level;
      const totalDeposits = userData.depositHistory?.length || 0;
      const totalKg = userData.depositHistory?.reduce((a, d) => a + (d.totalWeight || 0), 0) || 0;
      const score = newScans + (totalDeposits * 3) + Math.floor(totalKg * 0.5);
      if (score >= 1000) newLevel = 'NeuroHero';
      else if (score >= 750) newLevel = 'Eco Legend';
      else if (score >= 500) newLevel = 'Green Master';
      else if (score >= 350) newLevel = 'Eco Warrior';
      else if (score >= 200) newLevel = 'Pahlawan Bumi';
      else if (score >= 100) newLevel = 'Penjaga Alam';
      else if (score >= 50) newLevel = 'Pemilah Aktif';
      else if (score >= 25) newLevel = 'Pecinta Hijau';
      else if (score >= 10) newLevel = 'Penjelajah';
      else newLevel = 'Pemula';

      // Hitung streak harian otomatis
      const today = new Date().toDateString();
      const lastLogin = userData.lastLogin;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newStreak = userData.streak || 1;
      if (lastLogin !== today) {
        newStreak = lastLogin === yesterday ? newStreak + 1 : 1;
      }

      await saveUserData({
        ...userData,
        points: newPoints,
        scans: newScans,
        level: newLevel,
        streak: newStreak,
        lastLogin: today,
        history: newHistory,
        scanHistory: [newScanItem, ...(userData.scanHistory || [])]
      });

      setState('result');
    } catch (err: any) {
      console.error("Detail Error Pemindaian:", err);
      const errorMsg = err.message || 'Gagal memproses gambar.';

      if (errorMsg.includes('BUKAN_SAMPAH')) {
        const cleanMsg = errorMsg.replace('BUKAN_SAMPAH:', '').trim();
        alert(`🚫 ${cleanMsg}`);
        setState('main');
        return;
      }
      
      // Log error with context
      let errorType = 'scan_analysis_failed';
      if (errorMsg.toLowerCase().includes('timeout')) {
        errorType = 'scan_timeout';
      } else if (errorMsg.toLowerCase().includes('api')) {
        errorType = 'scan_api_error';
      } else if (errorMsg.toLowerCase().includes('image')) {
        errorType = 'scan_invalid_image';
      }
      
      await logError({
        severity: 'ERROR',
        type: errorType,
        message: errorMsg,
        context: 'waste_scan',
        userId: user?.uid || userData.uid,
        userEmail: user?.email || userData.email || '',
        functionName: 'handleImageInput',
        stack: err instanceof Error ? err.stack : undefined,
        metadata: { fileName: (e.target.files?.[0])?.name }
      });
      
      const userFriendlyError = errorMsg.toLowerCase().includes('image input')
        ? 'Model gambar sedang tidak dapat digunakan. Coba ambil foto ulang atau pilih gambar lain.'
        : errorMsg;
      alert(`Gagal memindai gambar: ${userFriendlyError}`);
      setState('main');
    } finally {
      setLoading(false);
      // Reset input values so the same image can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const deleteHistory = (id: string) => {
    const newHistory = (userData.scanHistory || []).filter(item => item.id !== id);
    saveUserData({ ...userData, scanHistory: newHistory });
  };

  const resetScanner = () => {
    setResult(null);
    setScannedImage(null);
    const backTo = prevState || 'main';
    setPrevState(null);
    setState(backTo);
  };

  const handleClaimReward = async (offer: any) => {
    if (userData.points < offer.points) return;

    const newPoints = userData.points - offer.points;
    const today = new Date().toLocaleString('id-ID');

    const newClaim: ClaimHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: offer.title,
      points: offer.points,
      date: today,
      status: 'Pending',
      userEmail: userData.email || user?.email || '',
      userUid: user?.uid || userData.uid || ''
    };

    const updatedData = {
      ...userData,
      points: newPoints,
      claimHistory: [newClaim, ...(userData.claimHistory || [])]
    };

    try {
      await saveUserData(updatedData);
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'claim_reward_failed',
        message: e?.message || 'Gagal mengajukan klaim hadiah',
        context: 'claim_reward',
        userId: user?.uid || userData.uid,
        userEmail: userData.email || user?.email || '',
        functionName: 'handleClaimReward',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { rewardTitle: offer.title, points: offer.points }
      });
      alert('Gagal mengajukan klaim: ' + e.message);
      return;
    }

    const adminIG = 'neurocycle.id';
    const dmMessage = encodeURIComponent(
      `Halo Admin NeuroCycle! 👋\n\nSaya ingin menukarkan poin saya:\n\n🎁 Hadiah: ${offer.title}\n💰 Poin: ${offer.points} NP\n🆔 ID Klaim: ${newClaim.id}\n📧 Email: ${userData.email}\n\nMohon konfirmasi dan instruksi selanjutnya. Terima kasih!`
    );
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const instagramUrl = isMobile
      ? `instagram://user?username=${adminIG}`
      : `https://ig.me/m/${adminIG}`;
    window.open(instagramUrl, '_blank');
    const plainMessage = `Halo Admin NeuroCycle! Saya ingin menukarkan poin saya. Hadiah: ${offer.title} | Poin: ${offer.points} NP | ID Klaim: ${newClaim.id} | Email: ${userData.email}. Mohon konfirmasi. Terima kasih!`;
    navigator.clipboard.writeText(plainMessage).then(() => {
      alert(`✅ Klaim berhasil diajukan!\n\nPesan sudah disalin ke clipboard.\nInstagram DM admin sudah terbuka — paste pesan tersebut untuk konfirmasi klaim kamu.\n\nID Klaim: ${newClaim.id}`);
    }).catch(() => {
      alert(`✅ Klaim berhasil diajukan!\n\nSilakan DM Instagram @neurocycle.id dengan menyebutkan:\n- Hadiah: ${offer.title}\n- ID Klaim: ${newClaim.id}\n- Email: ${userData.email}`);
    });
  };

  const chartData = useMemo(() => userData.history, [userData.history]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  // Main UI Render
  return (
    <div className={`min-h-screen pb-32 max-w-md mx-auto ${state === 'login' ? 'bg-stone-900' : 'bg-stone-50'}`}>
      <AnimatePresence mode="wait">
        {state === 'login' && (
          <LoginScreen
            onGoogleLogin={handleGoogleLogin}
            onAdminLogin={handleAdminLogin}
            onSuperAdminLogin={handleSuperAdminLogin}
            onInstAdminLogin={handleInstAdminLogin}
            onInstAdminRegister={handleInstAdminRegister}
            onPartnerLogin={handlePartnerLogin}
          />
        )}
        {state === 'admin_dashboard' && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50">
            <AdminDashboard
              onLogout={async () => {
                if (window.confirm("Apakah anda yakin ingin logout dari panel Admin?")) {
                  await handleLogout();
                }
              }}
            />
          </div>
        )}
        {state === 'super_admin_dashboard' && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50">
            <SuperAdminDashboard
              onLogout={async () => {
                if (window.confirm("Apakah anda yakin ingin logout dari panel Super Admin?")) {
                  await handleLogout();
                }
              }}
            />
          </div>
        )}
        {state === 'institution_admin_dashboard' && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50">
            <InstitutionAdminDashboard
              adminUserId={instAdminId}
              onLogout={async () => {
                if (window.confirm("Apakah anda yakin ingin logout dari panel Institution Admin?")) {
                  await handleLogout();
                }
              }}
            />
          </div>
        )}
        {state === 'partner_dashboard' && partnerData && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50">
            <PartnerDashboard
              partnerId={partnerData.id}
              onClose={() => {
                setPartnerData(null);
                setState('login');
              }}
            />
          </div>
        )}
        {state === 'scan_options' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/90 backdrop-blur-sm z-70 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-4xl p-6 shadow-2xl"
            >
              <h2 className="text-2xl font-display font-bold text-stone-900 mb-3">Scan Sampah</h2>
              <p className="text-sm text-stone-500 mb-6">Pilih foto dari kamera atau galeri untuk menganalisis sampahmu.</p>
              <div className="grid gap-4">
                <button
                  onClick={() => { setState('main'); setTimeout(() => fileInputRef.current?.click(), 100); }}
                  className="w-full py-4 rounded-3xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 transition-all"
                >
                  📷 Ambil Foto Kamera
                </button>
                <button
                  onClick={() => { setState('main'); setTimeout(() => galleryInputRef.current?.click(), 100); }}
                  className="w-full py-4 rounded-3xl bg-stone-900 text-white font-bold shadow-lg shadow-stone-300/30 hover:bg-stone-800 transition-all"
                >
                  🖼️ Unggah dari Galeri
                </button>
                <button
                  onClick={() => setState('main')}
                  className="w-full py-3 rounded-3xl bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {state === 'welcome' && <WelcomeScreen onStart={() => setState('main')} />}
        {state === 'about' && <AboutScreen onBack={() => setState('main')} />}
        {state === 'redemption' && (
          <RedemptionCenter
            points={userData.points}
            onBack={() => setState('main')}
            onClaim={handleClaimReward}
          />
        )}

        {state === 'scanning' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-sm z-60 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative w-48 h-48 mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full"
              />
              <div className="absolute inset-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Loader2 size={48} className="text-emerald-600 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-emerald-800 mb-2">Sedang Memindai...</h2>
            <p className="text-stone-500">{progressMsg}</p>
          </motion.div>
        )}

        {state === 'main' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-3xl shadow-sm flex items-center justify-center text-emerald-600 border border-emerald-50">
                  <User size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-display font-bold text-emerald-900 leading-tight">Halo!</h1>
                  <p className="mt-2 text-sm font-sans font-semibold text-stone-700 leading-tight">{userData.email || user?.email || 'Email belum tersedia'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowNotifications(true)}
                  className="relative p-3 bg-white rounded-2xl border border-stone-100 shadow-sm active:scale-95 transition-transform"
                >
                  <Bell size={18} className="text-stone-400" />
                  {userData.notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Apakah anda yakin ingin keluar dari aplikasi?")) {
                      handleLogout();
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-2xl border border-red-100 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="w-5 h-5 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                    <LogOut size={12} />
                  </div>
                </button>
                <button
                  onClick={() => setState('about')}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-2xl border border-stone-100 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    <Info size={12} />
                  </div>
                  <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest hidden sm:inline">Tentang</span>
                </button>
              </div>
            </div>

            {/* Mascot & Streak Section */}
            {/* Home Screen View */}
            <div className="flex flex-col items-center gap-6 mb-8">
              <Mascot
                streak={userData.streak || 1}
                name={userData.mascotName}
                onRename={() => {
                  setNewName(userData.mascotName || 'NeuroFlame');
                  setIsRenaming(true);
                }}
              />

              <div className="flex gap-4 w-full">
                {/* TikTok-Style Streak Badge */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex-1 bg-linear-to-r from-orange-500 to-red-600 p-px rounded-2xl shadow-lg shadow-orange-200/40 cursor-pointer overflow-hidden"
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-[15px] px-4 py-3 flex items-center gap-3">
                    <div className="relative">
                      <Zap size={24} className="text-orange-500 fill-orange-500 animate-pulse" />
                      <div className="absolute inset-0 bg-orange-400 blur-lg opacity-40 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-stone-800 leading-none">{userData.streak || 1}</span>
                        <span className="text-[10px] font-bold text-stone-400 uppercase">HARI</span>
                      </div>
                      <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest leading-none mt-1">NeuroStreak</p>
                    </div>
                  </div>
                </motion.div>

                {/* Tukar Poin Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setState('redemption')}
                  className="bg-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <Coins size={24} className="text-white" />
                  <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Tukar Poin</span>
                </motion.button>
              </div>

              {/* Setor Sampah Button (Bank Sampah) */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setState('waste_bank_list')}
                className="w-full bg-white p-6 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-6 group hover:border-emerald-500/30 transition-all"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <Recycle size={32} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-stone-800">Bank Sampah</h3>
                  <p className="text-xs text-stone-400">Setor sampah & kumpulkan NeuroPoints</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <ChevronRight size={20} />
                </div>
              </motion.button>

              {/* Misi Harian Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setState('daily_missions')}
                className="w-full bg-white p-6 rounded-4xl border border-stone-100 shadow-sm flex items-center gap-6 group hover:border-amber-500/30 transition-all"
              >
                <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                  <Award size={32} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-stone-800">Misi Harian</h3>
                  <p className="text-xs text-stone-400">Selesaikan misi & raih bonus NeuroPoints</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <ChevronRight size={20} />
                </div>
              </motion.button>
            </div>


            {/* Level Timeline */}
            <LevelTimeline
              currentScans={userData.scans}
              currentDeposits={userData.depositHistory?.length || 0}
              totalDepositKg={userData.depositHistory?.reduce((a, d) => a + (d.totalWeight || 0), 0) || 0}
            />

            {/* Points & Level Card */}
            <div className="bg-emerald-600 rounded-4xl p-8 text-white mb-8 shadow-xl shadow-emerald-200 relative overflow-hidden">
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-emerald-100 text-xs uppercase tracking-widest font-bold mb-1 opacity-80">NeuroPoints</p>
                  <h2 className="text-5xl font-display font-bold">{userData.points}</h2>
                </div>
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Award size={32} />
                </div>
              </div>
              <div className="space-y-4">
                {(() => {
                  const totalDeposits = userData.depositHistory?.length || 0;
                  const totalKg = userData.depositHistory?.reduce((a, d) => a + (d.totalWeight || 0), 0) || 0;
                  const score = userData.scans + (totalDeposits * 3) + Math.floor(totalKg * 0.5);
                  const levels = [
                    { score: 0,    label: 'Pemula' },
                    { score: 10,   label: 'Penjelajah' },
                    { score: 25,   label: 'Pecinta Hijau' },
                    { score: 50,   label: 'Pemilah Aktif' },
                    { score: 100,  label: 'Penjaga Alam' },
                    { score: 200,  label: 'Pahlawan Bumi' },
                    { score: 350,  label: 'Eco Warrior' },
                    { score: 500,  label: 'Green Master' },
                    { score: 750,  label: 'Eco Legend' },
                    { score: 1000, label: 'NeuroHero' },
                  ];
                  const currentIdx = levels.filter(l => score >= l.score).length - 1;
                  const current = levels[currentIdx];
                  const next = levels[currentIdx + 1];
                  const progress = next
                    ? ((score - current.score) / (next.score - current.score)) * 100
                    : 100;
                  return (
                    <>
                      <div className="flex justify-between text-[10px] text-emerald-100 font-bold uppercase tracking-widest">
                        <span>Level: {current.label}</span>
                        <span>{next ? `${next.score - score} pts menuju ${next.label}` : 'MAX LEVEL 🌟'}</span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-emerald-100 bg-white/10 p-2 rounded-xl">
                        <Info size={12} />
                        <span>Skor: {score} pts · Scan {userData.scans}x · Setor {totalDeposits}x · {totalKg.toFixed(1)}kg</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Deposit Status Summary */}
            <div className="bg-white rounded-4xl p-6 shadow-sm border border-stone-100 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-stone-800">Riwayat Setoran</h3>
                  <p className="text-xs text-stone-400">Lihat status pengajuan setoran sampahmu.</p>
                </div>
                <button
                  onClick={() => setState('user_dashboard')}
                  className="text-emerald-600 text-xs font-bold uppercase tracking-widest"
                >
                  Lihat Semua
                </button>
              </div>
              {userData.depositHistory && userData.depositHistory.length > 0 ? (
                <div className="space-y-3">
                  {userData.depositHistory.slice(0, 2).map((deposit) => (
                    <div key={deposit.id} className="rounded-3xl border border-stone-100 p-4 bg-stone-50">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-stone-800">{deposit.date}</p>
                          <p className="text-[11px] text-stone-500 mt-1">{deposit.totalWeight.toFixed(1)} kg — {deposit.items.length} jenis</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${deposit.status === 'Pending' ? 'bg-amber-100 text-amber-700' : deposit.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {deposit.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {userData.depositHistory.length > 2 && (
                    <p className="text-[10px] text-stone-400 text-right">Menampilkan 2 entri terbaru.</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 rounded-3xl border border-dashed border-stone-200 bg-stone-50">
                  <p className="text-sm text-stone-400">Belum ada pengajuan setoran. Ayo mulai setor sampah!</p>
                </div>
              )}
            </div>

            {/* Jejak Hijau Chart */}
            <div className="bg-white rounded-4xl p-6 shadow-sm border border-stone-100 mb-8 overflow-hidden">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                    <BarChart3 size={18} />
                  </div>
                  <h3 className="text-lg font-display font-bold text-stone-800">Jejak Hijau</h3>
                </div>
                <TrendingDown size={18} className="text-emerald-500" />
              </div>

              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#047857', fontWeight: 'bold' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="co2"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorCo2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="p-3 bg-emerald-50 rounded-2xl">
                  <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">CO2 (g)</p>
                  <p className="font-display font-bold text-emerald-700">{userData.history.reduce((a, b) => a + b.co2, 0)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Air (L)</p>
                  <p className="font-display font-bold text-blue-700">{userData.history.reduce((a, b) => a + b.water, 0)}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl">
                  <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Energi (kWh)</p>
                  <p className="font-display font-bold text-amber-700">{userData.history.reduce((a, b) => a + b.energy, 0).toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Featured Articles */}
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-lg font-display font-bold text-stone-800">Edukasi Hari Ini</h3>
              <button
                className="text-emerald-600 text-xs font-bold uppercase tracking-wider"
                onClick={() => setState('education_list')}
              >
                Lainnya
              </button>
            </div>
            <div className="grid gap-3">
              {EDUCATIONAL_ARTICLES.slice(0, 3).map((article) => (
                <div
                  key={article.id}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
                  onClick={() => {
                    setSelectedArticle(article);
                    setState('education_detail');
                  }}
                >
                  <div className={`w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center shrink-0`}>
                    {IconMap[article.icon] && React.createElement(IconMap[article.icon], { className: `text-${article.color}-500` })}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-stone-800 text-sm mb-0.5">{article.title}</h4>
                    <p className="text-[10px] text-stone-400 line-clamp-1">{article.excerpt}</p>
                  </div>
                  <ChevronRight size={16} className="text-stone-300" />
                </div>
              ))}
            </div>

            {/* Credits Section */}
            <div className="mt-12 mb-8 flex flex-col items-center">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3">
                ingin menyayakan info lebih lanjut? hubungi admin :
              </p>
              <motion.a
                href="https://www.instagram.com/neurocycle.id?igsh=YWw5MGdzNzFyZnV2"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-linear-to-tr from-[#f09433] via-[#cc2366] to-[#bc1888] text-white shadow-lg shadow-pink-200/50 transition-shadow"
              >
                <Instagram size={16} />
                <span className="text-xs font-black tracking-tight">neurocycle.id</span>
              </motion.a>
            </div>

          </motion.div>
        )}

        {state === 'map' && <MapContainer onClose={() => setState('main')} />}

        {state === 'education_list' && (
          <EducationList
            onBack={() => {
              // Jika dari misi, kembali ke misi
              if (missionArticleContext) {
                setState('daily_missions');
              } else {
                setState('main');
              }
            }}
            onSelectArticle={(article) => {
              setSelectedArticle(article);
              setState('education_detail');
            }}
          />
        )}

        {state === 'education_detail' && selectedArticle && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 bg-stone-50 z-70 overflow-y-auto"
          >
            <div className="p-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-stone-100">
              <button
                onClick={() => {
                  if (missionArticleContext) {
                    setState('education_list');
                  } else {
                    setState('education_list');
                  }
                }}
                className="p-3 bg-stone-100 rounded-2xl text-stone-600 hover:bg-stone-200"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-display font-bold">Detail Edukasi</h2>
              {/* Badge misi jika dari misi */}
              {missionArticleContext ? (
                <div className="px-3 py-1.5 bg-purple-100 rounded-xl">
                  <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Misi Aktif</p>
                </div>
              ) : <div className="w-10" />}
            </div>

            <div className="p-6 pb-32">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center border border-stone-100">
                  {IconMap[selectedArticle.icon] && React.createElement(IconMap[selectedArticle.icon], { size: 32, className: `text-${selectedArticle.color}-500` })}
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold text-stone-800 leading-tight">{selectedArticle.title}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{selectedArticle.author}</span>
                    <span className="w-1 h-1 bg-stone-300 rounded-full" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{selectedArticle.readTime} Baca</span>
                  </div>
                </div>
              </div>

              {/* PDF viewer atau konten teks */}
              {selectedArticle.contentType === 'pdf' && selectedArticle.pdfUrl ? (
                <div className="space-y-4">
                  {selectedArticle.thumbnailUrl && (
                    <div className="rounded-4xl overflow-hidden border border-stone-100 shadow-sm">
                      <img src={selectedArticle.thumbnailUrl} alt={selectedArticle.title} className="w-full object-cover max-h-48" />
                    </div>
                  )}
                  {selectedArticle.excerpt && (
                    <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm">
                      <p className="text-stone-600 text-sm leading-relaxed italic">{selectedArticle.excerpt}</p>
                    </div>
                  )}
                  <div className="bg-white rounded-4xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                          <BookOpen size={16} className="text-red-600" />
                        </div>
                        <span className="text-sm font-bold text-stone-700">Dokumen PDF</span>
                      </div>
                      <a href={selectedArticle.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                        <ChevronRight size={14} /> Buka PDF
                      </a>
                    </div>
                    <iframe src={`${selectedArticle.pdfUrl}#toolbar=0`} className="w-full"
                      style={{ height: '60vh' }} title={selectedArticle.title} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-4xl p-8 shadow-sm border border-stone-100 mb-8">
                    <div className="prose prose-stone max-w-none">
                      {(selectedArticle.content || '').split('\n').map((para: string, i: number) => (
                        <p key={i} className="text-stone-600 leading-relaxed mb-4">
                          {para.startsWith('**') ? <strong>{para.replace(/\*\*/g, '')}</strong> : para}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="bg-emerald-600 rounded-4xl p-6 text-white shadow-xl shadow-emerald-200 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white/20 rounded-2xl"><BookOpen size={24} /></div>
                    <div>
                      <h4 className="font-bold mb-1">Aksi Nyata</h4>
                      <p className="text-xs text-emerald-100 leading-relaxed">Bagikan informasi ini ke teman-temanmu untuk memberikan dampak yang lebih luas!</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tombol Selesai Baca — muncul jika dari misi, dengan countdown timer */}
            {missionArticleContext && (
              <ReadingTimer
                minReadMinutes={missionArticleContext.mission.minReadMinutes || 2}
                missionTitle={missionArticleContext.mission.title}
                progressCurrent={missionArticleContext.progress.current}
                progressTarget={missionArticleContext.progress.target}
                onFinish={async () => {
                  const { updateMissionProgress } = await import('./services/missionService');
                  const p = missionArticleContext.progress;
                  const m = missionArticleContext.mission;
                  const newCurrent = Math.min(p.current + 1, m.target);
                  const completed = newCurrent >= m.target;
                  if (user) {
                    await updateMissionProgress(user.uid, m.id, {
                      current: newCurrent,
                      completed,
                      articlesRead: [...(p.articlesRead || []), selectedArticle.id],
                    });
                  }
                  setMissionArticleContext(null);
                  setState('daily_missions');
                }}
              />
            )}
          </motion.div>
        )}

        {state === 'user_dashboard' && (
          <UserDashboard
            userData={userData}
            onDeleteHistory={deleteHistory}
            onPointsClick={() => setState('redemption')}
            onBack={() => setState('main')}
            saveUserData={saveUserData}
            onShowQR={() => setShowUserQR(true)}
            onShowPartner={() => {
              if (userData.role === 'partner') setShowPartnerDashboard(true);
              else setShowPartnerOnboard(true);
            }}
            onShowPartnerTx={() => setShowPartnerTx(true)}
            onShowUserDeposit={() => setShowUserDeposit(true)}
          />
        )}
        {state === 'result' && result && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="pb-20"
          >
            {/* Action Bar */}
            <div className="p-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-50">
              <button
                onClick={resetScanner}
                className="p-3 bg-stone-100 rounded-2xl text-stone-600 hover:bg-stone-200"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-display font-bold">Analisis Sampah</h2>
              <div className="w-10" />
            </div>

            <div className="px-6">
              {/* Photo Display */}
              <div className="relative rounded-[40px] overflow-hidden aspect-square shadow-2xl mb-8 border-4 border-white">
                <img src={scannedImage!} alt="Scanned" className="w-full h-full object-cover" />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-emerald-600 flex items-center gap-2">
                  <Sparkles size={12} />
                  Confidence: {Math.round(result.accuracy * 100)}%
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-8 border-2 border-white/50 border-dashed rounded-4xl bg-white/10 backdrop-blur-sm flex items-center justify-center px-4"
                >
                  <div className="text-white text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Terdeteksi</p>
                    <p className="text-xl font-display font-bold">{result.name}</p>
                  </div>
                </motion.div>
              </div>

              {/* Identity & Category */}
              <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${result.category === 'Organik' ? 'bg-green-100 text-green-700' :
                    result.category === 'Residu' ? 'bg-amber-100 text-amber-700' :
                    result.category === 'Anorganik' ? 'bg-blue-100 text-blue-700' :
                      result.category === 'B3' ? 'bg-red-100 text-red-700' :
                        result.category === 'Kaca' ? 'bg-cyan-100 text-cyan-700' :
                        result.category === 'Plastik' ? 'bg-purple-100 text-purple-700' :
                        result.category === 'Kertas' ? 'bg-amber-50 text-amber-900' :
                        result.category === 'Logam' ? 'bg-gray-200 text-gray-800' :
                        'bg-stone-100 text-stone-700'
                    }`}>
                    {result.category}
                  </span>
                  {result.recyclable && (
                    <span className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                      <Recycle size={12} /> Daur Ulang
                    </span>
                  )}
                </div>
              </div>

              {/* Composition */}
              <div className="bg-white rounded-[40px] p-8 shadow-sm border border-stone-100 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-6 flex items-center gap-2">
                  Komposisi Detail
                </h3>
                <div className="space-y-6">
                  {result.composition.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-stone-800 text-sm">{item.material}</span>
                        <span className="text-emerald-600 font-display font-bold">{item.percentage}%</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ delay: 0.5 + idx * 0.1, duration: 1 }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Creative Ideas */}
              <div className="bg-amber-50 rounded-[40px] p-8 mb-6 border border-amber-100">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-800 mb-6 flex items-center gap-2">
                  <Lightbulb size={18} /> Ide Kreasi (Upcycle)
                </h3>
                <div className="space-y-4">
                  {result.creativeIdeas.map((idea, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-8 h-8 bg-amber-200 rounded-xl flex items-center justify-center text-amber-800 font-bold shrink-0 text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-amber-900/80 text-sm italic py-1 leading-relaxed">
                        "{idea}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disposal & Impact */}
              <div className="bg-emerald-50 rounded-[40px] p-8 mb-6 border border-emerald-100">
                <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-800 mb-6 flex items-center gap-2">
                  <BookOpen size={18} /> Instruksi Pembuangan
                </h3>
                <p className="text-emerald-900 text-sm leading-relaxed mb-6">
                  {result.disposalGuide}
                </p>

                <div className="p-6 bg-white rounded-3xl border border-emerald-100 mb-6">
                  <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Langkah Selanjutnya</h4>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-stone-600 leading-normal">
                        Kirim sampah ini ke <b>TPU/TPA terdekat</b> melalui NeuroMap untuk mendapatkan <b>BONUS NeuroPoints (+50 NP)</b> dan bantu kelola lingkungan lebih baik!
                      </p>
                      <button
                        onClick={() => setState('map')}
                        className="mt-3 text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"
                      >
                        Cari Lokasi <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white/50 rounded-3xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-700 uppercase mb-3">Estimasi Dampak Positif:</p>
                  <div className="flex justify-between">
                    <div className="text-center">
                      <p className="text-lg font-display font-bold text-emerald-600">-{result.impactStats.co2Saved}g</p>
                      <p className="text-[10px] text-stone-400">CO2 Emissions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-display font-bold text-blue-600">{result.impactStats.waterSaved}L</p>
                      <p className="text-[10px] text-stone-400">Air Terselamatkan</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-display font-bold text-amber-600">{result.impactStats.energySaved}kW</p>
                      <p className="text-[10px] text-stone-400">Energi Hemat</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={resetScanner}
                className="w-full py-5 bg-stone-900 text-white rounded-4xl font-bold text-lg shadow-xl shadow-black/10 active:scale-95 transition-all mb-12"
              >
                Selesai (+25 Points)
              </button>
            </div>
          </motion.div>
        )}
        {state === 'waste_bank_list' && (
          <WasteBankList
            onNext={() => setState('waste_bank_calculate')}
            onBack={() => setState('main')}
            selectedItems={selectedWaste}
            onToggleItem={handleWasteToggle}
            onUpdateWeight={handleUpdateWeight}
          />
        )}

        {state === 'waste_bank_calculate' && (
          <WasteBankCalculate
            selectedItems={selectedWaste}
            onNext={() => {
              window.open('https://www.google.com/maps/search/bank+sampah+terdekat/', '_blank');
              setState('waste_bank_verify');
            }}
            onCancel={() => setState('waste_bank_list')}
          />
        )}

        {state === 'waste_bank_verify' && (
          <WasteBankVerify
            qrToken={userData.qrToken}
            selectedItems={selectedWaste}
            userUid={user?.uid || userData.uid}
            userData={userData}
            onSuccess={handleVerificationSuccess}
            onCancel={() => setState('waste_bank_calculate')}
          />
        )}

        {state === 'daily_missions' && user && (
          <DailyMissions
            userId={user.uid}
            userEmail={userData.email || user.email || ''}
            displayName={userData.displayName || user.displayName || 'User'}
            userPoints={userData.points}
            scanCountToday={(() => {
              const now = new Date();
              const day = now.getDate();
              const month = now.getMonth() + 1;
              const year = now.getFullYear();
              return userData.scanHistory?.filter(s => {
                // format date: "D/M/YYYY" atau "DD/MM/YYYY"
                const parts = s.date.split(' ')[0].replace(',','').split('/');
                return parseInt(parts[0]) === day &&
                       parseInt(parts[1]) === month &&
                       parseInt(parts[2]) === year;
              }).length || 0;
            })()}
            hasLoggedInToday={userData.lastLogin === new Date().toDateString()}
            depositApprovedToday={(() => {
              const now = new Date();
              const day = now.getDate();
              const month = now.getMonth() + 1;
              const year = now.getFullYear();
              return userData.depositHistory?.some(d => {
                if (d.status !== 'Approved') return false;
                // format date: "D/M/YYYY, HH.MM.SS" atau "DD/MM/YYYY HH.MM.SS"
                const parts = d.date.split(' ')[0].replace(',', '').split('/');
                return parseInt(parts[0]) === day &&
                       parseInt(parts[1]) === month &&
                       parseInt(parts[2]) === year;
              }) || false;
            })()}
            onBack={() => setState('main')}
            onGoToArticles={(mission, progress) => {
              setMissionArticleContext({ mission, progress });
              setState('education_list');
            }}
            onGoToDeposit={() => setState('waste_bank_list')}
            onGoToQuiz={(mission) => {
              setQuizMissionContext(mission);
              setState('quiz');
            }}
            onScanCamera={() => {
              setPrevState('daily_missions');
              fileInputRef.current?.click();
            }}
            onScanGallery={() => {
              setPrevState('daily_missions');
              galleryInputRef.current?.click();
            }}
            onPointsUpdated={(newPoints) => saveUserData({ ...userData, points: newPoints })}
          />
        )}

        {state === 'quiz' && quizMissionContext && user && (
          <QuizScreen
            mission={quizMissionContext}
            userId={user.uid}
            userPoints={userData.points}
            onBack={() => setState('daily_missions')}
            onHome={() => setState('main')}
            onPointsUpdated={(newPoints) => saveUserData({ ...userData, points: newPoints })}
          />
        )}
      </AnimatePresence>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImageInput}
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        className="hidden"
        onChange={handleImageInput}
      />

      {(state !== 'login' && state !== 'welcome' && state !== 'admin_dashboard' && state !== 'super_admin_dashboard' && state !== 'institution_admin_dashboard' && state !== 'education_detail' && state !== 'scan_options' && state !== 'waste_bank_list' && state !== 'waste_bank_calculate' && state !== 'waste_bank_verify' && state !== 'daily_missions' && state !== 'quiz' && !showPartnerDashboard && !showPartnerOnboard && !showPartnerTx) && (
        <BottomNav
          active={state}
          onChange={(nextState) => setState(nextState)}
          onScan={() => setState('scan_options')}
        />
      )}

      <AnimatePresence>
        {isRenaming && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mb-6 mx-auto">
                <Sparkles size={32} />
              </div>
              <h3 className="text-xl font-display font-bold text-center text-stone-800 mb-2">Beri Nama Temanmu</h3>
              <p className="text-center text-stone-500 text-sm mb-8">Pilih nama keren untuk mascot NeuroFlame milikmu!</p>

              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="cth: Pyro / Vulcan"
                className="w-full p-5 bg-stone-100 rounded-3xl font-bold text-lg mb-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                autoFocus
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setIsRenaming(false)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    saveUserData({ ...userData, mascotName: newName });
                    setIsRenaming(false);
                  }}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200"
                >
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reward Success Modal */}
      <AnimatePresence>
        {showRewardModal && (
          <div className="fixed inset-0 z-110 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[48px] p-10 text-center shadow-2xl overflow-hidden"
            >
              {/* Confetti Background Simulation */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-400 via-amber-400 to-emerald-400" />

              <div className="w-24 h-24 bg-emerald-100 rounded-[36px] flex items-center justify-center text-emerald-600 mb-8 mx-auto relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Award size={56} />
                </motion.div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white shadow-lg">
                  <Sparkles size={16} />
                </div>
              </div>

              <h2 className="text-3xl font-display font-bold text-stone-800 mb-2">Luar Biasa!</h2>
              <p className="text-stone-500 text-sm mb-10">Terima kasih telah berkontribusi langsung ke Bank Sampah.</p>

              <div className="bg-stone-50 rounded-4xl p-6 mb-10 border border-stone-100">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-stone-200/50">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Poin Setoran</span>
                  <span className="font-display font-bold text-stone-800">+{showRewardModal.total - showRewardModal.bonus}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Bonus TPA/Map</span>
                  <span className="font-display font-bold text-emerald-600">+{showRewardModal.bonus}</span>
                </div>
                <div className="pt-4 flex justify-between items-center">
                  <span className="text-sm font-black text-stone-800 uppercase tracking-widest">Total Diterima</span>
                  <div className="flex items-center gap-2">
                    <Coins size={20} className="text-amber-500" />
                    <span className="text-3xl font-display font-bold text-emerald-600">{showRewardModal.total}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowRewardModal(null)}
                className="w-full py-5 bg-stone-900 text-white rounded-[28px] font-bold text-lg shadow-xl shadow-black/20 active:scale-95 transition-all"
              >
                Mantap!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUserQR && (
          <UserQR
            uid={user?.uid}
            qrToken={userData.qrToken}
            onClose={() => setShowUserQR(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPartnerOnboard && (
          <PartnerOnboarding
            uid={user?.uid}
            onClose={() => setShowPartnerOnboard(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPartnerDashboard && (
          <PartnerDashboard
            uid={user?.uid}
            onClose={() => setShowPartnerDashboard(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPartnerTx && (
          <PartnerTransactionSubmit
            partnerUid={user?.uid}
            onClose={() => setShowPartnerTx(false)}
            onDone={() => { setShowPartnerTx(false); setState('user_dashboard'); }}
          />
        )}
        {showUserDeposit && (
          <UserDepositSubmit
            currentUserQr={userData.qrToken}
            userUid={user?.uid}
            userData={userData}
            onClose={() => setShowUserDeposit(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotifications && (
          <NotificationModal
            notifications={userData.notifications}
            onClose={() => setShowNotifications(false)}
            onMarkAsRead={handleMarkAsRead}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {depositApprovalAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-200 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative overflow-hidden text-center"
            >
              <button
                onClick={() => setDepositApprovalAlert(null)}
                className="absolute top-4 right-4 p-2 bg-stone-50 text-stone-400 rounded-2xl hover:text-stone-600"
              >
                <X size={18} />
              </button>
              <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-500 to-teal-500" />
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={42} />
              </div>
              <h3 className="text-2xl font-display font-black text-stone-900 mb-2">Selamat!</h3>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">
                {depositApprovalAlert.message}
              </p>

              {depositApprovalAlert.depositItems && depositApprovalAlert.depositItems.length > 0 && (
                <div className="bg-stone-50 border border-stone-100 rounded-3xl p-4 mb-5 text-left space-y-2">
                  {depositApprovalAlert.depositItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-stone-800 capitalize">{item.category || item.name}</p>
                        <p className="text-[10px] text-stone-400 font-medium">{item.weight} kg</p>
                      </div>
                      <span className="text-sm font-black text-amber-600">+{item.points.toLocaleString()} NP</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
                    <span className="text-xs font-black text-stone-500 uppercase tracking-wide">Total Berat</span>
                    <span className="text-sm font-black text-stone-800">{depositApprovalAlert.totalWeight?.toFixed(1) || '0'} kg</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-stone-500 uppercase tracking-wide">Total NeuroPoints</span>
                    <span className="text-lg font-black text-emerald-600">{(depositApprovalAlert.totalPoints || 0).toLocaleString()} NP</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  handleMarkAsRead(depositApprovalAlert.id);
                  setDepositApprovalAlert(null);
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-base hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100"
              >
                Selesai
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NeuroBot Chatbot */}
      {state !== 'login' && state !== 'welcome' && state !== 'admin_dashboard' && state !== 'quiz' && (
        <NeuroBot userData={userData} />
      )}
    </div>
  );
}