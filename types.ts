
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
  parent_category?: string; // Nuevo: Categoría raíz o padre
  collection?: string;      // Nuevo: Identificador de grupo (carpeta)
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

// Added VipPlan interface to fix Module '"../types"' has no exported member 'VipPlan'
export interface VipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  highlight?: boolean;
  type?: 'ACCESS' | 'BONUS';
  bonusPercent?: number;
}

// Added FtpSettings interface for SystemSettings
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
  customCategories: string[]; 
  categoryHierarchy?: string; // Nuevo: JSON String con el árbol de categorías
  autoGroupFolders?: boolean | number; // Nuevo: Switch para agrupar videos automáticamente
  localLibraryPath: string; 
  videoCommission: number;
  marketCommission: number;
  transferFee?: number;
  // Fixed: Update vipPlans type and add missing properties used in admin pages
  vipPlans?: VipPlan[];
  ftpSettings?: FtpSettings;
  is_transcoder_active?: boolean | number;
  is_transcoding?: boolean | number;
  paymentInstructions?: string;
  currencyConversion?: number;
  enableDebugLog?: boolean;
  // Fix: Added missing properties used in AdminConfig to resolve type errors
  autoTranscode?: boolean | number;
  tropipayClientId?: string;
  tropipayClientSecret?: string;
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
    text: string;
    type: 'SALE' | 'UPLOAD' | 'SYSTEM';
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
    username?: string;
}

export interface MarketplaceItem {
    id: string;
    title: string;
    description: string;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    stock?: number;
    category?: string;
    condition?: string;
    sellerId: string;
    sellerName: string;
    sellerAvatarUrl?: string;
    images?: string[];
    status?: 'ACTIVO' | 'AGOTADO' | 'ELIMINADO';
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

export interface BalanceRequest {
    id: string;
    userId: string;
    username: string;
    amount: number;
    createdAt: number;
}

export interface VipRequest {
    id: string;
    userId: string;
    username: string;
    planSnapshot: any;
    paymentRef?: string;
    createdAt: number;
}

export interface SmartCleanerResult {
    preview: Video[];
    stats: {
        spaceReclaimed: string;
    };
}

export interface FtpFile {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size?: string;
}
