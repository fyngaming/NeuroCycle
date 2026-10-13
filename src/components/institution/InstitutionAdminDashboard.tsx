import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Ban, Plus, X } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { normalizePhotoUrl } from '../../lib/photoUrl';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import type { NotificationItem } from '../../types';

interface InstitutionAdminDashboardProps {
  onLogout: () => void;
  adminUserId?: string | null;
}

export const InstitutionAdminDashboard: React.FC<InstitutionAdminDashboardProps> = ({ onLogout, adminUserId }) => {
  const [activeTab, setActiveTab] = useState<'partners' | 'pending_partners' | 'users' | 'transactions'>('partners');
  const [institution, setInstitution] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string>('');
  const [institutionNotFound, setInstitutionNotFound] = useState(false);
  const [showAddPartnerForm, setShowAddPartnerForm] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<{ image: string; user: string; title: string; date?: string } | null>(null);

  // ─── Pagination State (Aspek Skalabilitas) ──────────────────────────
  const [txPage, setTxPage] = useState(1);
  const txPerPage = 15;
  const [txSearch, setTxSearch] = useState('');

  const [usersPage, setUsersPage] = useState(1);
  const usersPerPage = 15;

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
  }, [adminUserId]);

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
        // Wajib memiliki foto bukti yang sah (bukan transaksi tanpa foto)
        const hasPhoto = tx.photoUrl && typeof tx.photoUrl === 'string' && tx.photoUrl.trim() !== '';
        if (!hasPhoto) return false;
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
      userTxCount.forEach((txs) => {
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

  // ─── Paginated Transactions ─────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    if (!txSearch.trim()) return transactions;
    const q = txSearch.toLowerCase();
    return transactions.filter(tx => 
      (tx.partnerName && tx.partnerName.toLowerCase().includes(q)) ||
      (tx.userEmail && tx.userEmail.toLowerCase().includes(q)) ||
      (tx.userName && tx.userName.toLowerCase().includes(q)) ||
      (tx.userToken && tx.userToken.toLowerCase().includes(q))
    );
  }, [transactions, txSearch]);

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPerPage;
    return filteredTransactions.slice(start, start + txPerPage);
  }, [filteredTransactions, txPage, txPerPage]);

  // ─── Paginated Users Table Rows ─────────────────────────────────────
  const allUserRows = useMemo(() => {
    const rows: any[] = [];
    transactions
      .filter((tx: any) => tx.photoUrl && typeof tx.photoUrl === 'string' && tx.photoUrl.trim() !== '')
      .forEach((tx: any) => {
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
  }, [transactions, users]);

  const totalUserRowPages = Math.max(1, Math.ceil(allUserRows.length / usersPerPage));
  const paginatedUserRows = useMemo(() => {
    const start = (usersPage - 1) * usersPerPage;
    return allUserRows.slice(start, start + usersPerPage);
  }, [allUserRows, usersPage, usersPerPage]);

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
        <button onClick={onLogout} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">Logout</button>
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
              {tab.id === 'pending_partners' && partners.filter((p: any) => p.status === 'pending' && p.institutionId === institutionId).length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {partners.filter((p: any) => p.status === 'pending' && p.institutionId === institutionId).length}
                </span>
              )}
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
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleInstitutionRejectPartner(p.id, p.email, p.name)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-all active:scale-95"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95"
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
                  {partners.map((p: any) => (
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
                  ))}
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
                  {paginatedUserRows.map((row: any) => (
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
            </div>
            {totalUserRowPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Halaman {usersPage} dari {totalUserRowPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={usersPage >= totalUserRowPages}
                    onClick={() => setUsersPage(p => Math.min(totalUserRowPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
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
            <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-black">Riwayat Transaksi Partner</h3>
                <p className="text-xs text-stone-500 mt-1">Detail setoran sampah per kategori dari partner institusi</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari transaksi..."
                  value={txSearch}
                  onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-400 w-full md:w-56"
                />
                <span className="text-xs font-black text-stone-400 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl whitespace-nowrap">
                  {filteredTransactions.length} transaksi
                </span>
              </div>
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
              {paginatedTransactions.map((tx: any) => {
                const partner = partners.find((p: any) => p.id === tx.partnerId || p.id === tx.partnerUid);
                const matchedUser = users.find((u: any) =>
                  (u.qrToken && (u.qrToken === tx.userToken || u.qrToken === tx.userUid)) ||
                  (u.uid && (u.uid === tx.userUid || u.uid === tx.userToken)) ||
                  (u.email && tx.userEmail && u.email.toLowerCase() === tx.userEmail.toLowerCase())
                );
                const userEmail = tx.userEmail || matchedUser?.email || '';
                const userName = tx.userName || tx.userDisplayName || matchedUser?.displayName || '';

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
                      <p className="text-xs font-bold text-stone-800 leading-tight break-all">
                        {userEmail || userName || (tx.userToken ? `Token: ${tx.userToken}` : '-')}
                      </p>
                      {userName && userEmail && userName !== userEmail && (
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">{userName}</p>
                      )}
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5 truncate max-w-[140px]">
                        {tx.userToken ? `Token: ${tx.userToken}` : ''}
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

            {filteredTransactions.length === 0 && (
              <div className="px-6 py-12 text-center text-stone-400 text-sm">
                Belum ada transaksi dari partner institusi ini.
              </div>
            )}

            {/* Pagination Controls Transactions */}
            {totalTxPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Halaman {txPage} dari {totalTxPages} ({filteredTransactions.length} total)</span>
                <div className="flex gap-2">
                  <button
                    disabled={txPage <= 1}
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={txPage >= totalTxPages}
                    onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Selanjutnya
                  </button>
                </div>
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

export default InstitutionAdminDashboard;
