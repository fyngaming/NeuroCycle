import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Sparkles,
  Recycle,
  Gift,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Camera,
  Coins,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Clock,
  Award
} from 'lucide-react';

interface HomeInfoBannerProps {
  onScan: () => void;
  onGoToDeposit: () => void;
  onGoToRedemption: () => void;
  onGoToEducation: () => void;
  userPoints?: number;
  isDesktop?: boolean;
}

interface BannerSlide {
  id: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  title: string;
  titleHighlight: string;
  description: string;
  primaryBtnText: string;
  primaryBtnAction: () => void;
  primaryBtnColor: string;
  secondaryBtnText?: string;
  secondaryBtnAction?: () => void;
  bgGradient: string;
  accentGlow: string;
  imageSrc: string;
  imageAlt: string;
  statBadge?: {
    icon: React.ElementType;
    label: string;
    value: string;
  };
}

export const HomeInfoBanner: React.FC<HomeInfoBannerProps> = ({
  onScan,
  onGoToDeposit,
  onGoToRedemption,
  onGoToEducation,
  userPoints = 0,
  isDesktop = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const slides: BannerSlide[] = [
    // ── Slide 1: Pengenalan NeuroCycle & AI Detection ──
    {
      id: 'neurocycle-intro',
      badge: 'PROJEK INOVASI BERKELANJUTAN',
      badgeColor: 'text-emerald-900',
      badgeBg: 'bg-emerald-100/90',
      badgeBorder: 'border-emerald-300',
      title: 'Selamat Datang di',
      titleHighlight: 'NeuroCycle Portal',
      description:
        'Platform pemilahan sampah cerdas berbasis Artificial Intelligence. Deteksi kategori sampah instan dengan kamera AI, pahami panduan daur ulang yang tepat, dan mulailah langkah nyata melestarikan bumi!',
      primaryBtnText: 'Pindai Sampah AI',
      primaryBtnAction: onScan,
      primaryBtnColor: 'from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-900/30 text-white',
      secondaryBtnText: 'Pelajari Fitur',
      secondaryBtnAction: onGoToEducation,
      bgGradient: 'from-emerald-900 via-teal-900 to-stone-900',
      accentGlow: 'bg-emerald-500/20',
      imageSrc: '/images/onboarding/onboarding_1.jpg',
      imageAlt: 'AI Waste Scanning Illustration',
      statBadge: {
        icon: Sparkles,
        label: 'Akurasi Deteksi AI',
        value: '98.5% Cerdas'
      }
    },

    // ── Slide 2: Ajakan Menyetorkan Sampah ke Bank Sampah ──
    {
      id: 'waste-deposit',
      badge: 'BANK SAMPAH MITRA TERDEKAT',
      badgeColor: 'text-teal-900',
      badgeBg: 'bg-teal-100/90',
      badgeBorder: 'border-teal-300',
      title: 'Ubah Sampah Jadi Berkah,',
      titleHighlight: 'Setor Sekarang!',
      description:
        'Jangan buang botol plastik, kertas, kardus, atau logam ke tempat sampah biasa. Setorkan ke Bank Sampah mitra NeuroCycle terdekat dan dapatkan konversi ribuan NeuroPoints untuk setiap kilogram sampahmu!',
      primaryBtnText: 'Setor Sekarang',
      primaryBtnAction: onGoToDeposit,
      primaryBtnColor: 'from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-teal-900/30 text-white',
      secondaryBtnText: 'Lihat Lokasi Bank',
      secondaryBtnAction: onGoToDeposit,
      bgGradient: 'from-teal-950 via-cyan-950 to-stone-900',
      accentGlow: 'bg-teal-400/20',
      imageSrc: '/images/onboarding/onboarding_2.jpg',
      imageAlt: 'Bank Sampah Collection Illustration',
      statBadge: {
        icon: Recycle,
        label: 'Nilai Tukar Sampah',
        value: '+Ratusan NP/kg'
      }
    },

    // ── Slide 3: Penukaran Poin & Hadiah Eksklusif ──
    {
      id: 'point-redemption',
      badge: 'REWARD & NEUROPOINTS MARKET',
      badgeColor: 'text-amber-950',
      badgeBg: 'bg-amber-100/95',
      badgeBorder: 'border-amber-300',
      title: 'Tukarkan Poin Jadi',
      titleHighlight: 'Hadiah & Saldo Nyata!',
      description:
        'Kumpulkan NeuroPoints dari setiap aktivitas memilah dan menyetor sampah. Tukarkan poinmu dengan saldo e-wallet (GoPay, OVO, DANA), voucher belanja, token listrik, hingga merchandise eksklusif ramah lingkungan!',
      primaryBtnText: 'Tukarkan Hadiah',
      primaryBtnAction: onGoToRedemption,
      primaryBtnColor: 'from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 shadow-amber-900/40 text-stone-950 font-black',
      secondaryBtnText: 'Cek Katalog Reward',
      secondaryBtnAction: onGoToRedemption,
      bgGradient: 'from-amber-950 via-stone-900 to-stone-950',
      accentGlow: 'bg-amber-500/25',
      imageSrc: '/images/onboarding/onboarding_3.jpg',
      imageAlt: 'Rewards & Points Redemption Illustration',
      statBadge: {
        icon: Coins,
        label: 'Saldo Poin Kamu',
        value: `${userPoints.toLocaleString('id-ID')} NP`
      }
    }
  ];

  // Auto-slide effect (every 5.5 seconds)
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setDirection('right');
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, slides.length]);

  const handlePrev = () => {
    setDirection('left');
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setDirection('right');
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleSelectSlide = (idx: number) => {
    setDirection(idx > currentIndex ? 'right' : 'left');
    setCurrentIndex(idx);
  };

  const currentSlide = slides[currentIndex];

  // Animation variants
  const slideVariants: Variants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? 80 : -80,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.45,
        ease: 'easeOut'
      }
    },
    exit: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? -80 : 80,
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.35,
        ease: 'easeInOut'
      }
    })
  };

  return (
    <div
      className="relative w-full mb-8 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Outer Banner Card Container */}
      <div className="relative overflow-hidden rounded-4xl border border-stone-200/60 shadow-xl bg-stone-900">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className={`relative w-full bg-gradient-to-br ${currentSlide.bgGradient} ${
              isDesktop ? 'p-8 md:p-10 min-h-[320px]' : 'p-5 min-h-[310px]'
            } text-white flex flex-col justify-between overflow-hidden`}
          >
            {/* ── Aesthetic Background Artwork with Soft Opacity & Directional Scrim ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              {/* Full-Cover Background Image with Low Opacity */}
              <img
                src={currentSlide.imageSrc}
                alt={currentSlide.imageAlt}
                className="w-full h-full object-cover object-right md:object-center opacity-25 scale-105 group-hover:scale-100 transition-transform duration-1000 ease-out"
              />
              {/* Directional Gradient Scrim to Guarantee High Text Contrast & Readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/80 to-stone-950/35" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-transparent to-stone-950/40" />

              {/* Ambient Lighting & Glows */}
              <div className={`absolute top-0 right-1/4 w-96 h-96 ${currentSlide.accentGlow} rounded-full blur-3xl`} />
              <div className="absolute -bottom-10 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl" />
            </div>

            {/* Inner Content: Desktop Layout vs Mobile Single-Column */}
            {isDesktop ? (
              /* ── DESKTOP LAYOUT (Expansive Text + Floating Glassmorphic Stat Highlight) ── */
              <div className="relative z-10 grid grid-cols-12 gap-8 items-center">
                {/* Left Column: Headline, Descriptions & CTA Buttons (8 Cols) */}
                <div className="col-span-8 space-y-4 text-left">
                  {/* Top Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${currentSlide.badgeColor} ${currentSlide.badgeBg} border ${currentSlide.badgeBorder} px-3 py-1 rounded-full shadow-xs`}
                    >
                      <Sparkles size={12} className="animate-pulse" />
                      <span>{currentSlide.badge}</span>
                    </span>

                    <span className="text-[10px] text-white/60 font-mono font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                      {currentIndex + 1} / {slides.length}
                    </span>
                  </div>

                  {/* Headline */}
                  <h3 className="text-3xl lg:text-4xl font-display font-black tracking-tight leading-tight text-white drop-shadow-sm">
                    {currentSlide.title}{' '}
                    <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-300 bg-clip-text text-transparent">
                      {currentSlide.titleHighlight}
                    </span>
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-stone-200/90 leading-relaxed max-w-2xl font-medium">
                    {currentSlide.description}
                  </p>

                  {/* Call-to-action Buttons */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={currentSlide.primaryBtnAction}
                      className={`px-5 py-3 rounded-2xl bg-gradient-to-r ${currentSlide.primaryBtnColor} font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95`}
                    >
                      <span>{currentSlide.primaryBtnText}</span>
                      <ArrowRight size={15} />
                    </motion.button>

                    {currentSlide.secondaryBtnText && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={currentSlide.secondaryBtnAction}
                        className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md active:scale-95"
                      >
                        <span>{currentSlide.secondaryBtnText}</span>
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Right Column: Floating Glassmorphic Stat Highlight (4 Cols) */}
                <div className="col-span-4 flex justify-end items-center relative">
                  {currentSlide.statBadge && (
                    <motion.div
                      whileHover={{ y: -3, scale: 1.02 }}
                      className="w-full max-w-[260px] bg-white/10 hover:bg-white/15 backdrop-blur-xl rounded-3xl p-5 border border-white/25 shadow-2xl text-left transition-all group/stat relative overflow-hidden"
                    >
                      {/* Subtle Ambient Radial Highlight inside card */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30 shadow-inner shrink-0">
                          {React.createElement(currentSlide.statBadge.icon, { size: 22 })}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider truncate">
                            {currentSlide.statBadge.label}
                          </p>
                          <p className="text-lg font-display font-black text-white truncate">
                            {currentSlide.statBadge.value}
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                        <div className="w-3/4 h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full animate-pulse" />
                      </div>
                      <p className="text-[10px] text-stone-300/80 font-medium mt-2">
                        Fitur unggulan platform NeuroCycle
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            ) : (
              /* ── MOBILE LAYOUT (Clean, Native & Focused) ── */
              <div className="relative z-10 space-y-3 text-left">
                {/* Top Badge & Counter */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${currentSlide.badgeColor} ${currentSlide.badgeBg} border ${currentSlide.badgeBorder} px-2.5 py-0.5 rounded-full shadow-xs truncate max-w-[80%]`}
                  >
                    <Sparkles size={11} className="shrink-0 animate-pulse" />
                    <span className="truncate">{currentSlide.badge}</span>
                  </span>

                  <span className="text-[9px] text-white/70 font-mono font-bold bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                    {currentIndex + 1}/{slides.length}
                  </span>
                </div>

                {/* Headline */}
                <h3 className="text-xl font-display font-black tracking-tight leading-snug text-white">
                  {currentSlide.title}{' '}
                  <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-300 bg-clip-text text-transparent">
                    {currentSlide.titleHighlight}
                  </span>
                </h3>

                {/* Description */}
                <p className="text-xs text-stone-200/90 leading-relaxed font-medium line-clamp-3">
                  {currentSlide.description}
                </p>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={currentSlide.primaryBtnAction}
                    className={`w-full py-3 rounded-2xl bg-gradient-to-r ${currentSlide.primaryBtnColor} font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95`}
                  >
                    <span>{currentSlide.primaryBtnText}</span>
                    <ArrowRight size={14} />
                  </button>

                  {currentSlide.secondaryBtnText && (
                    <button
                      type="button"
                      onClick={currentSlide.secondaryBtnAction}
                      className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <span>{currentSlide.secondaryBtnText}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Row: Navigation Dots & Auto-slide Controls */}
            <div className="relative z-10 pt-4 flex items-center justify-between border-t border-white/10 mt-4">
              {/* Dots Indicator */}
              <div className="flex items-center gap-2">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => handleSelectSlide(idx)}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      idx === currentIndex
                        ? 'w-7 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-300 shadow-md'
                        : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                    title={`Lompat ke Slide ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Prev / Next Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Slide Sebelumnya"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Slide Selanjutnya"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HomeInfoBanner;
