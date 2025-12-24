
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum VideoCategory {
  GENERAL = 'GENERAL',
  OTHER = 'OTHER'
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
    planSnapshot: VipPlan;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: number;
    paymentRef?: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stock: number;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  category: string;
  condition: 'NUEVO' | 'USADO' | 'REACONDICIONADO';
  createdAt: number;
  status: 'ACTIVO' | 'VENDIDO' | 'ELIMINADO' | 'AGOTADO';
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
    cartId?: string;
    quantity: number;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  balance: number;
  autoPurchaseLimit: number; 
  watchLater: string[]; 
  sessionToken?: string; 
  avatarUrl?: string; 
  lastActive?: number;
  lastDeviceId?: string;
  vipExpiry?: number;
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

export interface Video {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl: string;
  videoUrl: string;
  creatorId: string;
  creatorName: string;
  views: number;
  createdAt: number;
  likes: number;
  dislikes: number;
  category: string; 
  duration: number; 
  fileHash?: string; 
  creatorAvatarUrl?: string;
  isLocal?: boolean; 
  // Mantenimiento y Transcodificación
  reason?: string;
  size_fmt?: string;
  transcode_status?: 'NONE' | 'WAITING' | 'PROCESSING' | 'DONE' | 'FAILED';
  needs_transcode?: boolean;
}

export interface Transaction {
  id: string;
  buyerId: string;
  creatorId: string | null;
  videoId: string | null; 
  marketplaceItemId?: string; 
  amount: number;
  adminFee?: number;
  timestamp: number;
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE' | 'VIP';
  shippingData?: {
      fullName: string;
      address: string;
      city: string;
      zipCode: string;
      country: string;
      phoneNumber: string;
  };
  fulfillmentStatus?: 'PENDING' | 'SHIPPED';
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  userAvatarUrl?: string;
}

export interface UserInteraction {
  userId: string;
  videoId: string;
  liked: boolean;
  disliked: boolean;
  isWatched: boolean;
  newLikeCount?: number;
  newDislikeCount?: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ContentRequest {
  id: string;
  userId: string;
  username: string;
  query: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'MANUAL_UPLOAD';
  createdAt: number;
  useLocalNetwork: boolean; 
}

export interface BalanceRequest {
    id: string;
    userId: string;
    username: string; 
    amount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: number;
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
}

export interface Notification {
  id: string;
  userId: string; 
  type: 'UPLOAD' | 'SYSTEM' | 'SALE';
  text: string;
  link: string; 
  isRead: boolean;
  timestamp: number;
  avatarUrl?: string; 
}

export interface SaleRecord {
  id: string;
  amount: number;
  adminFee?: number;
  itemImage?: string;
  itemTitle: string;
  buyerAvatar?: string;
  buyerName: string;
  timestamp: number;
  fulfillmentStatus?: string;
  shippingData?: {
      fullName: string;
      address: string;
      city: string;
      zipCode: string;
      country: string;
      phoneNumber: string;
  };
}

export interface VideoResult {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    source: 'Pexels' | 'Pixabay' | 'YouTube';
    author: string;
    downloadUrl: string;
}

export interface FtpFile {
    name: string;
    type: 'dir' | 'file';
    size: string;
    path: string;
}

// Fixed missing export for OrganizeResult interface
export interface OrganizeResult {
    processed: number;
    remaining: number;
}

// Fixed missing export for SmartCleanerResult interface
export interface SmartCleanerResult {
    preview: Video[];
    stats: {
        spaceReclaimed: string;
    };
}
