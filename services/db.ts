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
  private isInstalled: boolean = true; // Optimistic default
  private isDemoMode: boolean = false;
  private isOffline: boolean = !navigator.onLine;
  
  // DEDUPLICATION: Map to store in-flight requests
  private pendingRequests = new Map<string, Promise<any>>();

  constructor() {
    if (localStorage.getItem('sp_demo_mode') === 'true') {
        this.isDemoMode = true;
        this.isInstalled = true;
    }
    
    window.addEventListener('online', () => { this.isOffline = false; });
    window.addEventListener('offline', () => { this.isOffline = true; });
  }

  // --- CACHE SYSTEM (SMART EVICTION) ---
  private saveToCache(key: string, data: any) {
      const cacheItem = JSON.stringify({
          timestamp: Date.now(),
          data: data
      });

      try {
          // Cache GET requests
          if (key.includes('action=')) {
              localStorage.setItem(`sp_cache_${key}`, cacheItem);
          }
      } catch (e: any) {
          // Check for QuotaExceededError
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              console.warn("Cache quota exceeded. Running smart eviction...");
              this.evictCache();
              // Try again once
              try {
                  if (key.includes('action=')) {
                      localStorage.setItem(`sp_cache_${key}`, cacheItem);
                  }
              } catch (retryErr) {
                  console.error("Cache write failed even after eviction.", retryErr);
              }
          }
      }
  }

  private evictCache() {
      // 1. Gather all sp_cache items
      const items: { key: string, timestamp: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('sp_cache_')) {
              try {
                  const val = localStorage.getItem(k);
                  if (val) {
                      const parsed = JSON.parse(val);
                      items.push({ key: k, timestamp: parsed.timestamp || 0 });
                  }
              } catch(e) {
                  // Corrupt item, mark for deletion
                  items.push({ key: k, timestamp: 0 });
              }
          }
      }

      // 2. Sort by oldest first
      items.sort((a, b) => a.timestamp - b.timestamp);

      // 3. Delete the oldest 50%
      const toDelete = Math.ceil(items.length * 0.5);
      for (let i = 0; i < toDelete; i++) {
          localStorage.removeItem(items[i].key);
      }
      console.log(`Evicted ${toDelete} old cache items.`);
  }

  private getFromCache<T>(key: string, maxAgeMs: number = 0): T | null {
      const item = localStorage.getItem(`sp_cache_${key}`);
      if (!item) return null;
      try {
          const parsed = JSON.parse(item);
          // Check expiration if maxAgeMs is provided
          if (maxAgeMs > 0 && (Date.now() - parsed.timestamp > maxAgeMs)) {
              return null;
          }
          return parsed.data as T;
      } catch {
          return null;
      }
  }

  public invalidateCache(endpointKey: string) {
      localStorage.removeItem(`sp_cache_${endpointKey}`);
  }

  // Helper to mark Home feed as outdated so it refreshes on next visit
  public setHomeDirty() {
      localStorage.setItem('sp_home_dirty', 'true');
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: any, silent: boolean = false): Promise<T> {
    if (this.isDemoMode) {
       return this.handleMockRequest<T>(endpoint, method, body);
    }

    // Prepare URL
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const cacheKey = cleanEndpoint; // Use endpoint as cache key
    
    // --- STRATEGY: STALE-WHILE-REVALIDATE FOR HOME FEED ---
    // If getting all videos, assume cache is good for 5 minutes to avoid spinning up NAS HDDs constantly
    if (method === 'GET' && cleanEndpoint.includes('get_videos') && !cleanEndpoint.includes('id=')) {
        const cached = this.getFromCache<T>(cacheKey, 5 * 60 * 1000); // 5 Minutes
        if (cached) {
            console.log(`[Cache] Serving ${cacheKey} from persistent cache`);
            return cached;
        }
    }

    // --- OFFLINE FIRST STRATEGY ---
    // If explicitly offline and it's a GET request, try cache immediately (ignore age)
    if (this.isOffline && method === 'GET') {
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) {
            console.log(`[Offline] Serving cached: ${cacheKey}`);
            return cached;
        }
        throw new Error("No internet connection and no cached data available.");
    }

    // If trying to WRITE (POST) while offline
    if (this.isOffline && method === 'POST') {
        throw new Error("You are offline. Action cannot be completed.");
    }

    // --- DEDUPLICATION START ---
    // If a request for this key is already in flight, return that promise
    if (method === 'GET' && this.pendingRequests.has(cacheKey)) {
        // console.log(`[Dedupe] Reusing in-flight request for: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey) as Promise<T>;
    }

    const url = method === 'GET' 
       ? `${API_BASE}/${cleanEndpoint}${cleanEndpoint.includes('?') ? '&' : '?'}_t=${Date.now()}` 
       : `${API_BASE}/${cleanEndpoint}`;

    const headers: HeadersInit = {
        'Cache-Control': 'no-cache, no-store, must-revalidate', 
        'Pragma': 'no-cache',
        'Expires': '0'
    };
    
    let requestBody: BodyInit | undefined;
    
    if (body instanceof FormData) {
        requestBody = body;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    const requestPromise = (async () => {
        try {
            const response = await fetch(url, {
                method,
                headers,
                body: requestBody
            });
    
            const text = await response.text();
    
            // NETWORK SUCCESS
            if (!response.ok) {
                try {
                    const errJson = JSON.parse(text);
                    throw new Error(errJson.error || `Server Error: ${response.status}`);
                } catch {
                    throw new Error(`Server Error: ${response.status} ${response.statusText}`);
                }
            }
            
            if (!text || text.trim().length === 0) {
                throw new Error("Empty response from API. Check PHP logs.");
            }
    
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                if (text.includes('Fatal error') || text.includes('Parse error')) {
                     const match = text.match(/(Fatal|Parse) error: (.*?) in/);
                     throw new Error(`PHP Error: ${match ? match[2] : 'Unknown Syntax Error'}`);
                }
                throw new Error(`Invalid JSON from API.`);
            }
            
            if (!json.success) {
                throw new Error(json.error || 'Operation failed');
            }
    
            // CACHE SUCCESSFUL GET RESPONSES
            if (method === 'GET') {
                this.saveToCache(cacheKey, json.data);
            }
    
            return json.data as T;
    
        } catch (error: any) {
            // NETWORK FAIL - FALLBACK TO CACHE
            if (method === 'GET') {
                console.warn(`Network request failed for ${cacheKey}, trying cache...`);
                const cached = this.getFromCache<T>(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            
            if (!silent) console.error("API Request Failed:", endpoint, error);
            throw error;
        } finally {
            // Remove from pending map when done (success or fail)
            if (method === 'GET') {
                this.pendingRequests.delete(cacheKey);
            }
        }
    })();

    if (method === 'GET') {
        this.pendingRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
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

  // --- INSTALLATION CHECK (SECURITY FIX) ---
  public async checkInstallation() {
    if (this.isDemoMode) {
        this.isInstalled = true;
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/install.php?action=check`);
        if (!response.ok) throw new Error("Backend unreachable");
        const text = await response.text();
        if (!text) throw new Error("Empty response");
        
        const json = JSON.parse(text);
        
        // Only set to FALSE if the server EXPLICITLY says { installed: false }
        // If there's a network error, DB error, or weird response, we assume TRUE (installed)
        // to prevent redirecting users to the setup page by accident.
        if (json.success && json.data.installed === false) {
            this.isInstalled = false;
        } else {
            this.isInstalled = true;
        }
    } catch (e) {
        // If network fails, we assume installed (Offline Mode)
        console.warn("Backend check failed, assuming installed (Offline Mode)", e);
        this.isInstalled = true;
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
    if (this.isOffline) throw new Error("Cannot upload while offline.");
    
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
                    if (json.success) {
                        // Invalidate video list cache so new content appears
                        this.invalidateCache('index.php?action=get_videos');
                        // MARK HOME AS DIRTY to force refresh when user goes back
                        this.setHomeDirty();
                        resolve(); 
                    } else reject(new Error(json.error || 'Upload failed')); 
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
    // Import also adds content, so mark home dirty
    this.invalidateCache('index.php?action=get_videos');
    this.setHomeDirty();
  }

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
          return res ? res.isSubscribed : false;
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