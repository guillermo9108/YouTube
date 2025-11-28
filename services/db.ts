
import { User, Video, Transaction, Comment, UserInteraction, UserRole, ContentRequest, SystemSettings, VideoCategory } from '../types';

const API_BASE = '/api';

// --- MOCK DATA FOR DEMO MODE ---
const MOCK_VIDEOS: Video[] = [
  {
    id: 'demo_1',
    title: 'Cyberpunk City Run',
    description: 'A futuristic run through the neon streets.',
    price: 5,
    thumbnailUrl: 'https://images.unsplash.com/photo-1533907650686-705761a08656',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    creatorId: 'demo_creator',
    creatorName: 'NeoArtist',
    views: 1205,
    createdAt: Date.now(),
    likes: 450,
    dislikes: 12,
    category: VideoCategory.SHORT_FILM,
    duration: 600
  }
];

export interface VideoResult {
  id: string;
  source: 'Pexels' | 'Pixabay';
  thumbnail: string;
  title: string;
  duration?: number;
  downloadUrl: string;
  author: string;
  originalUrl?: string;
}

class DatabaseService {
  private isInstalled: boolean = false;
  private isDemoMode: boolean = false;

  constructor() {
    if (localStorage.getItem('sp_demo_mode') === 'true') {
        this.isDemoMode = true;
        this.isInstalled = true;
    }
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: any, silent: boolean = false): Promise<T> {
    if (this.isDemoMode) {
       return this.handleMockRequest<T>(endpoint, method, body);
    }

    const headers: HeadersInit = {
        'Cache-Control': 'no-cache', 
        'Pragma': 'no-cache'
    };
    
    let requestBody: BodyInit | undefined;
    
    if (body instanceof FormData) {
        requestBody = body;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    const url = method === 'GET' 
       ? `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}` 
       : `${API_BASE}${endpoint}`;

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: requestBody
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        
        if (!text || text.trim().length === 0) {
            throw new Error("Empty response from API. PHP file might be empty.");
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            if (!silent) console.error("Invalid API Response:", text.substring(0, 100));
            throw new Error(`Invalid JSON from API: ${text.substring(0, 50)}...`);
        }
        
        if (!json.success) {
            throw new Error(json.error || 'Operation failed');
        }

        return json.data as T;
    } catch (error: any) {
        if (!silent) console.error("API Request Failed:", endpoint, error);
        throw error;
    }
  }

  private async handleMockRequest<T>(endpoint: string, method: string, body: any): Promise<T> {
    await new Promise(r => setTimeout(r, 500)); 
    if (endpoint.includes('login') || endpoint.includes('register') || endpoint.includes('get_user')) {
        return {
            id: 'demo_user',
            username: 'DemoUser',
            role: 'ADMIN',
            balance: 500,
            autoPurchaseLimit: 10,
            watchLater: []
        } as T;
    }
    if (endpoint.includes('get_videos')) return MOCK_VIDEOS as T;
    if (endpoint.includes('get_video')) return MOCK_VIDEOS[0] as T;
    if (endpoint.includes('has_purchased')) return { hasPurchased: true } as T;
    if (endpoint.includes('get_interaction')) return { liked: false, disliked: false, isWatched: false, userId: 'demo', videoId: 'demo' } as T;
    if (endpoint.includes('get_all_users')) return [{id: 'demo', username: 'DemoUser', role: 'ADMIN', balance: 500}] as T;
    return {} as T;
  }

