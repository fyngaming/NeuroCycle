import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Recycle, Brain, Sparkles, Lock, Trophy } from 'lucide-react';

export type BadgeCategory = 'scanner' | 'collector' | 'quiz';
export type BadgeRank = 1 | 2 | 3;

export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  rank: BadgeRank;
  name: string;
  title: string;
  description: string;
  colorName: string;
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  'scanner_1': {
    id: 'scanner_1',
    category: 'scanner',
    rank: 1,
    name: 'Grand AI Visionary',
    title: 'Juara 1 Scanner Sampah',
    description: 'Paling aktif memindai dan memverifikasi sampah cerdas menggunakan kamera AI.',
    colorName: 'Emas Murni'
  },
  'scanner_2': {
    id: 'scanner_2',
    category: 'scanner',
    rank: 2,
    name: 'Master Scanner',
    title: 'Juara 2 Scanner Sampah',
    description: 'Konsisten memilah sampah dengan ketajaman pemindaian AI.',
    colorName: 'Perak Mengkilap'
  },
  'scanner_3': {
    id: 'scanner_3',
    category: 'scanner',
    rank: 3,
    name: 'Pro Scanner',
    title: 'Juara 3 Scanner Sampah',
    description: 'Pilar utama pemindaian sampah cerdas komunitas.',
    colorName: 'Perunggu Berkilau'
  },
  'collector_1': {
    id: 'collector_1',
    category: 'collector',
    rank: 1,
    name: 'Bumi Overlord',
    title: 'Juara 1 Pengumpul Sampah',
    description: 'Penyetor sampah fisik terbanyak (Kg) ke jaringan bank sampah mitra.',
    colorName: 'Emas Murni'
  },
  'collector_2': {
    id: 'collector_2',
    category: 'collector',
    rank: 2,
    name: 'Green Champion',
    title: 'Juara 2 Pengumpul Sampah',
    description: 'Pejuang pemulihan lingkungan dengan bobot setoran signifikan.',
    colorName: 'Perak Mengkilap'
  },
  'collector_3': {
    id: 'collector_3',
    category: 'collector',
    rank: 3,
    name: 'Eco Guardian',
    title: 'Juara 3 Pengumpul Sampah',
    description: 'Penggerak aktif daur ulang sampah berkelanjutan.',
    colorName: 'Perunggu Berkilau'
  },
  'quiz_1': {
    id: 'quiz_1',
    category: 'quiz',
    rank: 1,
    name: 'Mahaguru Lingkungan',
    title: 'Juara 1 Si Paling Quiz',
    description: 'Raja pengetahuan kuis harian dengan skor sempurna dan penyelesaian terbanyak.',
    colorName: 'Emas Murni'
  },
  'quiz_2': {
    id: 'quiz_2',
    category: 'quiz',
    rank: 2,
    name: 'Cendekiawan Hijau',
    title: 'Juara 2 Si Paling Quiz',
    description: 'Wawasan tajam dan rajin menuntaskan misi kuis edukasi ekosistem.',
    colorName: 'Perak Mengkilap'
  },
  'quiz_3': {
    id: 'quiz_3',
    category: 'quiz',
    rank: 3,
    name: 'Juara Kelas Edukasi',
    title: 'Juara 3 Si Paling Quiz',
    description: 'Pelajar tekun yang aktif menjawab kuis pemilahan sampah harian.',
    colorName: 'Perunggu Berkilau'
  }
};

interface BadgeMedalProps {
  category: BadgeCategory;
  rank: BadgeRank;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLocked?: boolean;
  showDetails?: boolean;
  awardedDate?: string;
  onClick?: () => void;
  className?: string;
}

