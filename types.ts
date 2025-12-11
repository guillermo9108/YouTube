
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum VideoCategory {
  SHORTS = 'SHORTS',
  MUSIC = 'MUSICA',
  SHORT_FILM = 'CORTOMETRAJE',
  SERIES = 'SERIES',
  NOVELAS = 'NOVELAS',
  MOVIE = 'PELICULA',
  EDUCATION = 'EDUCACION',
  OTHER = 'OTRO'
}

export interface VipPlan {
    id: string;
    name: string;
    price: number;
    type: 'ACCESS' | 'BALANCE'; // ACCESS = Dias ilimitados, BALANCE = Saldo extra
    durationDays?: number; // Solo para ACCESS
    bonusPercent?: number; // Solo para BALANCE
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
    paymentRef?: string; // ID de transacción externa
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number; // Para mostrar tachado
  discountPercent?: number; // % de descuento
  stock: number; // Cantidad disponible
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  category: string;
  condition: 'NUEVO' | 'USADO' | 'REACONDICIONADO';
  createdAt: number;
  status: 'ACTIVO' | 'VENDIDO' | 'ELIMINADO' | 'AGOTADO';
  rating?: number; // Promedio de estrellas
  reviewCount?: number;
}

export interface MarketplaceReview {
  id: string;
  itemId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  rating: number; // 1-5
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
  vipExpiry?: number; // Timestamp de expiración VIP (0 o null si no es VIP)
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
}

export interface Transaction {
  id: string;
  buyerId: string;
  creatorId: string | null;
  videoId: string | null; 
  marketplaceItemId?: string; 
  amount: number;
  adminFee?: number; // Nueva: Comisión cobrada
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
  ytDlpPath: string;    
  enableYoutube: boolean; 
  categoryPrices: Record<string, number>; 
  customCategories: string[]; 
  localLibraryPath: string; 
  ftpSettings?: FtpSettings;
  videoCommission: number; // Percentage (0-100)
  marketCommission: number; // Percentage (0-100)
  vipPlans?: VipPlan[];
  paymentInstructions?: string;
  // Gateways
  tropipayClientId?: string;
  tropipayClientSecret?: string;
  currencyConversion?: number; // 1 USD/EUR = X Saldo
}

export interface OrganizeResult {
  processed: number;
  renamed: number;
  categorized: number;
  details: string[];
  remaining?: number;
}

export interface SmartCleanerResult {
  preview: Video[];
  stats: {
    totalVideos: number;
    videosToDelete: number;
    spaceReclaimed: string; 
  }
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
