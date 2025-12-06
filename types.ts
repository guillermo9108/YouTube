

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
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE';
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