export const BadgeMedal: React.FC<BadgeMedalProps> = ({
  category,
  rank,
  size = 'md',
  isLocked = false,
  showDetails = false,
  awardedDate,
  onClick,
  className = ''
}) => {
  const badgeKey = `${category}_${rank}`;
  const info = BADGE_DEFINITIONS[badgeKey] || {
    name: `Juara #${rank}`,
    title: `Peringkat #${rank}`,
    description: 'Peringkat Terbaik Leaderboard',
    colorName: rank === 1 ? 'Emas' : rank === 2 ? 'Perak' : 'Perunggu'
  };

  // Dimensions
  const sizeMap = {
    sm: { box: 'w-14 h-16', outerCircle: 'w-12 h-12', iconSize: 16, ribbonH: 'h-4', textSize: 'text-[9px]' },
    md: { box: 'w-24 h-28', outerCircle: 'w-20 h-20', iconSize: 24, ribbonH: 'h-6', textSize: 'text-xs' },
    lg: { box: 'w-32 h-36', outerCircle: 'w-28 h-28', iconSize: 34, ribbonH: 'h-8', textSize: 'text-sm' },
    xl: { box: 'w-44 h-48', outerCircle: 'w-36 h-36', iconSize: 44, ribbonH: 'h-10', textSize: 'text-base' }
  };
  const currentSize = sizeMap[size];

  // Palette settings per Rank
  const rankColors = {
    1: {
      gradient: 'from-amber-300 via-yellow-400 to-amber-600',
      border: 'border-yellow-200 shadow-yellow-500/40',
      inner: 'from-yellow-100 to-amber-300',
      glow: 'rgba(245, 158, 11, 0.45)',
      ring: 'ring-amber-300/60',
      ribbonBg: 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600',
      textAccent: 'text-amber-600',
      starColor: 'text-yellow-300'
    },
    2: {
      gradient: 'from-slate-200 via-slate-300 to-zinc-400',
      border: 'border-white shadow-slate-400/30',
      inner: 'from-white to-slate-200',
      glow: 'rgba(148, 163, 184, 0.4)',
      ring: 'ring-slate-300/60',
      ribbonBg: 'bg-gradient-to-r from-slate-500 via-zinc-400 to-slate-500',
      textAccent: 'text-slate-600',
      starColor: 'text-slate-200'
    },
    3: {
      gradient: 'from-orange-300 via-amber-600 to-orange-800',
      border: 'border-amber-200 shadow-orange-600/30',
      inner: 'from-amber-100 to-orange-300',
      glow: 'rgba(217, 119, 6, 0.4)',
      ring: 'ring-amber-500/50',
      ribbonBg: 'bg-gradient-to-r from-orange-700 via-amber-600 to-orange-700',
      textAccent: 'text-orange-700',
      starColor: 'text-amber-300'
    }
  };
  const color = rankColors[rank];

  // Category Icon
  const renderCategoryIcon = () => {
    const iconProps = { size: currentSize.iconSize, className: isLocked ? 'text-stone-400' : 'text-stone-900 drop-shadow-sm' };
    switch (category) {
      case 'scanner':
        return <Camera {...iconProps} />;
      case 'collector':
        return <Recycle {...iconProps} />;
      case 'quiz':
        return <Brain {...iconProps} />;
      default:
        return <Trophy {...iconProps} />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Outer Container with Medallion & Ribbon */}
      <div className={`relative flex flex-col items-center justify-center ${currentSize.box}`}>
        
        {/* Glow behind medal */}
        {!isLocked && (
          <div
            className="absolute rounded-full blur-xl pointer-events-none scale-125 transition-all duration-700"
            style={{
              width: '80%',
              height: '80%',
              backgroundColor: color.glow
            }}
          />
        )}

        {/* Medallion Circle */}
        <motion.div
          whileHover={onClick ? { scale: 1.08, rotate: [0, -3, 3, 0] } : undefined}
          transition={{ duration: 0.3 }}
          className={`relative ${currentSize.outerCircle} rounded-full p-1.5 shadow-xl flex items-center justify-center transition-all ${
            isLocked
              ? 'bg-stone-200 border-2 border-stone-300 grayscale opacity-60 shadow-none'
              : `bg-gradient-to-tr ${color.gradient} border-2 ${color.border} ring-4 ${color.ring}`
          }`}
        >
          {/* Decorative notched outer rim */}
          <div className="absolute inset-1 rounded-full border border-white/40 pointer-events-none" />

          {/* Inner medal core */}
          <div
            className={`w-full h-full rounded-full flex flex-col items-center justify-center shadow-inner relative overflow-hidden ${
              isLocked
                ? 'bg-stone-300 text-stone-500'
                : `bg-gradient-to-b ${color.inner}`
            }`}
          >
            {/* Dynamic Light Sweep / Shimmer */}
            {!isLocked && (
              <motion.div
                initial={{ x: '-150%' }}
                animate={{ x: '200%' }}
                transition={{
                  repeat: Infinity,
                  duration: 2.8,
                  ease: 'easeInOut',
                  repeatDelay: 1.5
                }}
                className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-12 pointer-events-none z-10"
              />
            )}

            {/* Sparkle icon on Top-Right for Rank 1 */}
            {!isLocked && rank === 1 && size !== 'sm' && (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`absolute top-1 right-1 ${color.starColor} z-20`}
              >
                <Sparkles size={currentSize.iconSize * 0.6} />
              </motion.div>
            )}

            {/* Central Icon */}
            <div className="relative z-10 flex flex-col items-center">
              {isLocked ? (
                <Lock size={currentSize.iconSize} className="text-stone-500" />
              ) : (
                <>
                  {renderCategoryIcon()}
                  {size !== 'sm' && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-900/80 -mt-0.5">
                      #{rank}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Ribbon Banner Below Medal */}
        <div
          className={`-mt-2 z-20 px-2.5 py-0.5 rounded-full shadow-md text-white font-black text-center flex items-center justify-center gap-1 ${
            isLocked ? 'bg-stone-400' : color.ribbonBg
          } ${currentSize.ribbonH}`}
        >
          <span className={`${currentSize.textSize} uppercase tracking-wider whitespace-nowrap`}>
            {isLocked ? 'Terkunci' : `Juara ${rank}`}
          </span>
        </div>
      </div>

      {/* Optional details text below */}
      {showDetails && (
        <div className="text-center mt-2 max-w-[140px]">
          <h5 className={`font-display font-black text-xs leading-tight ${isLocked ? 'text-stone-400' : 'text-stone-800'}`}>
            {info.name}
          </h5>
          <p className="text-[9px] text-stone-500 font-medium line-clamp-1 mt-0.5">
            {info.title}
          </p>
          {awardedDate && (
            <span className="inline-block mt-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Diraih: {awardedDate}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BadgeMedal;

