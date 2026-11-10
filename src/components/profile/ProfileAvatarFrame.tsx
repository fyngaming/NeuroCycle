import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles, Star, Leaf, Zap, ShieldCheck } from 'lucide-react';

export type AvatarFrameType =
  | 'auto'
  | 'champion_gold'
  | 'champion_silver'
  | 'champion_bronze'
  | 'eco_emerald'
  | 'cyber_neon'
  | 'classic';

interface ProfileAvatarFrameProps {
  photoUrl?: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  frameType?: AvatarFrameType;
  highestRank?: 1 | 2 | 3 | null;
  className?: string;
  onClick?: () => void;
  showEditHint?: boolean;
}

export const ProfileAvatarFrame: React.FC<ProfileAvatarFrameProps> = ({
  photoUrl,
  displayName,
  size = 'lg',
  frameType = 'auto',
  highestRank = null,
  className = '',
  onClick,
  showEditHint = false
}) => {
  // Determine effective frame
  let effectiveFrame: AvatarFrameType = frameType;
  if (frameType === 'auto') {
    if (highestRank === 1) effectiveFrame = 'champion_gold';
    else if (highestRank === 2) effectiveFrame = 'champion_silver';
    else if (highestRank === 3) effectiveFrame = 'champion_bronze';
    else effectiveFrame = 'eco_emerald';
  }

  // Dimension settings
  const sizeConfig = {
    sm: { container: 'w-12 h-12', inner: 'w-10 h-10', text: 'text-sm', badgeSize: 12, stroke: 'p-0.5' },
    md: { container: 'w-16 h-16', inner: 'w-14 h-14', text: 'text-lg', badgeSize: 14, stroke: 'p-1' },
    lg: { container: 'w-24 h-24', inner: 'w-20 h-20', text: 'text-2xl', badgeSize: 18, stroke: 'p-1.5' },
    xl: { container: 'w-32 h-32', inner: 'w-28 h-28', text: 'text-4xl', badgeSize: 24, stroke: 'p-2' }
  };
  const cfg = sizeConfig[size];

  const firstLetter = (displayName || 'U').charAt(0).toUpperCase();

  // Frame styles
  const frameStyles = {
    champion_gold: {
      ringGradient: 'from-amber-300 via-yellow-400 to-amber-600',
      borderRing: 'ring-amber-300/60 shadow-amber-500/35',
      glow: 'rgba(245, 158, 11, 0.4)',
      badgeIcon: Crown,
      badgeColor: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 border-yellow-200',
      badgeLabel: 'Juara 1'
    },
    champion_silver: {
      ringGradient: 'from-slate-200 via-slate-300 to-zinc-400',
      borderRing: 'ring-slate-300/60 shadow-slate-400/30',
      glow: 'rgba(148, 163, 184, 0.35)',
      badgeIcon: Star,
      badgeColor: 'bg-gradient-to-r from-slate-400 to-slate-200 text-stone-900 border-white',
      badgeLabel: 'Juara 2'
    },
    champion_bronze: {
      ringGradient: 'from-orange-400 via-amber-600 to-orange-700',
      borderRing: 'ring-amber-500/50 shadow-orange-600/30',
      glow: 'rgba(217, 119, 6, 0.35)',
      badgeIcon: Sparkles,
      badgeColor: 'bg-gradient-to-r from-orange-600 to-amber-500 text-white border-amber-200',
      badgeLabel: 'Juara 3'
    },
    eco_emerald: {
      ringGradient: 'from-emerald-400 via-teal-500 to-emerald-600',
      borderRing: 'ring-emerald-400/50 shadow-emerald-500/30',
      glow: 'rgba(16, 185, 129, 0.35)',
      badgeIcon: Leaf,
      badgeColor: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-200',
      badgeLabel: 'Eco'
    },
    cyber_neon: {
      ringGradient: 'from-cyan-400 via-teal-400 to-blue-500',
      borderRing: 'ring-cyan-400/50 shadow-cyan-500/35',
      glow: 'rgba(6, 182, 212, 0.4)',
      badgeIcon: Zap,
      badgeColor: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-200',
      badgeLabel: 'Cyber'
    },
    classic: {
      ringGradient: 'from-stone-200 via-white to-stone-300',
      borderRing: 'ring-stone-200 shadow-stone-300/30',
      glow: 'rgba(0, 0, 0, 0.05)',
      badgeIcon: ShieldCheck,
      badgeColor: 'bg-stone-700 text-white border-stone-300',
      badgeLabel: 'Member'
    }
  };

  const style = frameStyles[effectiveFrame] || frameStyles.eco_emerald;
  const BadgeIcon = style.badgeIcon;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Outer Glow Halo */}
      <div
        className="absolute rounded-full blur-xl pointer-events-none transition-all duration-700 scale-125"
        style={{
          width: '90%',
          height: '90%',
          backgroundColor: style.glow
        }}
      />

      {/* Decorative Rotating / Shimmering Frame Ring */}
      <div
        className={`relative ${cfg.container} rounded-full bg-gradient-to-tr ${style.ringGradient} ${cfg.stroke} shadow-xl ring-4 ${style.borderRing} flex items-center justify-center transition-all ${
          onClick ? 'group-hover:scale-105 group-hover:rotate-3' : ''
        }`}
      >
        {/* Subtle notched rim for crown effect */}
        {effectiveFrame === 'champion_gold' && (
          <div className="absolute inset-0.5 rounded-full border border-yellow-200/80 pointer-events-none" />
        )}

        {/* Inner Avatar Container */}
        <div className={`${cfg.inner} rounded-full overflow-hidden bg-stone-100 flex items-center justify-center relative shadow-inner`}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initial if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 flex items-center justify-center text-white font-black">
              <span className={cfg.text}>{firstLetter}</span>
            </div>
          )}

          {/* Edit Hint Overlay on Hover */}
          {showEditHint && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-black pointer-events-none">
              <span>Ubah</span>
            </div>
          )}
        </div>

        {/* Crown Badge on Top for Gold Frame */}
        {effectiveFrame === 'champion_gold' && size !== 'sm' && (
          <motion.div
            animate={{ y: [-2, 2, -2] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-amber-500 drop-shadow-md z-20 pointer-events-none"
          >
            <Crown size={cfg.badgeSize * 1.3} className="fill-amber-400 stroke-amber-600 stroke-[1.5]" />
          </motion.div>
        )}

        {/* Floating Rank / Emblem Badge at Bottom-Right */}
        <div
          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${style.badgeColor} border-2 shadow-md flex items-center justify-center z-20 ${
            size === 'sm' ? 'scale-75' : size === 'xl' ? 'scale-125' : ''
          }`}
          title={style.badgeLabel}
        >
          <BadgeIcon size={cfg.badgeSize} />
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatarFrame;

