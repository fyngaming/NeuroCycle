import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizePhotoUrl } from '../lib/photoUrl';
import { logError } from '../lib/errorLogger';

const uploadToImgBB = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  if (!json.success || !json.data?.url) throw new Error('ImgBB upload gagal');
  return normalizePhotoUrl(json.data.url);
};
import { Loader2, FileImage, CheckCircle2 } from 'lucide-react';

const WASTE_CATEGORIES = [
  { id: 'plastik', name: 'Plastik', pointsPerKg: 1000 },
  { id: 'kertas', name: 'Kertas', pointsPerKg: 800 },
  { id: 'logam', name: 'Logam', pointsPerKg: 1500 },
  { id: 'kaca', name: 'Kaca', pointsPerKg: 1200 },
  { id: 'kardus', name: 'Kardus', pointsPerKg: 900 },
  { id: 'residu', name: 'Residu', pointsPerKg: 500 },
];

const UserDepositSubmit = ({ onClose, currentUserQr, userUid, userData }: { onClose: () => void; currentUserQr?: string; userUid?: string; userData?: any }) => {
  const [category, setCategory] = useState('plastik');
  const [partnerList, setPartnerList] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [manualName, setManualName] = useState('');
  const [weight, setWeight] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const loadPartners = async () => {
      try {
        const q = query(collection(db, 'partners'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        setPartnerList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    loadPartners();
  }, []);

  const submit = async () => {
    if (!currentUserQr) return alert('QR user tidak tersedia. Buka halaman My QR terlebih dahulu.');
    if (!photo) return alert('Mohon unggah foto verifikasi.');
    if (weight <= 0) return alert('Berat harus > 0');

    setSubmitting(true);
    setSuccessInfo(null);
    const txCol = collection(db, 'transactions');
    const newDocRef = doc(txCol);
    const txId = newDocRef.id;

    try {
      // Upload photo ke ImgBB
      const photoUrl = await uploadToImgBB(photo);

      const categoryData = WASTE_CATEGORIES.find(c => c.id === category);
      const pointsPerKg = categoryData ? categoryData.pointsPerKg : 1000;
      const totalPoints = weight * pointsPerKg;

      // Determine target user
      let targetUserUid = userUid;
      let targetUserData = userData;

      if (!targetUserUid) {
        const usersRef = collection(db, 'users');
        const qUser = query(usersRef, where('qrToken', '==', currentUserQr));
        const userSnap = await getDocs(qUser);
        if (!userSnap.empty) {
          targetUserUid = userSnap.docs[0].id;
          targetUserData = userSnap.docs[0].data();
        }
      }

      // If partner selected (registered) -> notify partner by creating tx with partnerUid = partner.ownerUid and status 'pending'
      if (selectedPartnerId) {
        const partnerDoc = partnerList.find(p => p.id === selectedPartnerId);
        const txData: any = {
          partnerUid: partnerDoc?.id || null,
          partnerId: selectedPartnerId,
          partnerName: partnerDoc?.name || '',
          institutionId: partnerDoc?.institutionId || null,
          userUid: targetUserUid || null,
          userToken: currentUserQr,
          userEmail: targetUserData?.email || '',
          category,
          weight,
          photoUrl,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        await setDoc(newDocRef, txData);

        // Prepend pending deposit log to user's depositHistory
        if (targetUserUid && targetUserData) {
          const newDeposit = {
            id: txId,
            date: new Date().toLocaleString('id-ID'),
            items: [{ category: categoryData?.name || category, weight, points: totalPoints }],
            totalPoints,
            totalWeight: weight,
            status: 'Pending',
            image: photoUrl,
            location: partnerDoc?.name || 'Bank Sampah Partner',
            userEmail: targetUserData.email || '',
            userUid: targetUserUid
          };
          const userRef = doc(db, 'users', targetUserUid);
          const updatedHistory = [newDeposit, ...(targetUserData.depositHistory || [])];
          await setDoc(userRef, { depositHistory: updatedHistory }, { merge: true });
        }

        setSuccessInfo({
          title: 'Pengajuan Berhasil Dikirim',
          message: `Permintaan setoran dikirim ke ${partnerDoc?.name || 'Bank Sampah Partner'}. Silakan datang dan tunjukkan QR kepada petugas.`
        });
      } else {
        // Manual input -> send to admin for review
        const txData: any = {
          partnerUid: null,
          partnerId: null,
          partnerNameManual: manualName || 'Belum diisi',
          userUid: targetUserUid || null,
          userToken: currentUserQr,
          userEmail: targetUserData?.email || '',
          category,
          weight,
          photoUrl,
          status: 'pending_admin',
          createdAt: new Date().toISOString()
        };
        await setDoc(newDocRef, txData);
        // create admin review doc
        const reviewRef = doc(db, 'adminReviews', txId);
        await setDoc(reviewRef, {
          txId,
          reason: 'User memilih bank sampah tidak terdaftar (manual)',
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        // Prepend pending deposit log to user's depositHistory
        if (targetUserUid && targetUserData) {
          const newDeposit = {
            id: txId,
            date: new Date().toLocaleString('id-ID'),
            items: [{ category: categoryData?.name || category, weight, points: totalPoints }],
            totalPoints,
            totalWeight: weight,
            status: 'Pending',
            image: photoUrl,
            location: manualName || 'Bank Sampah (Manual)',
            userEmail: targetUserData.email || '',
            userUid: targetUserUid
          };
          const userRef = doc(db, 'users', targetUserUid);
          const updatedHistory = [newDeposit, ...(targetUserData.depositHistory || [])];
          await setDoc(userRef, { depositHistory: updatedHistory }, { merge: true });
        }

        setSuccessInfo({
          title: 'Pengajuan Berhasil Dikirim',
          message: 'Pengajuan setoran dikirim ke Admin untuk ditinjau. Terima kasih.'
        });
      }
    } catch (e: any) {
      await logError({
        severity: 'ERROR',
        type: 'user_deposit_submit_failed',
        message: e?.message || 'Gagal mengirim pengajuan setoran',
        context: 'user_deposit_submit',
        functionName: 'submit',
        stack: e instanceof Error ? e.stack : undefined,
        metadata: { category, weight, photo: photo?.name }
      });
      alert('Gagal mengirim pengajuan: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6">
        <div className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="font-display font-black text-xl text-stone-900 mb-3">{successInfo.title}</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-8">{successInfo.message}</p>
          <button
            onClick={onClose}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95"
          >
            Kembali ke Halaman Utama
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-black text-lg">Ajukan Setoran Sampah</h3>
          <button onClick={onClose} className="text-stone-400">Tutup</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase">Kategori</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 rounded-2xl border">
              {WASTE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase">Pilih Bank Sampah (jika terdaftar)</label>
            <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} className="w-full p-3 rounded-2xl border mb-2">
              <option value="">-- Pilih atau isi manual --</option>
              {partnerList.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.address || ''}</option>
              ))}
            </select>
            {!selectedPartnerId && (
              <input placeholder="Nama Bank Sampah (manual)" value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full p-3 rounded-2xl border" />
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase">Berat (kg)</label>
            <input type="number" min={0.1} step={0.1} value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} className="w-full p-3 rounded-2xl border" />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase">Foto Verifikasi</label>
            <div className="relative border border-dashed rounded-2xl p-4 text-center bg-stone-50">
              <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <div className="flex flex-col items-center">
                <FileImage size={28} className="text-stone-400" />
                <p className="text-xs text-stone-500 mt-2">{photo ? photo.name : 'Klik untuk unggah foto bukti'}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold">
              {submitting ? <><Loader2 className="animate-spin" size={14} /> Mengirim...</> : 'Kirim Pengajuan'}
            </button>
            <button onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-2xl">Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDepositSubmit;
