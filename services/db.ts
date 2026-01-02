
import { 
  User, Video, Category, SystemSettings, Transaction, 
  Notification, VideoResult, ContentRequest, MarketplaceItem, 
  MarketplaceReview, BalanceRequest, VipRequest, VipPlan,
  SmartCleanerResult, FtpFile, UserInteraction, Comment
} from '../types';

/**
 * DBService handles all API communication with the PHP backend.
 */
class DBService {
  private apiBase = 'api/index.php';

  /**
   * Generic request handler with session management and 401 interceptor.
   */
  public async request<T>(query: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('sp_session_token');
    const url = `${this.apiBase}?${query}${token ? `&token=${token}` : ''}`;
    
    try {
      const res = await fetch(url, options);
      
      if (res.status === 401) {
        window.dispatchEvent(new Event('sp_session_expired'));
        throw new Error("Session expired");
      }

      const json = await res.json().catch(() => {
        throw new Error("Respuesta del servidor inválida (No JSON)");
      });

      // El backend PHP de StreamPay siempre devuelve { success: boolean, data?: any, error?: string }
      if (json.success === false) {
        // Caso especial: El guard de App.tsx busca este mensaje para redirigir a /setup
        if (json.error === 'Sistema no instalado') {
          throw new Error('SYSTEM_NOT_INSTALLED');
        }
        throw new Error(json.error || "Error desconocido en el servidor");
      }
      
      return json.data as T;
    } catch (err: any) {
      console.error(`Fetch error [${query}]:`, err);
      throw err;
    }
  }

  // --- Auth & Session ---
  
  public async login(username: string, password: string): Promise<User> {
    return this.request<User>(`action=login`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  public async register(username: string, password: string, avatar?: File | null): Promise<User> {
    const fd = new FormData();
    fd.append('username', username);
    fd.append('password', password);
    if (avatar) fd.append('avatar', avatar);
    
    return this.request<User>(`action=register`, {
      method: 'POST',
      body: fd
    });
  }

  public async logout(userId: string): Promise<void> {
    return this.request<void>(`action=logout&userId=${userId}`);
  }

  public async getUser(userId: string): Promise<User> {
    return this.request<User>(`action=get_user&userId=${userId}`);
  }

  public async heartbeat(userId: string): Promise<void> {
    return this.request<void>(`action=heartbeat&userId=${userId}`);
  }

  public saveOfflineUser(user: User) {
    localStorage.setItem('sp_offline_user', JSON.stringify(user));
  }

  public getOfflineUser(): User | null {
    const saved = localStorage.getItem('sp_offline_user');
    return saved ? JSON.parse(saved) : null;
  }

  // --- Content (Videos & Metadata) ---
  
  public async getAllVideos(): Promise<Video[]> {
    return this.request<Video[]>(`action=get_videos`);
  }

  public async getVideo(id: string): Promise<Video> {
    return this.request<Video>(`action=get_video&id=${id}`);
  }

  public async getVideosByCreator(userId: string): Promise<Video[]> {
    return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`);
  }

  public async getRelatedVideos(id: string): Promise<Video[]> {
    return this.request<Video[]>(`action=get_related_videos&id=${id}`);
  }

  public async uploadVideo(
    title: string, desc: string, price: number, cat: string, dur: number, 
    user: User, file: File, thumb: File | null, onProgress: (p: number, l: number, t: number) => void
  ): Promise<void> {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', desc);
    fd.append('price', String(price));
    fd.append('category', cat);
    fd.append('duration', String(dur));
    fd.append('userId', user.id);
    fd.append('video', file);
    if (thumb) fd.append('thumbnail', thumb);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const token = localStorage.getItem('sp_session_token');
      xhr.open('POST', `${this.apiBase}?action=upload_video${token ? `&token=${token}` : ''}`);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          onProgress(percent, e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            const resp = JSON.parse(xhr.responseText);
            if (resp.success) resolve();
            else reject(new Error(resp.error || "Upload failed"));
        }
        else reject(new Error("Upload failed"));
      };
      
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(fd);
    });
  }

  public async deleteVideo(videoId: string, userId: string): Promise<void> {
    return this.request<void>(`action=delete_video&id=${videoId}&userId=${userId}`);
  }

  public async markWatched(userId: string, videoId: string): Promise<void> {
    return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`);
  }

  // --- Interactions & Social ---
  
  public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
    const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
    return res.hasPurchased;
  }

