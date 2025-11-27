import { User, Video, Transaction, Comment, UserInteraction, UserRole } from '../types';

const API_BASE = '/api';

// --- Mock Data Constants ---
const MOCK_INITIAL_VIDEOS: Video[] = [
  {
    id: 'v1',
    title: 'Neon Nights: Cyberpunk City',
    description: 'A visual journey through a futuristic metropolis.',
    price: 5,
    thumbnailUrl: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    creatorId: 'admin',
    creatorName: 'System Admin',
    views: 1250,
    createdAt: Date.now() - 10000000,
    likes: 120,
    dislikes: 5
  },
  {
    id: 'v2',
    title: 'Alpine Escape',
    description: 'Relaxing 4K drone footage of the Alps.',
    price: 10,
    thumbnailUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    creatorId: 'admin',
    creatorName: 'System Admin',
    views: 850,
    createdAt: Date.now() - 5000000,
    likes: 85,
    dislikes: 1
  },
  {
    id: 'v3',
    title: 'Urban Exploration',
    description: 'Parkour and climbing in abandoned structures.',
    price: 2,
    thumbnailUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    creatorId: 'admin',
    creatorName: 'System Admin',
    views: 3200,
    createdAt: Date.now() - 2000000,
    likes: 340,
    dislikes: 12
  }
];

class DatabaseService {
  private isInstalled: boolean = false;
  private isDemo: boolean = false;

  constructor() {
    // Check if we are in demo mode from previous session
    if (localStorage.getItem('sp_demo_mode') === 'true') {
      this.isDemo = true;
      this.isInstalled = true;
      this.initMockData();
    }
  }

  public enableDemoMode() {
    this.isDemo = true;
    this.isInstalled = true;
    localStorage.setItem('sp_demo_mode', 'true');
    this.initMockData();
  }

  private initMockData() {
    if (!localStorage.getItem('sp_users')) {
       const admin: User = { 
         id: 'admin', 
         username: 'admin', 
         password: 'password', // Stored plain for mock only
         role: UserRole.ADMIN, 
         balance: 1000, 
         autoPurchaseLimit: 5, 
         watchLater: [] 
       };
       localStorage.setItem('sp_users', JSON.stringify([admin]));
       localStorage.setItem('sp_videos', JSON.stringify(MOCK_INITIAL_VIDEOS));
       localStorage.setItem('sp_transactions', '[]');
       localStorage.setItem('sp_comments', '[]');
       localStorage.setItem('sp_interactions', '[]');
    }
  }

  // --- Helper for API Requests ---
  private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    // Intercept for Demo Mode
    if (this.isDemo) {
        return this.mockRequest<T>(endpoint, method, body);
    }

    const headers: HeadersInit = {};
    let requestBody: BodyInit | undefined;
    
