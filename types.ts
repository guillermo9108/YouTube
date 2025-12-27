
/**
 * Global Type Definitions for StreamPay
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum VideoCategory {
  GENERAL = 'GENERAL',
  MOVIES = 'MOVIES',
  SERIES = 'SERIES',
  SPORTS = 'SPORTS',
  MUSIC = 'MUSIC',
  OTHER = 'OTHER',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING'
}

export interface User {
  id: string;
  username: string;
  role: UserRole | string;
  balance: number;
  sessionToken?: string;
  avatarUrl?: string;
  lastActive?: number;
  lastDeviceId?: string;
  watchLater: string[];
  autoPurchaseLimit: number;
  defaultPrices?: Record<string, number>;
  shippingDetails?: any;
  vipExpiry?: number;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
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
  transcode_status?: 'WAITING' | 'PROCESSING' | 'FAILED' | 'DONE';
  reason?: string;
  size_fmt?: string;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  text: string;
  timestamp: number;
}

export interface UserInteraction {
  liked: boolean;
  disliked: boolean;
  isWatched: boolean;
  newLikeCount?: number;
}

export interface SaleRecord {
  id: string;
  amount: number;
  adminFee?: number;
  itemImage?: string;
  itemTitle?: string;
  buyerAvatar?: string;
  buyerName?: string;
  timestamp: number;
  fulfillmentStatus?: string;
  shippingData?: any;
}

export interface Transaction {
  id: string;
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE' | 'VIP' | 'VIP_REVENUE';
  amount: number | string;
  buyerId?: string;
  buyerName?: string;
  creatorId?: string;
  videoTitle?: string;
  itemTitle?: string;
  timestamp: number;
  adminFee?: number | string;
}

export interface Notification {
  id: string;
  text: string;
  type: 'SALE' | 'UPLOAD' | 'SYSTEM';
  timestamp: number;
  isRead: boolean;
  link: string;
  avatarUrl?: string;
}

export interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  downloadUrl: string;
  source: string;
  author?: string;
  duration?: number;
}

export interface ContentRequest {
  id: string;
  userId: string;
  username?: string;
  query: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  createdAt: number;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stock?: number;
  condition: 'NUEVO' | 'USADO' | 'REACONDICIONADO' | string;
  category: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  images: string[];
  status: 'ACTIVO' | 'AGOTADO' | 'ELIMINADO' | string;
  rating?: number;
  reviewCount?: number;
  createdAt: number;
}

export interface CartItem extends MarketplaceItem {
  // quantity added manually for Cart UI
  quantity: number;
}

export interface MarketplaceReview {
  id: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  rating: number;
  comment: string;
  timestamp: number;
}

export interface BalanceRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  createdAt: number;
}

export interface VipPlan {
  id: string;
  name: string;
  price: number;
  type: 'ACCESS' | 'BALANCE';
  durationDays?: number;
  bonusPercent?: number;
  description?: string;
  highlight?: boolean;
}

export interface VipRequest {
  id: string;
  userId: string;
  username: string;
  planSnapshot: any;
  paymentRef: string;
  createdAt: number;
}

export interface FtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  rootPath: string;
}

export interface FtpFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
}

export interface OrganizeResult {
  processed: number;
  remaining: number;
}

export interface SmartCleanerResult {
  preview: Video[];
  stats: {
    spaceReclaimed: string;
  };
}

export interface SystemSettings {
  downloadStartTime: string; 
  downloadEndTime: string;   
  isQueuePaused: boolean;
  batchSize: number;         
  maxDuration: number;       
  maxResolution: number;     
  pexelsKey: string;
  pixabayKey: string;
  geminiKey: string;
  ytDlpPath: string;
  ffmpegPath: string;
  enableYoutube: boolean; 
  categoryPrices: Record<string, number>; 
  customCategories: string[]; 
  localLibraryPath: string; 
  ftpSettings?: FtpSettings;
  videoCommission: number;
  marketCommission: number;
  vipPlans?: VipPlan[];
  paymentInstructions?: string;
  tropipayClientId?: string;
  tropipayClientSecret?: string;
  currencyConversion?: number;
  proxyUrl?: string;
  paqueteMapper?: Record<string, string>;
  autoTranscode?: boolean;
  transcodePreset?: string;
  is_transcoder_active?: boolean;
  enableDebugLog?: boolean;
}
