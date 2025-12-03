
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum VideoCategory {
  SHORTS = 'SHORTS',
  MUSIC = 'MUSIC',
  SHORT_FILM = 'SHORT_FILM',
  SERIES = 'SERIES',
  NOVELAS = 'NOVELAS',
  MOVIE = 'MOVIE',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER'
}

export interface ShippingDetails {
  fullName: string;
  phoneNumber: string;
  address: string;
  bankAccount?: string;
  notes?: string;
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
  shippingDetails?: ShippingDetails; 
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

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  media: { type: 'image' | 'video', url: string }[];
  status: 'ACTIVE' | 'SOLD' | 'OUT_OF_STOCK';
  createdAt: number;
  stock: number;         // New: Quantity available
  discountPercent: number; // New: 0-100
  salesCount: number;    // New: For "Best Seller" logic
}

export interface CartItem extends MarketplaceItem {
  cartQuantity: number;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string; // Grouped by seller usually, but for simplicity flattened
  items: { itemId: string, title: string, price: number, quantity: number }[];
  totalAmount: number;
  shippingData: {
    name: string;
    bankAccount?: string;
    phoneNumber?: string;
    address?: string;
    notes?: string;
  };
  timestamp: number;
  status: 'COMPLETED' | 'REFUNDED';
}

export interface Transaction {
  id: string;
  buyerId: string;
  creatorId: string | null;
  videoId: string | null;
  amount: number;
  timestamp: number;
  type: 'PURCHASE' | 'DEPOSIT' | 'MARKETPLACE';
  orderId?: string; // Link to the order
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
  serverUploadLimit?: number; // In Bytes
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
  type: 'UPLOAD' | 'SYSTEM';
  text: string;
  link: string; 
  isRead: boolean;
  timestamp: number;
  avatarUrl?: string; 
}