  public async checkInstallation() {
    if (this.isDemoMode) {
        this.isInstalled = true;
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/install.php?action=check`);
        if (!response.ok) throw new Error("Backend unreachable");
        const text = await response.text();
        if (!text) { this.isInstalled = false; return; }
        try {
            const json = JSON.parse(text);
            this.isInstalled = json.success && json.data.installed;
        } catch { this.isInstalled = false; }
    } catch (e) {
        this.isInstalled = false;
        console.warn("Backend check failed", e);
    }
  }

  public needsSetup(): boolean { return !this.isInstalled; }
  public async verifyDbConnection(config: any): Promise<boolean> { await this.request<any>('/install.php?action=verify_db', 'POST', config); return true; }
  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> { await this.request<any>('/install.php?action=install', 'POST', { dbConfig, adminUser }); this.isInstalled = true; }
  public enableDemoMode() { this.isDemoMode = true; this.isInstalled = true; localStorage.setItem('sp_demo_mode', 'true'); window.location.reload(); }

  async login(username: string, password: string): Promise<User> { return this.request<User>('/index.php?action=login', 'POST', { username, password }); }
  async register(username: string, password: string): Promise<User> { return this.request<User>('/index.php?action=register', 'POST', { username, password }); }
  async getUser(id: string): Promise<User | null> { try { return await this.request<User>(`/index.php?action=get_user&id=${id}`); } catch (e) { return null; } }
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> { await this.request('/index.php?action=update_user', 'POST', { userId, updates }); }

  async getAllVideos(): Promise<Video[]> { return this.request<Video[]>('/index.php?action=get_videos'); }
  async getVideo(id: string): Promise<Video | undefined> { 
      try { 
          return await this.request<Video>(`/index.php?action=get_video&id=${id}`); 
      } catch (e) { 
          console.warn(`Video ${id} fetch failed`, e);
          return undefined; 
      } 
  }
  async getRelatedVideos(currentVideoId: string): Promise<Video[]> { return this.request<Video[]>(`/index.php?action=get_related_videos&id=${currentVideoId}`); }
  async hasPurchased(userId: string, videoId: string): Promise<boolean> { const res = await this.request<{ hasPurchased: boolean }>(`/index.php?action=has_purchased&userId=${userId}&videoId=${videoId}`); return res.hasPurchased; }
  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> { return this.request<UserInteraction>(`/index.php?action=get_interaction&userId=${userId}&videoId=${videoId}`); }
  async toggleLike(userId: string, videoId: string, isLike: boolean): Promise<UserInteraction> { return this.request<UserInteraction>('/index.php?action=toggle_like', 'POST', { userId, videoId, isLike }); }
  async markWatched(userId: string, videoId: string): Promise<void> { await this.request('/index.php?action=mark_watched', 'POST', { userId, videoId }); }
  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> { const res = await this.request<{ list: string[] }>('/index.php?action=toggle_watch_later', 'POST', { userId, videoId }); return res.list; }
  async getUserActivity(userId: string): Promise<{ liked: string[], watched: string[] }> { return this.request<{ liked: string[], watched: string[] }>(`/index.php?action=get_user_activity&userId=${userId}`); }

  async getComments(videoId: string): Promise<Comment[]> { return this.request<Comment[]>(`/index.php?action=get_comments&videoId=${videoId}`); }
  async addComment(userId: string, videoId: string, text: string): Promise<Comment> { return this.request<Comment>('/index.php?action=add_comment', 'POST', { userId, videoId, text }); }

  async purchaseVideo(userId: string, videoId: string): Promise<void> { await this.request('/index.php?action=purchase_video', 'POST', { userId, videoId }); }
  
  async uploadVideo(title: string, description: string, price: number, category: VideoCategory, duration: number, creator: User, file: File | null, thumbnail: File | null = null, onProgress?: (percent: number) => void): Promise<void> {
    if (this.isDemoMode) { await new Promise(r => setTimeout(r, 1000)); return; }
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price.toString());
        formData.append('category', category);
        formData.append('duration', duration.toString());
        formData.append('creatorId', creator.id);
        if (file) formData.append('video', file);
        if (thumbnail) formData.append('thumbnail', thumbnail);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/index.php?action=upload_video`, true);
        if (onProgress) { xhr.upload.onprogress = (e) => { if (e.lengthComputable) { onProgress(Math.round((e.loaded / e.total) * 100)); } }; }
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { const json = JSON.parse(xhr.responseText); if (json.success) resolve(); else reject(new Error(json.error || 'Upload failed')); } catch (e) { reject(new Error("Invalid server response")); } } else { reject(new Error(`Server error: ${xhr.status}`)); } };
        xhr.onerror = () => reject(new Error("Network connection error"));
        xhr.send(formData);
    });
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> { await this.request('/index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice }); }
  async getAllUsers(): Promise<User[]> { try { const u = await this.request<User[]>('/index.php?action=get_all_users'); return Array.isArray(u) ? u : []; } catch (e) { return []; } }
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> { await this.request('/index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount }); }
  async getUserTransactions(userId: string): Promise<Transaction[]> { return this.request<Transaction[]>(`/index.php?action=get_transactions&userId=${userId}`); }
  async getVideosByCreator(creatorId: string): Promise<Video[]> { return this.request<Video[]>(`/index.php?action=get_creator_videos&creatorId=${creatorId}`); }
  async adminRepairDb(): Promise<void> { await this.request('/index.php?action=admin_repair_db', 'POST', {}); }
  
  async getRequests(status?: string): Promise<ContentRequest[]> { const qs = status ? `&status=${status}` : ''; return this.request<ContentRequest[]>(`/index.php?action=get_requests${qs}`); }
  async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<ContentRequest> { return this.request<ContentRequest>('/index.php?action=request_content', 'POST', { userId, query, useLocalNetwork }); }
  async deleteRequest(requestId: string): Promise<void> { await this.request('/index.php?action=delete_request', 'POST', { requestId }); }
  async getSystemSettings(): Promise<SystemSettings> { return this.request<SystemSettings>('/index.php?action=get_system_settings'); }
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> { await this.request('/index.php?action=update_system_settings', 'POST', { settings }); }
  async triggerQueueProcessing(): Promise<{ processed: number, message: string }> { return this.request<{ processed: number, message: string }>('/index.php?action=process_queue', 'POST', {}); }
  async searchExternal(query: string): Promise<VideoResult[]> { return this.request<VideoResult[]>('/index.php?action=search_external', 'POST', { query }); }
}

export const db = new DatabaseService();
