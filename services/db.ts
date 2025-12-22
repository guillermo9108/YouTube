import { 
    User, Video, Transaction, Comment, UserInteraction, 
    ContentRequest, BalanceRequest, SystemSettings, 
    MarketplaceItem, MarketplaceReview, CartItem, 
    VipPlan, VipRequest, SaleRecord, VideoResult, FtpFile, OrganizeResult, SmartCleanerResult,
    Notification as AppNotification
} from '../types';

class DBService {
    private baseUrl = 'api/index.php';
    private homeDirty = false;

    public async request<T>(query: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('sp_session_token');
        const headers: any = options?.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${this.baseUrl}?${query}`, {
                ...options,
                headers: { ...headers }
            });

            const text = await response.text();
            
            if (!response.ok) {
                const snippet = text.substring(0, 500);
                throw new Error(`Servidor (${response.status}): ${snippet.includes('<!DOCTYPE') ? 'Fallo crítico (HTML)' : snippet}`);
            }
            
            if (!text || text.trim() === "") {
                throw new Error("El servidor no respondió. Posible timeout o bloqueo de sesión en PHP.");
            }

            try {
                const json = JSON.parse(text);
                if (json.success === false) throw new Error(json.error || json.message || "Error en la API");
                return json.data as T;
            } catch (e: any) {
                console.error("Respuesta no válida del servidor:", text);
                throw new Error("Respuesta corrupta. Revisa el log de errores de PHP.");
            }
        } catch (error: any) {
            // Fallback offline para videos
            if (!options || options.method === 'GET' || !options.method) {
                if (query.includes('action=get_videos')) {
                    const cached = this.getOfflineVideos();
                    if (cached.length > 0) return cached as any;
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
            body: JSON.stringify({ updates: data })
        });
    }

    public async uploadAvatar(userId: string, file: File): Promise<void> {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('avatar', file);
        return this.request<void>(`action=upload_avatar`, {
            method: 'POST',
            body: formData
        });
    }

    public async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        return this.request<void>(`action=change_password`, {
            method: 'POST',
            body: JSON.stringify({ userId, oldPass, newPass })
        });
    }

    public async heartbeat(userId: string, token: string): Promise<boolean> {
        try {
            return await this.request<boolean>(`action=heartbeat`, {
                method: 'POST',
                body: JSON.stringify({ userId, token })
            });
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
        return this.request<void>(`action=delete_video`, {
            method: 'POST',
            body: JSON.stringify({ id: videoId, userId })
        });
    }

    public async uploadVideo(title: string, description: string, price: number, category: string, duration: number, user: User, file: File, thumbnail: File | null, onProgress: (percent: number, loaded: number, total: number) => void): Promise<void> {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price.toString());
        formData.append('category', category);
        formData.append('duration', duration.toString());
        formData.append('creatorId', user.id);
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
                        reject(new Error("Respuesta inválida"));
                    }
                } else reject(new Error("Subida fallida"));
            };
            xhr.onerror = () => reject(new Error("Error de red"));
            xhr.send(formData);
        });
    }

    // Social
    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, rating: type })
        });
    }

    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId })
        });
    }

    public async getUserActivity(userId: string): Promise<{watched: string[], liked: string[]}> {
        return this.request<{watched: string[], liked: string[]}>(`action=get_user_activity&userId=${userId}`);
    }

    public async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
    }

    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, text })
        });
    }

    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        const res = await this.request<{isSubscribed: boolean}>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
        return res.isSubscribed;
    }

    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe`, {
            method: 'POST',
            body: JSON.stringify({ userId, creatorId })
        });
    }

    // Finance & VIP
    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
        return res.hasPurchased;
    }

    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId })
        });
    }

    public async getSales(userId: string): Promise<SaleRecord[]> {
        return this.request<SaleRecord[]>(`action=get_sales&userId=${userId}`);
    }

    public async getUserTransactions(userId: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`action=get_user_transactions&userId=${userId}`);
    }

    public async requestBalance(userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=request_balance`, {
            method: 'POST',
            body: JSON.stringify({ userId, amount })
        });
    }

    public async requestVip(userId: string, plan: VipPlan, paymentRef: string): Promise<void> {
        return this.request<void>(`action=request_vip`, {
            method: 'POST',
            body: JSON.stringify({ userId, plan, paymentRef })
        });
    }

    public async verifyPayment(userId: string, ref: string): Promise<void> {
        return this.request<void>(`action=verify_payment`, {
            method: 'POST',
            body: JSON.stringify({ userId, reference: ref })
        });
    }

    public async createPaymentLink(userId: string, plan: VipPlan): Promise<string> {
        const res = await this.request<{paymentUrl: string}>(`action=create_payment_link`, {
            method: 'POST',
            body: JSON.stringify({ userId, plan })
        });
        return res.paymentUrl;
    }

    public async updatePricesBulk(userId: string, price: number): Promise<void> {
        return this.request<void>(`action=update_prices_bulk`, {
            method: 'POST',
            body: JSON.stringify({ creatorId: userId, newPrice: price })
        });
    }

    public async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
        return this.request<void>(`action=update_order_status`, {
            method: 'POST',
            body: JSON.stringify({ userId, transactionId: txId, status })
        });
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
        return this.request<void>(`action=edit_listing`, {
            method: 'POST',
            body: JSON.stringify({ id, userId, data })
        });
    }

    public async checkoutCart(userId: string, items: CartItem[], shipping: any): Promise<void> {
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

    // Admin
    public async checkInstallation(): Promise<{status: string}> {
        try {
            return await this.request<{status: string}>(`action=check_installation`);
        } catch (e: any) {
            if (e.message && e.message.includes('No instalado')) {
                return { status: 'not_installed' };
            }
            return { status: 'installed' }; 
        }
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
            body: JSON.stringify({ settings })
        });
    }

    public async getBalanceRequests(): Promise<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> {
        return this.request<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> (`action=get_balance_requests`);
    }

    public async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_balance_request`, { 
            method: 'POST',
            body: JSON.stringify({ adminId, requestId: reqId, action })
        });
    }

    public async handleVipRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_vip_request`, { 
            method: 'POST',
            body: JSON.stringify({ adminId, requestId: reqId, action })
        });
    }

    public async adminAddBalance(adminId: string, userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance`, { 
            method: 'POST',
            body: JSON.stringify({ adminId, targetUserId: userId, amount })
        });
    }

    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>(`action=get_global_transactions`);
    }

    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
    }

    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing`, {
            method: 'POST',
            body: JSON.stringify({ id: itemId })
        });
    }

    public async adminCleanupSystemFiles(): Promise<any> {
        return this.request<any>(`action=admin_cleanup_system_files`, { method: 'POST' });
    }

    public async adminRepairDb(): Promise<void> {
        return this.request<void>(`action=admin_repair_db`, { method: 'POST' });
    }

    public async getSmartCleanerPreview(category: string, percent: number, days: number): Promise<SmartCleanerResult> {
        return this.request<SmartCleanerResult>(`action=admin_smart_cleaner_preview`, {
            method: 'POST',
            body: JSON.stringify({ category, percentage: percent, safeHarborDays: days })
        });
    }

    public async executeSmartCleaner(ids: string[]): Promise<{deleted: number}> {
        return this.request<{deleted: number}>(`action=admin_smart_cleaner_execute`, {
            method: 'POST',
            body: JSON.stringify({ videoIds: ids })
        });
    }

    public async getRealStats(): Promise<any> {
        return this.request<any>(`action=admin_get_real_stats`);
    }

    // Library & Local
    /* Added 'message' property to the return type of scanLocalLibrary to fix TypeScript errors in AdminLibrary.tsx */
    public async scanLocalLibrary(path: string): Promise<{success: boolean, totalFound: number, newToImport: number, errors?: string[], error?: string, message?: string}> {
        return this.request<any>(`action=scan_local_library`, { 
            method: 'POST',
            body: JSON.stringify({ path })
        });
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
        return this.request<OrganizeResult>(`action=smart_organize`, { method: 'POST' });
    }

    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`);
    }

    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=import_ftp_file`, {
            method: 'POST',
            body: JSON.stringify({ path })
        });
    }

    public async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
        return this.request<{scanned: number, added: number}>(`action=scan_ftp_recursive`, {
            method: 'POST',
            body: JSON.stringify({ path })
        });
    }

    // External Requests
    public async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external`, {
            method: 'POST',
            body: JSON.stringify({ query, source })
        });
    }

    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import_video`, {
            method: 'POST',
            body: JSON.stringify({ url })
        });
    }

    public async getRequests(filter: string = 'ALL'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&status=${filter}`);
    }

    public async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<void> {
        return this.request<void>(`action=request_content`, {
            method: 'POST',
            body: JSON.stringify({ userId, query, useLocalNetwork })
        });
    }

    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=admin_update_request_status`, {
            method: 'POST',
            body: JSON.stringify({ id, status })
        });
    }

    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request`, {
            method: 'POST',
            body: JSON.stringify({ requestId: id })
        });
    }

    // Notifications
    public async getNotifications(userId: string): Promise<AppNotification[]> {
        return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`);
    }

    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read`, {
            method: 'POST',
            body: JSON.stringify({ notifId: id })
        });
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