
/**
 * Global Type Definitions for StreamPay
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// Added VideoCategory enum for upload and library management
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
  // Backend dynamic properties
  size_fmt?: string;
  transcode_progress?: number;
  needs_transcode?: boolean | number;
  processing_attempts?: number;
  fileHash?: string;
  collection?: string; // Added missing collection property
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

// Added Comment interface for video discussions
export interface Comment {
    id: string;
    userId: string;
    username: string;
    userAvatarUrl?: string;
    text: string;
    timestamp: number;
}

// Added UserInteraction for tracking likes and watch status
export interface UserInteraction {
    liked: boolean;
    disliked: boolean;
    isWatched: boolean;
    newLikeCount?: number;
}

// Added Notification for system and user events
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

// Added VideoResult for external search results
export interface VideoResult {
    id: string;
    title: string;
    thumbnail: string;
    downloadUrl: string;
    source: string;
    author: string;
    duration?: number;
}

// Added ContentRequest for user-submitted content ideas
export interface ContentRequest {
    id: string;
    userId: string;
    query: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    createdAt: number;
    username?: string;
}

// Added MarketplaceItem for the store
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

// Added CartItem for shopping cart management
export interface CartItem extends MarketplaceItem {
    quantity: number;
}

// Added MarketplaceReview for product feedback
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

// Added BalanceRequest for tracking pending deposits
export interface BalanceRequest {
    id: string;
    userId: string;
    username: string;
    amount: number;
    createdAt: number;
}

// Added VipRequest for tracking pending membership activations
export interface VipRequest {
    id: string;
    userId: string;
    username: string;
    planSnapshot: any;
    paymentRef?: string;
    createdAt: number;
}

// Added SmartCleanerResult for system maintenance tools
export interface SmartCleanerResult {
    preview: Video[];
    stats: {
        spaceReclaimed: string;
    };
}

// Added FtpFile for remote file browsing
export interface FtpFile {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size?: string;
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
  videoCommission: number;
  marketCommission: number;
  transferFee?: number;
  vipPlans?: VipPlan[];
  paymentInstructions?: string;
  currencyConversion?: number;
  enableDebugLog?: boolean;
  // Added missing settings for transcoding and FTP integration
  autoTranscode?: boolean;
  transcodePreset?: string;
  proxyUrl?: string;
  is_transcoder_active?: boolean;
  ftpSettings?: {
      host: string;
      port: number;
      user: string;
      pass: string;
      rootPath: string;
  };
  // Added missing fields for hierarchy and organization
  categoryHierarchy?: string;
  autoGroupFolders?: boolean | number;
}
