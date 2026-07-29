import React, { useEffect, useState } from 'react';

import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizePhotoUrl } from '../lib/photoUrl';
import PartnerTransactionSubmit from './PartnerTransactionSubmit';

const uploadToImgBB = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('image', blob);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  if (!json.success || !json.data?.url) throw new Error('ImgBB upload gagal');
  return normalizePhotoUrl(json.data.url);
};
import { WifiOff, RefreshCw, Loader2, Award, Clock, ShieldAlert, Check, AlertTriangle, X, Plus } from 'lucide-react';

const WASTE_CATEGORIES = [
  { id: 'plastik', name: 'Plastik', pointsPerKg: 1000 },
  { id: 'kertas', name: 'Kertas', pointsPerKg: 800 },
  { id: 'logam', name: 'Logam', pointsPerKg: 1500 },
  { id: 'kaca', name: 'Kaca', pointsPerKg: 1200 },
  { id: 'kardus', name: 'Kardus', pointsPerKg: 900 },
  { id: 'residu', name: 'Residu', pointsPerKg: 500 },
];

type WasteItem = { category: string; name?: string; weight: number; points: number };

const buildDepositSummary = (tx: any) => {
  const categoryData = WASTE_CATEGORIES.find(c => c.id === tx.category);
  const items: WasteItem[] = tx.items
    ? (tx.items as WasteItem[]).map((item) => ({
        category: item.category || item.name || tx.category || 'campuran',
        name: item.name,
        weight: Number(item.weight) || 0,
        points: Number(item.points) || 0,
      }))
    : [{
        category: categoryData?.name || tx.category || 'campuran',
        weight: Number(tx.weight) || 0,
        points: (Number(tx.weight) || 0) * (categoryData?.pointsPerKg || 1000),
      }];

  const totalWeight = Number(tx.totalWeight || tx.weight) || items.reduce((sum, item) => sum + item.weight, 0);
  const totalPoints = Number(tx.totalPoints) || items.reduce((sum, item) => sum + item.points, 0);

  return { items, totalWeight, totalPoints };
};

