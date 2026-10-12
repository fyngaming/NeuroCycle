import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizePhotoUrl } from '../lib/photoUrl';
import { logError } from '../lib/errorLogger';

const uploadToImgBB = async (file: Blob | File): Promise<string> => {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!apiKey) throw new Error('VITE_IMGBB_API_KEY belum disetel di environment (Vercel).');
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${apiKey}`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  if (!json.success || !json.data?.url) {
    throw new Error('ImgBB upload gagal: ' + (json?.error?.message || JSON.stringify(json).slice(0, 160)));
  }
  return normalizePhotoUrl(json.data.url);
};

import { Loader2, Camera as CameraIcon, AlertTriangle, Check, Wifi, WifiOff, FileImage, Zap, QrCode, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const WASTE_CATEGORIES = [
  { id: 'plastik', name: 'Plastik', pointsPerKg: 1000 },
  { id: 'kertas', name: 'Kertas', pointsPerKg: 800 },
  { id: 'logam', name: 'Logam', pointsPerKg: 1500 },
  { id: 'kaca', name: 'Kaca', pointsPerKg: 1200 },
  { id: 'kardus', name: 'Kardus', pointsPerKg: 900 },
  { id: 'residu', name: 'Residu', pointsPerKg: 500 },
];

type DepositItem = { category: string; name?: string; weight: number; points: number };

const compressImage = (file: File, maxW = 1024, quality = 0.75): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

const PartnerTransactionSubmit = ({ partnerUid, onClose, onDone }: { partnerUid?: string; onClose: () => void; onDone?: () => void }) => {
  const [userToken, setUserToken] = useState('');
  const [category, setCategory] = useState('plastik');
  const [weight, setWeight] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    title: string; message: string; items?: DepositItem[]; totalWeight?: number; totalPoints?: number; bankName?: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showScanner, setShowScanner] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const submitTimedOutRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const [partnerStatus, setPartnerStatus] = useState<'pending' | 'approved' | 'rejected' | 'suspended' | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [itemsList, setItemsList] = useState<Array<{ categoryId: string; categoryName: string; weight: number; points: number }>>([]);

  const addItem = () => {
    const cat = WASTE_CATEGORIES.find(c => c.id === category);
    if (!cat || weight <= 0) return;
    setItemsList([...itemsList, { categoryId: cat.id, categoryName: cat.name, weight, points: weight * cat.pointsPerKg }]);
  };

  const removeItem = (index: number) => { setItemsList(itemsList.filter((_, i) => i !== index)); };
  const totalWeight = itemsList.reduce((sum, item) => sum + item.weight, 0);
  const totalPoints = itemsList.reduce((sum, item) => sum + item.points, 0);

  useEffect(() => {
    if (!partnerUid) return;
    const q = query(collection(db, 'partners'), where('ownerUid', '==', partnerUid));
    const unsub = onSnapshot(q, (snap) => {
      setPartnerStatus(!snap.empty ? snap.docs[0].data().status : null);
      setPartnerName(!snap.empty ? snap.docs[0].data().name || 'Bank Sampah' : '');
    });
    return () => unsub();
  }, [partnerUid]);

  useEffect(() => {
    const trimmedToken = userToken.trim().replace(/^user:/i, '');
    if (!trimmedToken) {
      setScannedUser(null);
      setLoadingUser(false);
      return;
    }
    setLoadingUser(true);
    const timer = setTimeout(() => {
      getDocs(query(collection(db, 'users'), where('qrToken', '==', trimmedToken)))
        .then(snap => {
          if (!snap.empty) setScannedUser({ uid: snap.docs[0].id, ...snap.docs[0].data() });
          else setScannedUser(null);
        })
        .catch(() => setScannedUser(null))
        .finally(() => setLoadingUser(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [userToken]);

  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        qrbox: { width: 280, height: 280 },
        fps: 10,
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      false
    );

    scanner.render(
      (text) => {
        try {
          scanner.clear().catch(() => {});
        } catch (_) {}
        setUserToken(text.trim().replace(/^user:/i, ''));
        setShowScanner(false);
      },
      () => {}
    );

    return () => {
      try {
        scanner.clear().catch(() => {});
      } catch (_) {}
    };
  }, [showScanner]);

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const submit = async () => {
    if (submitting || isSubmittingRef.current) return;
    if (!userToken.trim()) return alert('Masukkan token QR user');
    if (!photo) return alert('Unggah foto bukti dulu');
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    
    const trimmedToken = userToken.trim().replace(/^user:/i, '');
    const finalItems: DepositItem[] = itemsList.length === 0 && weight > 0
      ? [{ category: category, name: WASTE_CATEGORIES.find(c => c.id === category)?.name || category, weight, points: weight * (WASTE_CATEGORIES.find(c => c.id === category)?.pointsPerKg || 1000) }]
      : itemsList.map(i => ({ category: i.categoryId, name: i.categoryName, weight: i.weight, points: i.points }));
    const finalTotalWeight = finalItems.reduce((s, i) => s + i.weight, 0);
    const finalTotalPoints = finalItems.reduce((s, i) => s + i.points, 0);
    const isUnapproved = partnerStatus !== 'approved';
    const txStatus = isUnapproved ? 'flagged_for_review' : 'pending';

    try {
      const userPromise = scannedUser
        ? Promise.resolve({ uid: scannedUser.uid, data: scannedUser })
        : getDocs(query(collection(db, 'users'), where('qrToken', '==', trimmedToken))).then(snap => {
            if (snap.empty) throw new Error('User tidak ditemukan');
            return { uid: snap.docs[0].id, data: snap.docs[0].data() };
          });

      const partnerPromise = partnerUid
        ? getDoc(doc(db, 'partners', partnerUid)).then(docSnap => docSnap.exists() ? docSnap.data() : null)
        : Promise.resolve(null);

      const [resolvedUser, partnerData, photoUrl] = await Promise.all([
        userPromise,
        partnerPromise,
        compressImage(photo).then(f => uploadToImgBB(f))
      ]);

      const partnerInstitutionId = partnerData?.institutionId || null;

      // Cari transaksi pending yang sudah ada (dari WasteBankVerify user)
      const existingTxSnap = await getDocs(query(
        collection(db, 'transactions'),
        where('partnerUid', '==', partnerUid || 'unverified'),
        where('userToken', '==', trimmedToken),
        where('status', '==', 'pending')
      ));

      let txId: string;

      if (!existingTxSnap.empty) {
        // Update transaksi yang sudah ada — sertakan photoUrl
        txId = existingTxSnap.docs[0].id;
        await updateDoc(doc(db, 'transactions', txId), {
          status: txStatus,
          updatedAt: new Date().toISOString(),
          institutionId: partnerInstitutionId || null,
          partnerId: partnerUid || null,
          // Simpan foto bukti agar terlihat di dashboard admin
          photoUrl: photoUrl || '',
          image: photoUrl || '',
        });
      } else {
        // Buat transaksi baru
        txId = doc(collection(db, 'transactions')).id;
        const txDocRef = doc(db, 'transactions', txId);
        await setDoc(txDocRef, {
          partnerUid: partnerUid || 'unverified',
          partnerId: partnerUid || null,
          partnerName: partnerName || (isUnapproved ? 'Bank Sampah Belum Terdaftar' : 'Bank Sampah'),
          userUid: resolvedUser.uid,
          userToken: trimmedToken,
          category: category,
          weight: finalTotalWeight,
          items: finalItems,
          totalWeight: finalTotalWeight,
          totalPoints: finalTotalPoints,
          photoUrl: photoUrl || '',
          image: photoUrl || '',
          status: txStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          institutionId: partnerInstitutionId
        });
      }

      if (isUnapproved) {
        await setDoc(doc(db, 'adminReviews', txId), {
          txId,
          reason: 'Partner belum terdaftar',
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      setSuccessInfo({
        title: isUnapproved ? 'Menunggu Review Admin' : 'Setoran Dicatat',
        message: isUnapproved
          ? 'Bank sampah belum terdaftar. Setoran menunggu verifikasi admin.'
          : `Setoran berhasil diajukan. Total: ${finalTotalWeight} kg • ${finalTotalPoints.toLocaleString()} NP.`,
        bankName: partnerName || 'Bank Sampah',
        items: finalItems,
        totalWeight: finalTotalWeight,
        totalPoints: finalTotalPoints
      });
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'partner_transaction_submit_failed',
        message: e?.message || 'Gagal mengirim setoran partner',
        context: 'partner_transaction_submit',
        functionName: 'submit',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { category, weight: finalTotalWeight, points: finalTotalPoints, partnerUid, userToken: trimmedToken }
      });
      alert('Gagal: ' + e.message);
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-60 p-6">
        <div className="bg-white rounded-[40px] p-8 max-w-md w-full text-center">
          <Check size={48} className="text-emerald-600 mx-auto mb-4" />
          <h3 className="font-black text-2xl mb-2">{successInfo.title}</h3>
          <p className="mb-4">{successInfo.message}</p>
          {successInfo.items && successInfo.items.length > 0 && (
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-3 mb-4 text-left">
              {successInfo.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs py-1">
                  <span>{item.name || item.category}: {item.weight} kg</span>
                  <span className="text-emerald-600 font-bold">+{item.points} NP</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 font-bold">Total: {successInfo.totalWeight} kg • {successInfo.totalPoints?.toLocaleString()} NP</div>
            </div>
          )}
          <button onClick={() => onDone ? onDone() : onClose()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold">Selesai</button>
        </div>
      </div>
    );
  }

  if (partnerStatus === 'suspended') {
    return (
      <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-60 p-6">
        <div className="bg-white rounded-[40px] p-8 w-full max-w-md max-h-[90vh] flex flex-col text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="font-black text-xl mb-2 text-stone-900">Akun Disuspend</h3>
          <p className="text-stone-500 text-sm mb-6 leading-relaxed">
            Akun partner Anda sedang disuspend oleh admin. Anda tidak dapat mencatat setoran sampah baru.
          </p>
          <button onClick={onClose} className="w-full py-4 bg-stone-100 text-stone-700 rounded-2xl font-bold hover:bg-stone-200 transition-all">
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal Scanner QR Terpisah & Diperbesar */}
      {showScanner && (
        <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-lg shadow-2xl flex flex-col border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <QrCode size={22} />
                </div>
                <div>
                  <h4 className="font-black text-lg text-stone-900">Pindai QR Nasabah</h4>
                  <p className="text-xs text-stone-500">Arahkan kamera ke QR Code milik pengguna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm transition-colors"
                title="Tutup Scanner"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full rounded-2xl overflow-hidden bg-stone-950 p-2 min-h-[300px] flex flex-col items-center justify-center shadow-inner">
              <div id="reader" className="w-full text-stone-100" />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-stone-500">💡 Scanner akan otomatis membaca kode dan mengisi token</span>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition-colors"
              >
                Tutup Kamera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Setoran Sampah Utama */}
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-60 p-4 md:p-6">
        <div className="bg-white rounded-[36px] p-6 md:p-8 w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-black text-xl text-stone-900">Input Setoran Sampah</h3>
              <p className="text-stone-400 text-xs">Catat transaksi setoran sampah dan verifikasi nasabah</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Input Token & Pindai QR */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-stone-600">
                  Identitas Nasabah (QR Token)
                </label>
                {userToken && (
                  <button
                    type="button"
                    onClick={() => { setUserToken(''); setScannedUser(null); }}
                    className="text-[10px] font-bold text-stone-400 hover:text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  placeholder="Scan QR atau ketik token user..."
                  className="flex-1 p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={userToken}
                  onChange={e => setUserToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <QrCode size={16} />
                  <span>Pindai QR</span>
                </button>
              </div>

              {loadingUser && (
                <div className="mt-2.5 p-2.5 bg-white border border-stone-200 rounded-xl flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 size={14} className="animate-spin text-emerald-600" />
                  <span>Memverifikasi akun nasabah...</span>
                </div>
              )}

              {!loadingUser && scannedUser && (
                <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {(scannedUser.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-stone-900 truncate flex items-center gap-1">
                        <span>{scannedUser.displayName || 'Nasabah'}</span>
                        <span className="text-[9px] bg-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Terdaftar</span>
                      </p>
                      <p className="text-[10px] text-stone-500 truncate">{scannedUser.email || scannedUser.qrToken}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] uppercase font-bold text-stone-400 block">Saldo NP</span>
                    <span className="font-black text-xs text-emerald-700">{Number(scannedUser.points || 0).toLocaleString()} NP</span>
                  </div>
                </div>
              )}

              {!loadingUser && !scannedUser && userToken.trim().length > 0 && (
                <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Token manual dimasukkan (belum terhubung ke akun terdaftar).</span>
                </div>
              )}
            </div>

            {/* List Item Setoran */}
            {itemsList.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-stone-500">Daftar Sampah Ditambahkan</div>
                {itemsList.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <div>
                      <p className="font-bold text-sm text-stone-800">{item.categoryName} • {item.weight} kg</p>
                      <p className="text-[10px] text-emerald-600 font-bold">+{item.points.toLocaleString()} NP</p>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-1 font-bold text-xs">✕</button>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold border-t border-stone-200 pt-2 px-1">
                  <span>Total Setoran: {totalWeight.toFixed(1)} kg</span>
                  <span className="text-emerald-600 font-black">{totalPoints.toLocaleString()} NP</span>
                </div>
              </div>
            )}

            {/* Form Input Sampah */}
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-100">
              <div>
                <label className="text-[10px] font-black uppercase mb-1 block text-stone-600">Kategori Sampah</label>
                <select
                  className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {WASTE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.pointsPerKg.toLocaleString()} Pts/kg)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase mb-1 block text-stone-600">Berat (kg)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={weight}
                  onChange={e => setWeight(parseFloat(e.target.value) || 0)}
                />
              </div>

              <button
                type="button"
                onClick={addItem}
                disabled={weight <= 0}
                className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-bold text-xs disabled:opacity-50 transition-colors"
              >
                + Tambah ke Daftar Setoran
              </button>
            </div>

            {/* Bukti Foto */}
            <div>
              <label className="text-[10px] font-black uppercase mb-1.5 block text-stone-600">Bukti Foto Sampah</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-200 hover:border-emerald-500 rounded-2xl p-3.5 flex flex-col items-center justify-center transition-colors"
                >
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                  <CameraIcon size={20} className="text-stone-500 mb-1" />
                  <p className="text-[11px] font-bold text-stone-700">Ambil Foto</p>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-200 hover:border-emerald-500 rounded-2xl p-3.5 flex flex-col items-center justify-center transition-colors"
                >
                  <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                  <FileImage size={20} className="text-stone-500 mb-1" />
                  <p className="text-[11px] font-bold text-stone-700">Pilih Galeri</p>
                </button>
              </div>
              {photo && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center justify-between">
                  <span className="truncate">📷 {photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} className="text-stone-400 hover:text-red-500 font-bold ml-2">✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex gap-3 mt-4 pt-3 border-t border-stone-100">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition-all shadow-md shadow-emerald-600/20"
            >
              {submitting ? 'Menyimpan...' : 'Kirim Setoran'}
            </button>
            <button
              onClick={onClose}
              disabled={submitting}
              className="py-3.5 px-6 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl font-bold text-sm transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PartnerTransactionSubmit;