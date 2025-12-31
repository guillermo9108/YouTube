
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
    PROCESSING = 'PROCESSING',
    FAILED_METADATA = 'FAILED_METADATA'
}

export interface CategoryConfig {
    id: string;
    name: string;
    price: number;
    folderPatterns: string[];       // Palabras clave en la ruta
    namePatterns: string[];         // Palabras clave en el archivo
    autoGroupFolders: boolean;      // NUEVO: ¿Usar nombres de subcarpetas como categorías?
    children?: CategoryConfig[];    // Subcategorías manuales
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
  transcode_status?: 'NONE' | 'WAITING' | 'PROCESSING' | 'FAILED' | 'DONE';
  reason?: string;
  size_fmt?: string;
  transcode_progress?: number;
  needs_transcode?: boolean | number;
  processing_attempts?: number;
  fileHash?: string;
}

export interface Transaction {
  id: string;
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE' | 'VIP' | 'VIP_REVENUE' | 'TRANSFER_SENT' | 'TRANSFER_RECV';
  amount: number | string;
  buyerId?: string;
  buyerName?: string;
  creatorId?: string;
  videoTitle?: string;
  itemTitle?: string;
  timestamp: number;
  adminFee?: number | string;
  recipientName?: string;
  senderName?: string;
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

export interface FtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  rootPath: string;
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
  customCategories: any; 
  localLibraryPath: string; 
  videoCommission: number;
  marketCommission: number;
  transferFee: number;
  vipPlans?: VipPlan[];
  paymentInstructions?: string;
  currencyConversion: number;
  enableDebugLog?: boolean;
  autoTranscode?: boolean;
  transcodePreset?: string;
  proxyUrl?: string;
  paqueteMapper?: any;
  is_transcoder_active?: boolean;
  ftpSettings?: FtpSettings;
}

// Add missing exports for entities used in other files
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

export interface Notification {
  id: string;
  userId: string;
  type: 'SALE' | 'UPLOAD' | 'SYSTEM';
  text: string;
  link: string;
  isRead: boolean;
  timestamp: number;
  avatarUrl?: string;
  metadata?: any;
}

export interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  downloadUrl: string;
  source: string;
  author: string;
  duration?: number;
}

export interface ContentRequest {
  id: string;
  userId: string;
  query: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: number;
  isVip: boolean;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stock: number;
  category: string;
  condition: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  createdAt: number;
  status: 'ACTIVO' | 'AGOTADO' | 'ELIMINADO';
  rating?: number;
  reviewCount?: number;
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

export interface CartItem extends MarketplaceItem {
  quantity: number;
}

export interface BalanceRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
}

export interface VipRequest {
  id: string;
  userId: string;
  username: string;
  planId: string;
  planSnapshot: string | any;
  paymentRef?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
}

export interface SmartCleanerResult {
  preview: Video[];
  stats: {
    spaceReclaimed: string;
    count: number;
  };
}

export interface FtpFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
}
