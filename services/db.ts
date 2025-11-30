
import { User, Video, Transaction, Comment, UserInteraction, UserRole, ContentRequest, SystemSettings, VideoCategory, SmartCleanerResult, Notification } from '../types';

// CRITICAL FIX: Use relative path 'api' instead of absolute '/api'
// This ensures it works in subfolders (e.g., 192.168.x.x/streampay/) on Synology/XAMPP
const API_BASE = 'api';

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
    duration: 600,
    fileHash: ''
  }
];

export interface VideoResult {
  id: string;
  source: 'Pexels' | 'Pixabay' | 'YouTube';
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
        'Cache-Control': 'no-cache, no-store, must-revalidate', 
        'Pragma': 'no-cache',
        'Expires': '0'
    };
    
    let requestBody: BodyInit | undefined;
    
    if (body instanceof FormData) {
        requestBody = body;
        // Do NOT set Content-Type header for FormData, browser sets it with boundary
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    // Ensure endpoint doesn't start with / if API_BASE doesn't end with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = method === 'GET' 
       ? `${API_BASE}/${cleanEndpoint}${cleanEndpoint.includes('?') ? '&' : '?'}_t=${Date.now()}` 
       : `${API_BASE}/${cleanEndpoint}`;

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: requestBody
        });

        const text = await response.text();

        if (!response.ok) {
            // Try to parse error from JSON if available
            try {
                const errJson = JSON.parse(text);
                throw new Error(errJson.error || `Server Error: ${response.status}`);
            } catch {
                throw new Error(`Server Error: ${response.status} ${response.statusText}`);
            }
        }
        
        if (!text || text.trim().length === 0) {
            console.error("Empty response received from:", url);
            throw new Error("Empty response from API. Check PHP logs or file permissions.");
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            if (!silent) console.error("Invalid API Response:", text.substring(0, 200));
            // Check if it's a raw PHP error printed
            if (text.includes('Fatal error') || text.includes('Parse error')) {
                 const match = text.match(/(Fatal|Parse) error: (.*?) in/);
                 throw new Error(`PHP Error: ${match ? match[2] : 'Unknown Syntax Error'}`);
            }
            throw new Error(`Invalid JSON from API. Response was not JSON.`);
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
            watchLater: [],
            sessionToken: 'demo_token',
            avatarUrl: null
        } as T;
    }
    if (endpoint.includes('get_videos')) return MOCK_VIDEOS as T;
    if (endpoint.includes('get_video')) return MOCK_VIDEOS[0] as T;
    if (endpoint.includes('has_purchased')) return { hasPurchased: true } as T;
    if (endpoint.includes('get_interaction')) return { liked: false, disliked: false, isWatched: false, userId: 'demo', videoId: 'demo' } as T;
    if (endpoint.includes('get_all_users')) return [{id: 'demo', username: 'DemoUser', role: 'ADMIN', balance: 500}] as T;
    if (endpoint.includes('heartbeat')) return true as T;
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
  public async verifyDbConnection(config: any): Promise<boolean> { await this.request<any>('install.php?action=verify_db', 'POST', config); return true; }
  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> { await this.request<any>('install.php?action=install', 'POST', { dbConfig, adminUser }); this.isInstalled = true; }
  public enableDemoMode() { this.isDemoMode = true; this.isInstalled = true; localStorage.setItem('sp_demo_mode', 'true'); window.location.reload(); }

  async login(username: string, password: string): Promise<User> { return this.request<User>('index.php?action=login', 'POST', { username, password }); }
  async logout(userId: string): Promise<void> { await this.request('index.php?action=logout', 'POST', { userId }); }
  async heartbeat(userId: string, token: string): Promise<boolean> { 
      try {
        await this.request('index.php?action=heartbeat', 'POST', { userId, token }, true);
        return true;
      } catch { return false; }
  }

  async register(username: string, password: string, avatar?: File | null): Promise<User> { 
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      if (avatar) formData.append('avatar', avatar);
      
      return this.request<User>('index.php?action=register', 'POST', formData); 
  }

  async getUser(id: string): Promise<User | null> { try { return await this.request<User>(`index.php?action=get_user&id=${id}`); } catch (e) { return null; } }
  
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> { await this.request('index.php?action=update_user', 'POST', { userId, updates }); }
  
  async uploadAvatar(userId: string, file: File): Promise<string> {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('avatar', file);
      const res = await this.request<{avatarUrl: string}>('index.php?action=update_avatar', 'POST', formData);
      return res.avatarUrl;
  }

  async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
      await this.request('index.php?action=change_password', 'POST', { userId, oldPass, newPass });
  }

  async getAllVideos(): Promise<Video[]> { return this.request<Video[]>('index.php?action=get_videos'); }
  async getVideo(id: string): Promise<Video | undefined> { 
      try { 
          return await this.request<Video>(`index.php?action=get_video&id=${id}`); 
      } catch (e) { 
          console.warn(`Video ${id} fetch failed`, e);
          return undefined; 
      } 
  }
  async getRelatedVideos(currentVideoId: string): Promise<Video[]> { return this.request<Video[]>(`index.php?action=get_related_videos&id=${currentVideoId}`); }
  async hasPurchased(userId: string, videoId: string): Promise<boolean> { const res = await this.request<{ hasPurchased: boolean }>(`index.php?action=has_purchased&userId=${userId}&videoId=${videoId}`); return res.hasPurchased; }
  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> { return this.request<UserInteraction>(`index.php?action=get_interaction&userId=${userId}&videoId=${videoId}`); }
  
  async rateVideo(userId: string, videoId: string, rating: 'like' | 'dislike'): Promise<UserInteraction> { 
      return this.request<UserInteraction>('index.php?action=rate_video', 'POST', { userId, videoId, rating }); 
  }
  
  async markWatched(userId: string, videoId: string): Promise<void> { await this.request('index.php?action=mark_watched', 'POST', { userId, videoId }); }
  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> { const res = await this.request<{ list: string[] }>('index.php?action=toggle_watch_later', 'POST', { userId, videoId }); return res.list; }
  async getUserActivity(userId: string): Promise<{ liked: string[], watched: string[] }> { return this.request<{ liked: string[], watched: string[] }>(`index.php?action=get_user_activity&userId=${userId}`); }

  async getComments(videoId: string): Promise<Comment[]> { return this.request<Comment[]>(`index.php?action=get_comments&videoId=${videoId}`); }
  async addComment(userId: string, videoId: string, text: string): Promise<Comment> { return this.request<Comment>('index.php?action=add_comment', 'POST', { userId, videoId, text }); }

  async purchaseVideo(userId: string, videoId: string): Promise<void> { await this.request('index.php?action=purchase_video', 'POST', { userId, videoId }); }
  
  async uploadVideo(
    title: string, 
    description: string, 
    price: number, 
    category: VideoCategory, 
    duration: number, 
    creator: User, 
    file: File | null, 
    thumbnail: File | null = null, 
    onProgress?: (percent: number, loaded: number, total: number) => void
  ): Promise<void> {
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
        // XHR also needs the relative path fix
        xhr.open('POST', `${API_BASE}/index.php?action=upload_video`, true);
        if (onProgress) { 
            xhr.upload.onprogress = (e) => { 
                if (e.lengthComputable) { 
                    onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total); 
                } 
            }; 
        }
        xhr.onload = () => { 
            if (xhr.status >= 200 && xhr.status < 300) { 
                try { 
                    const json = JSON.parse(xhr.responseText); 
                    if (json.success) resolve(); else reject(new Error(json.error || 'Upload failed')); 
                } catch (e) { 
                    console.error("Upload response error", xhr.responseText);
                    reject(new Error("Invalid server response")); 
                } 
            } else { 
                reject(new Error(`Server error: ${xhr.status}`)); 
            } 
        };
        xhr.onerror = () => reject(new Error("Network connection error"));
        xhr.send(formData);
    });
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> { await this.request('index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice }); }
  async getAllUsers(): Promise<User[]> { try { const u = await this.request<User[]>('index.php?action=get_all_users'); return Array.isArray(u) ? u : []; } catch (e) { return []; } }
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> { await this.request('index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount }); }
  async getUserTransactions(userId: string): Promise<Transaction[]> { return this.request<Transaction[]>(`index.php?action=get_transactions&userId=${userId}`); }
  async getVideosByCreator(creatorId: string): Promise<Video[]> { return this.request<Video[]>(`index.php?action=get_creator_videos&creatorId=${creatorId}`); }
  
  async adminRepairDb(): Promise<void> { await this.request('index.php?action=admin_repair_db', 'POST', {}); }
  async adminCleanupVideos(): Promise<{deleted: number}> { return this.request<{deleted: number}>('index.php?action=admin_cleanup_videos', 'POST', {}); }
  
  async getSmartCleanerPreview(category: string, percentage: number, safeHarborDays: number): Promise<SmartCleanerResult> {
      return this.request<SmartCleanerResult>('index.php?action=admin_smart_cleaner_preview', 'POST', { category, percentage, safeHarborDays });
  }
  
  async executeSmartCleaner(videoIds: string[]): Promise<{deleted: number}> {
      return this.request<{deleted: number}>('index.php?action=admin_smart_cleaner_execute', 'POST', { videoIds });
  }

  async getRequests(status?: string): Promise<ContentRequest[]> { const qs = status ? `&status=${status}` : ''; return this.request<ContentRequest[]>(`index.php?action=get_requests${qs}`); }
  async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<ContentRequest> { return this.request<ContentRequest>('index.php?action=request_content', 'POST', { userId, query, useLocalNetwork }); }
  async deleteRequest(requestId: string): Promise<void> { await this.request('index.php?action=delete_request', 'POST', { requestId }); }
  async getSystemSettings(): Promise<SystemSettings> { return this.request<SystemSettings>('index.php?action=get_system_settings'); }
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> { await this.request('index.php?action=update_system_settings', 'POST', { settings }); }
  async triggerQueueProcessing(): Promise<{ processed: number, message: string }> { return this.request<{ processed: number, message: string }>('index.php?action=process_queue', 'POST', {}); }
  
  async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE' = 'STOCK'): Promise<VideoResult[]> { 
    return this.request<VideoResult[]>('index.php?action=search_external', 'POST', { query, source }); 
  }
  
  async serverImportVideo(url: string): Promise<void> {
    await this.request('index.php?action=server_import_video', 'POST', { url });
  }

  // --- Subscriptions & Notifications ---
  async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
      try {
          return await this.request('index.php?action=toggle_subscribe', 'POST', { userId, creatorId });
      } catch (e) {
          throw new Error("Could not update subscription.");
      }
  }
  async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
      try {
          const res = await this.request<{isSubscribed: boolean}>(`index.php?action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
          return res.isSubscribed;
      } catch { return false; }
  }
  async getNotifications(userId: string): Promise<Notification[]> {
      return this.request<Notification[]>(`index.php?action=get_notifications&userId=${userId}`);
  }
  async markNotificationRead(notifId: string): Promise<void> {
      await this.request('index.php?action=mark_notification_read', 'POST', { notifId });
  }
  async getSubscriptions(userId: string): Promise<string[]> {
      return this.request<string[]>(`index.php?action=get_subscriptions&userId=${userId}`);
  }
}

export const db = new DatabaseService();
