import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Copy } from 'lucide-react';
import { db } from '../../lib/firebase';
import { normalizePhotoUrl } from '../../lib/photoUrl';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'institutions' | 'partners' | 'users' | 'user_assignments' | 'transactions' | 'error_logs' | 'inst_passwords'>('institutions');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState<any | null>(null);
  const [showAssignAdminForm, setShowAssignAdminForm] = useState(false);
  const [assigningInstitution, setAssigningInstitution] = useState<any>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [reassigningUser, setReassigningUser] = useState<any>(null);
  const [reassignInstitutionId, setReassignInstitutionId] = useState('');

  // ─── Pagination & Filter State (Aspek Skalabilitas) ─────────────────
  const [txSearch, setTxSearch] = useState('');
  const [txPage, setTxPage] = useState(1);
  const txPerPage = 20;

  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const userPerPage = 20;

  const [errorPage, setErrorPage] = useState(1);
  const errorPerPage = 20;

  const [instSearch, setInstSearch] = useState('');

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

  // Sinkronisasi otomatis: ganti email institusi lama dengan email admin aktif jika berbeda
  useEffect(() => {
    if (institutions.length > 0 && users.length > 0) {
      institutions.forEach((inst: any) => {
        const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
        if (adminUser?.email && inst.email !== adminUser.email) {
          updateDoc(doc(db, 'institutions', inst.id), { email: adminUser.email }).catch(err => {
            console.error('Failed to sync institution email:', err);
          });
        }
      });
    }
  }, [institutions, users]);

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
        adminUid: userDoc.id,
        email: selectedUserEmail.trim()
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

  // ─── Filtered & Paginated Collections ─────────────────────────────
  const filteredTransactions = useMemo(() => {
    if (!txSearch.trim()) return transactions;
    const q = txSearch.toLowerCase();
    return transactions.filter(tx => 
      (tx.partnerName && tx.partnerName.toLowerCase().includes(q)) ||
      (tx.userEmail && tx.userEmail.toLowerCase().includes(q)) ||
      (tx.userName && tx.userName.toLowerCase().includes(q)) ||
      (tx.userToken && tx.userToken.toLowerCase().includes(q)) ||
      (tx.status && tx.status.toLowerCase().includes(q))
    );
  }, [transactions, txSearch]);

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPerPage;
    return filteredTransactions.slice(start, start + txPerPage);
  }, [filteredTransactions, txPage, txPerPage]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u =>
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPerPage;
    return filteredUsers.slice(start, start + userPerPage);
  }, [filteredUsers, userPage, userPerPage]);

  const totalErrorPages = Math.max(1, Math.ceil(errorLogs.length / errorPerPage));
  const paginatedErrorLogs = useMemo(() => {
    const start = (errorPage - 1) * errorPerPage;
    return errorLogs.slice(start, start + errorPerPage);
  }, [errorLogs, errorPage, errorPerPage]);

  const filteredInstitutions = useMemo(() => {
    if (!instSearch.trim()) return institutions;
    const q = instSearch.toLowerCase();
    return institutions.filter(i =>
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.email && i.email.toLowerCase().includes(q)) ||
      (i.code && i.code.toLowerCase().includes(q)) ||
      (i.type && i.type.toLowerCase().includes(q))
    );
  }, [institutions, instSearch]);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-black">Super Admin Dashboard</h1>
          <p className="text-stone-400 text-xs">Kelola seluruh platform NeuroCycle</p>
        </div>
        <button onClick={onLogout} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">Logout</button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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

        {/* Tab Navigation Menu (Selalu berada di atas) */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'institutions', label: 'Institutions' },
            { id: 'partners', label: 'Partners' },
            { id: 'users', label: 'Users' },
            { id: 'user_assignments', label: 'Kelola User' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'error_logs', label: 'Error Logs' },
            { id: 'inst_passwords', label: 'Password Institusi' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
              {tab.label}
              {tab.id === 'error_logs' && stats.totalErrors > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {stats.totalErrors}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'institutions' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-black">Daftar Institusi</h3>
                <p className="text-xs text-stone-500 mt-1">Verifikasi institusi yang mendaftar sebagai Institution Admin.</p>
              </div>
              <input
                type="text"
                placeholder="Cari institusi..."
                value={instSearch}
                onChange={(e) => setInstSearch(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-400 w-full md:w-64"
              />
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
                  {filteredInstitutions.map((inst: any) => {
                    const adminUser = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                    const displayEmail = adminUser?.email || inst.email || '-';
                    return (
                      <tr key={inst.id} className="hover:bg-stone-50/50">
                        <td className="px-6 py-4 text-sm font-bold text-stone-800">{inst.name}</td>
                        <td className="px-6 py-4 text-xs text-stone-500 capitalize">{inst.type || '-'}</td>
                        <td className="px-6 py-4 text-xs text-stone-500">{displayEmail}</td>
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
                            {inst.approvalStatus === 'pending' && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'institutions', inst.id), { approvalStatus: 'approved', status: 'active' });
                                      const adminU = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                      if (adminU) {
                                        const notifs = [...(adminU.notifications || [])];
                                        notifs.unshift({
                                          id: Math.random().toString(36).substr(2, 9),
                                          title: 'Institusi Disetujui! 🎊',
                                          message: `Institusi "${inst.name}" Anda telah disetujui oleh Super Admin. Anda sekarang bisa login sebagai Institution Admin.`,
                                          date: new Date().toLocaleString('id-ID'),
                                          type: 'success',
                                          isRead: false
                                        });
                                        await updateDoc(doc(db, 'users', adminU.id || adminU.uid), { notifications: notifs });
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
                                      const adminU = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                      if (adminU) {
                                        const notifs = [...(adminU.notifications || [])];
                                        notifs.unshift({
                                          id: Math.random().toString(36).substr(2, 9),
                                          title: 'Institusi Ditolak',
                                          message: `Institusi "${inst.name}" ditolak oleh Super Admin. Alasan: ${reason}`,
                                          date: new Date().toLocaleString('id-ID'),
                                          type: 'warning',
                                          isRead: false
                                        });
                                        await updateDoc(doc(db, 'users', adminU.id || adminU.uid), { notifications: notifs });
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

                            {inst.status !== 'active' && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Aktifkan institusi "${inst.name}"? Institusi akan bisa digunakan partner untuk mendaftar.`)) return;
                                  try {
                                    await updateDoc(doc(db, 'institutions', inst.id), {
                                      status: 'active',
                                      approvalStatus: 'approved'
                                    });
                                    const adminU = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                    if (adminU) {
                                      const notifs = [...(adminU.notifications || [])];
                                      notifs.unshift({
                                        id: Math.random().toString(36).substr(2, 9),
                                        title: '✅ Institusi Diaktifkan',
                                        message: `Institusi "${inst.name}" telah diaktifkan oleh Super Admin. Anda sekarang bisa login.`,
                                        date: new Date().toLocaleString('id-ID'),
                                        type: 'success',
                                        isRead: false
                                      });
                                      await updateDoc(doc(db, 'users', adminU.id || adminU.uid), { notifications: notifs });
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

                            {inst.status === 'active' && (
                              <button
                                onClick={async () => {
                                  const reason = prompt(`Alasan nonaktifkan/banned "${inst.name}"? (opsional)`);
                                  if (reason === null) return;
                                  try {
                                    await updateDoc(doc(db, 'institutions', inst.id), {
                                      status: 'suspended',
                                      approvalStatus: 'rejected',
                                      suspendReason: reason || 'Dinonaktifkan oleh Super Admin',
                                      suspendedAt: new Date().toISOString()
                                    });
                                    const adminU = users.find((u: any) => u.role === 'institution_admin' && u.institutionId === inst.id);
                                    if (adminU) {
                                      const notifs = [...(adminU.notifications || [])];
                                      notifs.unshift({
                                        id: Math.random().toString(36).substr(2, 9),
                                        title: '🚫 Institusi Dinonaktifkan',
                                        message: `Institusi "${inst.name}" telah dinonaktifkan oleh Super Admin.${reason ? ` Alasan: ${reason}` : ''}`,
                                        date: new Date().toLocaleString('id-ID'),
                                        type: 'warning',
                                        isRead: false
                                      });
                                      await updateDoc(doc(db, 'users', adminU.id || adminU.uid), { notifications: notifs });
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

                            {inst.approvalStatus !== 'pending' && inst.status !== 'active' && inst.status === 'suspended' && (
                              <span className="text-[10px] text-stone-400 italic">Suspended</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInstitutions.length === 0 && (
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
                    <th className="px-6 py-3 text-[10px] font-black text-stone-400 uppercase text-right">Aksi</th>
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
                          p.status === 'suspended' ? 'bg-stone-100 text-stone-700 border-stone-300' :
                          'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>
                          {p.status === 'approved' ? 'Disetujui' : p.status === 'pending' ? 'Menunggu' : p.status === 'rejected' ? 'Ditolak' : p.status === 'suspended' ? 'Nonaktif' : p.status}
                        </span>
                        {p.suspensionReason && (
                          <p className="text-[10px] text-stone-500 mt-1 max-w-[140px]">{p.suspensionReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-semibold text-stone-700">{p.password || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-600">{institutions.find((i: any) => i.id === p.institutionId)?.name || p.institutionId || '-'}</td>
                      <td className="px-6 py-4 text-[10px] font-mono text-stone-400">{p.ownerUid}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {p.status === 'approved' ? (
                          <button
                            onClick={async () => {
                              const reason = prompt(`Masukkan alasan penonaktifan untuk "${p.name}" (opsional):`) || 'Dinonaktifkan oleh Super Admin';
                              try {
                                await updateDoc(doc(db, 'partners', p.id), {
                                  status: 'suspended',
                                  suspendedAt: new Date().toISOString(),
                                  suspensionReason: reason,
                                  suspendedBy: 'super_admin'
                                });
                                alert(`⛔ Partner "${p.name}" berhasil dinonaktifkan.`);
                              } catch (e) {
                                console.error('Gagal menonaktifkan partner:', e);
                                alert('Gagal menonaktifkan partner.');
                              }
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                          >
                            Nonaktifkan
                          </button>
                        ) : (p.status === 'suspended' || p.status === 'rejected') ? (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'partners', p.id), {
                                  status: 'approved',
                                  approvedAt: new Date().toISOString(),
                                  approvedBy: 'super_admin',
                                  suspendedAt: null,
                                  suspensionReason: '',
                                  rejectionReason: ''
                                });
                                alert(`✅ Partner "${p.name}" berhasil diaktifkan kembali!`);
                              } catch (e) {
                                console.error('Gagal mengaktifkan partner:', e);
                                alert('Gagal mengaktifkan partner.');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95 shadow-sm"
                          >
                            Aktifkan
                          </button>
                        ) : p.status === 'pending' ? (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            Menunggu Persetujuan Institusi
                          </span>
                        ) : (
                          <span className="text-xs text-stone-300 italic">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-black">Daftar Users</h3>
                <p className="text-xs text-stone-400 mt-0.5">Total {filteredUsers.length} pengguna terdaftar</p>
              </div>
              <input
                type="text"
                placeholder="Cari nama, email, role..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-400 w-full md:w-64"
              />
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
                  {paginatedUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-stone-800">{u.displayName || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">{u.email || '-'}</td>
                      <td className="px-6 py-4 text-xs text-stone-500 capitalize">{u.role || 'user'}</td>
                      <td className="px-6 py-4 text-xs font-black text-emerald-600">{u.points || 0} NP</td>
                    </tr>
                  ))}
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-stone-400 text-sm">
                        Tidak ada user yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls Users */}
            {totalUserPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Halaman {userPage} dari {totalUserPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={userPage <= 1}
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={userPage >= totalUserPages}
                    onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'error_logs' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-black">Error Logs</h3>
                <p className="text-xs text-stone-400 mt-0.5">Riwayat error aplikasi secara realtime</p>
              </div>
              <span className="text-xs font-bold text-stone-400">Total {errorLogs.length} logs</span>
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
                  {paginatedErrorLogs.map((log: any) => (
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
                  {paginatedErrorLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-stone-400 text-sm">
                        Tidak ada error logs tersimpan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalErrorPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Halaman {errorPage} dari {totalErrorPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={errorPage <= 1}
                    onClick={() => setErrorPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={errorPage >= totalErrorPages}
                    onClick={() => setErrorPage(p => Math.min(totalErrorPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-black">Semua Transaksi</h3>
                <p className="text-xs text-stone-500 mt-1">Detail setoran sampah per transaksi</p>
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
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_2.5fr_1fr_1fr_1.5fr] gap-4 px-6 py-3 bg-stone-50 border-b border-stone-100">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Partner</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">User</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Setoran</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Bukti</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Tanggal</span>
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</span>
            </div>

            <div className="divide-y divide-stone-50">
              {paginatedTransactions.map((tx: any) => {
                const matchedUser = users.find((u: any) =>
                  (u.qrToken && (u.qrToken === tx.userToken || u.qrToken === tx.userUid)) ||
                  (u.uid && (u.uid === tx.userUid || u.uid === tx.userToken)) ||
                  (u.email && tx.userEmail && u.email.toLowerCase() === tx.userEmail.toLowerCase())
                );
                const userEmail = tx.userEmail || matchedUser?.email || '';
                const userName = tx.userName || tx.userDisplayName || matchedUser?.displayName || '';

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
                      <p className="text-xs font-bold text-stone-800 leading-tight break-all">
                        {userEmail || userName || (tx.userToken ? `Token: ${tx.userToken}` : '-')}
                      </p>
                      {userName && userEmail && userName !== userEmail && (
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">{userName}</p>
                      )}
                      {tx.userToken && (
                        <p className="text-[9px] text-stone-400 font-mono mt-0.5">Token: {tx.userToken}</p>
                      )}
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
                      {(() => {
                        const rawPhoto = tx.photoUrl || tx.image || tx.proofImage || tx.proofPhoto || tx.photo;
                        const validPhoto = rawPhoto ? normalizePhotoUrl(rawPhoto) : null;
                        return validPhoto ? (
                          <div className="flex flex-col items-start gap-1">
                            <img
                              src={validPhoto}
                              alt="bukti"
                              className="w-12 h-12 rounded-xl object-cover border border-stone-200 cursor-pointer hover:scale-105 hover:shadow-md transition-all"
                              onClick={() => setPreviewPhoto({
                                url: validPhoto,
                                partnerName: tx.partnerName || '-',
                                userName: tx.userName || tx.userDisplayName || '-',
                                weight: totalW,
                                items: itemsList,
                                points: tx.totalPoints || 0,
                                date: tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID') : '-',
                                status: tx.status
                              })}
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                url: validPhoto,
                                partnerName: tx.partnerName || '-',
                                userName: tx.userName || tx.userDisplayName || '-',
                                weight: totalW,
                                items: itemsList,
                                points: tx.totalPoints || 0,
                                date: tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID') : '-',
                                status: tx.status
                              })}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                            >
                              Lihat Bukti
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-300 italic">Tanpa foto</span>
                        );
                      })()}
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

            {filteredTransactions.length === 0 && (
              <div className="px-6 py-12 text-center text-stone-400 text-sm">
                Belum ada transaksi yang sesuai pencarian.
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
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={txPage >= totalTxPages}
                    onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
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
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-100 transition-all"
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

        {/* Modal Scan / Detail Bukti Setoran Sampah */}
        {previewPhoto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setPreviewPhoto(null)}>
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-100" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h4 className="font-display font-black text-stone-800 text-sm">Bukti Setoran Sampah</h4>
                  <p className="text-[11px] text-stone-400">{previewPhoto.partnerName} • {previewPhoto.userName}</p>
                </div>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 bg-stone-900 flex items-center justify-center min-h-[260px] max-h-[420px] overflow-hidden">
                <img
                  src={previewPhoto.url}
                  alt="Bukti Setoran"
                  className="max-h-[380px] w-auto max-w-full rounded-xl object-contain shadow-lg"
                />
              </div>
              <div className="p-4 bg-stone-50 text-xs space-y-2">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Total Berat:</span>
                  <span className="font-black text-stone-900">{typeof previewPhoto.weight === 'number' ? previewPhoto.weight.toFixed(1) : previewPhoto.weight} kg</span>
                </div>
                {previewPhoto.items && previewPhoto.items.length > 0 && (
                  <div className="flex justify-between items-start text-stone-500 text-[11px]">
                    <span>Rincian:</span>
                    <span className="text-right font-medium">{previewPhoto.items.map((it: any) => `${it.category} (${it.weight}kg)`).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-stone-600">
                  <span>Poin Diperoleh:</span>
                  <span className="font-black text-emerald-600">+{previewPhoto.points.toLocaleString()} NP</span>
                </div>
                <div className="flex justify-between items-center text-stone-400 text-[10px] pt-1 border-t border-stone-200/60">
                  <span>Waktu Transaksi:</span>
                  <span>{previewPhoto.date}</span>
                </div>
              </div>
              <div className="p-3 bg-white border-t border-stone-100 flex justify-end gap-2">
                <button
                  onClick={() => window.open(previewPhoto.url, '_blank')}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all"
                >
                  Buka Gambar Asli ↗
                </button>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
