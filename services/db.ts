import { 
  User, Video, Category, SystemSettings, Transaction, 
  Notification, VideoResult, ContentRequest, MarketplaceItem, 
  MarketplaceReview, BalanceRequest, VipRequest, VipPlan,
  SmartCleanerResult, FtpFile, UserInteraction, Comment
} from '../types';

/**
 * DBService handles all API communication with the PHP backend.
 * Routes requests to either index.php or install.php depending on the action.
 */
class DBService {
  private indexBase = 'api/index.php';
  private installBase = 'api/install.php';

  /**
   * Generic request handler with session management and 401 interceptor.
   */
  public async request<T>(query: string, options: RequestInit = {}): Promise<T> {
    const rawToken = localStorage.getItem('sp_session_token');
    const token = rawToken ? rawToken.replace(/['"]+/g, '') : null;
    
    // Check if we are in Demo Mode (Local Storage only)
    const isDemo = localStorage.getItem('sp_demo_mode') === 'true';
    if (isDemo && !query.includes('action=check_installation')) {
       // In a real implementation, we would mock all calls here. 
       // For now, we allow the request to proceed but the App is designed to handle local data if needed.
    }

    // Precise routing logic
    // action=check_installation -> index.php (handled by app core)
    // action=check / verify_db / install -> install.php (handled by installer)
    const isInstallAction = query === 'action=check' || 
                            query.startsWith('action=check&') ||
                            query.includes('action=verify_db') || 
                            query === 'action=install' ||
                            query.startsWith('action=install&') ||
                            query.includes('action=ping');
    
    const base = isInstallAction ? this.installBase : this.indexBase;
    const url = `${base}?${query}${token ? `&token=${token}` : ''}`;
    
    try {
      const res = await fetch(url, options);
      
      if (res.status === 401) {
        window.dispatchEvent(new Event('sp_session_expired'));
        throw new Error("Session expired");
      }

      if (res.status === 404) {
          throw new Error(`API_NOT_FOUND: ${base}`);
      }

      const text = await res.text();
      
      // Attempt to find and parse JSON within the response text
      let cleanedText = text.trim();
      if (cleanedText.charCodeAt(0) === 0xFEFF) cleanedText = cleanedText.substring(1);

      const firstCurly = cleanedText.indexOf('{');
      const firstSquare = cleanedText.indexOf('[');
      let startIndex = -1;
      if (firstCurly !== -1 && (firstSquare === -1 || (firstCurly < firstSquare && firstCurly !== -1))) {
        startIndex = firstCurly;
      } else if (firstSquare !== -1) {
        startIndex = firstSquare;
      }
      
      if (startIndex > 0) cleanedText = cleanedText.substring(startIndex);

      const lastCurly = cleanedText.lastIndexOf('}');
      const lastSquare = cleanedText.lastIndexOf(']');
      let endIndex = Math.max(lastCurly, lastSquare);
      if (endIndex !== -1 && endIndex < cleanedText.length - 1) {
          cleanedText = cleanedText.substring(0, endIndex + 1);
      }

      let json;
      try {
        json = JSON.parse(cleanedText);
      } catch (e) {
        console.group("Respuesta de servidor inválida (No JSON)");
        console.error("Acción:", query);
        console.error("URL:", url);
        console.error("Status:", res.status);
        console.error("Texto recibido:", text);
        console.groupEnd();
        throw new Error("El servidor no devolvió JSON válido. Verifica que el servidor PHP esté funcionando correctamente.");
      }

      if (json.success === false) {
        if (json.error === 'Sistema no instalado' || json.installed === false) {
          throw new Error('SYSTEM_NOT_INSTALLED');
        }
        throw new Error(json.error || "Error desconocido en el servidor");
      }
      
      return json.data !== undefined ? json.data as T : json as T;
    } catch (err: any) {
      if (err.message === 'API_NOT_FOUND: api/index.php' || err.message === 'API_NOT_FOUND: api/install.php') {
         throw new Error('API_MISSING');
      }
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
    return this.request<User>(`action=register`, { method: 'POST', body: fd });
  }

  public async logout(userId: string): Promise<void> {
    return this.request<void>(`action=logout&userId=${userId}`);
  }

  public async getUser(userId: string): Promise<User> {
    return this.request<User>(`action=get_user&userId=${userId}`);
  }

  public async heartbeat(userId: string): Promise<void> {
    if (!userId) return;
    return this.request<void>(`action=heartbeat&userId=${userId}`);
  }

  public saveOfflineUser(user: User) {
    localStorage.setItem('sp_offline_user', JSON.stringify(user));
  }

  public getOfflineUser(): User | null {
    const saved = localStorage.getItem('sp_offline_user');
    return saved ? JSON.parse(saved) : null;
  }

  // Fix: Add missing method to update user profile information
  public async updateUserProfile(userId: string, data: any): Promise<void> {
    const fd = new FormData();
    fd.append('userId', userId);
    if (data.autoPurchaseLimit !== undefined) fd.append('autoPurchaseLimit', String(data.autoPurchaseLimit));
    if (data.newPassword) fd.append('newPassword', data.newPassword);
    if (data.avatar) fd.append('avatar', data.avatar);
    if (data.defaultPrices) fd.append('defaultPrices', JSON.stringify(data.defaultPrices));
    if (data.shippingDetails) fd.append('shippingDetails', JSON.stringify(data.shippingDetails));
    
    return this.request<void>(`action=update_user_profile`, {
      method: 'POST',
      body: fd
    });
  }

  // --- Content ---
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
    return this.request<Video[]>(`action=get_related_videos&videoId=${id}`);
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
      const rawToken = localStorage.getItem('sp_session_token');
      const token = rawToken ? rawToken.replace(/['"]+/g, '') : null;
      xhr.open('POST', `${this.indexBase}?action=upload_video${token ? `&token=${token}` : ''}`);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          onProgress(percent, e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText);
              if (resp.success) resolve();
              else reject(new Error(resp.error || "Upload failed"));
            } catch (e) {
              reject(new Error("Response was not JSON"));
            }
        } else reject(new Error("Upload failed"));
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

  // Fix: Add missing method to retrieve user interest vector for AI recommendations
  public async getUserInterestVector(userId: string): Promise<number[] | null> {
    return this.request<number[] | null>(`action=get_user_interest_vector&userId=${userId}`);
  }

  // Fix: Add missing method to save video vector embeddings
  public async saveVideoVector(videoId: string, vector: number[]): Promise<void> {
    return this.request<void>(`action=save_video_vector`, {
      method: 'POST',
      body: JSON.stringify({ videoId, vector })
    });
  }

  // --- Interactions ---
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

  // Fix: Add missing method to fetch notifications for a user
  public async getNotifications(userId: string): Promise<Notification[]> {
    return this.request<Notification[]>(`action=get_notifications&userId=${userId}`);
  }

  // Fix: Add missing method to mark a notification as read
  public async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`action=mark_notification_read&id=${id}`);
  }

  // --- Marketplace ---
  public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    return this.request<MarketplaceItem[]>(`action=get_marketplace_items`);
  }

