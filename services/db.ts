import { User, Video, Transaction, MarketplaceItem, MarketplaceReview, SystemSettings, Notification, ContentRequest, BalanceRequest, OrganizeResult, SmartCleanerResult, VideoResult, SaleRecord, FtpFile } from '../types';

export class DBService {
  private demoMode = false;
  private apiBase = 'api/';

  constructor() {
     // Check if demo mode is enabled in localStorage
     this.demoMode = localStorage.getItem('sp_demo_mode') === 'true';
  }

  enableDemoMode() {
      this.demoMode = true;
      localStorage.setItem('sp_demo_mode', 'true');
  }

  private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, isUpload = false, onProgress?: (percent: number, loaded: number, total: number) => void): Promise<T> {
    const headers: HeadersInit = {};
    if (!isUpload) {
        headers['Content-Type'] = 'application/json';
    }
    
    const token = localStorage.getItem('sp_session_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
        method,
        headers,
    };

    if (body) {
        if (isUpload) {
             options.body = body; // FormData
             if (onProgress) {
                 return this.xhrRequest(endpoint, method, body, onProgress);
             }
        } else {
            options.body = JSON.stringify(body);
        }
    }

    const url = endpoint.startsWith('http') ? endpoint : (this.apiBase + endpoint);

    const response = await fetch(url, options);
    const json = await response.json();

    if (!json.success) {
        throw new Error(json.error || 'API Error');
    }

    return json.data as T;
  }
  
  private xhrRequest<T>(endpoint: string, method: string, body: any, onProgress: (p: number, l: number, t: number) => void): Promise<T> {
      return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(method, this.apiBase + endpoint);
          
          const token = localStorage.getItem('sp_session_token');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          if (xhr.upload && onProgress) {
              xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                      const percent = (e.loaded / e.total) * 100;
                      onProgress(percent, e.loaded, e.total);
                  }
              };
          }

          xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                      const json = JSON.parse(xhr.responseText);
                      if (json.success) resolve(json.data);
                      else reject(new Error(json.error || 'API Error'));
                  } catch (e) {
                      reject(new Error('Invalid JSON response'));
                  }
              } else {
                  reject(new Error(`HTTP ${xhr.status}`));
              }
          };

          xhr.onerror = () => reject(new Error('Network Error'));
          xhr.send(body);
      });
  }

  // --- Methods ---

  async checkInstallation(): Promise<boolean> {
      try {
          const res = await this.request<{installed: boolean}>('index.php?action=check_install');
          return res.installed;
      } catch (e) {
          return false;
      }
  }

  needsSetup(): boolean {
      return false; // Handled by guard check logic externally usually
  }

  async verifyDbConnection(config: any): Promise<boolean> {
      const res = await this.request<{connected: boolean}>('index.php?action=verify_db', 'POST', config);
      return res.connected;
  }

  async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
      await this.request('index.php?action=install', 'POST', { dbConfig, adminConfig });
  }

  async login(username: string, password: string): Promise<User> {
      return this.request<User>('index.php?action=login', 'POST', { username, password });
  }

  async register(username: string, password: string, avatar?: File | null): Promise<User> {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      if (avatar) formData.append('avatar', avatar);
      return this.request<User>('index.php?action=register', 'POST', formData, true);
  }

  async logout(userId: string): Promise<void> {
      await this.request('index.php?action=logout', 'POST', { userId });
  }

  async getUser(userId: string): Promise<User | null> {
      return this.request<User>(`index.php?action=get_user&id=${userId}`);
  }
  
  async getAllUsers(): Promise<User[]> {
      return this.request<User[]>('index.php?action=get_all_users');
  }

  async heartbeat(userId: string, token: string): Promise<boolean> {
      try {
          await this.request('index.php?action=heartbeat', 'POST', { userId, token });
          return true;
      } catch {
          return false;
      }
  }

  saveOfflineUser(user: User) {
      localStorage.setItem('sp_offline_user', JSON.stringify(user));
  }

  getOfflineUser(): User | null {
      const s = localStorage.getItem('sp_offline_user');
      return s ? JSON.parse(s) : null;
  }

  async getAllVideos(): Promise<Video[]> {
      return this.request<Video[]>('index.php?action=get_videos');
  }

  async getVideosByCreator(userId: string): Promise<Video[]> {
      return this.request<Video[]>(`index.php?action=get_videos&creator_id=${userId}`);
  }

  async getVideo(id: string): Promise<Video | null> {
      return this.request<Video>(`index.php?action=get_video&id=${id}`);
  }

  async uploadVideo(title: string, description: string, price: number, category: string, duration: number, user: User, file: File, thumbnail: File | null, onProgress: (p: number, l: number, t: number) => void): Promise<void> {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('price', price.toString());
      formData.append('category', category);
      formData.append('duration', duration.toString());
      formData.append('creator_id', user.id);
      formData.append('video', file);
      if (thumbnail) formData.append('thumbnail', thumbnail);

      await this.request('index.php?action=upload_video', 'POST', formData, true, onProgress);
  }

  async deleteVideo(videoId: string, userId: string): Promise<void> {
      await this.request('index.php?action=delete_video', 'POST', { videoId, userId });
  }

  async hasPurchased(userId: string, videoId: string): Promise<boolean> {
      return this.request<boolean>('index.php?action=has_purchased', 'POST', { userId, videoId });
  }

  async purchaseVideo(userId: string, videoId: string): Promise<void> {
      await this.request('index.php?action=purchase_video', 'POST', { userId, videoId });
  }

  async getInteraction(userId: string, videoId: string): Promise<any> {
      return this.request('index.php?action=get_interaction', 'POST', { userId, videoId });
  }

  async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<any> {
      return this.request('index.php?action=rate_video', 'POST', { userId, videoId, type });
  }
  
  async markWatched(userId: string, videoId: string): Promise<void> {
      await this.request('index.php?action=mark_watched', 'POST', { userId, videoId });
  }

  async getComments(videoId: string): Promise<any[]> {
      return this.request(`index.php?action=get_comments&video_id=${videoId}`);
  }

  async addComment(userId: string, videoId: string, text: string): Promise<any> {
      return this.request('index.php?action=add_comment', 'POST', { userId, videoId, text });
  }

  async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
      const res = await this.request<{isSubscribed: boolean}>('index.php?action=check_subscription', 'POST', { userId, creatorId });
      return res.isSubscribed;
  }

  async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
      return this.request('index.php?action=toggle_subscribe', 'POST', { userId, creatorId });
  }

  async getRelatedVideos(videoId: string, context?: any): Promise<Video[]> {
      return this.request<Video[]>('index.php?action=get_related', 'POST', { videoId, context });
  }

  async getSystemSettings(): Promise<SystemSettings> {
      return this.request<SystemSettings>('index.php?action=get_settings');
  }

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
      await this.request('index.php?action=update_settings', 'POST', settings);
  }

  async updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
      await this.request('index.php?action=update_profile', 'POST', { userId, data });
  }
  
  async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
      await this.request('index.php?action=change_password', 'POST', { userId, oldPass, newPass });
  }

  async uploadAvatar(userId: string, file: File): Promise<void> {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('avatar', file);
      await this.request('index.php?action=upload_avatar', 'POST', formData, true);
  }

  async requestBalance(userId: string, amount: number): Promise<void> {
      await this.request('index.php?action=request_balance', 'POST', { userId, amount });
  }

  async getBalanceRequests(): Promise<BalanceRequest[]> {
      return this.request<BalanceRequest[]>('index.php?action=get_balance_requests');
  }

  async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
      await this.request('index.php?action=handle_balance_request', 'POST', { adminId, reqId, action });
  }
  
  async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
      await this.request('index.php?action=admin_add_balance', 'POST', { adminId, targetId, amount });
  }

  async getSales(userId: string): Promise<SaleRecord[]> {
      return this.request<SaleRecord[]>(`index.php?action=get_sales&user_id=${userId}`);
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
      return this.request<Transaction[]>(`index.php?action=get_transactions&user_id=${userId}`);
  }

  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
      return this.request<MarketplaceItem[]>('index.php?action=get_marketplace_items');
  }

  async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
      return this.request<MarketplaceItem>(`index.php?action=get_marketplace_item&id=${id}`);
  }

  async createListing(formData: FormData): Promise<void> {
      await this.request('index.php?action=create_listing', 'POST', formData, true);
  }
  
  async editListing(itemId: string, userId: string, data: any): Promise<void> {
      await this.request('index.php?action=edit_listing', 'POST', { itemId, userId, data });
  }

  async getReviews(itemId: string): Promise<MarketplaceReview[]> {
      return this.request<MarketplaceReview[]>(`index.php?action=get_reviews&item_id=${itemId}`);
  }

  async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
      await this.request('index.php?action=add_review', 'POST', { itemId, userId, rating, comment });
  }

  async checkoutCart(userId: string, cart: any[], shipping: any): Promise<void> {
      await this.request('index.php?action=checkout', 'POST', { userId, cart, shipping });
  }
  
  async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
      await this.request('index.php?action=update_order_status', 'POST', { userId, txId, status });
  }

  async getNotifications(userId: string): Promise<Notification[]> {
      return this.request<Notification[]>(`index.php?action=get_notifications&user_id=${userId}`);
  }
  
  async markNotificationRead(id: string): Promise<void> {
      await this.request('index.php?action=mark_notification_read', 'POST', { id });
  }

  // Admin & System methods
  async scanLocalLibrary(path: string): Promise<any> {
      return this.request('index.php?action=scan_library', 'POST', { path });
  }

  async processScanBatch(): Promise<{processed: any[], remaining: number, completed: boolean}> {
      return this.request('index.php?action=process_scan_batch', 'POST');
  }

  async updateVideoMetadata(id: string, duration: number, thumbnail: File | null): Promise<void> {
      const formData = new FormData();
      formData.append('id', id);
      formData.append('duration', duration.toString());
      if (thumbnail) formData.append('thumbnail', thumbnail);
      await this.request('index.php?action=update_metadata', 'POST', formData, true);
  }

  async smartOrganizeLibrary(): Promise<OrganizeResult> {
      return this.request<OrganizeResult>('index.php?action=smart_organize', 'POST');
  }

  async rectifyLibraryTitles(lastId: string = ''): Promise<{processed: number, lastId: string, completed: boolean}> {
      return this.request('index.php?action=rectify_titles', 'POST', { lastId });
  }
  
  async listFtpFiles(path: string): Promise<FtpFile[]> {
      return this.request<FtpFile[]>('index.php?action=ftp_list', 'POST', { path });
  }

  async importFtpFile(path: string): Promise<void> {
      await this.request('index.php?action=ftp_import', 'POST', { path });
  }

  async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
      return this.request('index.php?action=ftp_scan_recursive', 'POST', { path });
  }

  async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
      return this.request('index.php?action=admin_get_marketplace');
  }

  async adminDeleteListing(itemId: string): Promise<void> {
      await this.request('index.php?action=admin_delete_listing', 'POST', { itemId });
  }

  async adminCleanupSystemFiles(): Promise<any> {
      return this.request('index.php?action=admin_cleanup_files', 'POST');
  }

  async adminRepairDb(): Promise<void> {
      await this.request('index.php?action=admin_repair_db', 'POST');
  }

  async getSmartCleanerPreview(category: string, percent: number, days: number): Promise<SmartCleanerResult> {
      return this.request<SmartCleanerResult>('index.php?action=smart_cleaner_preview', 'POST', { category, percent, days });
  }

  async executeSmartCleaner(ids: string[]): Promise<{deleted: number}> {
      return this.request('index.php?action=smart_cleaner_execute', 'POST', { ids });
  }

  async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
      return this.request<VideoResult[]>('index.php?action=search_external', 'POST', { query, source });
  }
  
  async serverImportVideo(url: string): Promise<void> {
      await this.request('index.php?action=server_import', 'POST', { url });
  }

  async requestContent(userId: string, query: string, useLocal: boolean): Promise<void> {
      await this.request('index.php?action=request_content', 'POST', { userId, query, useLocal });
  }

  async getRequests(): Promise<ContentRequest[]> {
      return this.request<ContentRequest[]>('index.php?action=get_requests');
  }

  async deleteRequest(id: string): Promise<void> {
      await this.request('index.php?action=delete_request', 'POST', { id });
  }

  async updatePricesBulk(userId: string, price: number): Promise<void> {
      await this.request('index.php?action=update_prices_bulk', 'POST', { userId, price });
  }

  // Cache/Utils
  setHomeDirty() {
      // Implement if needed to trigger re-fetches
  }

  invalidateCache(key: string) {
      // Implement if caching is added
  }
}

export const db = new DBService();
