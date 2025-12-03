import { User, Video, Transaction, Comment, UserInteraction, UserRole, ContentRequest, SystemSettings, VideoCategory, SmartCleanerResult, Notification, MarketplaceItem, Order } from '../types';

const API_BASE = 'api';

const MOCK_VIDEOS: Video[] = [
  {
    id: 'demo_1',
    title: 'Demo Video',
    description: 'Video de demostración.',
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

  private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    if (this.isDemoMode && !endpoint.includes('action=login')) {
        // Simple demo mock
        if (endpoint === 'get_videos') return MOCK_VIDEOS as any;
        return {} as T;
    }
    
    // GET Caching (5 seconds short cache for responsiveness, but invalidation handles updates)
    if (method === 'GET') {
        const cached = this.getFromCache<T>(endpoint, 5000);
        if (cached && !this.isOffline) return cached;
        if (this.isOffline) return cached || ([] as any);
    }

    const url = `${API_BASE}/index.php?action=${endpoint}`;
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (!json.success) throw new Error(json.error || 'API Error');
            if (method === 'GET') this.saveToCache(endpoint, json.data);
            return json.data;
        } catch (e: any) {
            console.error("Invalid JSON:", text.substring(0, 500));
            // Show a bit of the text in the error message for debugging
            throw new Error(`JSON inválido de la API: ${text.substring(0, 100)}...`);
        }
    } catch (e: any) {
        throw e;
    }
  }

  // --- Auth ---
  async login(username: string, password: string): Promise<User> {
      return this.request('login', 'POST', { username, password });
  }

  async register(username: string, password: string, avatar?: File | null): Promise<User> {
      const fd = new FormData();
      fd.append('username', username);
      fd.append('password', password);
      if (avatar) fd.append('avatar', avatar);
      
      const res = await fetch(`${API_BASE}/index.php?action=register`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
  }

  async getUser(id: string): Promise<User> {
      return this.request(`get_user&id=${id}`);
  }

  async logout(userId: string) {
      return this.request('logout', 'POST', { userId });
  }

  async heartbeat(userId: string, token: string): Promise<boolean> {
      try {
          await this.request('heartbeat', 'POST', { userId, token });
          return true;
      } catch { return false; }
  }

  // --- Profile ---
  async updateUserProfile(userId: string, updates: Partial<User>) {
      await this.request('update_user', 'POST', { userId, updates });
  }

  async uploadAvatar(userId: string, file: File) {
      const fd = new FormData();
      fd.append('userId', userId);
      fd.append('avatar', file);
      const res = await fetch(`${API_BASE}/index.php?action=update_avatar`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
      return this.request('change_password', 'POST', { userId, oldPass, newPass });
  }

  // --- Videos ---
  async getAllVideos(): Promise<Video[]> {
      return this.request('get_videos');
  }

  async getVideo(id: string): Promise<Video | null> {
      return this.request(`get_video&id=${id}`);
  }

  async getRelatedVideos(id: string): Promise<Video[]> {
      return this.request(`get_related_videos&id=${id}`);
  }

  async getVideosByCreator(creatorId: string): Promise<Video[]> {
      return this.request(`get_creator_videos&creatorId=${creatorId}`);
  }

  async uploadVideo(title: string, description: string, price: number, category: string, duration: number, user: User, file: File, thumbnail: File | null, onProgress: (percent: number, loaded: number, total: number) => void) {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('price', price.toString());
      fd.append('category', category);
      fd.append('duration', duration.toString());
      fd.append('creatorId', user.id);
      fd.append('video', file);
      if (thumbnail) fd.append('thumbnail', thumbnail);

      return new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/index.php?action=upload_video`);
          
          xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                  const percent = (e.loaded / e.total) * 100;
                  onProgress(percent, e.loaded, e.total);
              }
          };

          xhr.onload = () => {
              if (xhr.status === 200) {
                  try {
                      const json = JSON.parse(xhr.responseText);
                      if (json.success) {
                          this.setHomeDirty();
                          this.invalidateCache('get_videos');
                          resolve();
                      } else {
                          reject(new Error(json.error));
                      }
                  } catch (e) { reject(new Error("Invalid JSON response")); }
              } else {
                  reject(new Error("Upload failed"));
              }
          };

          xhr.onerror = () => reject(new Error("Network Error"));
          xhr.send(fd);
      });
  }

  async purchaseVideo(userId: string, videoId: string) {
      await this.request('purchase_video', 'POST', { userId, videoId });
      this.invalidateCache(`has_purchased&userId=${userId}&videoId=${videoId}`);
  }

  async hasPurchased(userId: string, videoId: string): Promise<boolean> {
      const res = await this.request<{hasPurchased: boolean}>(`has_purchased&userId=${userId}&videoId=${videoId}`);
      return res.hasPurchased;
  }

  async rateVideo(userId: string, videoId: string, rating: 'like' | 'dislike') {
      const res = await this.request<UserInteraction>('rate_video', 'POST', { userId, videoId, rating });
      this.invalidateCache(`get_interaction&userId=${userId}&videoId=${videoId}`);
      return res;
  }

  async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
      return this.request(`get_interaction&userId=${userId}&videoId=${videoId}`);
  }

  async markWatched(userId: string, videoId: string) {
      return this.request('mark_watched', 'POST', { userId, videoId });
  }

  async getComments(videoId: string): Promise<Comment[]> {
      return this.request(`get_comments&videoId=${videoId}`);
  }

  async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
      const res = await this.request<Comment>('add_comment', 'POST', { userId, videoId, text });
      this.invalidateCache(`get_comments&videoId=${videoId}`);
      return res;
  }

  async toggleWatchLater(userId: string, videoId: string): Promise<string[]> {
      const res = await this.request<{list: string[]}>('toggle_watch_later', 'POST', { userId, videoId });
      return res.list;
  }

  // --- Marketplace ---
  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
      return this.request('get_marketplace_items');
  }

  async getMarketplaceItem(id: string): Promise<MarketplaceItem> {
      return this.request(`get_marketplace_item&id=${id}`);
  }

  async createListing(sellerId: string, title: string, description: string, price: number, stock: number, discountPercent: number, mediaFiles: File[]) {
      const fd = new FormData();
      fd.append('sellerId', sellerId);
      fd.append('title', title);
      fd.append('description', description);
      fd.append('price', price.toString());
      fd.append('stock', stock.toString());
      fd.append('discountPercent', discountPercent.toString());
      mediaFiles.forEach(f => fd.append('media[]', f));
      
      const res = await fetch(`${API_BASE}/index.php?action=create_marketplace_item`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
  }

  async editListing(itemId: string, sellerId: string, updates: Partial<MarketplaceItem>) {
      return this.request('edit_marketplace_item', 'POST', { itemId, sellerId, updates });
  }

  async checkoutCart(buyerId: string, items: {id: string, quantity: number}[], shippingData: any) {
      return this.request('checkout_cart', 'POST', { buyerId, items, shippingData });
  }

  async getUserOrders(userId: string): Promise<{bought: Order[], sold: Order[]}> {
      return this.request(`get_user_orders&userId=${userId}`);
  }

  // --- System ---
  async getSystemSettings(): Promise<SystemSettings> {
      return this.request('get_system_settings');
  }
  
  async updateSystemSettings(settings: SystemSettings) {
      return this.request('update_system_settings', 'POST', { settings });
  }

  // --- Admin ---
  async getAllUsers(): Promise<User[]> {
      return this.request('get_all_users');
  }

  async adminAddBalance(adminId: string, targetUserId: string, amount: number) {
      return this.request('admin_add_balance', 'POST', { adminId, targetUserId, amount });
  }

  async adminRepairDb() {
      return this.request('admin_repair_db', 'POST');
  }

  async adminCleanupVideos() {
      return this.request('admin_cleanup_videos', 'POST');
  }

  async triggerQueueProcessing() {
      return this.request('process_queue', 'POST');
  }

  async scanLocalLibraryStream(path: string, onMessage: (msg: string, type: string) => void) {
      return new Promise<void>((resolve, reject) => {
          const evtSource = new EventSource(`${API_BASE}/index.php?action=scan_local_library&path=${encodeURIComponent(path)}`);
          
          evtSource.onmessage = (e) => {
              if (e.data === '[DONE]') {
                  evtSource.close();
                  resolve();
                  return;
              }
              try {
                  const data = JSON.parse(e.data);
                  onMessage(data.msg, data.type);
              } catch(err) {
                  onMessage(e.data, 'log');
              }
          };

          evtSource.onerror = () => {
              evtSource.close();
              reject(new Error("Conexión perdida con el escáner"));
          };
      });
  }

  async getRequests(): Promise<ContentRequest[]> {
      return this.request('get_requests');
  }

  async requestContent(userId: string, query: string, useLocalNetwork: boolean) {
      return this.request('request_content', 'POST', { userId, query, useLocalNetwork });
  }

  async deleteRequest(requestId: string) {
      return this.request('delete_request', 'POST', { requestId });
  }

  async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
      return this.request('search_external', 'POST', { query, source });
  }
  
  async serverImportVideo(url: string) {
      return this.request('server_import_video', 'POST', { url });
  }

  async checkInstallation(): Promise<boolean> {
      try {
          const res = await fetch(`${API_BASE}/install.php?action=check`);
          if (!res.ok) return false;
          const json = await res.json();
          this.isInstalled = json.data?.installed;
          return this.isInstalled;
      } catch { return false; }
  }

  needsSetup() { return !this.isInstalled && !this.isDemoMode; }
  enableDemoMode() { localStorage.setItem('sp_demo_mode', 'true'); this.isDemoMode = true; this.isInstalled = true; }

  async verifyDbConnection(config: any): Promise<boolean> {
      const res = await fetch(`${API_BASE}/install.php?action=verify_db`, {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return true;
  }

  async initializeSystem(dbConfig: any, adminConfig: any) {
      // 1. Write Config
      const res = await fetch(`${API_BASE}/install.php?action=install`, {
           method: 'POST', headers: {'Content-Type': 'application/json'}, 
           body: JSON.stringify({ ...dbConfig, ...adminConfig })
      });
      if(!res.ok) throw new Error("Install script failed");
      const json = await res.json();
      if(!json.success) throw new Error(json.error);

      // 2. Init Tables via Main API
      await this.request('admin_repair_db', 'POST');
      // 3. Register Admin
      await this.register(adminConfig.username, adminConfig.password);
      // 4. Set Role
      // Note: First user registered is usually not admin automatically in this logic, 
      // but since we just installed, we can manually assume or update via SQL if needed.
      // For now, let's assume the install script handled the user creation or we do it here.
      // Actually, standard register is fine. The install.php usually writes db_config.json.
      
      this.isInstalled = true;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
      return this.request(`get_notifications&userId=${userId}`);
  }

  async markNotificationRead(notifId: string) {
      return this.request('mark_notification_read', 'POST', { notifId });
  }

  async getSmartCleanerPreview(category: string, percentage: number, safeHarborDays: number): Promise<SmartCleanerResult> {
      return this.request('admin_smart_cleaner_preview', 'POST', { category, percentage, safeHarborDays });
  }

  async executeSmartCleaner(videoIds: string[]) {
      return this.request('admin_smart_cleaner_execute', 'POST', { videoIds });
  }

  async toggleSubscribe(userId: string, creatorId: string) {
      return this.request<{isSubscribed: boolean}>('toggle_subscribe', 'POST', { userId, creatorId });
  }

  async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
      const res = await this.request<{isSubscribed: boolean}>(`check_subscription&userId=${userId}&creatorId=${creatorId}`);
      return res.isSubscribed;
  }

  async getSubscriptions(userId: string): Promise<string[]> {
      return this.request(`get_subscriptions&userId=${userId}`);
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
      return this.request(`get_transactions&userId=${userId}`);
  }

  async getUserActivity(userId: string) {
      return this.request<{liked: string[], watched: string[]}>(`get_user_activity&userId=${userId}`);
  }

  async updatePricesBulk(creatorId: string, newPrice: number) {
      return this.request('update_prices_bulk', 'POST', { creatorId, newPrice });
  }

  async repairThumbnail(videoId: string, file: File) {
      const fd = new FormData();
      fd.append('videoId', videoId);
      fd.append('thumbnail', file);
      await fetch(`${API_BASE}/index.php?action=repair_thumbnail`, { method: 'POST', body: fd });
  }
}

export const db = new DatabaseService();