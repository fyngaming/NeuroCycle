import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Save, RotateCcw, CheckCircle2, Gift, Camera, Recycle, Brain } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { LeaderboardRewardConfig } from '../../types';

const DEFAULT_CONFIG: LeaderboardRewardConfig = {
  scanner: { rank1: 1000, rank2: 500, rank3: 250 },
  collector: { rank1: 1500, rank2: 750, rank3: 350 },
  quiz: { rank1: 1000, rank2: 500, rank3: 250 }
};

export const LeaderboardRewardSettings: React.FC = () => {
  const [config, setConfig] = useState<LeaderboardRewardConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'leaderboardRewards'));
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as LeaderboardRewardConfig);
        }
      } catch (err) {
        console.error('Failed to load leaderboard rewards settings:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (category: keyof LeaderboardRewardConfig, rank: 'rank1' | 'rank2' | 'rank3', val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rank]: num
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'systemSettings', 'leaderboardRewards'), config, { merge: true });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save rewards:', err);
      alert('Gagal menyimpan pengaturan hadiah.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset nominal hadiah ke nilai default sistem?')) {
      setConfig(DEFAULT_CONFIG);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Trophy size={20} />
          </div>
          <div>
            <h3 className="font-display font-black text-lg text-stone-800">
              Pengaturan Hadiah Leaderboard Top 3
            </h3>
            <p className="text-xs text-stone-500">
              Tentukan jumlah NeuroPoints (NP) untuk pemenang posisi 1, 2, dan 3 di setiap kategori.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Default</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-bold flex items-center gap-2 border border-emerald-200"
        >
          <CheckCircle2 size={16} />
          <span>Pengaturan hadiah NeuroPoints berhasil disimpan dan langsung aktif!</span>
        </motion.div>
      )}

      {/* Grid 3 Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Scanner Sampah */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-4">
          <div className="flex items-center gap-2 text-stone-800 font-black text-sm">
            <Camera size={16} className="text-emerald-600" />
            <span>📸 Scanner Sampah</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-amber-600 flex items-center justify-between">
                <span>🥇 Juara 1 (Emas)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.scanner.rank1}
                onChange={e => handleChange('scanner', 'rank1', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                <span>🥈 Juara 2 (Perak)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.scanner.rank2}
                onChange={e => handleChange('scanner', 'rank2', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-orange-700 flex items-center justify-between">
                <span>🥉 Juara 3 (Perunggu)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.scanner.rank3}
                onChange={e => handleChange('scanner', 'rank3', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Pengumpul Sampah */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-4">
          <div className="flex items-center gap-2 text-stone-800 font-black text-sm">
            <Recycle size={16} className="text-teal-600" />
            <span>♻️ Pengumpul Sampah</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-amber-600 flex items-center justify-between">
                <span>🥇 Juara 1 (Emas)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.collector.rank1}
                onChange={e => handleChange('collector', 'rank1', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                <span>🥈 Juara 2 (Perak)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.collector.rank2}
                onChange={e => handleChange('collector', 'rank2', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-orange-700 flex items-center justify-between">
                <span>🥉 Juara 3 (Perunggu)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.collector.rank3}
                onChange={e => handleChange('collector', 'rank3', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Si Paling Quiz */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-4">
          <div className="flex items-center gap-2 text-stone-800 font-black text-sm">
            <Brain size={16} className="text-indigo-600" />
            <span>🧠 Si Paling Quiz</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-amber-600 flex items-center justify-between">
                <span>🥇 Juara 1 (Emas)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.quiz.rank1}
                onChange={e => handleChange('quiz', 'rank1', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                <span>🥈 Juara 2 (Perak)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.quiz.rank2}
                onChange={e => handleChange('quiz', 'rank2', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-orange-700 flex items-center justify-between">
                <span>🥉 Juara 3 (Perunggu)</span>
                <span>NP</span>
              </label>
              <input
                type="number"
                value={config.quiz.rank3}
                onChange={e => handleChange('quiz', 'rank3', e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardRewardSettings;
