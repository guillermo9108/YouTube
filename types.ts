
/**
 * Global Type Definitions for StreamPay
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

/* Added VideoCategory enum as required by Upload.tsx and others */
export enum VideoCategory {
  GENERAL = 'GENERAL',
  MOVIES = 'MOVIES',
  SERIES = 'SERIES',
  SPORTS = 'SPORTS',
  MUSIC = 'MUSIC',
  OTHER = 'OTHER'
}

export interface Category {
  id: string;
  name: string;
  price: number;
  autoSub: boolean; // Activar subcategorías automáticas por carpeta
  parent?: string | null;
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
  size_fmt?: string; // Formatted size for admin panels (e.g. "1.2 GB")
}

/* Added Comment interface as required by Watch.tsx and Shorts.tsx */
export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  text: string;
  timestamp: number;
}

/* Added UserInteraction interface as required by Watch.tsx and Shorts.tsx */
export interface UserInteraction {
  liked: boolean;
  disliked: boolean;
  newLikeCount?: number;
}

export interface VipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  highlight?: boolean;
}

export interface SystemSettings {
  downloadStartTime: string; 
  downloadEndTime: string;   
  isQueuePaused: boolean;
  batchSize: number;         
  maxDuration: number;       
  geminiKey: string;
  ytDlpPath: string;
  ffmpegPath: string;
  categories: Category[]; // Cambio crítico: Ahora es una lista de objetos
  localLibraryPath: string; 
  videoCommission: number;
  marketCommission: number;
  transferFee?: number;
  vipPlans?: VipPlan[];
  paymentInstructions?: string;
  currencyConversion?: number;
  enableDebugLog?: boolean;
  autoTranscode?: boolean | number;
  tropipayClientId?: string;
  tropipayClientSecret?: string;
  /* Added missing properties used in Admin panels and Upload */
  customCategories?: string[];
  categoryPrices?: Record<string, number>;
  ftpSettings?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    rootPath: string;
  };
  is_transcoder_active?: boolean;
}

export interface Transaction {
  id: string;
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE' | 'VIP' | 'TRANSFER_SENT' | 'TRANSFER_RECV';
  amount: number | string;
  buyerId?: string;
  videoTitle?: string;
  timestamp: number;
  recipientName?: string;
  senderName?: string;
  creatorId?: string; // Used in Profile logic
}

export interface Notification {
    id: string;
    userId: string;
    text: string;
    type: 'SALE' | 'UPLOAD' | 'SYSTEM';
    link: string;
    isRead: boolean;
    timestamp: number;
    metadata?: any;
    /* Added avatarUrl property as required by Layout.tsx */
    avatarUrl?: string;
}

/* Added VideoResult interface as required by Requests.tsx */
export interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  downloadUrl: string;
  source: string;
  author: string;
  duration?: number;
}

/* Added ContentRequest interface as required by Requests.tsx and AdminRequests.tsx */
export interface ContentRequest {
  id: string;
  userId: string;
  username?: string;
  query: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  createdAt: number;
  isVip: boolean;
}

export interface MarketplaceItem {
    id: string;
    title: string;
    description: string;
    price: number;
    originalPrice?: number;
    stock?: number;
    category?: string;
    condition?: string;
    sellerId: string;
    sellerName: string;
    images?: string[];
    status?: 'ACTIVO' | 'AGOTADO' | 'ELIMINADO';
    /* Added missing properties used in Marketplace and Edit pages */
    createdAt: number;
    discountPercent?: number;
    rating?: number;
    reviewCount?: number;
    sellerAvatarUrl?: string;
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

/* Added SmartCleanerResult interface as required by AdminMaintenance.tsx */
export interface SmartCleanerResult {
  preview: any[];
  stats: {
    spaceReclaimed: string;
  };
}

/* Added FtpFile interface as required by AdminFtp.tsx */
export interface FtpFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
}
