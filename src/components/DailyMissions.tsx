import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Clock, CheckCircle, Gift, Camera, BookOpen,
  LogIn, Recycle, Upload, X, Loader2, AlertTriangle,
  ImageIcon, Zap, Brain,
} from 'lucide-react';
import {
  getActiveMissions, initMissionProgress,
  claimMissionReward, syncMissionStatuses, updateMissionProgress,
  getAllUserMissionProgress,
} from '../services/missionService';
import { logError } from '../lib/errorLogger';
import type { Mission, MissionProgress } from '../types';

// ─── Countdown Timer Hook ─────────────────────────────────────────

const useCountdown = (expiresAt: string) => {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, expired: remaining === 0 };
};

// ─── Mission Icon ─────────────────────────────────────────────────

const MissionIcon = ({ type }: { type: Mission['type'] }) => {
  const map: Record<string, React.ReactNode> = {
    login: <LogIn size={22} />,
    scan: <Camera size={22} />,
    read_article: <BookOpen size={22} />,
    photo_proof: <Upload size={22} />,
    deposit: <Recycle size={22} />,
    quiz: <Brain size={22} />,
  };
  const colors: Record<string, string> = {
    login: 'bg-blue-50 text-blue-600',
    scan: 'bg-emerald-50 text-emerald-600',
    read_article: 'bg-purple-50 text-purple-600',
    photo_proof: 'bg-orange-50 text-orange-600',
    deposit: 'bg-teal-50 text-teal-600',
    quiz: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[type] || 'bg-stone-50 text-stone-500'}`}>
      {map[type] || <Zap size={22} />}
    </div>
  );
};

// ─── ScanPickerModal ──────────────────────────────────────────────

const ScanPickerModal = ({
  onCamera, onGallery, onClose
}: {
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-200 flex items-end justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
      onClick={e => e.stopPropagation()}
      className="bg-white rounded-[40px] p-6 w-full max-w-sm shadow-2xl mb-4"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-display font-bold text-stone-900">Mulai Scan Sampah</h3>
        <button onClick={onClose} className="p-2 bg-stone-100 rounded-xl text-stone-500">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onCamera}
          className="flex flex-col items-center gap-3 p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 hover:border-emerald-400 active:scale-95 transition-all">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Camera size={28} />
          </div>
          <span className="text-sm font-black text-emerald-700">Kamera</span>
          <span className="text-[10px] text-emerald-500 text-center">Ambil foto langsung</span>
        </button>
        <button onClick={onGallery}
          className="flex flex-col items-center gap-3 p-6 bg-stone-50 rounded-3xl border-2 border-stone-100 hover:border-stone-400 active:scale-95 transition-all">
          <div className="w-14 h-14 bg-stone-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
            <ImageIcon size={28} />
          </div>
          <span className="text-sm font-black text-stone-700">Galeri</span>
          <span className="text-[10px] text-stone-400 text-center">Pilih dari galeri</span>
        </button>
      </div>
      <p className="text-[10px] text-stone-400 text-center mt-4 font-medium">
        Setiap scan akan otomatis menghitung progress misi
      </p>
    </motion.div>
  </motion.div>
);

// ─── ProofUpload ──────────────────────────────────────────────────

interface ProofUploadProps {
  mission: Mission;
  progress: MissionProgress;
  userId: string;
  userEmail: string;
  displayName: string;
  onClose: () => void;
  onSubmitted: (newCurrent: number, completed: boolean) => void;
}

export const ProofUpload: React.FC<ProofUploadProps> = ({
  mission, progress, userId, onClose, onSubmitted
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const compressImage = (base64: string): Promise<string> =>
        new Promise(resolve => {
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

      const compressed = preview ? await compressImage(preview) : '';

      // Simpan sebagai pending — TIDAK langsung update progress
      // Admin harus approve dulu
      await updateMissionProgress(userId, mission.id, {
        pendingProofImage: compressed,
        proofStatus: 'pending_review',
      });
      onSubmitted(progress.current, false);
    } catch (err) {
      await logError({
        severity: 'ERROR',
        type: 'mission_proof_upload_failed',
        message: err instanceof Error ? err.message : 'Gagal mengunggah bukti foto misi',
        context: 'mission_proof_upload',
        userId,
        functionName: 'handleSubmit',
        stack: err instanceof Error ? err.stack : undefined,
        metadata: { missionId: mission.id, missionTitle: mission.title }
      });
      alert('Gagal menyimpan. Coba lagi.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-200 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-bold text-stone-900">Upload Bukti Foto</h3>
          <button onClick={onClose} className="p-2 bg-stone-100 rounded-xl text-stone-500">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 p-3 bg-stone-50 rounded-2xl">
          <p className="text-xs font-bold text-stone-600">{mission.title}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">Progress: {progress.current}/{progress.target}</p>
        </div>

        <div className="w-full aspect-square rounded-[28px] border-2 border-dashed border-stone-200 relative overflow-hidden bg-stone-50 mb-4 flex flex-col items-center justify-center">
          {preview ? (
            <>
              <img src={preview} alt="Bukti" className="w-full h-full object-cover" />
              <button onClick={() => { setPreview(null); setFile(null); }}
                className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full">
                <X size={14} />
              </button>
            </>
          ) : (
            <div className="text-center p-6">
              <Camera size={40} className="text-stone-300 mx-auto mb-2" />
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                Pilih sumber foto di bawah
              </p>
            </div>
          )}
        </div>

        {!preview && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => cameraRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-200">
              <Camera size={18} /> Kamera
            </button>
            <button onClick={() => galleryRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 bg-stone-800 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all">
              <ImageIcon size={18} /> Galeri
            </button>
          </div>
        )}

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <button onClick={handleSubmit} disabled={!file || uploading}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95 transition-all">
          {uploading
            ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</>
            : <><Upload size={18} /> Kirim untuk Diverifikasi Admin</>
          }
        </button>
        <p className="text-[10px] text-stone-400 text-center mt-2 font-medium">
          Foto akan diverifikasi Admin sebelum progress bertambah
        </p>
      </motion.div>
    </motion.div>
  );
};

// ─── MissionCard ──────────────────────────────────────────────────

const MissionCard = ({
  mission, progress, onClaim, onProof, onGoToArticles, onGoToScan, onGoToDeposit, onGoToQuiz
}: {
  mission: Mission;
  progress: MissionProgress | undefined;
  onClaim: (m: Mission) => void;
  onProof: (m: Mission, p: MissionProgress) => void;
  onGoToArticles: (m: Mission, p: MissionProgress) => void;
  onGoToScan: () => void;
  onGoToDeposit: () => void;
  onGoToQuiz: (m: Mission) => void;
}) => {
  const current = progress?.current || 0;
  const completed = progress?.completed || false;
  const claimed = progress?.claimed || false;
  const progressPct = Math.min((current / mission.target) * 100, 100);
  const { h, m, s, expired } = useCountdown(mission.expiresAt);

  const actionButton = () => {
    if (claimed) return (
      <div className="w-full py-3 bg-stone-50 text-stone-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
        <CheckCircle size={16} /> Hadiah sudah diklaim
      </div>
    );
    if (expired && !completed) return (
      <div className="w-full py-3 bg-red-50 text-red-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
        <AlertTriangle size={16} /> Misi berakhir
      </div>
    );
    if (completed) return (
      <motion.button
        animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
        onClick={() => onClaim(mission)}
        className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all">
        <Gift size={18} /> Klaim {mission.rewardPoints.toLocaleString()} NP
      </motion.button>
    );

    switch (mission.type) {
      case 'scan':
        return (
          <button onClick={onGoToScan}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all">
            <Camera size={18} /> Mulai Scan Sekarang ({current}/{mission.target})
          </button>
        );
      case 'deposit':
        return (
          <div className="space-y-2">
            <button onClick={onGoToDeposit}
              className="w-full py-3.5 bg-teal-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-200 active:scale-95 transition-all">
              <Recycle size={18} /> Setor Sampah Sekarang ({current}/{mission.target})
            </button>
            <p className="text-[10px] text-teal-600 text-center font-medium">
              ⏳ Progress dihitung setelah Admin memverifikasi setoran
            </p>
          </div>
        );
      case 'photo_proof':
        // Jika ada foto pending review
        if (progress?.proofStatus === 'pending_review') {
          return (
            <div className="w-full py-3.5 bg-amber-50 text-amber-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-amber-100">
              <Clock size={16} /> Menunggu Verifikasi Admin...
            </div>
          );
        }
        // Jika foto ditolak
        if (progress?.proofStatus === 'rejected') {
          return (
            <div className="space-y-2">
              <div className="w-full py-2.5 bg-red-50 text-red-500 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-red-100">
                ⚠️ Foto ditolak Admin — Upload ulang
              </div>
              <button onClick={() => progress && onProof(mission, progress)}
                className="w-full py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-200 active:scale-95 transition-all">
                <Camera size={18} /> Upload Foto Baru ({current}/{mission.target})
              </button>
            </div>
          );
        }
        return progress ? (
          <button onClick={() => onProof(mission, progress)}
            className="w-full py-3.5 bg-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-200 active:scale-95 transition-all">
            <Camera size={18} /> Upload Foto Bukti ({current}/{mission.target})
          </button>
        ) : null;
      case 'read_article':
        return progress ? (
          <button onClick={() => onGoToArticles(mission, progress)}
            className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-200 active:scale-95 transition-all">
            <BookOpen size={18} /> Baca Artikel ({current}/{mission.target})
          </button>
        ) : null;
      case 'login':
        return (
          <div className="w-full py-3.5 bg-blue-50 text-blue-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-blue-100">
            <Zap size={16} />
            {current >= mission.target
              ? 'Login hari ini sudah tercatat ✓'
              : 'Menunggu deteksi login harian...'}
          </div>
        );
      case 'quiz':
        // Jika sudah selesai quiz (quiz submitted)
        if (progress?.quizScore !== undefined) {
          return (
            <div className="w-full py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-indigo-100">
              <Brain size={16} />
              Quiz selesai — Skor: {progress.quizScore}/{mission.questions?.length || 0} ✓
            </div>
          );
        }
        return (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onGoToQuiz(mission)}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
          >
            <Brain size={18} />
            Kerjakan Quiz Sekarang
          </motion.button>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div layout
      className={`bg-white p-5 sm:p-6 rounded-3xl sm:rounded-4xl border shadow-xs transition-all ${
        completed && !claimed ? 'border-emerald-300 shadow-emerald-100/50' :
        claimed ? 'border-stone-100 opacity-70' : 'border-stone-200/70'
      }`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4 mb-4">
        <MissionIcon type={mission.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug">{mission.title}</h3>
            {claimed && <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">Selesai</span>}
          </div>
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{mission.description}</p>
        </div>
        <div className="text-right shrink-0 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
          <p className="text-xs sm:text-sm font-black text-emerald-700">+{mission.rewardPoints.toLocaleString()}</p>
          <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-wider">NP</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold text-stone-500">Progress: {current}/{mission.target}</span>
          <span className={`text-[10px] font-bold flex items-center gap-1 ${expired ? 'text-rose-500' : 'text-stone-400'}`}>
            <Clock size={11} />
            {expired ? 'Berakhir' : `${h}j ${m}m ${s}d`}
          </span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <motion.div animate={{ width: `${progressPct}%` }}
            className={`h-full rounded-full ${completed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        </div>
        <div className="flex gap-1.5 mt-2">
          {Array.from({ length: mission.target }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < current ? 'bg-emerald-500' : 'bg-stone-100'}`} />
          ))}
        </div>
      </div>

      {actionButton()}
    </motion.div>
  );
};

// ─── DailyMissions ────────────────────────────────────────────────

interface DailyMissionsProps {
  userId: string;
  userEmail: string;
  displayName: string;
  userPoints: number;
  scanCountToday: number;
  hasLoggedInToday: boolean;
  depositApprovedToday: boolean;
  isDesktop?: boolean;
  onBack: () => void;
  onGoToArticles: (mission: Mission, progress: MissionProgress) => void;
  onGoToDeposit: () => void;
  onGoToQuiz: (mission: Mission) => void;
  onPointsUpdated: (newPoints: number) => void;
  onScanCamera: () => void;
  onScanGallery: () => void;
}

export const DailyMissions: React.FC<DailyMissionsProps> = ({
  userId, userEmail, displayName, userPoints,
  scanCountToday, hasLoggedInToday, depositApprovedToday,
  isDesktop = false,
  onBack, onGoToArticles, onGoToDeposit, onGoToQuiz, onPointsUpdated,
  onScanCamera, onScanGallery,
}) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  // progressMap dibaca REAL-TIME dari Firestore
  const [progressMap, setProgressMap] = useState<Record<string, MissionProgress>>({});
  const [proofMission, setProofMission] = useState<{ mission: Mission; progress: MissionProgress } | null>(null);
  const [claimModal, setClaimModal] = useState<{ mission: Mission; points: number } | null>(null);
  const [showScanPicker, setShowScanPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Load misi aktif ──────────────────────────────────────────────
  useEffect(() => {
    syncMissionStatuses();
    const unsub = getActiveMissions(async (activeMissions) => {
      setMissions(activeMissions);
      setLoading(false);
      // Init progress untuk misi yang belum ada dokumennya
      for (const m of activeMissions) {
        const progressId = `${userId}_${m.id}`;
        const snap = await import('../lib/firebase').then(({ db }) =>
          import('firebase/firestore').then(({ doc, getDoc }) =>
            getDoc(doc(db, 'missionProgress', progressId))
          )
        );
        if (!snap.exists()) {
          await initMissionProgress(userId, m);
        }
      }
    });
    return unsub;
  }, [userId]);

  // ── Real-time listener untuk semua progress user ─────────────────
  useEffect(() => {
    if (!userId) return;
    const unsub = getAllUserMissionProgress(userId, (allProgress) => {
      const map: Record<string, MissionProgress> = {};
      allProgress.forEach(p => { map[p.missionId] = p; });
      setProgressMap(map);
    });
    return unsub;
  }, [userId]);

  // ── Auto-complete: login, scan, deposit ──────────────────────────
  useEffect(() => {
    if (missions.length === 0) return;
    missions.forEach(async (m) => {
      const p = progressMap[m.id];
      if (!p || p.completed) return;

      // Login: auto-complete jika sudah login hari ini
      if (m.type === 'login' && hasLoggedInToday && p.current < 1) {
        await updateMissionProgress(userId, m.id, { current: 1, completed: 1 >= m.target });
      }
      // Scan: update jika scanCountToday lebih besar dari current tersimpan
      if (m.type === 'scan' && scanCountToday > p.current) {
        const newVal = Math.min(scanCountToday, m.target);
        await updateMissionProgress(userId, m.id, { current: newVal, completed: newVal >= m.target });
      }
      // Deposit: auto-complete jika ada deposit approved hari ini
      if (m.type === 'deposit' && depositApprovedToday && p.current < 1) {
        await updateMissionProgress(userId, m.id, { current: 1, completed: 1 >= m.target });
      }
    });
  }, [missions, progressMap, hasLoggedInToday, scanCountToday, depositApprovedToday]);

  const handleClaim = async (mission: Mission) => {
    const p = progressMap[mission.id];
    if (!p?.completed || p.claimed) return;
    await claimMissionReward(userId, mission.id, mission.rewardPoints, userPoints);
    onPointsUpdated(userPoints + mission.rewardPoints);
    setClaimModal({ mission, points: mission.rewardPoints });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
        <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">Memuat Misi Harian...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`mx-auto ${isDesktop ? 'p-6 sm:p-8 max-w-5xl pb-40' : 'p-4 pb-36 max-w-md w-full'}`}>
      <header className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-black text-stone-900">Misi Harian</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">Selesaikan misi untuk dapatkan NeuroPoints ekstra</p>
        </div>
        <button onClick={onBack} className="p-2.5 sm:p-3 bg-white rounded-2xl shadow-xs border border-stone-200/80 active:scale-95 transition-transform cursor-pointer">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
      </header>

      {missions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-stone-200 p-6">
          <div className="text-4xl mb-3">🎯</div>
          <p className="font-bold text-stone-700 mb-1">Belum Ada Misi Hari Ini</p>
          <p className="text-xs text-stone-400">Admin belum menjadwalkan misi. Cek lagi nanti!</p>
        </div>
      ) : (
        <div className={isDesktop ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "flex flex-col gap-4"}>
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              progress={progressMap[mission.id]}
              onClaim={handleClaim}
              onProof={(m, p) => setProofMission({ mission: m, progress: p })}
              onGoToArticles={onGoToArticles}
              onGoToScan={() => setShowScanPicker(true)}
              onGoToDeposit={onGoToDeposit}
              onGoToQuiz={onGoToQuiz}
            />
          ))}
        </div>
      )}

      {/* Scan Picker Modal */}
      <AnimatePresence>
        {showScanPicker && (
          <ScanPickerModal
            onCamera={() => { setShowScanPicker(false); onScanCamera(); }}
            onGallery={() => { setShowScanPicker(false); onScanGallery(); }}
            onClose={() => setShowScanPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Proof Upload Modal */}
      <AnimatePresence>
        {proofMission && (
          <ProofUpload
            mission={proofMission.mission}
            progress={proofMission.progress}
            userId={userId}
            userEmail={userEmail}
            displayName={displayName}
            onClose={() => setProofMission(null)}
            onSubmitted={(newCurrent, completed) => {
              // progressMap akan auto-update via onSnapshot, tidak perlu manual
              setProofMission(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Claim Success Modal */}
      <AnimatePresence>
        {claimModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-200 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-display font-bold text-stone-900 mb-2">Selamat!</h3>
              <p className="text-stone-500 text-sm mb-2">Kamu telah menyelesaikan misi</p>
              <p className="font-bold text-stone-800 mb-4">"{claimModal.mission.title}"</p>
              <div className="bg-emerald-50 rounded-3xl p-4 mb-6 border border-emerald-100">
                <p className="text-3xl font-display font-black text-emerald-600">+{claimModal.points.toLocaleString()} NP</p>
                <p className="text-xs text-emerald-500 font-bold mt-1">sudah masuk ke akunmu</p>
              </div>
              <button onClick={() => setClaimModal(null)}
                className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-bold active:scale-95 transition-all cursor-pointer">
                Selesai
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
