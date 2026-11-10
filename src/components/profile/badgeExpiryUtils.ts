import type { UserBadge } from '../../types';

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mendapatkan timestamp milidetik ketika medali diraih.
 */
export const getBadgeTimestamp = (badge: UserBadge): number => {
  if (badge.awardedTimestamp && badge.awardedTimestamp > 0) {
    return badge.awardedTimestamp;
  }
  
  // Mencoba parse dari akhiran ID medali (contoh: scanner_1_1794209500000)
  const parts = (badge.id || '').split('_');
  const lastPart = Number(parts[parts.length - 1]);
  if (!isNaN(lastPart) && lastPart > 1000000000000) {
    return lastPart;
  }

  // Mencoba parse dari string tanggal awardedAt
  if (badge.awardedAt) {
    const parsed = new Date(badge.awardedAt).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Fallback ke sekarang agar tidak langsung hilang jika timestamp belum tercatat
  return Date.now();
};

/**
 * Mengecek apakah medali masih dalam batas masa aktif 1 minggu (7 hari).
 * Setelah 7 hari, medali akan otomatis kadaluwarsa dari dashboard utama.
 */
export const isBadgeActive = (badge: UserBadge): boolean => {
  const timestamp = getBadgeTimestamp(badge);
  const elapsed = Date.now() - timestamp;
  return elapsed < SEVEN_DAYS_MS;
};

/**
 * Mendapatkan info sisa waktu keaktifan medali.
 */
export const getBadgeExpiryInfo = (badge: UserBadge) => {
  const timestamp = getBadgeTimestamp(badge);
  const elapsed = Date.now() - timestamp;
  const remainingMs = SEVEN_DAYS_MS - elapsed;
  const isExpired = remainingMs <= 0;

  if (isExpired) {
    return {
      isExpired: true,
      daysLeft: 0,
      hoursLeft: 0,
      text: 'Masa aktif 1 minggu telah berakhir',
      badgeLabel: 'Kadaluwarsa',
      progressPercent: 0
    };
  }

  const totalHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  const daysLeft = Math.floor(totalHours / 24);
  const hoursLeft = totalHours % 24;
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / SEVEN_DAYS_MS) * 100));

  let text = '';
  if (daysLeft >= 1) {
    text = `Sisa ${daysLeft} hari ${hoursLeft > 0 ? `${hoursLeft} jam` : ''}`;
  } else {
    text = `Sisa ${Math.max(1, hoursLeft)} jam lagi`;
  }

  return {
    isExpired: false,
    daysLeft,
    hoursLeft,
    text,
    badgeLabel: daysLeft >= 1 ? `⏳ Sisa ${daysLeft} Hari` : `⏳ Sisa ${Math.max(1, hoursLeft)} Jam`,
    progressPercent
  };
};

