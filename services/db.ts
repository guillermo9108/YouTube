import { User, Video, Transaction, UserRole, Comment, UserInteraction } from '../types';

// Mock Database Service using LocalStorage
class DatabaseService {
  private isInstalled: boolean = false;
  private delayMs = 500;

  constructor() {
    this.checkInstallation();
  }

  // --- Helper Methods ---
  private async delay() {
    return new Promise(resolve => setTimeout(resolve, this.delayMs));
  }

  private load<T>(key: string, defaultVal: T): T {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  }

  private save(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Setup & Config Methods ---

  public async checkInstallation() {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    // valid if at least one admin exists
    this.isInstalled = users.some(u => u.role === UserRole.ADMIN);
  }

  public needsSetup(): boolean {
    return !this.isInstalled;
  }

  public async verifyDbConnection(config: any): Promise<boolean> {
     await this.delay();
     return true; // Mock connection always success
  }

  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> {
    await this.delay();
    const newUser: User = {
        id: 'admin-' + Date.now(),
        username: adminUser.username || 'admin',
        password: adminUser.password, // In real app, hash this
        role: UserRole.ADMIN,
        balance: 1000,
        autoPurchaseLimit: 5,
        watchLater: []
    };
    
    this.save('sp_users', [newUser]);
    
    // Seed some initial data
    const seedVideos: Video[] = [
        {
            id: 'v1',
            title: 'Welcome to StreamPay',
            description: 'An introduction to our platform.',
            price: 0, // Free
            thumbnailUrl: 'https://picsum.photos/id/48/800/450',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            creatorId: newUser.id,
            creatorName: newUser.username,
            views: 120,
            createdAt: Date.now(),
            likes: 10,
            dislikes: 0
        },
        {
            id: 'v2',
            title: 'Premium Masterclass',
            description: 'Learn advanced techniques in this exclusive video.',
            price: 50,
            thumbnailUrl: 'https://picsum.photos/id/20/800/450',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            creatorId: newUser.id,
            creatorName: newUser.username,
            views: 45,
            createdAt: Date.now() - 100000,
            likes: 5,
            dislikes: 0
        }
    ];
    this.save('sp_videos', seedVideos);
    this.save('sp_transactions', []);
    this.save('sp_interactions', []);
    this.save('sp_comments', []);

    this.isInstalled = true;
  }

  // --- Auth ---

  async login(username: string, password: string): Promise<User> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) throw new Error("Invalid credentials");
    return user;
  }

  async register(username: string, password: string): Promise<User> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    if (users.find(u => u.username === username)) throw new Error("Username taken");

    const newUser: User = {
        id: crypto.randomUUID(),
        username,
        password,
        role: UserRole.USER,
        balance: 100, // Sign up bonus
        autoPurchaseLimit: 1,
        watchLater: []
    };
    
    users.push(newUser);
    this.save('sp_users', users);
    
    // Log deposit transaction for bonus
    const txs = this.load<Transaction[]>('sp_transactions', []);
    txs.push({
        id: crypto.randomUUID(),
        buyerId: 'system',
        creatorId: newUser.id,
        videoId: null,
        amount: 100,
        timestamp: Date.now(),
        type: 'DEPOSIT'
    });
    this.save('sp_transactions', txs);

    return newUser;
  }

  async getUser(id: string): Promise<User | null> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    return users.find(u => u.id === id) || null;
  }

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        this.save('sp_users', users);
    }
  }

  // --- Video & Interaction ---

  async getAllVideos(): Promise<Video[]> {
    await this.delay();
    return this.load<Video[]>('sp_videos', []);
  }

  async getVideo(id: string): Promise<Video | undefined> {
    await this.delay();
    const videos = this.load<Video[]>('sp_videos', []);
    return videos.find(v => v.id === id);
  }

  async getRelatedVideos(currentVideoId: string): Promise<Video[]> {
    const all = await this.getAllVideos();
    return all.filter(v => v.id !== currentVideoId).slice(0, 5);
  }

  async hasPurchased(userId: string, videoId: string): Promise<boolean> {
    await this.delay();
    // Creator always owns
    const video = (await this.getVideo(videoId));
    if (video?.creatorId === userId) return true;

    // Check transactions
    const txs = this.load<Transaction[]>('sp_transactions', []);
    return txs.some(t => t.buyerId === userId && t.videoId === videoId && t.type === 'PURCHASE');
  }

  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
    await this.delay();
    const interactions = this.load<UserInteraction[]>('sp_interactions', []);
    const found = interactions.find(i => i.userId === userId && i.videoId === videoId);
    return found || { userId, videoId, liked: false, disliked: false, isWatched: false };
  }

  async toggleLike(userId: string, videoId: string, isLike: boolean): Promise<UserInteraction> {
    await this.delay();
    let interactions = this.load<UserInteraction[]>('sp_interactions', []);
    let idx = interactions.findIndex(i => i.userId === userId && i.videoId === videoId);
    
    let current = idx !== -1 ? interactions[idx] : { userId, videoId, liked: false, disliked: false, isWatched: false };
    
    // Logic: Toggle. If clicking like and already liked -> unlike. If clicking like and disliked -> like (remove dislike).
    if (isLike) {
        current.liked = !current.liked;
        if (current.liked) current.disliked = false;
    } else {
        current.disliked = !current.disliked;
        if (current.disliked) current.liked = false;
    }

    if (idx !== -1) interactions[idx] = current;
    else interactions.push(current);
    
    this.save('sp_interactions', interactions);

    // Update video counters
    const videos = this.load<Video[]>('sp_videos', []);
    const vIdx = videos.findIndex(v => v.id === videoId);
    if (vIdx !== -1) {
       // Recalculate totals
       const relevant = interactions.filter(i => i.videoId === videoId);
       videos[vIdx].likes = relevant.filter(i => i.liked).length;
       videos[vIdx].dislikes = relevant.filter(i => i.disliked).length;
       this.save('sp_videos', videos);
    }

    return current;
  }

  async markWatched(userId: string, videoId: string): Promise<void> {
     // Don't delay for this one to feel snappy
     let interactions = this.load<UserInteraction[]>('sp_interactions', []);
     let idx = interactions.findIndex(i => i.userId === userId && i.videoId === videoId);
     if (idx !== -1) {
         if (!interactions[idx].isWatched) {
             interactions[idx].isWatched = true;
             // Update View Count
             const videos = this.load<Video[]>('sp_videos', []);
             const v = videos.find(v => v.id === videoId);
             if (v) { v.views++; this.save('sp_videos', videos); }
         }
     } else {
         interactions.push({ userId, videoId, liked: false, disliked: false, isWatched: true });
         // Update View Count
         const videos = this.load<Video[]>('sp_videos', []);
         const v = videos.find(v => v.id === videoId);
         if (v) { v.views++; this.save('sp_videos', videos); }
     }
     this.save('sp_interactions', interactions);
  }

  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return [];

    let list = users[idx].watchLater || [];
    if (list.includes(videoId)) {
        list = list.filter(id => id !== videoId);
    } else {
        list.push(videoId);
    }
    users[idx].watchLater = list;
    this.save('sp_users', users);
    return list;
  }

  // --- Comments ---

  async getComments(videoId: string): Promise<Comment[]> {
    await this.delay();
    const all = this.load<Comment[]>('sp_comments', []);
    return all.filter(c => c.videoId === videoId).sort((a,b) => b.timestamp - a.timestamp);
  }

  async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
    await this.delay();
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newComment: Comment = {
        id: crypto.randomUUID(),
        videoId,
        userId,
        username: user.username,
        text,
        timestamp: Date.now()
    };
    
    const comments = this.load<Comment[]>('sp_comments', []);
    comments.push(newComment);
    this.save('sp_comments', comments);
    
    return newComment;
  }

  // --- Transactions ---

  async purchaseVideo(userId: string, videoId: string): Promise<void> {
    await this.delay();
    const users = this.load<User[]>('sp_users', []);
    const videos = this.load<Video[]>('sp_videos', []);
    
    const userIdx = users.findIndex(u => u.id === userId);
    const video = videos.find(v => v.id === videoId);
    
    if (userIdx === -1 || !video) throw new Error("Invalid Request");
    const user = users[userIdx];

    if (await this.hasPurchased(userId, videoId)) return; // Already bought
    
    if (user.balance < video.price) throw new Error("Insufficient Balance");

    // Deduct
    user.balance -= video.price;
    users[userIdx] = user;
    
    // Add to creator
    const creatorIdx = users.findIndex(u => u.id === video.creatorId);
    if (creatorIdx !== -1) {
        users[creatorIdx].balance += video.price;
    }
    
    this.save('sp_users', users);

    // Record Transaction
    const txs = this.load<Transaction[]>('sp_transactions', []);
    txs.push({
        id: crypto.randomUUID(),
        buyerId: userId,
        creatorId: video.creatorId,
        videoId: video.id,
        amount: video.price,
        timestamp: Date.now(),
        type: 'PURCHASE'
    });
    this.save('sp_transactions', txs);
  }

  async uploadVideo(title: string, description: string, price: number, creator: User, file: File | null): Promise<void> {
    await this.delay();
    const videos = this.load<Video[]>('sp_videos', []);
    
    // Simulate Video URL (Random selection from sample clips)
    const samples = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
    ];
    const randomVideo = samples[Math.floor(Math.random() * samples.length)];

    const newVideo: Video = {
        id: crypto.randomUUID(),
        title,
        description,
        price,
        thumbnailUrl: `https://picsum.photos/seed/${Date.now()}/800/450`,
        videoUrl: randomVideo,
        creatorId: creator.id,
        creatorName: creator.username,
        views: 0,
        createdAt: Date.now(),
        likes: 0,
        dislikes: 0
    };
    
    videos.push(newVideo);
    this.save('sp_videos', videos);
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> {
    await this.delay();
    const videos = this.load<Video[]>('sp_videos', []);
    let changed = false;
    const updated = videos.map(v => {
        if (v.creatorId === creatorId) {
            changed = true;
            return { ...v, price: newPrice };
        }
        return v;
    });
    
    if (changed) this.save('sp_videos', updated);
  }

  async getAllUsers(): Promise<User[]> { 
    await this.delay();
    return this.load<User[]>('sp_users', []);
  }
  
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> {
      await this.delay();
      const users = this.load<User[]>('sp_users', []);
      const idx = users.findIndex(u => u.id === targetUserId);
      if (idx !== -1) {
          users[idx].balance += amount;
          this.save('sp_users', users);
          
          const txs = this.load<Transaction[]>('sp_transactions', []);
          txs.push({
            id: crypto.randomUUID(),
            buyerId: adminId,
            creatorId: targetUserId, // Receiver
            videoId: null,
            amount: amount,
            timestamp: Date.now(),
            type: 'DEPOSIT'
        });
        this.save('sp_transactions', txs);
      }
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    await this.delay();
    const txs = this.load<Transaction[]>('sp_transactions', []);
    return txs.filter(t => t.buyerId === userId || t.creatorId === userId).sort((a,b) => b.timestamp - a.timestamp);
  }

  async getVideosByCreator(creatorId: string): Promise<Video[]> {
    await this.delay();
    const videos = this.load<Video[]>('sp_videos', []);
    return videos.filter(v => v.creatorId === creatorId);
  }
}

export const db = new DatabaseService();