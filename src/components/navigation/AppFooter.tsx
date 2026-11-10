import React from 'react';
import { motion } from 'framer-motion';
import { Instagram, Leaf, Sparkles, ShieldCheck, Heart, ArrowUpRight } from 'lucide-react';

interface AppFooterProps {
  onNavigate?: (state: any) => void;
  onScan?: () => void;
  isDesktop?: boolean;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onNavigate, onScan, isDesktop = true }) => {
  return (
    <footer className={`mt-14 mb-8 w-full select-none ${isDesktop ? '' : 'pb-16'}`}>
      <div className={`bg-white/90 backdrop-blur-md rounded-4xl border border-stone-200/80 ${
        isDesktop ? 'p-8 md:p-10' : 'p-5 sm:p-6'
      } shadow-xs relative overflow-hidden`}>
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

        {/* Content: Desktop 3-Column vs Mobile Clean Stack */}
        {isDesktop ? (
          /* ── DESKTOP LAYOUT (3 Columns) ── */
          <div className="grid grid-cols-12 gap-8 items-start relative z-10">
            {/* Column 1: Brand Info (6 Cols) */}
            <div className="col-span-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center p-2 shadow-md shadow-emerald-600/20">
                  <img
                    src="/logo_NeuroCycle.png"
                    alt="NeuroCycle"
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-black text-lg text-stone-900 tracking-tight">
                      NeuroCycle
                    </h4>
                    <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      PORTAL RESMI
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 font-medium">
                    Cerdas Memilah, Berkah Berkelanjutan
                  </p>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed max-w-md pt-1">
                Aplikasi pemilahan sampah pintar berbasis Artificial Intelligence di Indonesia. Bersama masyarakat dan Bank Sampah mitra mewujudkan bumi yang lebih hijau dan bernilai ekonomis.
              </p>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-700 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sistem AI Online • Deteksi Real-Time Aktif</span>
              </div>
            </div>

            {/* Column 2: Navigasi Cepat (3 Cols) */}
            <div className="col-span-3 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Menu Cepat
              </p>
              <ul className="space-y-1.5 text-xs font-semibold text-stone-600">
                {onNavigate && (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate('main')}
                        className="hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        Beranda Portal
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate('waste_bank_list')}
                        className="hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        Bank Sampah Mitra
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate('daily_missions')}
                        className="hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        Misi Harian & Quiz
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate('leaderboard')}
                        className="hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        Papan Peringkat Top 3
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate('education_list')}
                        className="hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        Pusat Edukasi Daur Ulang
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Column 3: Hubungi Kami & Komunitas (3 Cols) */}
            <div className="col-span-3 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Bantuan & Komunitas
              </p>
              <p className="text-xs text-stone-500 font-medium">
                Punya pertanyaan seputar bank sampah atau kemitraan? Hubungi kami langsung:
              </p>

              <div>
                <motion.a
                  href="https://www.instagram.com/neurocycle.id?igsh=YWw5MGdzNzFyZnV2"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#cc2366] to-[#bc1888] text-white shadow-md shadow-pink-200/50 hover:shadow-lg transition-all font-bold text-xs cursor-pointer"
                >
                  <Instagram size={15} />
                  <span>@neurocycle.id</span>
                  <ArrowUpRight size={13} className="opacity-80" />
                </motion.a>
              </div>
            </div>
          </div>
        ) : (
          /* ── MOBILE LAYOUT (Clean Vertical Stack, No Cramping) ── */
          <div className="space-y-5 text-left relative z-10">
            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center p-2 shadow-md shadow-emerald-600/20 shrink-0">
                <img
                  src="/logo_NeuroCycle.png"
                  alt="NeuroCycle"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-black text-base text-stone-900 tracking-tight truncate">
                    NeuroCycle
                  </h4>
                  <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                    PORTAL
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 font-medium truncate">
                  Cerdas Memilah, Berkah Berkelanjutan
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              Platform cerdas pemilahan sampah berbasis Artificial Intelligence. Bersama wujudkan bumi lebih hijau & bernilai.
            </p>

            <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 w-fit">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem AI Online • Aktif</span>
            </div>

            {/* Quick Menu (2 Columns Grid on Mobile) */}
            {onNavigate && (
              <div className="pt-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">
                  Menu Cepat
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-stone-700">
                  <button
                    type="button"
                    onClick={() => onNavigate('main')}
                    className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-left truncate transition-colors"
                  >
                    Beranda
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('waste_bank_list')}
                    className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-left truncate transition-colors"
                  >
                    Bank Sampah
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('daily_missions')}
                    className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-left truncate transition-colors"
                  >
                    Misi & Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('leaderboard')}
                    className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-left truncate transition-colors"
                  >
                    Papan Peringkat
                  </button>
                </div>
              </div>
            )}

            {/* Social Media & Help Button */}
            <div className="pt-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">
                Bantuan & Komunitas
              </p>
              <a
                href="https://www.instagram.com/neurocycle.id?igsh=YWw5MGdzNzFyZnV2"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#cc2366] to-[#bc1888] text-white shadow-md font-bold text-xs active:scale-95 transition-all"
              >
                <Instagram size={15} />
                <span>Ikuti Kami @neurocycle.id</span>
                <ArrowUpRight size={13} className="opacity-80" />
              </a>
            </div>
          </div>
        )}

        {/* Bottom Bar: Divider & Copyright */}
        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[10px] sm:text-[11px] text-stone-400 font-medium relative z-10 text-center sm:text-left">
          <p>© 2026 NeuroCycle Indonesia. Hak cipta dilindungi.</p>
          <div className="flex items-center justify-center gap-1">
            <span>Dibuat dengan</span>
            <Heart size={12} className="text-red-500 fill-red-500 inline" />
            <span>untuk kelestarian bumi</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
