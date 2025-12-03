
import { User, Video, Transaction, Comment, UserInteraction, UserRole, ContentRequest, SystemSettings, VideoCategory, SmartCleanerResult, Notification, MarketplaceItem, Order } from '../types';

// CRITICAL FIX: Use relative path 'api' instead of absolute '/api'
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

export interface ScanResult {
    scanned: number;
    imported: number;
    errors: string[];
    log: string[];
}

class DatabaseService {
  private isInstalled: boolean = true; 
  private isDemoMode: boolean = false;
  private isOffline: boolean = !navigator.onLine;
  
  private pendingRequests = new Map<string, Promise<any>>();

  constructor() {
    if (localStorage.getItem('sp_demo_mode') === 'true') {
        this.isDemoMode = true;
        this.isInstalled = true;
    }
    
    window.addEventListener('online', () => { this.isOffline = false; });
    window.addEventListener('offline', () => { this.isOffline = true; });
  }

  // --- CACHE SYSTEM ---
  private saveToCache(key: string, data: any) {
      const cacheItem = JSON.stringify({
          timestamp: Date.now(),
          data: data
      });
      try {
          if (key.includes('action=')) {
              localStorage.setItem(`sp_cache_${key}`, cacheItem);
          }
      } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              this.evictCache();
              try {
                  if (key.includes('action=')) {
                      localStorage.setItem(`sp_cache_${key}`, cacheItem);
                  }
              } catch (retryErr) {}
          }
      }
  }

  private evictCache() {
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
                  items.push({ key: k, timestamp: 0 });
              }
          }
      }
      items.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = Math.ceil(items.length * 0.5);
      for (let i = 0; i < toDelete; i++) {
          localStorage.removeItem(items[i].key);
      }
  }

  private getFromCache<T>(key: string, maxAgeMs: number = 0): T | null {
      const item = localStorage.getItem(`sp_cache_${key}`);
      if (!item) return null;
      try {
          const parsed = JSON.parse(item);
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

  public setHomeDirty() {
      localStorage.setItem('sp_home_dirty', 'true');
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: any, silent: boolean = false): Promise<T> {
    if (this.isDemoMode) {
       return this.handleMockRequest<T>(endpoint, method, body);
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const cacheKey = cleanEndpoint; 
    
    if (method === 'GET' && cleanEndpoint.includes('get_videos') && !cleanEndpoint.includes('id=')) {
        const cached = this.getFromCache<T>(cacheKey, 5 * 60 * 1000); 
        if (cached) return cached;
    }

    if (this.isOffline && method === 'GET') {
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) return cached;
        throw new Error("No internet connection and no cached data available.");
    }

    if (this.isOffline && method === 'POST') {
        throw new Error("You are offline. Action cannot be completed.");
    }

    if (method === 'GET' && this.pendingRequests.has(cacheKey)) {
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
                throw new Error(`Invalid JSON from API.`);
            }
            
            if (!json.success) {
                throw new Error(json.error || 'Operation failed');
            }
    
            if (method === 'GET') {
                this.saveToCache(cacheKey, json.data);
            }
    
            return json.data as T;
    
        } catch (error: any) {
            if (method === 'GET') {
                const cached = this.getFromCache<T>(cacheKey);
                if (cached) return cached;
            }
            if (!silent) console.error("API Request Failed:", endpoint, error);
            throw error;
        } finally {
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
        const json = await response.json();
        this.isInstalled = !(json.success && json.data.installed === false);
    } catch (e) {
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
  async getVideo(id: string): Promise<Video | undefined> { try { return await this.request<Video>(`index.php?action=get_video&id=${id}`); } catch (e) { return undefined; } }
  async getRelatedVideos(currentVideoId: string): Promise<Video[]> { return this.request<Video[]>(`index.php?action=get_related_videos&id=${currentVideoId}`); }
  async hasPurchased(userId: string, videoId: string): Promise<boolean> { const res = await this.request<{ hasPurchased: boolean }>(`index.php?action=has_purchased&userId=${userId}&videoId=${videoId}`); return res.hasPurchased; }
  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> { return this.request<UserInteraction>(`index.php?action=get_interaction&userId=${userId}&videoId=${videoId}`); }
  async rateVideo(userId: string, videoId: string, rating: 'like' | 'dislike'): Promise<UserInteraction> { return this.request<UserInteraction>('index.php?action=rate_video', 'POST', { userId, videoId, rating }); }
  async markWatched(userId: string, videoId: string): Promise<void> { await this.request('index.php?action=mark_watched', 'POST', { userId, videoId }); }
  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> { const res = await this.request<{ list: string[] }>('index.php?action=toggle_watch_later', 'POST', { userId, videoId }); return res.list; }
  async getUserActivity(userId: string): Promise<{ liked: string[], watched: string[] }> { return this.request<{ liked: string[], watched: string[] }>(`index.php?action=get_user_activity&userId=${userId}`); }
  async getComments(videoId: string): Promise<Comment[]> { return this.request<Comment[]>(`index.php?action=get_comments&videoId=${videoId}`); }
  async addComment(userId: string, videoId: string, text: string): Promise<Comment> { return this.request<Comment>('index.php?action=add_comment', 'POST', { userId, videoId, text }); }
  async purchaseVideo(userId: string, videoId: string): Promise<void> { await this.request('index.php?action=purchase_video', 'POST', { userId, videoId }); }
  
  async uploadVideo(title: string, description: string, price: number, category: VideoCategory, duration: number, creator: User, file: File | null, thumbnail: File | null = null, onProgress?: (percent: number, loaded: number, total: number) => void): Promise<void> {
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
        if (onProgress) { xhr.upload.onprogress = (e) => { if (e.lengthComputable) { onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total); } }; }
        xhr.onload = () => { 
            if (xhr.status >= 200 && xhr.status < 300) { 
                this.invalidateCache('index.php?action=get_videos');
                this.setHomeDirty();
                resolve(); 
            } else reject(new Error(`Server error: ${xhr.status}`)); 
        };
        xhr.onerror = () => reject(new Error("Network connection error"));
        xhr.send(formData);
    });
  }

  async repairThumbnail(videoId: string, file: File): Promise<void> {
      const formData = new FormData();
      formData.append('videoId', videoId);
      formData.append('thumbnail', file);
      await this.request('index.php?action=repair_thumbnail', 'POST', formData, true);
  }

  async scanLocalLibraryStream(path: string, onMessage: (msg: string, type: 'log'|'error'|'success') => void): Promise<void> {
      const response = await fetch(`${API_BASE}/index.php?action=scan_local_library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
      });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const dataStr = line.replace('data: ', '').trim();
                  if (dataStr === '[DONE]') {
                      this.invalidateCache('index.php?action=get_videos');
                      this.setHomeDirty();
                      return;
                  }
                  try { const data = JSON.parse(dataStr); onMessage(data.msg, data.type); } catch (e) {}
              }
          }
      }
  }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> { await this.request('index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice }); }
  async getAllUsers(): Promise<User[]> { try { const u = await this.request<User[]>('index.php?action=get_all_users'); return Array.isArray(u) ? u : []; } catch (e) { return []; } }
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> { await this.request('index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount }); }
  async getUserTransactions(userId: string): Promise<Transaction[]> { return this.request<Transaction[]>(`index.php?action=get_transactions&userId=${userId}`); }
  async getVideosByCreator(creatorId: string): Promise<Video[]> { return this.request<Video[]>(`index.php?action=get_creator_videos&creatorId=${creatorId}`); }
  async adminRepairDb(): Promise<void> { await this.request('index.php?action=admin_repair_db', 'POST', {}); }
  async adminCleanupVideos(): Promise<{deleted: number}> { return this.request<{deleted: number}>('index.php?action=admin_cleanup_videos', 'POST', {}); }
  async getSmartCleanerPreview(category: string, percentage: number, safeHarborDays: number): Promise<SmartCleanerResult> { return this.request<SmartCleanerResult>('index.php?action=admin_smart_cleaner_preview', 'POST', { category, percentage, safeHarborDays }); }
  async executeSmartCleaner(videoIds: string[]): Promise<{deleted: number}> { return this.request<{deleted: number}>('index.php?action=admin_smart_cleaner_execute', 'POST', { videoIds }); }
  async getRequests(status?: string): Promise<ContentRequest[]> { const qs = status ? `&status=${status}` : ''; return this.request<ContentRequest[]>(`index.php?action=get_requests${qs}`); }
  async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<ContentRequest> { return this.request<ContentRequest>('index.php?action=request_content', 'POST', { userId, query, useLocalNetwork }); }
  async deleteRequest(requestId: string): Promise<void> { await this.request('index.php?action=delete_request', 'POST', { requestId }); }
  async getSystemSettings(): Promise<SystemSettings> { return this.request<SystemSettings>('index.php?action=get_system_settings'); }
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> { await this.request('index.php?action=update_system_settings', 'POST', { settings }); }
  async triggerQueueProcessing(): Promise<{ processed: number, message: string }> { return this.request<{ processed: number, message: string }>('index.php?action=process_queue', 'POST', {}); }
  async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE' = 'STOCK'): Promise<VideoResult[]> { return this.request<VideoResult[]>('index.php?action=search_external', 'POST', { query, source }); }
  async serverImportVideo(url: string): Promise<void> { await this.request('index.php?action=server_import_video', 'POST', { url }); this.invalidateCache('index.php?action=get_videos'); this.setHomeDirty(); }
  async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> { try { return await this.request('index.php?action=toggle_subscribe', 'POST', { userId, creatorId }); } catch (e) { throw new Error("Could not update subscription."); } }
  async checkSubscription(userId: string, creatorId: string): Promise<boolean> { try { const res = await this.request<{isSubscribed: boolean}>(`index.php?action=check_subscription&userId=${userId}&creatorId=${creatorId}`); return res ? res.isSubscribed : false; } catch { return false; } }
  async getNotifications(userId: string): Promise<Notification[]> { return this.request<Notification[]>(`index.php?action=get_notifications&userId=${userId}`); }
  async markNotificationRead(notifId: string): Promise<void> { await this.request('index.php?action=mark_notification_read', 'POST', { notifId }); }
  async getSubscriptions(userId: string): Promise<string[]> { return this.request<string[]>(`index.php?action=get_subscriptions&userId=${userId}`); }
  
  // MARKETPLACE
  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
      return this.request<MarketplaceItem[]>('index.php?action=get_marketplace_items');
  }

  async getMarketplaceItem(id: string): Promise<MarketplaceItem> {
      return this.request<MarketplaceItem>(`index.php?action=get_marketplace_item&id=${id}`);
  }

  async createListing(sellerId: string, title: string, desc: string, price: number, stock: number, discount: number, files: File[]): Promise<void> {
      const formData = new FormData();
      formData.append('sellerId', sellerId);
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('price', price.toString());
      formData.append('stock', stock.toString());
      formData.append('discountPercent', discount.toString());
      files.forEach(f => formData.append('media[]', f));
      
      await this.request('index.php?action=create_marketplace_item', 'POST', formData);
  }

  async editListing(itemId: string, sellerId: string, updates: Partial<MarketplaceItem>): Promise<void> {
      await this.request('index.php?action=edit_marketplace_item', 'POST', { itemId, sellerId, updates });
  }

  // Deprecated single buy - kept for backward compat if needed, but cart is preferred
  async buyMarketplaceItem(buyerId: string, itemId: string): Promise<void> {
      await this.request('index.php?action=buy_marketplace_item', 'POST', { buyerId, itemId });
  }

  async checkoutCart(buyerId: string, items: {id: string, quantity: number}[], shippingData: any): Promise<void> {
      await this.request('index.php?action=checkout_cart', 'POST', { buyerId, items, shippingData });
  }

  async getUserOrders(userId: string): Promise<{bought: Order[], sold: Order[]}> {
      return this.request<{bought: Order[], sold: Order[]}>(`index.php?action=get_user_orders&userId=${userId}`);
  }
}

export const db = new DatabaseService();
