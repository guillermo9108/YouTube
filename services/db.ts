
import { 
    User, Video, Transaction, Comment, UserInteraction, 
    ContentRequest, BalanceRequest, SystemSettings, 
    MarketplaceItem, MarketplaceReview, CartItem, 
    VipPlan, VipRequest, SaleRecord, VideoResult, FtpFile, OrganizeResult, SmartCleanerResult,
    Notification as AppNotification
} from '../types';

/* Fix: Wrapped the request method into a class and implemented missing methods called throughout the app. */
class DBService {
    private baseUrl = 'api/index.php';
    private homeDirty = false;

    /* Fix: Implemented the generic request helper used for API communication. */
    public async request<T>(query: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('sp_session_token');
        const headers: any = options?.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${this.baseUrl}?${query}`, {
                ...options,
                headers: { ...headers }
            });

            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                if (json.success === false) throw new Error(json.error || json.message || "API Error");
                return json.data as T;
            } catch (e: any) {
                throw new Error(e.message || "Invalid JSON response");
            }
        } catch (error) {
            /* Fix: Added offline fallback for video listing as requested in original snippet. */
            if (!options || options.method === 'GET' || !options.method) {
                if (query.includes('action=get_videos')) {
                    return this.getOfflineVideos() as any;
                }
            }
            throw error;
        }
    }

    // Auth & Users
    public async login(username: string, password: string): Promise<User> {
        return this.request<User>(`action=login`, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    public async register(username: string, password: string, avatar?: File | null): Promise<User> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (avatar) formData.append('avatar', avatar);
        return this.request<User>(`action=register`, {
            method: 'POST',
            body: formData
        });
    }

    public async logout(userId: string): Promise<void> {
        return this.request<void>(`action=logout&userId=${userId}`, { method: 'POST' });
    }

    public async getUser(userId: string): Promise<User | null> {
        return this.request<User | null>(`action=get_user&userId=${userId}`);
    }

    public async getAllUsers(): Promise<User[]> {
        return this.request<User[]>(`action=get_all_users`);
    }

    public async updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
        return this.request<void>(`action=update_profile&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    public async uploadAvatar(userId: string, file: File): Promise<void> {
        const formData = new FormData();
        formData.append('avatar', file);
        return this.request<void>(`action=upload_avatar&userId=${userId}`, {
            method: 'POST',
            body: formData
        });
    }

    public async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        return this.request<void>(`action=change_password&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ oldPass, newPass })
        });
    }

    public async heartbeat(userId: string, token: string): Promise<boolean> {
        try {
            return await this.request<boolean>(`action=heartbeat&userId=${userId}`);
        } catch (e) {
            return true;
        }
    }

    // Videos
    public async getAllVideos(): Promise<Video[]> {
        const videos = await this.request<Video[]>(`action=get_videos`);
        this.saveOfflineVideos(videos);
        return videos;
    }

    public async getVideo(id: string): Promise<Video | null> {
        return this.request<Video | null>(`action=get_video&id=${id}`);
    }

    public async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`);
    }

