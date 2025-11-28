
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
  category: VideoCategory; // New
  duration: number; // Seconds
  fileHash?: string; // New: MD5 Hash for deduplication
}

export interface Transaction {
  id: string;
  buyerId: string;
  creatorId: string | null;
  videoId: string | null;
  amount: number;
  timestamp: number;
  type: 'PURCHASE' | 'DEPOSIT';
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface UserInteraction {
  userId: string;
  videoId: string;
  liked: boolean;
  disliked: boolean;
  isWatched: boolean;
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
}
