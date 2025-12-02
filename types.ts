
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

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  balance: number;
  autoPurchaseLimit: number; // Default 1
  watchLater: string[]; // Video IDs
  sessionToken?: string; // New: For single session enforcement
  avatarUrl?: string; // New: Profile Picture
  defaultPrices?: Record<string, number>; // New: User specific price overrides
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
  category: string; // Changed from VideoCategory to string to support custom ones
  duration: number; // Seconds
  fileHash?: string; // New: MD5 Hash for deduplication
  creatorAvatarUrl?: string;
  isLocal?: boolean; // New: Flag for local NAS files
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
  status: 'ACTIVE' | 'SOLD';
  createdAt: number;
}

export interface Transaction {
  id: string;
  buyerId: string;
  creatorId: string | null;
  videoId: string | null;
  amount: number;
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

export interface SystemSettings {
  downloadStartTime: string; 
  downloadEndTime: string;   
  isQueuePaused: boolean;
  batchSize: number;         
  maxDuration: number;       
  maxResolution: number;     
  pexelsKey: string;
  pixabayKey: string;
  ytDlpPath: string;    // New: Path to yt-dlp binary
  enableYoutube: boolean; // New: Toggle for YouTube features
  categoryPrices: Record<string, number>; // New: Global default prices
  customCategories: string[]; // New: List of admin added categories
  localLibraryPath: string; // New: Path to local NAS video folder
}

export interface SmartCleanerResult {
  preview: Video[];
  stats: {
    totalVideos: number;
    videosToDelete: number;
    spaceReclaimed: string; // Estimate
  }
}

export interface Notification {
  id: string;
  userId: string; // The recipient
  type: 'UPLOAD' | 'SYSTEM';
  text: string;
  link: string; // URL to go to
  isRead: boolean;
  timestamp: number;
  avatarUrl?: string; // Optional image for the notif
}