    public async getRelatedVideos(videoId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_related_videos&id=${videoId}`);
    }

    public async deleteVideo(videoId: string, userId: string): Promise<void> {
        return this.request<void>(`action=delete_video&id=${videoId}&userId=${userId}`, { method: 'POST' });
    }

    public async uploadVideo(title: string, description: string, price: number, category: string, duration: number, user: User, file: File, thumbnail: File | null, onProgress: (percent: number, loaded: number, total: number) => void): Promise<void> {
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
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) resolve();
                        else reject(new Error(res.error || res.message));
                    } catch (e) {
                        reject(new Error("Invalid response"));
                    }
                } else reject(new Error("Upload failed"));
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(formData);
        });
    }

    // Social
    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video&userId=${userId}&videoId=${videoId}&type=${type}`, { method: 'POST' });
    }

    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async getUserActivity(userId: string): Promise<{watched: string[], liked: string[]}> {
        return this.request<{watched: string[], liked: string[]}>(`action=get_user_activity&userId=${userId}`);
    }

    public async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
    }

    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment&userId=${userId}&videoId=${videoId}`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        return this.request<boolean>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
    }

    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe&userId=${userId}&creatorId=${creatorId}`, { method: 'POST' });
    }

    // Finance & VIP
    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        return this.request<boolean>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
    }

    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async getSales(userId: string): Promise<SaleRecord[]> {
        return this.request<SaleRecord[]>(`action=get_sales&userId=${userId}`);
    }

    public async getUserTransactions(userId: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`action=get_user_transactions&userId=${userId}`);
    }

    public async requestBalance(userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=request_balance&userId=${userId}&amount=${amount}`, { method: 'POST' });
    }

    public async requestVip(userId: string, plan: VipPlan, paymentRef: string): Promise<void> {
        return this.request<void>(`action=request_vip&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ plan, paymentRef })
        });
    }

    public async verifyPayment(userId: string, ref: string): Promise<void> {
        return this.request<void>(`action=verify_payment&userId=${userId}&ref=${ref}`, { method: 'POST' });
    }

    public async createPaymentLink(userId: string, plan: VipPlan): Promise<string> {
        return this.request<string>(`action=create_payment_link&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ plan })
        });
    }

    public async updatePricesBulk(userId: string, price: number): Promise<void> {
        return this.request<void>(`action=update_prices_bulk&userId=${userId}&price=${price}`, { method: 'POST' });
    }

    public async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
        return this.request<void>(`action=update_order_status&userId=${userId}&txId=${txId}&status=${status}`, { method: 'POST' });
    }

    // Marketplace
    public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=get_marketplace_items`);
    }

    public async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem | null>(`action=get_marketplace_item&id=${id}`);
    }

    public async createListing(formData: FormData): Promise<void> {
        return this.request<void>(`action=create_listing`, {
            method: 'POST',
            body: formData
        });
    }

    public async editListing(id: string, userId: string, data: any): Promise<void> {
        return this.request<void>(`action=edit_listing&id=${id}&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    public async checkoutCart(userId: string, items: CartItem[], shipping: any): Promise<void> {
        return this.request<void>(`action=checkout_cart&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ items, shipping })
        });
    }

    public async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
    }

    public async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        return this.request<void>(`action=add_review&itemId=${itemId}&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ rating, comment })
        });
    }

    // Admin
    public async checkInstallation(): Promise<{status: string}> {
        return this.request<{status: string}>(`action=check_installation`);
    }

    public async verifyDbConnection(config: any): Promise<boolean> {
        return this.request<boolean>(`action=verify_db_connection`, {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    public async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        return this.request<void>(`action=initialize_system`, {
            method: 'POST',
            body: JSON.stringify({ dbConfig, adminConfig })
        });
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

    public async getBalanceRequests(): Promise<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> {
        return this.request<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> (`action=get_balance_requests`);
    }

    public async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_balance_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    public async handleVipRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_vip_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    public async adminAddBalance(adminId: string, userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance&adminId=${adminId}&userId=${userId}&amount=${amount}`, { method: 'POST' });
    }

    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>(`action=get_global_transactions`);
    }

    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
    }

    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing&id=${itemId}`, { method: 'POST' });
    }

    public async adminCleanupSystemFiles(): Promise<any> {
        return this.request<any>(`action=admin_cleanup_files`, { method: 'POST' });
    }

    public async adminRepairDb(): Promise<void> {
        return this.request<void>(`action=admin_repair_db`, { method: 'POST' });
    }

    public async getSmartCleanerPreview(category: string, percent: number, days: number): Promise<SmartCleanerResult> {
        return this.request<SmartCleanerResult>(`action=smart_cleaner_preview&category=${category}&percent=${percent}&days=${days}`);
    }

    public async executeSmartCleaner(ids: string[]): Promise<{deleted: number}> {
        return this.request<{deleted: number}>(`action=execute_smart_cleaner`, {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
    }

    public async getRealStats(): Promise<any> {
        return this.request<any>(`action=get_real_stats`);
    }

    // Library & Local
    public async scanLocalLibrary(path: string): Promise<{success: boolean, totalFound: number, newToImport: number, errors?: string[], error?: string}> {
        return this.request<any>(`action=scan_local_library&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async processScanBatch(): Promise<any> {
        return this.request<any>(`action=process_scan_batch`, { method: 'POST' });
    }

    public async getUnprocessedVideos(limit: number, mode: 'normal' | 'random'): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    public async updateVideoMetadata(id: string, duration: number, thumbnail: File | null, success: boolean = true): Promise<{status: string}> {
        const formData = new FormData();
        formData.append('id', id);
        formData.append('duration', duration.toString());
        formData.append('success', success ? '1' : '0');
        if (thumbnail) formData.append('thumbnail', thumbnail);
        return this.request<{status: string}>(`action=update_video_metadata`, {
            method: 'POST',
            body: formData
        });
    }

    public async smartOrganizeLibrary(): Promise<OrganizeResult> {
        return this.request<OrganizeResult>(`action=smart_organize_library`, { method: 'POST' });
    }

    public async rectifyLibraryTitles(lastId: string): Promise<{processed: number, completed: boolean, lastId: string}> {
        return this.request<any>(`action=rectify_library_titles&lastId=${lastId}`, { method: 'POST' });
    }

    public async organizeWithAi(): Promise<{processed: number}> {
        return this.request<{processed: number}>(`action=organize_with_ai`, { method: 'POST' });
    }

    // External Requests
    public async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
    }

    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import_video&url=${encodeURIComponent(url)}`, { method: 'POST' });
    }

    public async getRequests(filter: string = 'PENDING'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&filter=${filter}`);
    }

    public async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<void> {
        return this.request<void>(`action=request_content&userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ query, useLocalNetwork })
        });
    }

    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=update_request_status&id=${id}&status=${status}`, { method: 'POST' });
    }

    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request&id=${id}`, { method: 'POST' });
    }

    // FTP
    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=ftp_list&path=${encodeURIComponent(path)}`);
    }

    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=ftp_import&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
        return this.request<any>(`action=ftp_scan_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    // Notifications
    public async getNotifications(userId: string): Promise<AppNotification[]> {
        return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`);
    }

    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read&id=${id}`, { method: 'POST' });
    }

    // Cache & Helpers
    public invalidateCache(key: string): void {
        localStorage.removeItem(`sp_cache_${key.replace(/[^a-z0-9]/gi, '_')}`);
    }

    public setHomeDirty(): void {
        this.homeDirty = true;
    }

    public enableDemoMode(): void {
        localStorage.setItem('sp_demo_mode', 'true');
    }

    // Offline / LocalStorage logic
    public saveOfflineUser(user: User): void {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    public getOfflineUser(): User | null {
        const saved = localStorage.getItem('sp_offline_user');
        return saved ? JSON.parse(saved) : null;
    }

    public saveOfflineVideos(videos: Video[]): void {
        localStorage.setItem('sp_cache_get_videos', JSON.stringify({
            timestamp: Date.now(),
            data: videos
        }));
    }

    public getOfflineVideos(): Video[] {
        const saved = localStorage.getItem('sp_cache_get_videos');
        if (saved) {
            try { return JSON.parse(saved).data || []; } catch(e) {}
        }
        return [];
    }

    public async checkDownloadStatus(id: string): Promise<boolean> {
        if ('caches' in window) {
            const cache = await caches.open('streampay-videos-v1');
            const match = await cache.match(`api/index.php?action=stream&id=${id}`);
            return !!match;
        }
        return false;
    }

    public async downloadVideoForOffline(video: Video): Promise<void> {
        const url = video.isLocal ? `api/index.php?action=stream&id=${video.id}` : video.videoUrl;
        
        if ('BackgroundFetchManager' in self) {
            const registration = await navigator.serviceWorker.ready;
            // @ts-ignore
            await registration.backgroundFetch.fetch(video.id, [url], {
                title: video.title,
                icons: [{ src: video.thumbnailUrl, sizes: '192x192', type: 'image/jpeg' }],
                downloadTotal: 0
            });
        } else {
            const response = await fetch(url);
            const cache = await caches.open('streampay-videos-v1');
            await cache.put(url, response);
        }
    }
}

export const db = new DBService();