  public async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
    return this.request<UserInteraction>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
  }

  public async purchaseVideo(userId: string, videoId: string): Promise<void> {
    return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`);
  }

  public async rateVideo(userId: string, videoId: string, rating: 'like' | 'dislike'): Promise<any> {
    return this.request<any>(`action=rate_video&userId=${userId}&videoId=${videoId}&rating=${rating}`);
  }

  public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
    return this.request<Comment>(`action=add_comment`, {
      method: 'POST',
      body: JSON.stringify({ userId, videoId, text })
    });
  }

  public async getComments(videoId: string): Promise<Comment[]> {
    return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
  }

  public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
    const res = await this.request<{subscribed: boolean}>(`action=check_sub&userId=${userId}&creatorId=${creatorId}`);
    return res.subscribed;
  }

  public async toggleSubscribe(userId: string, creatorId: string): Promise<any> {
    return this.request<any>(`action=toggle_sub&userId=${userId}&creatorId=${creatorId}`);
  }

  // --- Marketplace ---
  
  public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    return this.request<MarketplaceItem[]>(`action=get_marketplace_items`);
  }

  public async getMarketplaceItem(id: string): Promise<MarketplaceItem> {
    return this.request<MarketplaceItem>(`action=get_marketplace_item&id=${id}`);
  }

  public async createListing(formData: FormData): Promise<void> {
    return this.request<void>(`action=create_marketplace_listing`, {
      method: 'POST',
      body: formData
    });
  }

  public async editListing(id: string, sellerId: string, data: any): Promise<void> {
    return this.request<void>(`action=edit_marketplace_listing&id=${id}&sellerId=${sellerId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async checkoutCart(userId: string, items: any[], shipping: any): Promise<void> {
    return this.request<void>(`action=checkout_cart&userId=${userId}`, {
      method: 'POST',
      body: JSON.stringify({ items, shipping })
    });
  }

  public async getReviews(itemId: string): Promise<MarketplaceReview[]> {
    return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
  }

  public async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
    return this.request<void>(`action=add_review`, {
      method: 'POST',
      body: JSON.stringify({ itemId, userId, rating, comment })
    });
  }

  // --- AI & Vectors ---
  
  public async saveVideoVector(videoId: string, vector: number[]): Promise<void> {
    return this.request<void>(`action=save_video_vector`, {
      method: 'POST',
      body: JSON.stringify({ videoId, vector })
    });
  }

  public async getUserInterestVector(userId: string): Promise<number[] | null> {
    return this.request<number[] | null>(`action=get_user_interest_vector&userId=${userId}`);
  }

  // --- User Profile ---
  
  public async updateUserProfile(userId: string, data: any): Promise<void> { 
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] instanceof File) fd.append(k, data[k]);
      else if (typeof data[k] === 'object') fd.append(k, JSON.stringify(data[k]));
      else fd.append(k, data[k]);
    });
    return this.request<void>(`action=update_profile&userId=${userId}`, { method: 'POST', body: fd });
  }

  public async searchUsers(userId: string, query: string): Promise<any[]> {
    return this.request<any[]>(`action=search_users&userId=${userId}&query=${query}`);
  }

  public async transferBalance(userId: string, target: string, amount: number): Promise<void> {
    return this.request<void>(`action=transfer_balance&userId=${userId}&target=${target}&amount=${amount}`);
  }

  // --- Notifications ---
  
  public async getNotifications(userId: string): Promise<Notification[]> {
    return this.request<Notification[]>(`action=get_notifications&userId=${userId}`);
  }

  public async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`action=mark_notif_read&id=${id}`);
  }

  // --- Content Requests ---
  
  public async searchExternal(query: string, source: string): Promise<VideoResult[]> {
    return this.request<VideoResult[]>(`action=search_external&query=${query}&source=${source}`);
  }

  public async serverImportVideo(url: string): Promise<void> {
    return this.request<void>(`action=server_import&url=${url}`);
  }

  public async getRequests(filter: string = 'ALL'): Promise<ContentRequest[]> {
    return this.request<ContentRequest[]>(`action=get_requests&filter=${filter}`);
  }

  public async requestContent(userId: string, query: string, urgent: boolean): Promise<void> {
    return this.request<void>(`action=request_content&userId=${userId}&query=${query}&urgent=${urgent ? 1 : 0}`);
  }

  public async deleteRequest(id: string): Promise<void> {
    return this.request<void>(`action=delete_request&id=${id}`);
  }

  public async updateRequestStatus(id: string, status: string): Promise<void> {
    return this.request<void>(`action=update_request_status&id=${id}&status=${status}`);
  }

  // --- Admin & Maintenance ---
  
  public async checkInstallation(): Promise<{status: string}> {
    return this.request<{status: string}>(`action=check_installation`);
  }

  public async getSystemSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>(`action=get_system_settings`);
  }

  public async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
    return this.request<void>(`action=update_system_settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }

  public async adminRepairDb(): Promise<void> {
    return this.request<void>(`action=admin_repair_db`);
  }

  public async getAllUsers(): Promise<User[]> {
    return this.request<User[]>(`action=admin_get_users`);
  }

  public async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
    return this.request<void>(`action=admin_add_balance&adminId=${adminId}&targetId=${targetId}&amount=${amount}`);
  }

  public async getBalanceRequests(): Promise<any> {
    return this.request<any>(`action=admin_get_balance_requests`);
  }

  public async handleBalanceRequest(adminId: string, reqId: string, status: string): Promise<void> {
    return this.request<void>(`action=admin_handle_balance_request&adminId=${adminId}&id=${reqId}&status=${status}`);
  }

  public async handleVipRequest(adminId: string, reqId: string, status: string): Promise<void> {
    return this.request<void>(`action=admin_handle_vip_request&adminId=${adminId}&id=${reqId}&status=${status}`);
  }

  public async getGlobalTransactions(): Promise<any> {
    return this.request<any>(`action=admin_get_global_transactions`);
  }

  public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
    return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
  }

  public async adminDeleteListing(id: string): Promise<void> {
    return this.request<void>(`action=admin_delete_marketplace_item&id=${id}`);
  }

  public async adminCleanupSystemFiles(): Promise<any> {
    return this.request<any>(`action=admin_cleanup_files`);
  }

  // --- Grid & Library Scanner ---
  
  public async scanLocalLibrary(path: string): Promise<any> {
    return this.request<any>(`action=scan_library&path=${path}`);
  }

  public async processScanBatch(): Promise<any> {
    return this.request<any>(`action=process_scan_batch`);
  }

  public async updateVideoMetadata(id: string, duration: number, thumb: File | null): Promise<void> {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('duration', String(duration));
    if (thumb) fd.append('thumbnail', thumb);
    return this.request(`action=update_video_metadata`, { method: 'POST', body: fd });
  }

  public async getUnprocessedVideos(limit: number, mode: string): Promise<Video[]> {
    return this.request<Video[]>(`action=get_unprocessed&limit=${limit}&mode=${mode}`);
  }

  public async smartOrganizeLibrary(): Promise<any> {
    return this.request<any>(`action=smart_organize`);
  }

  public async fixLibraryMetadata(): Promise<any> {
    return this.request<any>(`action=fix_library`);
  }

  public async reorganizeAllVideos(): Promise<any> {
    return this.request<any>(`action=reorganize_all`);
  }

  // --- FTP & Sync ---
  
  public async listFtpFiles(path: string): Promise<FtpFile[]> {
    return this.request<FtpFile[]>(`action=list_ftp&path=${path}`);
  }

  public async importFtpFile(path: string): Promise<void> {
    return this.request<void>(`action=import_ftp&path=${path}`);
  }

  public async scanFtpRecursive(path: string): Promise<any> {
    return this.request<any>(`action=scan_ftp_recursive&path=${path}`);
  }

  // --- VIP & Plans ---
  
  public async purchaseVipInstant(userId: string, plan: VipPlan): Promise<void> {
    return this.request<void>(`action=purchase_vip_instant&userId=${userId}&planId=${plan.id}`);
  }

  // --- System Setup ---
  
  public async verifyDbConnection(config: any): Promise<boolean> {
    const res = await this.request<{connected: boolean}>(`action=verify_db`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    return res.connected;
  }

  public async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
    return this.request<void>(`action=initialize_system`, {
      method: 'POST',
      body: JSON.stringify({ dbConfig, adminConfig })
    });
  }

  public enableDemoMode() {
    localStorage.setItem('sp_demo_mode', 'true');
  }

  // --- UI Helpers ---
  
  public async getUserActivity(userId: string): Promise<any> {
    return this.request<any>(`action=get_user_activity&userId=${userId}`);
  }

  public invalidateCache(key: string) {
    // Optional client-side cache invalidation
  }

  public setHomeDirty() {
    // Logic to force Home refresh
  }
}

export const db = new DBService();
