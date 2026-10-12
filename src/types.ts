// ─── Article Types ───────────────────────────────────────────────
export interface Article {
  id: string;
  title: string;
  author: string;
  source?: string;
  category?: string;
  excerpt: string;
  readTime: string;
  contentType: 'text' | 'pdf';
  content?: string;
  pdfUrl?: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  createdAt: string;
  color: string;
  icon: string;
}

// ─── Mission Types ────────────────────────────────────────────────
export type MissionType = 'login' | 'scan' | 'read_article' | 'photo_proof' | 'deposit' | 'quiz';
export type MissionStatus = 'scheduled' | 'active' | 'expired';
export type ProofStatus = 'pending_review' | 'approved' | 'rejected';

export interface QuizQuestion {
  id: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correctAnswer: 'a' | 'b' | 'c' | 'd';
}

export interface MissionProof {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  missionId: string;
  imageUrl: string;
  submittedAt: string;
  status: ProofStatus;
  rejectedReason?: string;
  progressIndex: number;    // which step this proof is for (0-based)
}

export interface MissionProgress {
  missionId: string;
  userId: string;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  claimedAt?: string;
  articlesRead: string[];
  proofs: MissionProof[];
  proofImages: string[];        // base64 foto bukti yang sudah approved
  pendingProofImage?: string;   // foto bukti menunggu review admin
  proofStatus?: 'pending_review' | 'approved' | 'rejected'; // status review terkini
  startedAt: string;
  quizScore?: number;           // untuk tipe quiz
  quizAnswers?: Record<string, string>; // questionId -> selected answer
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;           // e.g. 3 (times) or 1 for quiz completion
  rewardPoints: number;
  minReadMinutes?: number;  // for read_article type (default 2)
  status: MissionStatus;
  launchAt: string;         // ISO string — when to go live
  expiresAt: string;        // ISO string — 24h after launchAt
  createdAt: string;
  icon: string;             // emoji
  // Quiz-specific fields
  questions?: QuizQuestion[];
  timeLimitSeconds?: number;
}

// ─── User & Activity Types ─────────────────────────────────────────
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'success' | 'warning' | 'info';
  isRead: boolean;
  depositId?: string;
  userName?: string;
  depositItems?: { category: string; name?: string; weight: number; points: number }[];
  totalWeight?: number;
  totalPoints?: number;
}

export interface ScanHistoryItem {
  id: string;
  name: string;
  category: string;
  date: string;
  impact: { co2: number; water: number; energy: number };
  image?: string;
}

export interface DepositHistoryItem {
  id: string;
  date: string;
  items: { category: string; weight: number; points: number }[];
  totalPoints: number;
  totalWeight: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  image?: string;
  photoUrl?: string;
  proofImage?: string;
  location?: string;
  userEmail?: string;
  userUid?: string;
}

export interface ClaimHistoryItem {
  id: string;
  title: string;
  points: number;
  date: string;
  status: 'Pending' | 'Success' | 'Rejected';
  userEmail?: string;
  userUid?: string;
}

export interface UserData {
  uid?: string;
  email: string;
  displayName: string;
  role?: string;
  institutionId?: string;
  institutionCode?: string;
  qrToken?: string;
  points: number;
  scans: number;
  level: string;
  streak: number;
  lastLogin: string;
  mascotName: string;
  isBanned?: boolean;
  history: { date: string; co2: number; water: number; energy: number }[];
  scanHistory: ScanHistoryItem[];
  claimHistory: ClaimHistoryItem[];
  depositHistory: DepositHistoryItem[];
  notifications: NotificationItem[];
}