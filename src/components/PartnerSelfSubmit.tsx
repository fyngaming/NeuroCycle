import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2 } from 'lucide-react';

const PartnerSelfSubmit = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        // Hanya tampilkan institusi yang sudah disetujui DAN aktif
        // Tampilkan institusi yang statusnya 'active' (sudah diaktifkan oleh super admin)
        const q = query(
          collection(db, 'institutions'),
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

  const submit = async () => {
    if (!name || !email || !phone || !address || !password || !institutionId) {
      alert('Mohon lengkapi semua field');
      return;
    }

    setSubmitting(true);
    try {
      const q = query(collection(db, 'partners'), where('email', '==', email));
      const existing = await getDocs(q);
      if (!existing.empty) {
        alert('Email sudah terdaftar sebagai partner!');
        setSubmitting(false);
        return;
      }

      const partnerRef = doc(collection(db, 'partners'));
      await setDoc(partnerRef, {
        name,
        email,
        phone,
        address,
        notes,
        password,
        ownerUid: partnerRef.id,
        institutionId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Send notification to institution admins
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

      alert('✅ Permohonan pendaftaran partner berhasil dikirim! Silakan tunggu verifikasi admin institusi.');
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error('Error during partner self-submit:', e);
      alert('Gagal mendaftar: ' + (e.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-60 p-6 animate-fade-in">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-teal-500 to-cyan-500" />
        
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h3 className="font-display font-black text-xl text-stone-900 leading-tight">Daftar sebagai Partner</h3>
            <p className="text-stone-400 text-xs mt-1">Bergabung dengan institusi sebagai bank sampah/TPA partner</p>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-50 rounded-xl text-stone-400 hover:text-stone-600">Close</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-2">
          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Nama Bank Sampah / TPA</label>
             <input 
               placeholder="Contoh: Bank Sampah Hijau Lestari" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all" 
               value={name} 
               onChange={(e) => setName(e.target.value)} 
             />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Email</label>
             <input 
               type="email"
               placeholder="email@banksampah.com" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all" 
               value={email} 
               onChange={(e) => setEmail(e.target.value)} 
             />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">No. Telepon</label>
             <input 
               placeholder="08123456789" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all" 
               value={phone} 
               onChange={(e) => setPhone(e.target.value)} 
             />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Alamat</label>
             <textarea 
               placeholder="Alamat lengkap bank sampah / TPA" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all min-h-20" 
               value={address} 
               onChange={(e) => setAddress(e.target.value)} 
             />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Institusi</label>
             <select
               value={institutionId}
               onChange={(e) => setInstitutionId(e.target.value)}
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all bg-white"
             >
              <option value="">-- Pilih Institusi --</option>
              {institutions.map((inst: any) => (
                <option key={inst.id} value={inst.id}>{inst.name} ({inst.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Password Akun</label>
             <input 
               type="password"
               placeholder="Buat password untuk login partner" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all" 
               value={password} 
               onChange={(e) => setPassword(e.target.value)} 
             />
          </div>

          <div>
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">Catatan Tambahan (Opsional)</label>
             <textarea 
               placeholder="Tambahkan informasi penting lainnya jika ada" 
               className="w-full p-4 border border-stone-200 rounded-2xl text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-400 transition-all min-h-20" 
               value={notes} 
               onChange={(e) => setNotes(e.target.value)} 
             />
          </div>
        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button 
            onClick={submit} 
            disabled={submitting} 
            className="flex-1 py-4 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-teal-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="animate-spin" size={18} /> Mengirim...</>
            ) : (
              'Kirim Permohonan'
            )}
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all active:scale-95"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerSelfSubmit;
