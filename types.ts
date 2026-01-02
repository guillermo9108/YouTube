
/**
 * Global Type Definitions for StreamPay
 */

export interface Video {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  parent_category?: string;
  collection?: string;
  duration: number;
  thumbnailUrl: string;
  videoUrl: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  createdAt: number;
  views: number;
  likes: number;
  isLocal?: boolean | number | string;
  transcode_status?: 'NONE' | 'WAITING' | 'PROCESSING' | 'FAILED' | 'DONE';
  reason?: string;
  transcode_progress?: number;
  size_fmt?: string;
  vector?: number[]; // Vector de 384 dimensiones (all-MiniLM-L6-v2)
}

export interface Category {
  id: string;
  name: string;
  price: number;
  autoSub: boolean;
  parent?: string | null;
  sortOrder?: 'LATEST' | 'ALPHA' | 'RANDOM' | 'AI_VECTOR'; // Nuevo: Sugerencias por IA
}

export interface User {
  id: string;
  username: string;
  role: string;
  balance: number;
  sessionToken?: string;
  avatarUrl?: string;
  lastActive?: number;
  watchLater: string[];
  autoPurchaseLimit: number;
  interestVector?: number[]; // Perfil semántico del usuario
  vipExpiry?: number;
  // Fix: Add missing properties used in Profile and Admin
  lastDeviceId?: string;
  defaultPrices?: Record<string, number>;
  shippingDetails?: {
    fullName: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
    phoneNumber: string;
  };
}

// Fix: Add missing VideoCategory enum
export enum VideoCategory {
  GENERAL = 'GENERAL',
  MOVIES = 'MOVIES',
  SERIES = 'SERIES',
  SPORTS = 'SPORTS',
  MUSIC = 'MUSIC',
  OTHER = 'OTHER'
}

// Fix: Add missing Comment interface
export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  text: string;
  timestamp: number;
}

// Fix: Add missing UserInteraction interface
export interface UserInteraction {
  liked: boolean;
  disliked: boolean;
  watched: boolean;
  newLikeCount?: number;
}

// Fix: Add missing Transaction interface
export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  timestamp: number;
  recipientId?: string;
  recipientName?: string;
  senderId?: string;
  senderName?: string;
  creatorId?: string;
  videoTitle?: string;
  itemTitle?: string;
  adminFee?: number;
  buyerName?: string;
  sellerName?: string;
}

// Fix: Add missing Notification interface
export interface Notification {
  id: string;
  userId: string;
  text: string;
  type: 'SYSTEM' | 'SALE' | 'UPLOAD' | 'ALERT';
  link: string;
  isRead: boolean;
  timestamp: number;
  avatarUrl?: string;
}

// Fix: Add missing VideoResult interface
export interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  downloadUrl: string;
  source: string;
  author: string;
  duration?: number;
}

// Fix: Add missing ContentRequest interface
export interface ContentRequest {
  id: string;
  userId: string;
  username?: string;
  query: string;
  status: string;
  createdAt: number;
}

// Fix: Add missing Marketplace types
export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  category: string;
  condition: string;
  status: string;
  stock: number;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  images: string[];
  rating?: number;
  reviewCount?: number;
  createdAt: number;
}

export interface CartItem extends MarketplaceItem {
  quantity: number;
}

export interface MarketplaceReview {
  id: string;
  itemId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  rating: number;
  comment: string;
  timestamp: number;
}

// Fix: Add missing Finance request types
export interface BalanceRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  createdAt: number;
  status: string;
}

export interface VipRequest {
  id: string;
  userId: string;
  username: string;
  planId: string;
  planSnapshot: any;
  paymentRef: string;
  status: string;
  createdAt: number;
}

// Fix: Add missing VipPlan and SystemSettings types
export interface VipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  highlight?: boolean;
}

export interface SystemSettings {
  categories: Category[];
  customCategories?: string[];
  categoryPrices?: Record<string, number>;
  videoCommission?: number;
  marketCommission?: number;
  transferFee?: number;
  localLibraryPath?: string;
  batchSize?: number;
  maxResolution?: number;
  downloadStartTime?: string;
  downloadEndTime?: string;
  geminiKey?: string;
  ffmpegPath?: string;
  tropipayClientId?: string;
  tropipayClientSecret?: string;
  currencyConversion?: number;
  vipPlans?: VipPlan[];
  is_transcoder_active?: boolean;
}

// Fix: Add missing Admin utility types
export interface SmartCleanerResult {
  stats: {
    spaceReclaimed: string;
  };
  preview: Array<{
    id: string;
    title: string;
    views: number;
    size_fmt: string;
    reason: string;
  }>;
}

export interface FtpFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
}
