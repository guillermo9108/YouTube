import { User, Video, Transaction, UserRole, Comment, UserInteraction } from '../types';

const SEED_VIDEOS: Video[] = [
  {
    id: 'v1',
    title: 'Big Buck Bunny',
    description: 'A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel.',
    price: 1,
    thumbnailUrl: 'https://picsum.photos/id/237/800/450',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    creatorId: 'u1',
    creatorName: 'Demo Creator',
    views: 120,
    createdAt: Date.now() - 10000000,
    likes: 12,
    dislikes: 1
  },
  {
    id: 'v2',
    title: 'Elephant Dream',
    description: 'The world\'s first open movie, made entirely with open source graphics software.',
    price: 5,
    thumbnailUrl: 'https://picsum.photos/id/238/800/450',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    creatorId: 'u2',
    creatorName: 'Indie Artist',
    views: 55,
    createdAt: Date.now() - 5000000,
    likes: 45,
    dislikes: 2
  }
];

const K_INSTALLED = 'sp_installed'; // New flag
const K_DB_CONFIG = 'sp_db_config'; // Mock DB config
const K_USERS = 'sp_users';
const K_VIDEOS = 'sp_videos';
const K_TXS = 'sp_transactions';
const K_PURCHASES = 'sp_purchases';
const K_COMMENTS = 'sp_comments';
const K_INTERACTIONS = 'sp_interactions';

class DatabaseService {
  private users: User[] = [];
  private videos: Video[] = [];
  private transactions: Transaction[] = [];
  private purchases: Record<string, string[]> = {};
  private comments: Comment[] = [];
  private interactions: Record<string, UserInteraction> = {};
  private isInstalled: boolean = false;

  constructor() {
    this.load();
  }

  // --- Setup & Config Methods ---

  public needsSetup(): boolean {
    return !this.isInstalled;
  }

  public async verifyDbConnection(config: any): Promise<boolean> {
    // Simulate a network request to MariaDB
    await new Promise(r => setTimeout(r, 1500));
    // In a real backend app, we would test the connection here.
    return true; 
  }

  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> {
    await new Promise(r => setTimeout(r, 2000)); // Simulate table creation

    // 1. Save Config
    localStorage.setItem(K_DB_CONFIG, JSON.stringify(dbConfig));
    
    // 2. Clear existing data (Fresh Install)
    this.users = [];
    this.videos = SEED_VIDEOS; // Restore seed videos for content
    this.transactions = [];
    this.purchases = {};
    this.comments = [];
    this.interactions = {};

    // 3. Create Admin
    const admin: User = {
      id: 'admin_' + Math.random().toString(36).substr(2, 5),
      username: adminUser.username || 'admin',
      password: adminUser.password || 'admin',
      role: UserRole.ADMIN,
      balance: 999999,
      autoPurchaseLimit: 5,
      watchLater: []
    };
    this.users.push(admin);

    // 4. Mark as installed
    this.isInstalled = true;
    localStorage.setItem(K_INSTALLED, 'true');
    this.save();
  }

  // --- Internal Load/Save ---

  private load() {
    const installed = localStorage.getItem(K_INSTALLED);
    
    if (installed === 'true') {
      this.isInstalled = true;
      const u = localStorage.getItem(K_USERS);
      const v = localStorage.getItem(K_VIDEOS);
      const t = localStorage.getItem(K_TXS);
      const p = localStorage.getItem(K_PURCHASES);
      const c = localStorage.getItem(K_COMMENTS);
      const i = localStorage.getItem(K_INTERACTIONS);

      this.users = u ? JSON.parse(u) : [];
      this.videos = v ? JSON.parse(v) : [];
      this.transactions = t ? JSON.parse(t) : [];
      this.purchases = p ? JSON.parse(p) : {};
      this.comments = c ? JSON.parse(c) : [];
      this.interactions = i ? JSON.parse(i) : {};
    } else {
      this.isInstalled = false;
      // We do not load seed data here anymore, we wait for Setup
    }
  }

  private save() {
    localStorage.setItem(K_USERS, JSON.stringify(this.users));
    localStorage.setItem(K_VIDEOS, JSON.stringify(this.videos));
    localStorage.setItem(K_TXS, JSON.stringify(this.transactions));
    localStorage.setItem(K_PURCHASES, JSON.stringify(this.purchases));
    localStorage.setItem(K_COMMENTS, JSON.stringify(this.comments));
    localStorage.setItem(K_INTERACTIONS, JSON.stringify(this.interactions));
  }

  private getInteractionKey(userId: string, videoId: string) {
    return `${userId}_${videoId}`;
  }

  // --- Auth ---

  async login(username: string, password: string): Promise<User> {
    await new Promise(r => setTimeout(r, 500));
    const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) throw new Error("Invalid username or password");
    if (user.password && user.password !== password) throw new Error("Invalid username or password");
    
    // Legacy migration: ensure new fields exist
    if (typeof user.autoPurchaseLimit === 'undefined') user.autoPurchaseLimit = 1;
    if (!user.watchLater) user.watchLater = [];
    