  public async getMarketplaceItem(id: string): Promise<MarketplaceItem> {
    return this.request<MarketplaceItem>(`action=get_marketplace_item&id=${id}`);
  }

  public async createListing(formData: FormData): Promise<void> {
    return this.request<void>(`action=create_listing`, { method: 'POST', body: formData });
  }

  public async editListing(id: string, sellerId: string, data: any): Promise<void> {
    return this.request<void>(`action=edit_listing`, {
      method: 'POST',
      body: JSON.stringify({ id, userId: sellerId, data })
    });
  }

  public async checkoutCart(userId: string, items: any[], shipping: any): Promise<void> {
    return this.request<void>(`action=checkout_cart`, {
      method: 'POST',
      body: JSON.stringify({ userId, cart: items, shippingDetails: shipping })
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

  // --- Admin ---
  public async checkInstallation(): Promise<{installed: boolean}> {
    return this.request<{installed: boolean}>(`action=check_installation`);
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
    return this.request<User[]>(`action=get_all_users`);
  }

  public async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
    return this.request<void>(`action=admin_add_balance`, {
      method: 'POST',
      body: JSON.stringify({ adminId, targetId, amount })
    });
  }

  public async getBalanceRequests(): Promise<any> {
    return this.request<any>(`action=get_balance_requests`);
  }

  public async handleBalanceRequest(adminId: string, reqId: string, status: string): Promise<void> {
    return this.request<void>(`action=handle_balance_request`, {
      method: 'POST',
      body: JSON.stringify({ adminId, reqId, status })
    });
  }

  public async handleVipRequest(adminId: string, reqId: string, status: string): Promise<void> {
    return this.request<void>(`action=handle_vip_request`, {
      method: 'POST',
      body: JSON.stringify({ adminId, reqId, status })
    });
  }

  public async getGlobalTransactions(): Promise<any> {
    return this.request<any>(`action=get_global_transactions`);
  }

  public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
    return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
  }

  public async adminDeleteListing(id: string): Promise<void> {
    return this.request<void>(`action=delete_marketplace_item&id=${id}`);
  }

  public async adminCleanupSystemFiles(): Promise<any> {
    return this.request<any>(`action=admin_cleanup_files`);
  }

  // --- Grid & Library ---
  public async scanLocalLibrary(path: string): Promise<any> {
    return this.request<any>(`action=scan_local_library`, { method: 'POST', body: JSON.stringify({ path }) });
  }

  public async processScanBatch(): Promise<any> {
    return this.request<any>(`action=process_scan_batch`);
  }

  public async updateVideoMetadata(id: string, duration: number, thumb: File | null): Promise<void> {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('duration', String(duration));
    fd.append('success', '1');
    if (thumb) fd.append('thumbnail', thumb);
    return this.request(`action=update_video_metadata`, { method: 'POST', body: fd });
  }

  public async getUnprocessedVideos(limit: number, mode: string): Promise<Video[]> {
    return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
  }

  public async smartOrganizeLibrary(): Promise<any> {
    return this.request<any>(`action=smart_organize_library`);
  }

  public async fixLibraryMetadata(): Promise<any> {
    return this.request<any>(`action=fix_library_metadata`);
  }

  public async reorganizeAllVideos(): Promise<any> {
    return this.request<any>(`action=reorganize_all_videos`);
  }

  // Fix: Add missing method to search external sources for videos
  public async searchExternal(query: string, source: string): Promise<VideoResult[]> {
    return this.request<VideoResult[]>(`action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
  }

  // Fix: Add missing method to trigger server-side video import from a URL
  public async serverImportVideo(url: string): Promise<void> {
    return this.request<void>(`action=server_import_video&url=${encodeURIComponent(url)}`);
  }

  // Fix: Add missing method to retrieve content requests by status
  public async getRequests(status: string = 'ALL'): Promise<ContentRequest[]> {
    return this.request<ContentRequest[]>(`action=get_requests&status=${status}`);
  }

  // Fix: Add missing method to submit a new content request
  public async requestContent(userId: string, query: string, isInstant: boolean): Promise<void> {
    return this.request<void>(`action=request_content`, {
      method: 'POST',
      body: JSON.stringify({ userId, query, isInstant })
    });
  }

  // Fix: Add missing method to delete a content request by ID
  public async deleteRequest(id: string): Promise<void> {
    return this.request<void>(`action=delete_request&id=${id}`);
  }

  // Fix: Add missing method to update the status of a content request
  public async updateRequestStatus(id: string, status: string): Promise<void> {
    return this.request<void>(`action=update_request_status`, {
      method: 'POST',
      body: JSON.stringify({ id, status })
    });
  }

  // --- FTP ---
  public async listFtpFiles(path: string): Promise<FtpFile[]> {
    return this.request<FtpFile[]>(`action=list_ftp&path=${path}`);
  }

  public async importFtpFile(path: string): Promise<void> {
    return this.request<void>(`action=import_ftp&path=${path}`);
  }

  public async scanFtpRecursive(path: string): Promise<any> {
    return this.request<any>(`action=scan_ftp_recursive&path=${path}`);
  }

  // --- VIP ---
  public async purchaseVipInstant(userId: string, plan: VipPlan): Promise<void> {
    return this.request<void>(`action=purchase_vip_instant`, { method: 'POST', body: JSON.stringify({ userId, plan }) });
  }

  // --- Setup ---
  public async verifyDbConnection(config: any): Promise<boolean> {
    const res = await this.request<{success: boolean}>(`action=verify_db`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    return res.success;
  }

  public async initializeSystem(dbConfig: any, adminUser: any): Promise<void> {
    return this.request<void>(`action=install`, {
      method: 'POST',
      body: JSON.stringify({ dbConfig, adminUser })
    });
  }

  public enableDemoMode() {
    localStorage.setItem('sp_demo_mode', 'true');
  }

  public async getUserActivity(userId: string): Promise<any> {
    return this.request<any>(`action=get_user_activity&userId=${userId}`);
  }

  public async searchUsers(userId: string, q: string): Promise<any[]> {
    return this.request<any[]>(`action=search_users`, { method: 'POST', body: JSON.stringify({ userId, q }) });
  }

  public async transferBalance(userId: string, targetUsername: string, amount: number): Promise<void> {
    return this.request<void>(`action=transfer_balance`, { method: 'POST', body: JSON.stringify({ userId, targetUsername, amount }) });
  }

  public invalidateCache(k: string) {}
  public setHomeDirty() {}
}

export const db = new DBService();
