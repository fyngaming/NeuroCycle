import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, AlertCircle, CheckCircle, XCircle, Search, Building2 } from 'lucide-react';

const PartnerOnboarding = ({ uid, onClose }: { uid?: string; onClose: () => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [institutionCodeInput, setInstitutionCodeInput] = useState('');
  const [password, setPassword] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [instSearch, setInstSearch] = useState('');

  // States for checking existing registration status
  const [existingPartner, setExistingPartner] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isReapplying, setIsReapplying] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoadingStatus(false);
      return;
    }
    const q = query(collection(db, 'partners'), where('ownerUid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setExistingPartner({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setExistingPartner(null);
      }
      setLoadingStatus(false);
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        // Hanya tampilkan institusi yang sudah disetujui DAN aktif
        const q = query(
          collection(db, 'institutions'),
          where('approvalStatus', '==', 'approved'),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        setInstitutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Gagal memuat institusi:', e);
      }
    };
    fetchInstitutions();
  }, []);

  const verifyInstitutionCode = async () => {
    if (!institutionCodeInput.trim()) {
      alert('Masukkan kode institusi terlebih dahulu!');
      return;
    }
    setVerifyingCode(true);
    try {
      const q = query(collection(db, 'institutions'), where('code', '==', institutionCodeInput.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert('Kode institusi tidak ditemukan!');
        setInstitutionId('');
        return;
      }
      const instDoc = snap.docs[0];
      setInstitutionId(instDoc.id);
      setInstSearch('');
      alert(`Institusi ditemukan: ${instDoc.data().name}`);
    } catch (e: any) {
      alert('Gagal verifikasi kode: ' + (e.message || 'Unknown'));
    } finally {
      setVerifyingCode(false);
    }
  };

  const submit = async () => {
    setErrorMsg('');
    if (!name || !email || !phone || !address) {
      alert('Mohon lengkapi semua field utama (Nama, Email, Telepon, Alamat)');
      return;
    }
    if (!institutionId) {
      alert('Mohon pilih institusi');
      return;
    }
    if (!password) {
      alert('Mohon buat password untuk akun partner');
      return;
    }

    setSubmitting(true);
    try {
      const partnerCol = collection(db, 'partners');
      const partnerDocRef = existingPartner && isReapplying 
        ? doc(db, 'partners', existingPartner.id) 
        : doc(partnerCol);
      const partnerId = partnerDocRef.id;
      
      const partnerData: any = {
        name,
        email,
        phone,
        address,
        notes,
        ownerUid: uid || partnerId,
        institutionId,
        status: 'pending',
        password,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(partnerDocRef, partnerData, { merge: true });

      const adminsQuery = query(collection(db, 'users'), where('institutionId', '==', institutionId), where('role', '==', 'institution_admin'));
      const adminsSnap = await getDocs(adminsQuery);
      const promises = adminsSnap.docs.map(adminDoc => {
        const adminData = adminDoc.data() as any;
        const newNotification = {
          id: Math.random().toString(36).substr(2, 9),
          title: 'Partner Baru Mendaftar',
          message: `${name} telah mengajukan pendaftaran sebagai partner ke institusi Anda.`,
          date: new Date().toLocaleString('id-ID'),
          type: 'info',
          isRead: false
        };
        const updatedNotifications = [newNotification, ...(adminData.notifications || [])];
        return updateDoc(doc(db, 'users', adminDoc.id), { notifications: updatedNotifications });
      });
      await Promise.all(promises);
      
      alert('✅ Permohonan pendaftaran partner berhasil dikirim! Silakan tunggu verifikasi admin.');
      setIsReapplying(false);
      onClose();
    } catch (e: any) {
      console.error('Error during partner registration:', e);
      alert('Gagal mendaftar: ' + (e.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6">
        <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center shadow-2xl">
          <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={48} />
          <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Memeriksa Status Kemitraan...</p>
        </div>
      </div>
    );
  }

  // If already registered and not in re-apply mode
  if (existingPartner && !isReapplying) {
    const isPending = existingPartner.status === 'pending';
    const isApproved = existingPartner.status === 'approved';
    const isRejected = existingPartner.status === 'rejected';

    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6 animate-fade-in">
        <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-500 to-teal-500" />
          
          <div className="text-center py-6">
            {isPending && (
              <div className="w-20 h-20 bg-amber-50 rounded-[28px] flex items-center justify-center text-amber-500 mx-auto mb-6 border border-amber-100">
                <Loader2 className="animate-spin" size={36} />
              </div>
            )}
            {isApproved && (
              <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center text-emerald-500 mx-auto mb-6 border border-emerald-100">
                <CheckCircle size={36} />
              </div>
            )}
            {isRejected && (
              <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-100">
                <XCircle size={36} />
              </div>
            )}

            <h3 className="font-display font-bold text-2xl text-stone-800 mb-2">Status Kemitraan</h3>
            <p className="text-stone-400 text-sm mb-6">Pendaftaran Bank Sampah / TPA Partner</p>

            <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100 text-left mb-6 space-y-4">
              <div>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Nama Mitra</p>
                  <p className="text-sm font-bold text-stone-800">{existingPartner.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Status Pengajuan</p>
                <span className={`inline-block px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mt-1.5 ${
                  isPending ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {existingPartner.status.toUpperCase()}
                </span>
              </div>
              {isRejected && existingPartner.rejectionReason && (
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle size={10} /> Alasan Penolakan
                  </p>
                  <p className="text-xs font-semibold text-red-700 mt-1 bg-red-50/50 p-2.5 rounded-xl border border-red-100/50 leading-relaxed">
                    {existingPartner.rejectionReason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {isRejected && (
                <button 
                  onClick={() => {
                    setName(existingPartner.name || '');
                    setEmail(existingPartner.email || '');
                    setPhone(existingPartner.phone || '');
                    setAddress(existingPartner.address || '');
                    setNotes(existingPartner.notes || '');
                    setIsReapplying(true);
                  }}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-100"
                >
                  Daftar Ulang
                </button>
              )}
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6 animate-fade-in">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-500 to-teal-500" />
        
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h3 className="font-display font-black text-xl text-stone-900 leading-tight">Registrasi Partner</h3>
            <p className="text-stone-400 text-xs mt-1">Daftarkan Bank Sampah / TPA Anda</p>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-50 rounded-xl text-stone-400 hover:text-stone-600">Close</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-2">
          {errorMsg && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">⚠️ Error Detail:</p>
              <p className="text-xs text-red-600 whitespace-pre-wrap leading-relaxed font-mono">{errorMsg}</p>
            </div>
          )}
          
          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Nama Bank Sampah / TPA</label>
            <input 
              placeholder="Contoh: Bank Sampah Hijau Lestari" 
              className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Email Resmi Partner</label>
            <input 
              type="email"
              placeholder="Contoh: info@banksampah.com" 
              className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">No. Telepon / WhatsApp</label>
            <input 
              placeholder="Contoh: 08123456789" 
              className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Alamat Operasional TPA</label>
            <input 
              placeholder="Masukkan alamat lengkap TPA" 
              className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
            />
           </div>

            <div>
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Institusi</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Ketik kode institusi..."
                  value={institutionCodeInput}
                  onChange={(e) => setInstitutionCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all uppercase"
                />
                <button
                  type="button"
                  onClick={verifyInstitutionCode}
                  disabled={verifyingCode}
                  className="px-4 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {verifyingCode ? <Loader2 className="animate-spin" size={18} /> : 'Cari'}
                </button>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  placeholder="Atau ketik nama institusi untuk mencari..."
                  value={instSearch}
                  onChange={(e) => setInstSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                />
              </div>
              {instSearch && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto shadow-lg mb-3">
                  {institutions
                    .filter((inst: any) => {
                      const q = instSearch.toLowerCase();
                      return (inst.name || '').toLowerCase().includes(q) ||
                             (inst.code || '').toLowerCase().includes(q);
                    })
                    .map((inst: any) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          setInstitutionId(inst.id);
                          setInstitutionCodeInput(inst.code || '');
                          setInstSearch('');
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-stone-50 last:border-b-0 ${institutionId === inst.id ? 'bg-emerald-50' : ''}`}
                      >
                        <p className="text-sm font-bold text-stone-800">{inst.name}</p>
                        <p className="text-[10px] text-stone-400 font-mono">Kode: {inst.code || '-'}</p>
                      </button>
                    ))}
                  {institutions.filter((inst: any) => {
                    const q = instSearch.toLowerCase();
                    return (inst.name || '').toLowerCase().includes(q) ||
                           (inst.code || '').toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="text-xs text-stone-400 p-4 text-center">Tidak ada institusi yang cocok.</p>
                  )}
                </div>
              )}
              {institutionId && institutions.find((i: any) => i.id === institutionId) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2">
                  <Building2 size={16} className="text-emerald-600" />
                  <p className="text-xs font-bold text-emerald-700">
                    {institutions.find((i: any) => i.id === institutionId)?.name}
                    <span className="font-mono ml-2">({institutions.find((i: any) => i.id === institutionId)?.code})</span>
                  </p>
                </div>
              )}
              {!institutionId && instSearch === '' && institutions.length > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Total {institutions.length} institusi terdaftar. Ketik untuk mencari.
                </p>
              )}
              {!institutionId && instSearch === '' && institutions.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1">
                  Belum ada institusi terdaftar. Hubungi admin untuk membuat institusi terlebih dahulu.
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Password Akun Partner</label>
              <input 
                type="password"
                placeholder="Buat password untuk login partner" 
                className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

           <div>
             <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Catatan Tambahan (Opsional)</label>
             <textarea 
               placeholder="Tambahkan informasi penting lainnya jika ada" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition-all min-h-20" 
               value={notes} 
               onChange={(e) => setNotes(e.target.value)} 
            />
          </div>


        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button 
            onClick={submit} 
            disabled={submitting} 
            className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="animate-spin" size={18} /> Mengirim...</>
            ) : (
              'Kirim Permohonan'
            )}
          </button>
          <button 
            onClick={() => {
              if (isReapplying) setIsReapplying(false);
              else onClose();
            }}
            className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all active:scale-95"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerOnboarding;
