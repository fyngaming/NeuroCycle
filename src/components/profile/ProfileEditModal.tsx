import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Check, Sparkles, User, AtSign, Crown, Leaf, Zap, Shield, Image as ImageIcon } from 'lucide-react';
import { ProfileAvatarFrame, AvatarFrameType } from './ProfileAvatarFrame';
import type { UserData } from '../../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
  onSave: (updatedData: UserData) => void;
}

const PRESET_FRAMES: { id: AvatarFrameType; name: string; desc: string; icon: any; color: string }[] = [
  { id: 'auto', name: 'Otomatis Juara', desc: 'Sesuai peringkat medali tertinggi aktif Anda', icon: Sparkles, color: 'from-amber-400 to-emerald-500' },
  { id: 'champion_gold', name: 'Emas Juara 1', desc: 'Mahkota emas berkilau sang pemenang', icon: Crown, color: 'from-amber-400 to-yellow-500' },
  { id: 'champion_silver', name: 'Perak Bersinar', desc: 'Lingkaran perak mengkilap elegan', icon: Sparkles, color: 'from-slate-300 to-slate-400' },
  { id: 'champion_bronze', name: 'Perunggu Api', desc: 'Gradasi perunggu tembaga berwibawa', icon: Sparkles, color: 'from-orange-500 to-amber-600' },
  { id: 'eco_emerald', name: 'Zamrud Lestari', desc: 'Lingkaran hijau daun khas pelestari bumi', icon: Leaf, color: 'from-emerald-500 to-teal-600' },
  { id: 'cyber_neon', name: 'Cyber Pulse', desc: 'Efek futuristik neon cyan & biru', icon: Zap, color: 'from-cyan-400 to-blue-500' },
  { id: 'classic', name: 'Klasik Minimalis', desc: 'Tampilan bersih, rapi, dan netral', icon: Shield, color: 'from-stone-300 to-stone-400' }
];

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  userData,
  onSave
}) => {
  const [displayName, setDisplayName] = useState(userData.displayName || '');
  const [username, setUsername] = useState(
    userData.username ||
    (userData.displayName ? userData.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '') : '') ||
    (userData.email ? userData.email.split('@')[0] : 'pemilah')
  );
  const [photoUrl, setPhotoUrl] = useState(userData.photoURL || userData.avatarUrl || '');
  const [selectedFrame, setSelectedFrame] = useState<AvatarFrameType>(
    (userData.avatarFrame as AvatarFrameType) || 'auto'
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar. Maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const updated: UserData = {
      ...userData,
      displayName: displayName.trim() || userData.displayName,
      username: cleanUsername,
      photoURL: photoUrl,
      avatarUrl: photoUrl,
      avatarFrame: selectedFrame
    };

    onSave(updated);

    // Save to Firestore if uid exists
    if (userData.uid) {
      try {
        await setDoc(doc(db, 'users', userData.uid), {
          displayName: updated.displayName,
          username: cleanUsername,
          photoURL: photoUrl,
          avatarUrl: photoUrl,
          avatarFrame: selectedFrame
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update profile in Firestore:', err);
      }
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 25 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 25 }}
          className="bg-white rounded-[36px] max-w-md w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl relative border-2 border-emerald-100"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all cursor-pointer shadow-xs"
          >
            <X size={18} />
          </button>

          <div className="text-center mb-6">
            <h3 className="text-xl font-display font-black text-stone-900">
              Ubah Profil & Frame Foto
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Sesuaikan avatar dan identitas pemilah Anda
            </p>
          </div>

          {/* Avatar Preview with Live Frame */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group">
              <ProfileAvatarFrame
                photoUrl={photoUrl}
                displayName={displayName || 'Pemilah'}
                size="xl"
                frameType={selectedFrame}
              />
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-1 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer shadow-lg border-2 border-white transition-all active:scale-95"
                title="Unggah Foto Baru"
              >
                <Camera size={16} />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-3">
              Klik ikon kamera untuk mengunggah foto baru (maks. 2MB)
            </p>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4 mb-6">
            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={13} className="text-emerald-600" />
                <span>Nama Lengkap / Panggilan</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Favian Yusuf"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white text-stone-900 text-sm font-semibold outline-none transition-all shadow-xs"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AtSign size={13} className="text-emerald-600" />
                <span>Username Profil</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username_anda"
                  className="w-full pl-8 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white text-stone-900 text-sm font-semibold outline-none transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Frame Selector */}
            <div>
              <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crown size={13} className="text-amber-500" />
                <span>Pilih Frame Lingkaran Foto</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {PRESET_FRAMES.map((f) => {
                  const Icon = f.icon;
                  const isSelected = selectedFrame === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFrame(f.id)}
                      className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                          : 'bg-stone-50/60 border-stone-200/80 hover:border-emerald-200'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${f.color} flex items-center justify-center text-white shrink-0 shadow-xs`}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-stone-900 truncate">{f.name}</p>
                        <p className="text-[9px] text-stone-500 truncate">{f.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check size={11} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-full text-xs text-stone-400 hover:text-stone-600 font-bold py-2 transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileEditModal;