    if (body instanceof FormData) {
        requestBody = body;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers,
            body: requestBody
        });

        // Check for common server errors before parsing JSON
        if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Invalid API Response:", text.substring(0, 100));
            throw new Error("API returned invalid data (HTML/Text). Check your API URL and backend configuration.");
        }

        const json = await response.json();
        
        if (!json.success) {
            throw new Error(json.error || 'Operation failed');
        }

        return json.data as T;
    } catch (error: any) {
        console.error("API Request Failed:", endpoint, error);
        throw error;
    }
  }

  // --- Mock Request Handler ---
  private async mockRequest<T>(endpoint: string, method: string, body: any): Promise<T> {
    await new Promise(r => setTimeout(r, 400)); // Simulate latency
    
    const url = new URL('http://mock' + endpoint);
    const action = url.searchParams.get('action');
    
    const users = JSON.parse(localStorage.getItem('sp_users') || '[]');
    const videos = JSON.parse(localStorage.getItem('sp_videos') || '[]');
    const txs = JSON.parse(localStorage.getItem('sp_transactions') || '[]');
    const comments = JSON.parse(localStorage.getItem('sp_comments') || '[]');
    
    const save = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

    switch (action) {
        case 'check':
        case 'verify_db': return { installed: true } as any;
        
        case 'login': {
            const u = users.find((x: any) => x.username === body.username && x.password === body.password);
            if (!u) throw new Error("Invalid credentials (try admin/password)");
            return u as any;
        }
        case 'register': {
            if (users.find((x: any) => x.username === body.username)) throw new Error("Username taken");
            const newUser = { 
                id: 'u_' + Date.now(), 
                username: body.username, 
                password: body.password, 
                role: 'USER', 
                balance: 100, 
                autoPurchaseLimit: 1, 
                watchLater: [] 
            };
            users.push(newUser);
            save('sp_users', users);
            return newUser as any;
        }
        case 'get_user': {
            const id = url.searchParams.get('id');
            return users.find((u: any) => u.id === id) as any;
        }
        case 'get_videos': return videos as any;
        case 'get_video': {
            const id = url.searchParams.get('id');
            return videos.find((v: any) => v.id === id) as any;
        }
        case 'has_purchased': {
            const userId = url.searchParams.get('userId');
            const videoId = url.searchParams.get('videoId');
            const has = txs.some((t: any) => t.buyerId === userId && t.videoId === videoId && t.type === 'PURCHASE');
            return { hasPurchased: has } as any;
        }
        case 'purchase_video': {
            const { userId, videoId } = body;
            const uIdx = users.findIndex((u: any) => u.id === userId);
            const v = videos.find((v: any) => v.id === videoId);
            if (users[uIdx].balance < v.price) throw new Error("Insufficient balance");
            
            users[uIdx].balance -= v.price;
            save('sp_users', users);
            
            const tx = { id: 'tx_'+Date.now(), buyerId: userId, creatorId: v.creatorId, videoId, amount: v.price, timestamp: Date.now(), type: 'PURCHASE' };
            txs.push(tx);
            save('sp_transactions', txs);
            return {} as any;
        }
        case 'upload_video': {
            // Mock upload - we can't handle real files in localstorage easily so we mock it
            const newVideo = {
                id: 'v_' + Date.now(),
                title: body.get('title'),
                description: body.get('description'),
                price: parseInt(body.get('price')),
                thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                creatorId: body.get('creatorId'),
                creatorName: users.find((u:any) => u.id === body.get('creatorId'))?.username || 'User',
                views: 0, createdAt: Date.now(), likes: 0, dislikes: 0
            };
            videos.unshift(newVideo);
            save('sp_videos', videos);
            return {} as any;
        }
        case 'get_interaction': return { liked: false, disliked: false, isWatched: false } as any;
        case 'get_comments': return comments.filter((c:any) => c.videoId === url.searchParams.get('videoId')) as any;
        case 'add_comment': {
            const c = { id: 'c_'+Date.now(), videoId: body.videoId, userId: body.userId, username: users.find((u:any)=>u.id===body.userId).username, text: body.text, timestamp: Date.now() };
            comments.unshift(c);
            save('sp_comments', comments);
            return c as any;
        }
        // ... add other mocks as needed
        default: return {} as any;
    }
  }

  // --- Setup & Config Methods ---

  public async checkInstallation() {
    if (this.isDemo) {
        this.isInstalled = true;
        return;
    }
    try {
        const result = await this.request<{ installed: boolean }>('/install.php?action=check');
        this.isInstalled = result.installed;
    } catch (e) {
        this.isInstalled = false;
    }
  }

  public needsSetup(): boolean {
    return !this.isInstalled;
  }

  public async verifyDbConnection(config: any): Promise<boolean> {
     // Sends the DB credentials to the backend to attempt a connection
     await this.request<any>('/install.php?action=verify_db', 'POST', config);
     return true;
  }

  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> {
    await this.request<any>('/install.php?action=install', 'POST', { dbConfig, adminUser });
    this.isInstalled = true;
  }

  // --- Auth ---

  async login(username: string, password: string): Promise<User> {
    return this.request<User>('/index.php?action=login', 'POST', { username, password });
  }

  async register(username: string, password: string): Promise<User> {
    return this.request<User>('/index.php?action=register', 'POST', { username, password });
  }

  async getUser(id: string): Promise<User | null> {
    try {
        return await this.request<User>(`/index.php?action=get_user&id=${id}`);
    } catch (e) {
        return null;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
    if (this.isDemo) {
        const users = JSON.parse(localStorage.getItem('sp_users') || '[]');
        const idx = users.findIndex((u:any) => u.id === userId);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...updates };
            localStorage.setItem('sp_users', JSON.stringify(users));
        }
        return;
    }
    await this.request('/index.php?action=update_user', 'POST', { userId, updates });
  }

  // --- Video & Interaction ---

  async getAllVideos(): Promise<Video[]> {
    return this.request<Video[]>('/index.php?action=get_videos');
  }

  async getVideo(id: string): Promise<Video | undefined> {
    try {
        return await this.request<Video>(`/index.php?action=get_video&id=${id}`);
    } catch {
        return undefined;
    }
  }

  async getRelatedVideos(currentVideoId: string): Promise<Video[]> {
    if (this.isDemo) {
        const videos = JSON.parse(localStorage.getItem('sp_videos') || '[]');
        return videos.filter((v:any) => v.id !== currentVideoId).slice(0, 3) as any;
    }
    return this.request<Video[]>(`/index.php?action=get_related_videos&id=${currentVideoId}`);
  }

  async hasPurchased(userId: string, videoId: string): Promise<boolean> {
    const res = await this.request<{ hasPurchased: boolean }>(`/index.php?action=has_purchased&userId=${userId}&videoId=${videoId}`);
    return res.hasPurchased;
  }

  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
    return this.request<UserInteraction>(`/index.php?action=get_interaction&userId=${userId}&videoId=${videoId}`);
  }

  async toggleLike(userId: string, videoId: string, isLike: boolean): Promise<UserInteraction> {
    if (this.isDemo) {
        // Simple mock toggle
        return { userId, videoId, liked: isLike, disliked: !isLike, isWatched: true };
    }
    return this.request<UserInteraction>('/index.php?action=toggle_like', 'POST', { userId, videoId, isLike });
  }

  async markWatched(userId: string, videoId: string): Promise<void> {
    if (this.isDemo) return;
    await this.request('/index.php?action=mark_watched', 'POST', { userId, videoId });
  }

  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> {
    if (this.isDemo) {
        const users = JSON.parse(localStorage.getItem('sp_users') || '[]');
        const u = users.find((x:any) => x.id === userId);
        if (u) {
            if (u.watchLater.includes(videoId)) {
                u.watchLater = u.watchLater.filter((id:string) => id !== videoId);
            } else {
                u.watchLater.push(videoId);
            }
            localStorage.setItem('sp_users', JSON.stringify(users));
            return u.watchLater;
        }
        return [];
    }
    const res = await this.request<{ list: string[] }>('/index.php?action=toggle_watch_later', 'POST', { userId, videoId });
    return res.list;
  }

  // --- Comments ---

  async getComments(videoId: string): Promise<Comment[]> {
    return this.request<Comment[]>(`/index.php?action=get_comments&videoId=${videoId}`);
  }

  async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
    return this.request<Comment>('/index.php?action=add_comment', 'POST', { userId, videoId, text });
  }

  // --- Transactions ---

  async purchaseVideo(userId: string, videoId: string): Promise<void> {
    await this.request('/index.php?action=purchase_video', 'POST', { userId, videoId });
  }

  async uploadVideo(title: string, description: string, price: number, creator: User, file: File | null): Promise<void> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price.toString());
    formData.append('creatorId', creator.id);
    if (file) {
        formData.append('video', file);
    }

    await this.request('/index.php?action=upload_video', 'POST', formData);
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> {
    if (this.isDemo) return;
    await this.request('/index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice });
  }

  async getAllUsers(): Promise<User[]> { 
    if (this.isDemo) {
        return JSON.parse(localStorage.getItem('sp_users') || '[]');
    }
    return this.request<User[]>('/index.php?action=get_all_users');
  }
  
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> {
      if (this.isDemo) {
        const users = JSON.parse(localStorage.getItem('sp_users') || '[]');
        const t = users.find((u:any) => u.id === targetUserId);
        if (t) {
            t.balance += amount;
            localStorage.setItem('sp_users', JSON.stringify(users));
        }
        return;
      }
      await this.request('/index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount });
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    if (this.isDemo) {
        const txs = JSON.parse(localStorage.getItem('sp_transactions') || '[]');
        return txs.filter((t:any) => t.buyerId === userId || t.creatorId === userId) as any;
    }
    return this.request<Transaction[]>(`/index.php?action=get_transactions&userId=${userId}`);
  }

  async getVideosByCreator(creatorId: string): Promise<Video[]> {
    if (this.isDemo) {
        const videos = JSON.parse(localStorage.getItem('sp_videos') || '[]');
        return videos.filter((v:any) => v.creatorId === creatorId) as any;
    }
    return this.request<Video[]>(`/index.php?action=get_creator_videos&creatorId=${creatorId}`);
  }
}

export const db = new DatabaseService();