const PartnerDashboard = ({ uid, partnerId, onClose }: { uid?: string; partnerId?: string; onClose: () => void }) => {
  const [partner, setPartner] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [offlineTxsList, setOfflineTxsList] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [approveSuccessInfo, setApproveSuccessInfo] = useState<{
    partnerName: string;
    userName: string;
    items: { category: string; name?: string; weight: number; points: number }[];
    totalWeight: number;
    totalPoints: number;
  } | null>(null);
  const [approvingTxId, setApprovingTxId] = useState<string | null>(null);
  const [showAddTx, setShowAddTx] = useState(false);

  useEffect(() => {
    if (!partnerId && !uid) return;
    const q = partnerId
      ? query(collection(db, 'partners'), where('__name__', '==', partnerId))
      : query(collection(db, 'partners'), where('ownerUid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartner(docs[0] || null);
    });
    return () => unsub();
  }, [uid, partnerId]);

  useEffect(() => {
    if (!partnerId) return;
    const q = query(collection(db, 'transactions'), where('partnerUid', '==', partnerId));
    const unsub = onSnapshot(q, (snap) => {
      const allTxs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTxs(allTxs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
  }, [partnerId]);

  // Load offline transactions on mount
  useEffect(() => {
    const offlineTxs = localStorage.getItem('pending_offline_txs');
    if (offlineTxs) {
      setOfflineTxsList(JSON.parse(offlineTxs));
    }
  }, []);

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const syncOfflineTransactions = async () => {
    if (syncing || offlineTxsList.length === 0) return;
    setSyncing(true);
    let successCount = 0;
    const list = [...offlineTxsList];
    const remainingList = [...offlineTxsList];

    try {
      for (let i = 0; i < list.length; i++) {
        const tx = list[i];
        try {
          let finalPhotoUrl = '';
          if (tx.photoBase64) {
            const blob = dataURLtoBlob(tx.photoBase64);
            finalPhotoUrl = await uploadToImgBB(blob);
          }

          // Query user UID by QR token
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('qrToken', '==', tx.userToken));
          const querySnap = await getDocs(q);

          let userUid = '';
          let uData: any = null;
          if (!querySnap.empty) {
            userUid = querySnap.docs[0].id;
            uData = querySnap.docs[0].data();
          }

          // Save to Firestore
          const txRef = doc(db, 'transactions', tx.id);
          const txData: any = {
            partnerUid: uid || null,
            partnerName: tx.partnerName || partner?.name || 'Bank Sampah Partner',
            partnerId: partner?.id || null,
            institutionId: partner?.institutionId || null,
            userUid,
            userToken: tx.userToken,
            category: tx.category || 'campuran',
            weight: tx.weight || 0,
            items: tx.items || [],
            totalWeight: tx.totalWeight || tx.weight || 0,
            totalPoints: tx.totalPoints || 0,
            photoUrl: finalPhotoUrl || '',
            status: tx.status === 'pending_offline' ? 'pending' : tx.status || 'pending',
            anomalyReason: tx.anomalyReason || '',
            createdAt: tx.createdAt || new Date().toISOString()
          };
          if (tx.items) {
            txData.items = tx.items;
            txData.totalWeight = tx.totalWeight || tx.weight || 0;
          }
          await setDoc(txRef, txData);

          // If approved, credit points directly
          if (tx.status === 'approved' && userUid && uData) {
            let totalPoints = 0;
            let depositItems = [];
            let finalWeight = tx.weight || 0;

            if (tx.items) {
              depositItems = tx.items;
              totalPoints = tx.items.reduce((acc: number, item: any) => acc + item.points, 0);
              finalWeight = tx.totalWeight || tx.weight || 0;
            } else {
              const categoryData = WASTE_CATEGORIES.find(c => c.id === tx.category);
              const pointsPerKg = categoryData ? categoryData.pointsPerKg : 1000;
              totalPoints = (tx.weight || 0) * pointsPerKg;
              depositItems = [{ category: categoryData?.name || tx.category || 'campuran', weight: tx.weight || 0, points: totalPoints }];
            }

            const newDeposit = {
              id: tx.id,
              date: new Date(tx.createdAt || Date.now()).toLocaleString('id-ID'),
              items: depositItems,
              totalPoints,
              totalWeight: finalWeight,
              status: 'Approved',
              image: finalPhotoUrl || '',
              location: partner?.name || 'Bank Sampah Partner',
              userEmail: uData.email || '',
              userUid
            };

            const updatedPoints = (uData.points || 0) + totalPoints;
            const updatedHistory = [newDeposit, ...(uData.depositHistory || []).filter((item: any) => item.id !== tx.id)];

            await updateDoc(doc(db, 'users', userUid), {
              points: updatedPoints,
              depositHistory: updatedHistory
            });
          } else if (tx.status === 'flagged' || tx.status === 'flagged_offline') {
            const reviewRef = doc(db, 'adminReviews', tx.id);
            await setDoc(reviewRef, {
              txId: tx.id,
              reason: tx.anomalyReason || 'Terdeteksi anomali (offline)',
              status: 'pending',
              createdAt: tx.createdAt || new Date().toISOString()
            });
          }

          successCount++;
          // Remove from local list
          const index = remainingList.findIndex(t => t.id === tx.id);
          if (index > -1) remainingList.splice(index, 1);
        } catch (err) {
          console.error(`Gagal sinkronisasi transaksi ID ${tx.id}:`, err);
        }
      }

      localStorage.setItem('pending_offline_txs', JSON.stringify(remainingList));
      setOfflineTxsList(remainingList);
      alert(`Sinkronisasi selesai! ${successCount} dari ${list.length} transaksi offline berhasil diunggah.`);
    } catch (e: any) {
      console.error(e);
      alert('Gagal menyinkronkan transaksi: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirm = async (tx: any) => {
    if (approvingTxId) return;
    setApprovingTxId(tx.id);
    try {
      const summary = buildDepositSummary(tx);
      const depositItems = summary.items;
      const totalWeight = summary.totalWeight;
      const totalPoints = Number(summary.totalPoints) || 0;

      // Credit points to user by QR token
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('qrToken', '==', tx.userToken));
      const querySnap = await getDocs(q);
      let userUid = '';
      let uData: any = null;
      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        userUid = userDoc.id;
        uData = userDoc.data();
      } else if (tx.userUid) {
        const userDoc = await getDoc(doc(db, 'users', tx.userUid));
        if (userDoc.exists()) {
          userUid = userDoc.id;
          uData = userDoc.data();
        }
      }

      const userName = uData?.displayName || tx.userName || 'User';

      // Mark transaction approved
      const txRef = doc(db, 'transactions', tx.id);
      const updateData: any = { 
        status: 'approved', 
        approvedAt: new Date().toISOString(), 
        userUid: userUid || tx.userUid || '',
        partnerId: partner?.id || tx.partnerId || '',
        partnerName: partner?.name || tx.partnerName || '',
        institutionId: partner?.institutionId || tx.institutionId || null,
        items: depositItems,
        totalWeight,
        totalPoints,
      };
      if (uid) updateData.approvedBy = uid;
      await updateDoc(txRef, updateData);

      if (tx.status === 'flagged' || tx.status === 'flagged_offline') {
        await setDoc(doc(db, 'adminReviews', tx.id), { status: 'approved', resolvedAt: new Date().toISOString() }, { merge: true });
      }

      if (userUid && uData) {
        const newDeposit = {
          id: tx.id,
          date: new Date(tx.createdAt || Date.now()).toLocaleString('id-ID'),
          items: depositItems,
          totalPoints,
          totalWeight,
          status: 'Approved',
          image: tx.photoUrl || '',
          location: partner?.name || 'Bank Sampah Partner',
          userEmail: uData.email || '',
          userUid
        };

        const updatedPoints = (uData.points || 0) + totalPoints;
        const updatedHistory = [newDeposit, ...(uData.depositHistory || []).filter((item: any) => item.id !== tx.id)];

        const notifs = [...(uData.notifications || [])];
        notifs.unshift({
          id: Math.random().toString(36).substr(2, 9),
          title: 'Selamat, Setoran Diterima!',
          message: `${userName}, pengajuan setoran Anda telah diterima oleh ${partner?.name || 'Bank Sampah'}: ${depositItems.map((i) => `${i.category} ${i.weight}kg`).join(', ')}. Total berat ${totalWeight} kg. Anda mendapatkan ${totalPoints.toLocaleString()} NeuroPoints.`,
          date: new Date().toLocaleString('id-ID'),
          type: 'success',
          isRead: false,
          depositId: tx.id,
          userName,
          depositItems,
          totalWeight,
          totalPoints
        });

        await updateDoc(doc(db, 'users', userUid), {
          points: updatedPoints,
          depositHistory: updatedHistory,
          notifications: notifs
        });
      }

      setApproveSuccessInfo({
        partnerName: partner?.name || 'Bank Sampah',
        userName,
        items: depositItems,
        totalWeight,
        totalPoints,
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui transaksi: ' + (err as any).message);
    } finally {
      setApprovingTxId(null);
    }
  };

  const handleReject = async (tx: any) => {
    try {
      const txRef = doc(db, 'transactions', tx.id);
      const updateData: any = { status: 'rejected', rejectedAt: new Date().toISOString() };
      if (uid) updateData.rejectedBy = uid;
      await updateDoc(txRef, updateData);

      // notify user if available
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('qrToken', '==', tx.userToken));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const userUid = userDoc.id;
        const uData = userDoc.data();
        const categoryData = WASTE_CATEGORIES.find(c => c.id === tx.category);
        const depositItems = tx.items || [{ category: categoryData?.name || tx.category || 'campuran', weight: tx.weight || 0, points: 0 }];
        const finalWeight = tx.totalWeight || tx.weight || depositItems.reduce((sum: number, item: any) => sum + (Number(item.weight) || 0), 0);
        const rejectedDeposit = {
          id: tx.id,
          date: new Date(tx.createdAt || Date.now()).toLocaleString('id-ID'),
          items: depositItems.map((item: any) => ({ ...item, points: 0 })),
          totalPoints: 0,
          totalWeight: finalWeight,
          status: 'Rejected',
          image: tx.photoUrl || '',
          location: partner?.name || 'Bank Sampah Partner',
          userEmail: uData.email || '',
          userUid
        };
        const notifs = [...(uData.notifications || [])];
        notifs.unshift({
          id: Math.random().toString(36).substr(2, 9),
          title: 'Setoran Ditolak',
          message: `Setoran Anda sebesar ${tx.weight}kg (${tx.category}) tidak dapat diproses oleh ${partner?.name || 'Bank Sampah'}. Silakan hubungi petugas.`,
          date: new Date().toLocaleString('id-ID'),
          type: 'warning',
          isRead: false
        });
        await updateDoc(doc(db, 'users', userUid), {
          depositHistory: [rejectedDeposit, ...(uData.depositHistory || []).filter((item: any) => item.id !== tx.id)],
          notifications: notifs
        });
      }

      alert('Transaksi ditolak. User diberitahu.');
    } catch (err) {
      console.error(err);
      alert('Gagal menolak transaksi: ' + (err as any).message);
    }
  };

  // Success modal after approving a deposit
  if (approveSuccessInfo) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6 animate-fade-in">
        <div className="bg-white rounded-[40px] p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />

          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5">
            <Check size={40} strokeWidth={3} />
          </div>

          <h3 className="font-display font-black text-2xl text-stone-900 mb-1">
            🎉 Selamat, Setoran Diterima!
          </h3>
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-5">
            {approveSuccessInfo.partnerName}
          </p>
          <p className="text-sm font-bold text-stone-800 mb-5">User: {approveSuccessInfo.userName}</p>

          {/* Deposit detail card */}
          <div className="bg-stone-50 border border-stone-100 rounded-3xl p-4 mb-6 text-left space-y-2">
            {approveSuccessInfo.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-stone-800 capitalize">{item.category || item.name}</p>
                  <p className="text-[10px] text-stone-400 font-medium">{item.weight} kg</p>
                </div>
                <span className="text-sm font-black text-amber-600">+{(item.points || 0).toLocaleString()} NP</span>
              </div>
            ))}
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
              <span className="text-xs font-black text-stone-500 uppercase tracking-wide">Total Berat</span>
              <span className="text-sm font-black text-stone-800">{approveSuccessInfo.totalWeight} kg</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-stone-500 uppercase tracking-wide">Total NeuroPoints</span>
              <span className="text-lg font-black text-emerald-600">{approveSuccessInfo.totalPoints.toLocaleString()} NP</span>
            </div>
          </div>

          <button
            onClick={() => {
              setApproveSuccessInfo(null);
            }}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-base hover:brightness-105 transition-all active:scale-95 shadow-lg shadow-emerald-100"
          >
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6 animate-fade-in">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-500 to-teal-500" />

        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h3 className="font-display font-black text-2xl text-stone-900">Dashboard Partner</h3>
            <p className="text-stone-400 text-xs mt-1">Status Operasional & Riwayat Transaksi</p>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-50 rounded-xl text-stone-400 hover:text-stone-600">Tutup</button>
        </div>

        {!partner ? (
          <div className="flex-1 flex items-center justify-center py-20 shrink-0">
            <div className="text-center max-w-sm">
              <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={40} />
              <p className="text-stone-500 font-bold text-sm leading-relaxed">
                Belum ada data partner terdaftar untuk akun ini. Jika sudah mendaftar, mohon tunggu verifikasi admin.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-6">
            {/* STATUS ALERTS - PROMINENT */}
            {!dismissedAlert && partner?.status === 'suspended' && (
              <div className="p-5 bg-gradient-to-r from-red-50 to-red-50/50 border-l-4 border-red-600 rounded-2xl flex items-start gap-4 shadow-md shadow-red-100/50 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12" />
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0 relative z-10">
                  <AlertTriangle size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1 relative z-10">
                  <h4 className="font-black text-red-800 text-base mb-1">🚨 Akun Partner DISUSPEND</h4>
                  <p className="text-red-700 text-sm leading-relaxed mb-3">
                    Status operasional Anda telah dihentikan sementara oleh admin. Anda tidak dapat menerima setoran sampah dari user sampai status diaktifkan kembali.
                  </p>
                  <p className="text-xs text-red-600 font-medium">
                    📞 Hubungi admin untuk informasi lebih lanjut atau untuk mengajukan banding.
                  </p>
                </div>
                <button
                  onClick={() => setDismissedAlert(true)}
                  className="shrink-0 text-red-400 hover:text-red-600 transition-colors p-1 relative z-10"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {!dismissedAlert && partner?.status === 'rejected' && (
              <div className="p-5 bg-gradient-to-r from-orange-50 to-orange-50/50 border-l-4 border-orange-600 rounded-2xl flex items-start gap-4 shadow-md shadow-orange-100/50 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12" />
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0 relative z-10">
                  <X size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1 relative z-10">
                  <h4 className="font-black text-orange-800 text-base mb-1">❌ Pendaftaran Partner Ditolak</h4>
                  <p className="text-orange-700 text-sm leading-relaxed mb-3">
                    Aplikasi pendaftaran Anda sebagai partner bank sampah telah ditolak oleh admin. 
                  </p>
                  <p className="text-xs text-orange-600 font-medium">
                    📧 Silakan hubungi admin untuk mengetahui alasan penolakan dan kemungkinan mendaftar ulang.
                  </p>
                </div>
                <button
                  onClick={() => setDismissedAlert(true)}
                  className="shrink-0 text-orange-400 hover:text-orange-600 transition-colors p-1 relative z-10"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {!dismissedAlert && partner?.status === 'pending' && (
              <div className="p-5 bg-gradient-to-r from-amber-50 to-amber-50/50 border-l-4 border-amber-600 rounded-2xl flex items-start gap-4 shadow-md shadow-amber-100/50 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12" />
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0 relative z-10">
                  <Clock size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1 relative z-10">
                  <h4 className="font-black text-amber-800 text-base mb-1">⏳ Menunggu Verifikasi Admin</h4>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    Aplikasi partner Anda sedang diproses oleh admin. Anda akan menerima notifikasi ketika status berubah. Terimakasih atas kesabaran Anda!
                  </p>
                </div>
                <button
                  onClick={() => setDismissedAlert(true)}
                  className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors p-1 relative z-10"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
            {/* Partner Info Card */}
            <div className="p-6 border border-stone-100 rounded-3xl bg-stone-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="text-lg font-black text-stone-800">{partner.name}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${
                    partner.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-100/50' :
                    partner.status === 'suspended' ? 'bg-red-100 text-red-700 border-red-200 shadow-red-100/50' :
                    partner.status === 'rejected' ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-orange-100/50' :
                    'bg-amber-100 text-amber-700 border-amber-200 shadow-amber-100/50'
                  }`}>
                    Status: {partner.status === 'approved' ? '✅ Aktif' : 
                             partner.status === 'suspended' ? '🔴 Disuspend' : 
                             partner.status === 'rejected' ? '❌ Ditolak' : 
                             '⏳ Menunggu'}
                  </span>
                  {partner.institutionId && (
                    <span className="text-[10px] text-stone-400 font-medium bg-white px-3 py-1.5 rounded-full border border-stone-200">
                      🏢 Institusi
                    </span>
                  )}
                  {!partner.institutionId && partner.status === 'approved' && (
                    <span className="text-[10px] text-red-500 font-black uppercase tracking-widest bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                      ⚠️ Belum Terasosiasi Institusi
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 font-medium">{partner.email}</span>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Bergabung Pada</p>
                <p className="text-sm font-bold text-stone-700 mt-1">
                  {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </p>
              </div>
            </div>

            {partner?.status === 'approved' && (
              <div className="mt-4">
                <button
                  onClick={() => setShowAddTx(true)}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Tambah Setoran
                </button>
              </div>
            )}

            {/* Offline Transactions Sync Bar */}
            {offlineTxsList.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center">
                    <WifiOff size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-800">{offlineTxsList.length} Transaksi Offline Pending</p>
                    <p className="text-xs text-amber-600 font-medium">Hubungkan ke internet untuk mengunggah.</p>
                  </div>
                </div>
                <button
                  onClick={syncOfflineTransactions}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all flex items-center gap-2 shadow-md shadow-amber-200/50"
                >
                  {syncing ? (
                    <><Loader2 className="animate-spin" size={14} /> Menyinkron...</>
                  ) : (
                    <><RefreshCw size={14} /> Sinkronisasi</>
                  )}
                </button>
              </div>
            )}

            {/* Transactions History */}
            <div>
              <h4 className="font-display font-black text-sm text-stone-400 uppercase tracking-widest mb-4">Riwayat Setoran Masuk</h4>
              
              {/* Combine online and offline lists for preview */}
              {txs.length === 0 && offlineTxsList.length === 0 ? (
                <div className="p-10 bg-stone-50 border border-stone-100 rounded-3xl text-center italic text-sm text-stone-400">
                  Belum ada transaksi setoran yang masuk.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Offline transactions (marked) */}
                  {offlineTxsList.map(tx => {
                    const isFlaggedOffline = tx.status === 'flagged_offline';
                    return (
                      <div key={tx.id} className={`p-4 border ${isFlaggedOffline ? 'border-red-100 bg-red-50/20' : 'border-amber-100 bg-amber-50/20'} rounded-3xl flex justify-between items-center relative overflow-hidden`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFlaggedOffline ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                            <WifiOff size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-stone-800 text-sm capitalize">{tx.category} · {tx.weight} kg</p>
                            {tx.userName && <p className="text-[9px] text-stone-400 mt-0.5">User: {tx.userName}</p>}
                            <p className={`text-[10px] ${isFlaggedOffline ? 'text-red-600' : 'text-amber-600'} font-bold uppercase tracking-wider mt-0.5`}>{isFlaggedOffline ? 'Flagged Offline' : 'Menunggu Koneksi'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-stone-400">Token: {tx.userToken}</p>
                          <p className="text-[9px] text-stone-400 mt-1">{new Date(tx.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })}

{/* Online transactions */}
                   {txs.map(tx => {
                     const isFlagged = tx.status === 'flagged' || tx.status === 'flagged_offline';
                     const isApproved = tx.status === 'approved';
                     const isRejected = tx.status === 'rejected';
                     const canConfirm = tx.status === 'pending' || isFlagged;

                     return (
                       <div key={tx.id} className="p-4 border border-stone-100 hover:border-stone-200 transition-colors bg-white rounded-3xl flex justify-between items-center">
                         <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                             isApproved ? 'bg-emerald-50 text-emerald-600' :
                             isFlagged ? 'bg-red-50 text-red-600' :
                             'bg-stone-50 text-stone-600'
                           }`}>
                             {isApproved ? <Award size={18} /> : isFlagged ? <ShieldAlert size={18} /> : <Clock size={18} />}
                           </div>
                           <div>
                             {tx.items && tx.items.length > 1 ? (
                               <div>
                                 <p className="font-bold text-stone-800 text-sm capitalize">{tx.category || 'Campuran'}</p>
                                 <p className="text-[10px] text-stone-400 mt-0.5">
                                   {tx.items.map((i: any) => `${i.category || i.name}: ${i.weight}kg`).join(' · ')}
                                 </p>
                               </div>
                             ) : (
                               <p className="font-bold text-stone-800 text-sm capitalize">{tx.category} · {tx.weight} kg</p>
                             )}
                             {tx.userName && <p className="text-[9px] text-stone-400 mt-0.5">User: {tx.userName}</p>}
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border mt-1 ${
                              isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              isFlagged ? 'bg-red-50 text-red-700 border-red-100' :
                              'bg-stone-50 text-stone-600 border-stone-100'
                            }`}>
                              {isApproved ? 'approved' : isFlagged ? 'flagged' : tx.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-stone-400">Token: {tx.userToken}</p>
                          <p className="text-[9px] text-stone-400 mt-1">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </p>
                          {canConfirm && (
                            <div className="mt-3 flex gap-2 justify-end">
                              <button
                                onClick={() => handleConfirm(tx)}
                                disabled={approvingTxId === tx.id}
                                className="px-3 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-bold disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                {approvingTxId === tx.id ? <><Loader2 className="animate-spin" size={12} /> Menyimpan</> : 'Konfirmasi'}
                              </button>
                              <button onClick={() => handleReject(tx)} className="px-3 py-2 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">Tolak</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddTx && (
        <PartnerTransactionSubmit
          partnerUid={partnerId}
          onClose={() => setShowAddTx(false)}
          onDone={() => setShowAddTx(false)}
        />
      )}
    </div>
  );
};

export default PartnerDashboard;
