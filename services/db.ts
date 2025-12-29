
import { 
    User, Video, Transaction, VipPlan, SystemSettings, 
    Comment, UserInteraction, Notification, VideoResult, 
    ContentRequest, MarketplaceItem, CartItem, MarketplaceReview, FtpFile
} from '../types';

class DBService {
    private baseUrl = 'api/index.php';
    private homeDirty = false;

    public async request<T>(query: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('sp_session_token');
        const headers: any = options?.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${this.baseUrl}?${query}`, { ...options, headers });
            if (response.status === 401) {
                window.dispatchEvent(new CustomEvent('sp_session_expired'));
                throw new Error("Sesión expirada");
            }
            const json = await response.json();
            if (json.success === false) throw new Error(json.error || "Error API");
            return json.data as T;
        } catch (error: any) { throw error; }
    }

    // --- System & Auth ---

    // Added checkInstallation to detect first-run state
    public async checkInstallation(): Promise<{ status: string }> {
        return this.request<{ status: string }>(`action=check_installation`);
    }

    public async login(username: string, password: string): Promise<User> {
        return this.request<User>(`action=login`, { method: 'POST', body: JSON.stringify({ username, password }) });
    }

    // Added register with avatar support using FormData
    public async register(username: string, password: string, avatar?: File | null): Promise<User> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (avatar) formData.append('avatar', avatar);
        return this.request<User>(`action=register`, { method: 'POST', body: formData });
    }

    // Added logout to clear session on backend
    public async logout(userId: string): Promise<void> {
        return this.request<void>(`action=logout&userId=${userId}`, { method: 'POST' });
    }

    public async getUser(userId: string): Promise<User | null> {
        return this.request<User | null>(`action=get_user&userId=${userId}`);
    }

    // Added heartbeat to track active devices and sessions
    public async heartbeat(userId: string): Promise<void> {
        return this.request<void>(`action=heartbeat&userId=${userId}`, { method: 'POST' });
    }

    // Added offline user persistence helpers
    public saveOfflineUser(user: User) {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    public getOfflineUser(): User | null {
        const data = localStorage.getItem('sp_offline_user');
        return data ? JSON.parse(data) : null;
    }

    public enableDemoMode() {
        localStorage.setItem('sp_demo_mode', 'true');
    }

    // Added system initialization for setup wizard
    public async verifyDbConnection(config: any): Promise<boolean> {
        return this.request<boolean>(`action=verify_db`, { method: 'POST', body: JSON.stringify(config) });
    }

    public async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        return this.request<void>(`action=initialize_system`, { method: 'POST', body: JSON.stringify({ dbConfig, adminConfig }) });
    }

    // --- User Profile & Interaction ---

    // Added updateUserProfile for individual user settings
    public async updateUserProfile(userId: string, data: any): Promise<void> {
        return this.request<void>(`action=update_user_profile&userId=${userId}`, { method: 'POST', body: JSON.stringify(data) });
    }

    // Added user activity and subscriptions tracking
    public async getUserActivity(userId: string): Promise<any> {
        return this.request<any>(`action=get_user_activity&userId=${userId}`);
    }

    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        const res = await this.request<{isSubscribed: boolean}>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
        return res.isSubscribed;
    }

    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe`, { method: 'POST', body: JSON.stringify({ userId, creatorId }) });
    }

    // --- Videos ---

    public async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos`);
    }

    // Added single video fetch
    public async getVideo(id: string): Promise<Video | null> {
        return this.request<Video | null>(`action=get_video&id=${id}`);
    }

    // Added related videos algorithm trigger
    public async getRelatedVideos(id: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_related_videos&id=${id}`);
    }

    // Added videos by creator for channel view
    public async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`);
    }

    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
        return res.hasPurchased;
    }

    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    // Added interaction and rating handlers
    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video`, { method: 'POST', body: JSON.stringify({ userId, videoId, type }) });
    }

    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    // Added comment handlers
    public async getComments(id: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&id=${id}`);
    }

    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment`, { method: 'POST', body: JSON.stringify({ userId, videoId, text }) });
    }

    // Added video deletion (Creator or Admin)
    public async deleteVideo(videoId: string, userId: string): Promise<void> {
        return this.request<void>(`action=delete_video&id=${videoId}&userId=${userId}`, { method: 'POST' });
    }

    // Added offline/PWA download status check
    public async checkDownloadStatus(id: string): Promise<boolean> {
        return this.request<boolean>(`action=check_download_status&id=${id}`);
    }

    public async downloadVideoForOffline(video: Video): Promise<void> {
        return this.request<void>(`action=download_video&id=${video.id}`);
    }

    // --- Content Center & Requests ---

    // Added external search for Pexels/Pixabay/YouTube
    public async searchExternal(query: string, source: string): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
    }

    // Added server-side video import
    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import&url=${encodeURIComponent(url)}`, { method: 'POST' });
    }

    // Added content request management
    public async getRequests(status: string = 'PENDING'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&status=${status}`);
    }

    public async requestContent(userId: string, query: string, isUrgent: boolean): Promise<void> {
        return this.request<void>(`action=request_content`, { method: 'POST', body: JSON.stringify({ userId, query, isUrgent }) });
    }

    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request&id=${id}`, { method: 'POST' });
    }

    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=update_request_status`, { method: 'POST', body: JSON.stringify({ id, status }) });
    }

    // --- Marketplace ---

    // Added marketplace items and review handlers
    public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=get_marketplace_items`);
    }

    public async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem | null>(`action=get_marketplace_item&id=${id}`);
    }

    public async checkoutCart(userId: string, cart: CartItem[], shipping: any): Promise<void> {
        return this.request<void>(`action=checkout_cart`, { method: 'POST', body: JSON.stringify({ userId, cart, shipping }) });
    }

    public async createListing(formData: FormData): Promise<void> {
        return this.request<void>(`action=create_listing`, { method: 'POST', body: formData });
    }

    public async editListing(id: string, sellerId: string, data: any): Promise<void> {
        return this.request<void>(`action=edit_listing`, { method: 'POST', body: JSON.stringify({ id, sellerId, ...data }) });
    }

    public async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
    }

    public async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        return this.request<void>(`action=add_review`, { method: 'POST', body: JSON.stringify({ itemId, userId, rating, comment }) });
    }

    // --- Finance & Admin ---

    public async transferBalance(userId: string, targetUsername: string, amount: number): Promise<any> {
        return this.request<any>(`action=transfer_balance`, { method: 'POST', body: JSON.stringify({ userId, targetUsername, amount }) });
    }

    public async purchaseVipInstant(userId: string, plan: VipPlan): Promise<any> {
        return this.request<any>(`action=purchase_vip_instant`, { method: 'POST', body: JSON.stringify({ userId, plan }) });
    }

    public async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>(`action=get_system_settings`);
    }

    // Added updateSystemSettings for admin dashboard
    public async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        return this.request<void>(`action=update_system_settings`, { method: 'POST', body: JSON.stringify(settings) });
    }

    public async getRealStats(): Promise<any> {
        return this.request<any>(`action=get_real_stats`);
    }

    // Added admin-only finance and user management
    public async getAllUsers(): Promise<User[]> {
        return this.request<User[]>(`action=get_all_users`);
    }

    public async adminAddBalance(adminId: string, userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance`, { method: 'POST', body: JSON.stringify({ adminId, userId, amount }) });
    }

    public async getBalanceRequests(): Promise<any> {
        return this.request<any>(`action=get_balance_requests`);
    }

    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>(`action=get_global_transactions`);
    }

    public async handleBalanceRequest(adminId: string, reqId: string, action: string): Promise<void> {
        return this.request<void>(`action=handle_balance_request`, { method: 'POST', body: JSON.stringify({ adminId, reqId, action }) });
    }

    public async handleVipRequest(adminId: string, reqId: string, action: string): Promise<void> {
        return this.request<void>(`action=handle_vip_request`, { method: 'POST', body: JSON.stringify({ adminId, reqId, action }) });
    }

    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
    }

    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing&itemId=${itemId}`, { method: 'POST' });
    }

    // Added notifications management
    public async getNotifications(userId: string): Promise<Notification[]> {
        return this.request<Notification[]>(`action=get_notifications&userId=${userId}`);
    }

    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read&id=${id}`, { method: 'POST' });
    }

    // --- Library Management & Scanning ---

    // Added local library scanning and batch processing
    public async scanLocalLibrary(path: string): Promise<any> {
        return this.request<any>(`action=scan_library&path=${encodeURIComponent(path)}`);
    }

    public async processScanBatch(): Promise<any> {
        return this.request<any>(`action=process_scan_batch`);
    }

    public async getUnprocessedVideos(limit: number, mode: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    // Added smart library organization
    public async smartOrganizeLibrary(): Promise<any> {
        return this.request<any>(`action=smart_organize_library`, { method: 'POST' });
    }

    // Added updateVideoMetadata with XHR support for progress in context
    public async updateVideoMetadata(videoId: string, duration: number, thumbnail: File | null, success: boolean = true): Promise<void> {
        const formData = new FormData();
        formData.append('videoId', videoId);
        formData.append('duration', duration.toString());
        formData.append('success', success ? '1' : '0');
        if (thumbnail) formData.append('thumbnail', thumbnail);
        return this.request<void>(`action=update_video_metadata`, { method: 'POST', body: formData });
    }

    // Added complex uploadVideo with progress reporting
    public async uploadVideo(
        title: string,
        description: string,
        price: number,
        category: string,
        duration: number,
        user: User,
        file: File,
        thumbnail: File | null,
        onProgress?: (percent: number, loaded: number, total: number) => void
    ): Promise<any> {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price.toString());
        formData.append('category', category);
        formData.append('duration', duration.toString());
        formData.append('userId', user.id);
        formData.append('video', file);
        if (thumbnail) formData.append('thumbnail', thumbnail);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const token = localStorage.getItem('sp_session_token');
            xhr.open('POST', `${this.baseUrl}?action=upload_video`);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) resolve(res.data);
                        else reject(new Error(res.error || "Upload failed"));
                    } catch (e) { reject(e); }
                } else reject(new Error(`Server error: ${xhr.status}`));
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(formData);
        });
    }

    // --- Maintenance & Tools ---

    // Added system maintenance tools
    public async adminCleanupSystemFiles(): Promise<any> {
        return this.request<any>(`action=admin_cleanup_files`, { method: 'POST' });
    }

    public async adminRepairDb(): Promise<void> {
        return this.request<void>(`action=admin_repair_db`, { method: 'POST' });
    }

    // Added FTP browser support
    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`);
    }

    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=import_ftp_file&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async scanFtpRecursive(path: string): Promise<any> {
        return this.request<any>(`action=scan_ftp_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    // Added state management helpers for the UI
    public invalidateCache(query: string) {
        // Logic to invalidate internal cache if used
    }

    public setHomeDirty() { this.homeDirty = true; }
    public isHomeDirty() { return this.homeDirty; }
}

export const db = new DBService();
