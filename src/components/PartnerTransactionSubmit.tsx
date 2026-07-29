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

import { Loader2, Camera as CameraIcon, AlertTriangle, Check, Wifi, WifiOff, FileImage, Zap } from 'lucide-react';
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
  const [demoUsers, setDemoUsers] = useState<any[]>([]);
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
    getDocs(collection(db, 'users')).then(snap => setDemoUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((u: any) => u.qrToken))).catch(() => {});
  }, []);

  useEffect(() => {
    const trimmedToken = userToken.trim().replace(/^user:/i, '');
    if (!trimmedToken) { setScannedUser(null); return; }
    const timer = setTimeout(() => {
      getDocs(query(collection(db, 'users'), where('qrToken', '==', trimmedToken))).then(snap => {
        if (!snap.empty) setScannedUser({ uid: snap.docs[0].id, ...snap.docs[0].data() });
        else setScannedUser(null);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [userToken]);

  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5QrcodeScanner("reader", { qrbox: { width: 250, height: 250 }, fps: 5 }, false);
    scanner.render(
      (text) => { scanner.clear(); setUserToken(text.trim().replace(/^user:/i, '')); setShowScanner(false); },
      (errorMessage) => { console.warn('QR Scanner error:', errorMessage); }
    );
    return () => { scanner.clear().catch(() => {}); };
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

      const [resolvedUser, partnerData, photoUrl] = await Promise.all([userPromise, partnerPromise, compressImage(photo).then(f => uploadToImgBB(f))]);

      const partnerInstitutionId = partnerData?.institutionId || null;

      const existingTxSnap = await getDocs(query(
        collection(db, 'transactions'),
        where('partnerUid', '==', partnerUid || 'unverified'),
        where('userToken', '==', trimmedToken),
        where('status', '==', txStatus)
      ));

      let txId: string;

      if (!existingTxSnap.empty) {
        txId = existingTxSnap.docs[0].id;
        await updateDoc(doc(db, 'transactions', txId), {
          status: txStatus,
          updatedAt: new Date().toISOString(),
          institutionId: partnerInstitutionId || null,
          partnerId: partnerUid || null,
        });
      } else {
        txId = doc(collection(db, 'transactions')).id;
        const txDocRef = doc(db, 'transactions', txId);
        await setDoc(txDocRef, {
          partnerUid: partnerUid || 'unverified',
          partnerId: partnerUid || null,
partnerName: partnerName || (isUnapproved ? 'Bank Sampah Belum Terdaftar' : 'Bank Sampah'),
          userUid: resolvedUser.uid, userToken: trimmedToken,
          category: category, weight: finalTotalWeight, items: finalItems,
          totalWeight: finalTotalWeight, totalPoints: finalTotalPoints, photoUrl,
          status: txStatus, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          institutionId: partnerInstitutionId
        });
      }

      if (isUnapproved) {
        await setDoc(doc(db, 'adminReviews', txId), { txId, reason: 'Partner belum terdaftar', status: 'pending', createdAt: new Date().toISOString() });
      }

      setSuccessInfo({
        title: isUnapproved ? 'Menunggu Review Admin' : 'Setoran Dicatat',
        message: isUnapproved
          ? 'Bank sampah belum terdaftar. Setoran menunggu verifikasi admin.'
          : `Setoran berhasil diajukan. Total: ${finalTotalWeight} kg • ${finalTotalPoints.toLocaleString()} NP.`,
        bankName: partnerName || 'Bank Sampah',
        items: finalItems, totalWeight: finalTotalWeight, totalPoints: finalTotalPoints
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
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-60 p-6">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-md max-h-[90vh] flex flex-col">
        <h3 className="font-black text-xl mb-1">Input Setoran Sampah</h3>
        <p className="text-stone-400 text-xs mb-4">Catat transaksi setoran sampah user</p>
        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase mb-1 block">Token User (QR)</label>
            <div className="flex gap-2">
              <input placeholder="Token QR user" className="flex-1 p-3 border rounded-xl" value={userToken} onChange={e => setUserToken(e.target.value)} />
              <button onClick={() => setShowScanner(!showScanner)} className="px-3 bg-stone-900 text-white rounded-xl text-xs">{showScanner ? 'Tutup' : 'Pindai QR'}</button>
            </div>
          </div>
          {showScanner && (
            <div className="border rounded-2xl p-3 bg-stone-50">
              <p className="text-[10px] uppercase text-center mb-2">Scanner QR</p>
              <div id="reader" className="bg-white rounded-xl min-h-[200px] flex items-center justify-center mb-2"><p className="text-stone-400 text-xs">Membuka kamera...</p></div>
              <p className="text-[9px] uppercase mb-1">Simulasi (Pilih User):</p>
              <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">{demoUsers.map(u => (<button key={u.id} onClick={() => setUserToken(u.qrToken)} className="px-2 py-1 bg-emerald-50 border rounded-lg text-[10px]">{u.displayName?.split(' ')[0]}</button>))}</div>
            </div>
          )}
          {itemsList.length > 0 && (
            <div className="space-y-2">
              {itemsList.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-emerald-50 p-2 rounded-xl border">
                  <div><p className="font-bold text-sm">{item.categoryName} • {item.weight} kg</p><p className="text-[10px] text-emerald-600">+{item.points} NP</p></div>
                  <button onClick={() => removeItem(idx)} className="text-red-500 text-xs">✕</button>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold border-t pt-2"><span>Total: {totalWeight} kg</span><span className="text-emerald-600">{totalPoints} NP</span></div>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase mb-1 block">Kategori Sampah</label>
              <select className="w-full p-3 border rounded-xl" value={category} onChange={e => setCategory(e.target.value)}>
                {WASTE_CATEGORIES.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.pointsPerKg} Pts/kg)</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase mb-1 block">Berat (kg)</label>
              <input type="number" min={0.1} step={0.1} className="w-full p-3 border rounded-xl" value={weight} onChange={e => setWeight(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <button onClick={addItem} disabled={weight <= 0} className="w-full py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">+ Tambah Setoran</button>
          <div>
            <label className="text-[10px] font-black uppercase mb-1 block">Bukti Foto</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => cameraInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-4"><input ref={cameraInputRef} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} /><CameraIcon size={20} className="mx-auto mb-1" /><p className="text-[10px]">Kamera</p></button>
              <button onClick={() => galleryInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-4"><input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} /><FileImage size={20} className="mx-auto mb-1" /><p className="text-[10px]">Galeri</p></button>
            </div>
            {photo && <div className="mt-1 text-xs text-emerald-600">✅ {photo.name}</div>}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">{submitting ? 'Menyimpan...' : 'Kirim'}</button>
          <button onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold">Batal</button>
        </div>
      </div>
    </div>
  );
};

export default PartnerTransactionSubmit;