export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
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
  // Computed fields from DB
  likes: number;
  dislikes: number;
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