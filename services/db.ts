import { User, Video, Transaction, Comment, UserInteraction, UserRole } from '../types';

const API_BASE = '/api';

class DatabaseService {
  private isInstalled: boolean = false;

  // --- Helper for API Requests ---
  private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
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

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
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

  // --- Setup & Config Methods ---

  public async checkInstallation() {
    try {
        // Ping the API to see if it's installed
        const result = await this.request<{ installed: boolean }>('/install.php?action=check');
        this.isInstalled = result.installed;
    } catch (e) {
        // If API is unreachable (404 etc), assume not installed or server down
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
    // Tells backend to create tables and admin user
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
    return this.request<UserInteraction>('/index.php?action=toggle_like', 'POST', { userId, videoId, isLike });
  }

  async markWatched(userId: string, videoId: string): Promise<void> {
    await this.request('/index.php?action=mark_watched', 'POST', { userId, videoId });
  }

  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> {
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
    await this.request('/index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice });
  }

  async getAllUsers(): Promise<User[]> { 
    return this.request<User[]>('/index.php?action=get_all_users');
  }
  
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> {
      await this.request('/index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount });
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.request<Transaction[]>(`/index.php?action=get_transactions&userId=${userId}`);
  }

  async getVideosByCreator(creatorId: string): Promise<Video[]> {
    return this.request<Video[]>(`/index.php?action=get_creator_videos&creatorId=${creatorId}`);
  }
}

export const db = new DatabaseService();