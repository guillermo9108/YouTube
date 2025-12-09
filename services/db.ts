




import { User, Video, Transaction, Comment, UserInteraction, UserRole, ContentRequest, SystemSettings, VideoCategory, SmartCleanerResult, Notification, MarketplaceItem, CartItem, FtpSettings, BalanceRequest, MarketplaceReview } from '../types';

const API_BASE = 'api';

// --- MOCK DATA ---
const MOCK_VIDEOS: Video[] = [
  {
    id: 'demo_1',
    title: 'Cyberpunk City Run',
    description: 'A futuristic run.',
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
  source: 'Pexels' | 'Pixabay' | 'YouTube';
  thumbnail: string;
  title: string;
  duration?: number;
  downloadUrl: string;
  author: string;
}

export interface ScanResult {
    success: boolean;
    totalFound: number;
    newToImport: number;
    errors?: string[];
}

export interface SaleRecord extends Transaction {
    itemTitle: string;
    itemImage: string;
    buyerName: string;
    buyerAvatar: string;
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

  // OPTIMIZATION: Non-blocking cache write to prevent UI freeze on large datasets
  private saveToCache(key: string, data: any) {
      if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(() => this.performSave(key, data));
      } else {
          setTimeout(() => this.performSave(key, data), 0);
      }
  }

  private performSave(key: string, data: any) {
      const cacheItem = JSON.stringify({ timestamp: Date.now(), data: data });
      try {
          if (key.includes('action=')) localStorage.setItem(`sp_cache_${key}`, cacheItem);
      } catch (e: any) {
          if (e.name === 'QuotaExceededError') {
              this.evictCache();
              try { localStorage.setItem(`sp_cache_${key}`, cacheItem); } catch(e){}
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
                  if (val) items.push({ key: k, timestamp: JSON.parse(val).timestamp || 0 });
              } catch(e) { items.push({ key: k, timestamp: 0 }); }
          }
      }
      items.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = Math.ceil(items.length * 0.5);
      for (let i = 0; i < toDelete; i++) localStorage.removeItem(items[i].key);
  }

  private getFromCache<T>(key: string, maxAgeMs: number = 0): T | null {
      const item = localStorage.getItem(`sp_cache_${key}`);
      if (!item) return null;
      try {
          const parsed = JSON.parse(item);
          if (maxAgeMs > 0 && (Date.now() - parsed.timestamp > maxAgeMs)) return null;
          return parsed.data as T;
      } catch { return null; }
  }

  public invalidateCache(endpointKey: string) { localStorage.removeItem(`sp_cache_${endpointKey}`); }
  public setHomeDirty() { localStorage.setItem('sp_home_dirty', 'true'); }

  private async request<T>(endpoint: string, method: string = 'GET', body?: any, silent: boolean = false): Promise<T> {
    if (this.isDemoMode) return this.handleMockRequest<T>(endpoint, method, body);

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const cacheKey = cleanEndpoint; 
    
    if (method === 'GET' && cleanEndpoint.includes('get_videos') && !cleanEndpoint.includes('id=')) {
        const cached = this.getFromCache<T>(cacheKey, 5 * 60 * 1000); 
        if (cached) return cached;
    }

    if (this.isOffline && method === 'GET') {
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) return cached;
        throw new Error("Offline and no cache.");
    }

    if (this.isOffline && method === 'POST') throw new Error("Offline. Action not available.");

    const url = method === 'GET' ? `${API_BASE}/${cleanEndpoint}${cleanEndpoint.includes('?') ? '&' : '?'}_t=${Date.now()}` : `${API_BASE}/${cleanEndpoint}`;
    const headers: HeadersInit = { 'Cache-Control': 'no-cache', 'Expires': '0' };
    let requestBody: BodyInit | undefined;
    if (body instanceof FormData) requestBody = body;
    else if (body) { headers['Content-Type'] = 'application/json'; requestBody = JSON.stringify(body); }

    try {
        const response = await fetch(url, { method, headers, body: requestBody });
        const text = await response.text();
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        let json;
        try { json = JSON.parse(text); } catch { throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`); }
        if (!json.success) throw new Error(json.error || 'Operation failed');

        if (method === 'GET') this.saveToCache(cacheKey, json.data);
        return json.data as T;
    } catch (error: any) {
        if (!silent) console.error("API Error:", endpoint, error);
        throw error;
    }
  }

  private async handleMockRequest<T>(endpoint: string, method: string, body: any): Promise<T> {
    await new Promise(r => setTimeout(r, 500)); 
    if (endpoint.includes('get_videos')) return MOCK_VIDEOS as T;
    return {} as T;
  }

  public async checkInstallation() {
    try {
        const response = await fetch(`${API_BASE}/install.php?action=check`);
        const json = await response.json();
        this.isInstalled = json.success ? json.data.installed : true;
    } catch (e) { this.isInstalled = true; }
  }

  public needsSetup(): boolean { return !this.isInstalled; }
  public async verifyDbConnection(config: any): Promise<boolean> { await this.request('install.php?action=verify_db', 'POST', config); return true; }
  public async initializeSystem(dbConfig: any, adminUser: Partial<User>): Promise<void> { await this.request('install.php?action=install', 'POST', { dbConfig, adminUser }); this.isInstalled = true; }
  public enableDemoMode() { this.isDemoMode = true; this.isInstalled = true; localStorage.setItem('sp_demo_mode', 'true'); window.location.reload(); }

  async login(username: string, password: string): Promise<User> { return this.request<User>('index.php?action=login', 'POST', { username, password }); }
  async logout(userId: string): Promise<void> { await this.request('index.php?action=logout', 'POST', { userId }); }
  async heartbeat(userId: string, token: string): Promise<boolean> { try { await this.request('index.php?action=heartbeat', 'POST', { userId, token }, true); return true; } catch { return false; } }
  
  async register(username: string, password: string, avatar?: File | null): Promise<User> { 
      const fd = new FormData(); fd.append('username', username); fd.append('password', password); if(avatar) fd.append('avatar', avatar);
      return this.request<User>('index.php?action=register', 'POST', fd); 
  }

  async getUser(id: string): Promise<User | null> { try { return await this.request<User>(`index.php?action=get_user&id=${id}`); } catch { return null; } }
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> { await this.request('index.php?action=update_user', 'POST', { userId, updates }); }
  async uploadAvatar(userId: string, file: File): Promise<string> { const fd = new FormData(); fd.append('userId', userId); fd.append('avatar', file); const r = await this.request<{avatarUrl:string}>('index.php?action=update_avatar', 'POST', fd); return r.avatarUrl; }
  async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> { await this.request('index.php?action=change_password', 'POST', { userId, oldPass, newPass }); }

  async getAllVideos(): Promise<Video[]> { return this.request<Video[]>('index.php?action=get_videos'); }
  async getVideo(id: string): Promise<Video | undefined> { try { return await this.request<Video>(`index.php?action=get_video&id=${id}`); } catch { return undefined; } }
  async deleteVideo(id: string, userId: string): Promise<void> { await this.request('index.php?action=delete_video', 'POST', { id, userId }); this.invalidateCache('index.php?action=get_videos'); this.setHomeDirty(); }
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
    if (this.isDemoMode) return;
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('title', title); formData.append('description', description); formData.append('price', price.toString()); formData.append('category', category); formData.append('duration', duration.toString()); formData.append('creatorId', creator.id);
        if (file) formData.append('video', file); if (thumbnail) formData.append('thumbnail', thumbnail);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/index.php?action=upload_video`, true);
        if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total); };
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { this.invalidateCache('index.php?action=get_videos'); this.setHomeDirty(); resolve(); } else reject(new Error('Upload failed')); };
        xhr.onerror = () => reject(new Error("Network connection error"));
        xhr.send(formData);
    });
  }

  async repairThumbnail(videoId: string, file: File): Promise<void> {
      const formData = new FormData(); formData.append('videoId', videoId); formData.append('thumbnail', file);
      await this.request('index.php?action=repair_thumbnail', 'POST', formData, true);
  }

  // --- NEW SCANNING METHODS ---
  async scanLocalLibrary(path: string): Promise<ScanResult> { return this.request<ScanResult>('index.php?action=scan_local_library', 'POST', { path }); }
  async getUnprocessedVideos(): Promise<Video[]> { return this.request<Video[]>('index.php?action=get_unprocessed_videos', 'GET'); }
  async updateVideoMetadata(id: string, duration: number, thumbnail: File | null): Promise<void> {
      const formData = new FormData(); formData.append('id', id); formData.append('duration', duration.toString()); if (thumbnail) formData.append('thumbnail', thumbnail);
      await this.request('index.php?action=update_video_metadata', 'POST', formData, true);
  }
  // Deprecated/Stub
  async processScanBatch(): Promise<any> { return { completed: true }; }

  // --- FTP ---
  async listFtpFiles(path: string): Promise<any[]> { return this.request<any[]>('index.php?action=ftp_list', 'POST', { path }); }
  async importFtpFile(path: string): Promise<void> { await this.request('index.php?action=ftp_import', 'POST', { path }); }
  async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> { return this.request<{scanned: number, added: number}>('index.php?action=scan_ftp_recursive', 'POST', { path }); }

  async updatePricesBulk(creatorId: string, newPrice: number): Promise<void> { await this.request('index.php?action=update_prices_bulk', 'POST', { creatorId, newPrice }); }
  
  async getAllUsers(): Promise<User[]> { 
      try { 
          const users = await this.request<User[]>('index.php?action=get_all_users'); 
          // Safety: ensure balance is number
          return users.map(u => ({...u, balance: Number(u.balance)}));
      } catch { return []; } 
  }
  
  async adminAddBalance(adminId: string, targetUserId: string, amount: number): Promise<void> { await this.request('index.php?action=admin_add_balance', 'POST', { adminId, targetUserId, amount }); }
  async getUserTransactions(userId: string): Promise<Transaction[]> { return this.request<Transaction[]>(`index.php?action=get_transactions&userId=${userId}`); }
  async getVideosByCreator(creatorId: string): Promise<Video[]> { return this.request<Video[]>(`index.php?action=get_creator_videos&creatorId=${creatorId}`); }
  async adminRepairDb(): Promise<void> { await this.request('index.php?action=admin_repair_db', 'POST', {}); }
  async adminCleanupVideos(): Promise<{deleted: number}> { return this.request<{deleted: number}>('index.php?action=admin_cleanup_videos', 'POST', {}); }
  async adminCleanupSystemFiles(): Promise<any> { return this.request<any>('index.php?action=admin_cleanup_system_files', 'POST', {}); }
  async requestBalance(userId: string, amount: number): Promise<void> { await this.request('index.php?action=request_balance', 'POST', { userId, amount }); }
  async getBalanceRequests(): Promise<BalanceRequest[]> { return this.request<BalanceRequest[]>('index.php?action=admin_get_balance_requests', 'POST', {}); }
  async handleBalanceRequest(adminId: string, requestId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> { await this.request('index.php?action=admin_handle_balance_request', 'POST', { adminId, requestId, action }); }
  async getSmartCleanerPreview(category: string, percentage: number, safeHarborDays: number): Promise<SmartCleanerResult> { return this.request<SmartCleanerResult>('index.php?action=admin_smart_cleaner_preview', 'POST', { category, percentage, safeHarborDays }); }
  async executeSmartCleaner(videoIds: string[]): Promise<{deleted: number}> { return this.request<{deleted: number}>('index.php?action=admin_smart_cleaner_execute', 'POST', { videoIds }); }
  async getRequests(status?: string): Promise<ContentRequest[]> { return this.request<ContentRequest[]>(`index.php?action=get_requests${status?`&status=${status}`:''}`); }
  async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<ContentRequest> { return this.request<ContentRequest>('index.php?action=request_content', 'POST', { userId, query, useLocalNetwork }); }
  async deleteRequest(requestId: string): Promise<void> { await this.request('index.php?action=delete_request', 'POST', { requestId }); }
  async getSystemSettings(): Promise<SystemSettings> { return this.request<SystemSettings>('index.php?action=get_system_settings'); }
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> { await this.request('index.php?action=update_system_settings', 'POST', { settings }); }
  async triggerQueueProcessing(): Promise<{ processed: number, message: string }> { return this.request<{ processed: number, message: string }>('index.php?action=process_queue', 'POST', {}); }
  async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE' = 'STOCK'): Promise<VideoResult[]> { return this.request<VideoResult[]>('index.php?action=search_external', 'POST', { query, source }); }
  async serverImportVideo(url: string): Promise<void> { await this.request('index.php?action=server_import_video', 'POST', { url }); this.invalidateCache('index.php?action=get_videos'); this.setHomeDirty(); }
  async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> { return await this.request('index.php?action=toggle_subscribe', 'POST', { userId, creatorId }); }
  async checkSubscription(userId: string, creatorId: string): Promise<boolean> { try { const r = await this.request<{isSubscribed: boolean}>(`index.php?action=check_subscription&userId=${userId}&creatorId=${creatorId}`); return r.isSubscribed; } catch { return false; } }
  async getNotifications(userId: string): Promise<Notification[]> { return this.request<Notification[]>(`index.php?action=get_notifications&userId=${userId}`); }
  async markNotificationRead(notifId: string): Promise<void> { await this.request('index.php?action=mark_notification_read', 'POST', { notifId }); }
  async getSubscriptions(userId: string): Promise<string[]> { return this.request<string[]>(`index.php?action=get_subscriptions&userId=${userId}`); }

  // MARKETPLACE
  async getMarketplaceItems(filters?: any): Promise<MarketplaceItem[]> { return this.request<MarketplaceItem[]>('index.php?action=get_marketplace_items', 'POST', filters); }
  async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> { return this.request<MarketplaceItem[]>('index.php?action=admin_get_marketplace_items', 'POST', {}); }
  async adminDeleteListing(id: string): Promise<void> { await this.request('index.php?action=admin_delete_listing', 'POST', { id }); }
  async getMarketplaceItem(id: string): Promise<MarketplaceItem | undefined> { try { return await this.request<MarketplaceItem>(`index.php?action=get_marketplace_item&id=${id}`); } catch { return undefined; } }
  async createListing(formData: FormData): Promise<void> { await this.request('index.php?action=create_listing', 'POST', formData); }
  async editListing(id: string, userId: string, data: Partial<MarketplaceItem>): Promise<void> { await this.request('index.php?action=edit_listing', 'POST', { id, userId, data }); }
  async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> { await this.request('index.php?action=add_review', 'POST', { itemId, userId, rating, comment }); }
  async getReviews(itemId: string): Promise<MarketplaceReview[]> { return this.request<MarketplaceReview[]>(`index.php?action=get_reviews&itemId=${itemId}`); }
  async checkoutCart(userId: string, cart: CartItem[], shippingDetails: NonNullable<User['shippingDetails']>): Promise<void> { await this.request('index.php?action=checkout_cart', 'POST', { userId, cart, shippingDetails }); }
  async getSales(userId: string): Promise<SaleRecord[]> { return this.request<SaleRecord[]>(`index.php?action=get_sales&userId=${userId}`); }
  async updateOrderStatus(userId: string, transactionId: string, status: 'SHIPPED' | 'PENDING'): Promise<void> { await this.request('index.php?action=update_order_status', 'POST', { userId, transactionId, status }); }
}

export const db = new DatabaseService();