    return user;
  }

  async register(username: string, password: string): Promise<User> {
    await new Promise(r => setTimeout(r, 500));
    if (this.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("Username taken");
    }
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      password,
      role: UserRole.USER,
      balance: 0,
      autoPurchaseLimit: 1,
      watchLater: []
    };
    this.users.push(newUser);
    this.save();
    return newUser;
  }

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
    const idx = this.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates };
      this.save();
    }
  }

  // --- Video & Interaction ---

  getAllVideos(): Video[] {
    return [...this.videos].sort((a, b) => b.createdAt - a.createdAt);
  }

  getVideo(id: string): Video | undefined {
    // Re-calculate likes/dislikes from interactions for accuracy
    const v = this.videos.find(v => v.id === id);
    if (v) {
      let likes = 0;
      let dislikes = 0;
      Object.values(this.interactions).forEach(i => {
        if (i.videoId === id) {
          if (i.liked) likes++;
          if (i.disliked) dislikes++;
        }
      });
      return { ...v, likes, dislikes };
    }
    return undefined;
  }

  getRelatedVideos(currentVideoId: string): Video[] {
    // Logic: Same creator first, then random
    const current = this.getVideo(currentVideoId);
    if (!current) return this.getAllVideos().slice(0, 5);

    const sameCreator = this.videos.filter(v => v.creatorId === current.creatorId && v.id !== currentVideoId);
    const others = this.videos.filter(v => v.creatorId !== current.creatorId && v.id !== currentVideoId);
    
    return [...sameCreator, ...others].slice(0, 8); // Return 8 candidates
  }

  hasPurchased(userId: string, videoId: string): boolean {
    const userPurchases = this.purchases[userId] || [];
    const video = this.getVideo(videoId);
    if (video && video.creatorId === userId) return true;
    return userPurchases.includes(videoId);
  }

  getInteraction(userId: string, videoId: string): UserInteraction {
    const key = this.getInteractionKey(userId, videoId);
    if (!this.interactions[key]) {
      this.interactions[key] = { userId, videoId, liked: false, disliked: false, isWatched: false };
    }
    return this.interactions[key];
  }

  async toggleLike(userId: string, videoId: string, isLike: boolean): Promise<UserInteraction> {
    const key = this.getInteractionKey(userId, videoId);
    const interaction = this.getInteraction(userId, videoId);

    if (isLike) {
      interaction.liked = !interaction.liked;
      interaction.disliked = false;
    } else {
      interaction.disliked = !interaction.disliked;
      interaction.liked = false;
    }
    
    this.interactions[key] = interaction;
    this.save();
    return interaction;
  }

  async markWatched(userId: string, videoId: string): Promise<void> {
    const key = this.getInteractionKey(userId, videoId);
    const interaction = this.getInteraction(userId, videoId);
    if (!interaction.isWatched) {
      interaction.isWatched = true;
      this.interactions[key] = interaction;
      this.save();
    }
  }

  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> {
    const user = this.users.find(u => u.id === userId);
    if (!user) return [];

    if (user.watchLater.includes(videoId)) {
      user.watchLater = user.watchLater.filter(id => id !== videoId);
    } else {
      user.watchLater.push(videoId);
    }
    this.save();
    return user.watchLater;
  }

  // --- Comments ---

  getComments(videoId: string): Comment[] {
    return this.comments.filter(c => c.videoId === videoId).sort((a, b) => b.timestamp - a.timestamp);
  }

  async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      videoId,
      userId,
      username: user.username,
      text,
      timestamp: Date.now()
    };
    this.comments.unshift(newComment);
    this.save();
    return newComment;
  }

  // --- Transactions ---

  async purchaseVideo(userId: string, videoId: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    const video = this.videos.find(v => v.id === videoId);

    if (!user || !video) throw new Error("Invalid request");
    if (user.balance < video.price) throw new Error("Insufficient Saldo");
    if (this.hasPurchased(userId, videoId)) return;

    user.balance -= video.price;
    const creator = this.users.find(u => u.id === video.creatorId);
    if (creator) creator.balance += video.price;

    if (!this.purchases[userId]) this.purchases[userId] = [];
    this.purchases[userId].push(videoId);

    const tx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      buyerId: userId,
      creatorId: video.creatorId,
      videoId: video.id,
      amount: video.price,
      timestamp: Date.now(),
      type: 'PURCHASE'
    };
    this.transactions.push(tx);
    this.save();
  }

  async uploadVideo(title: string, description: string, price: number, creator: User, file: File | null): Promise<Video> {
    await new Promise(r => setTimeout(r, 800));
    const videoUrl = file ? URL.createObjectURL(file) : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    
    const newVideo: Video = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description,
      price: isNaN(price) ? 1 : price,
      thumbnailUrl: `https://picsum.photos/seed/${Math.random()}/800/450`,
      videoUrl,
      creatorId: creator.id,
      creatorName: creator.username,
      views: 0,
      createdAt: Date.now(),
      likes: 0,
      dislikes: 0
    };

    this.videos.unshift(newVideo);
    this.save();
    return newVideo;
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> {
    this.videos.forEach(v => {
      if (v.creatorId === creatorId) v.price = newPrice;
    });
    this.save();
  }

  getAllUsers(): User[] { return this.users; }
  
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> {
    const admin = this.users.find(u => u.id === adminId);
    if (!admin || admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    const target = this.users.find(u => u.id === targetUserId);
    if (!target) throw new Error("User not found");

    target.balance += amount;
    const tx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      buyerId: targetUserId,
      creatorId: null,
      videoId: null,
      amount: amount,
      timestamp: Date.now(),
      type: 'DEPOSIT'
    };
    this.transactions.push(tx);
    this.save();
  }

  getUserTransactions(userId: string): Transaction[] {
    return this.transactions.filter(t => t.buyerId === userId || t.creatorId === userId).reverse();
  }

  getVideosByCreator(creatorId: string): Video[] {
    return this.videos.filter(v => v.creatorId === creatorId);
  }
}

export const db = new DatabaseService();