import { 
    User, Video, Transaction, Comment, UserInteraction, 
    ContentRequest, BalanceRequest, SystemSettings, 
    MarketplaceItem, MarketplaceReview, CartItem, 
    VipPlan, VipRequest, SaleRecord, VideoResult, FtpFile, OrganizeResult, SmartCleanerResult,
    Notification as AppNotification
} from '../types';

class DBService {
    private baseUrl = 'api/index.php';
    public lastRawResponse: string = "";

    // --- DEVICE ID HELPER ---
    private getDeviceId(): string {
        let id = localStorage.getItem('sp_device_id');
        if (!id) {
            id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('sp_device_id', id);
        }
        return id;
    }

    public async request<T>(query: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('sp_session_token');
        const headers: any = options?.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let text = "";
        try {
            const response = await fetch(`${this.baseUrl}?${query}`, {
                ...options,
                headers: { ...headers }
            });

            // INTERCEPTOR DE SESIÓN ÚNICA:
            // Si el servidor responde 401, significa que el token ya no es válido
            if (response.status === 401) {
                window.dispatchEvent(new CustomEvent('sp_session_expired'));
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Tu sesión ha expirado porque has entrado desde otro dispositivo.");
            }

            text = await response.text();
            this.lastRawResponse = text;
            
            if (!response.ok) {
                throw new Error(`Servidor (${response.status}): ${text.substring(0, 300)}`);
            }
            
            if (!text || text.trim() === "") {
                throw new Error("El servidor devolvió una respuesta vacía.");
            }

            try {
                const json = JSON.parse(text);
                if (json.success === false) {
                    throw new Error(json.error || "Error en la API");
                }
                return json.data as T;
            } catch (e: any) {
                if (e.message.includes("401")) throw e;
                throw new Error(`Error de formato en respuesta del servidor.`);
            }
        } catch (error: any) {
            console.error("DB Request Error:", error);
            throw error;
        }
    }

    // --- AUTH ---
    public async login(username: string, password: string): Promise<User> {
        return this.request<User>(`action=login`, { 
            method: 'POST', 
            body: JSON.stringify({ 
                username, 
                password,
                deviceId: this.getDeviceId() 
            }) 
        });
    }

    public async register(username: string, password: string, avatar?: File | null): Promise<User> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('deviceId', this.getDeviceId());
        if (avatar) formData.append('avatar', avatar);
        return this.request<User>(`action=register`, { method: 'POST', body: formData });
    }

    public async heartbeat(userId: string): Promise<boolean> {
        try { 
            await this.request<any>(`action=heartbeat&userId=${userId}`); 
            return true;
        }
        catch (e: any) { 
            return false; 
        }
    }

    // ... (resto de métodos permanecen igual)
    public async checkInstallation(): Promise<{status: string}> {
        try { return await this.request<{status: string}>(`action=check_installation`); }
        catch (e: any) { return { status: 'not_installed' }; }
    }

    public async verifyDbConnection(dbConfig: any): Promise<boolean> {
        return this.request<boolean>(`action=verify_db_connection`, { method: 'POST', body: JSON.stringify(dbConfig) });
    }

    public async initializeSystem(dbConfig: any, admin: any): Promise<void> {
        return this.request<void>(`action=initialize_system`, { method: 'POST', body: JSON.stringify({ dbConfig, admin }) });
    }

    public enableDemoMode(): void {
        localStorage.setItem('sp_demo_mode', 'true');
    }

    public async logout(userId: string): Promise<void> {
        return this.request<void>(`action=logout&userId=${userId}`, { method: 'POST' });
    }

    public saveOfflineUser(user: User): void {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    public getOfflineUser(): User | null {
        const data = localStorage.getItem('sp_offline_user');
        return data ? JSON.parse(data) : null;
    }

    public async getUser(userId: string): Promise<User | null> {
        return this.request<User | null>(`action=get_user&userId=${userId}`);
    }

    public async getAllUsers(): Promise<User[]> {
        return this.request<User[]>(`action=get_all_users`);
    }

    public async updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
        return this.request<void>(`action=update_user_profile&userId=${userId}`, { method: 'POST', body: JSON.stringify(data) });
    }

    public async uploadAvatar(userId: string, file: File): Promise<void> {
        const formData = new FormData();
        formData.append('avatar', file);
        return this.request<void>(`action=upload_avatar&userId=${userId}`, { method: 'POST', body: formData });
    }

    public async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        return this.request<void>(`action=change_password&userId=${userId}`, { method: 'POST', body: JSON.stringify({ oldPass, newPass }) });
    }

    public async getUserActivity(userId: string): Promise<{watched: string[], liked: string[]}> {
        return this.request<any>(`action=get_user_activity&userId=${userId}`);
    }

    public async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos`);
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

    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video&userId=${userId}&videoId=${videoId}&type=${type}`, { method: 'POST' });
    }

    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        return this.request<boolean>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
    }

    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async updatePricesBulk(userId: string, price: number): Promise<void> {
        return this.request<void>(`action=update_prices_bulk&userId=${userId}&price=${price}`, { method: 'POST' });
    }

    public async uploadVideo(
        title: string, description: string, price: number, category: string, duration: number,
        user: User, file: File, thumbnail: File | null,
        onProgress: (percent: number, loaded: number, total: number) => void
    ): Promise<void> {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price.toString());
        formData.append('category', category);
        formData.append('duration', duration.toString());
        formData.append('userId', user.id);
        formData.append('video', file);
        if (thumbnail) formData.append('thumbnail', thumbnail);

        const token = localStorage.getItem('sp_session_token');
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.baseUrl}?action=upload_video`);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total); };
            xhr.onload = () => {
                if (xhr.status === 401) {
                    window.dispatchEvent(new CustomEvent('sp_session_expired'));
                    reject(new Error("Sesión expirada."));
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.success) resolve();
                        else reject(new Error(json.error || "Upload failed"));
                    } catch (e) { reject(new Error("Invalid server response")); }
                } else reject(new Error(`Server error: ${xhr.status}`));
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(formData);
        });
    }

    public async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
    }

    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment`, { method: 'POST', body: JSON.stringify({ userId, videoId, text }) });
    }

    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        return this.request<boolean>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
    }

    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<any>(`action=toggle_subscribe&userId=${userId}&creatorId=${creatorId}`, { method: 'POST' });
    }

    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    public async getRequests(status: string = 'ALL'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&status=${status}`);
    }

    public async requestContent(userId: string, query: string, useLocalNetwork: boolean): Promise<void> {
        return this.request<void>(`action=request_content`, { method: 'POST', body: JSON.stringify({ userId, query, useLocalNetwork }) });
    }

    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=update_request_status&id=${id}&status=${status}`, { method: 'POST' });
    }

    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request&id=${id}`, { method: 'POST' });
    }

    public async searchExternal(query: string, source: string): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
    }

    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import_video`, { method: 'POST', body: JSON.stringify({ url }) });
    }

    public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=get_marketplace_items`);
    }

    public async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem | null>(`action=get_marketplace_item&id=${id}`);
    }

    public async createListing(formData: FormData): Promise<void> {
        return this.request<void>(`action=create_listing`, { method: 'POST', body: formData });
    }

    public async editListing(id: string, userId: string, data: any): Promise<void> {
        return this.request<void>(`action=edit_listing&id=${id}&userId=${userId}`, { method: 'POST', body: JSON.stringify(data) });
    }

    public async checkoutCart(userId: string, items: CartItem[], shipping: any): Promise<void> {
        return this.request<void>(`action=checkout_cart&userId=${userId}`, { method: 'POST', body: JSON.stringify({ items, shipping }) });
    }

    public async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
    }

    public async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        return this.request<void>(`action=add_review`, { method: 'POST', body: JSON.stringify({ itemId, userId, rating, comment }) });
    }

    public async getSales(userId: string): Promise<SaleRecord[]> {
        return this.request<SaleRecord[]>(`action=get_sales&userId=${userId}`);
    }

    public async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
        return this.request<void>(`action=update_order_status&userId=${userId}&txId=${txId}&status=${status}`, { method: 'POST' });
    }

    public async getUserTransactions(userId: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`action=get_user_transactions&userId=${userId}`);
    }

    public async getBalanceRequests(): Promise<any> {
        return this.request<any>(`action=get_balance_requests`);
    }

    public async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_balance_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    public async requestBalance(userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=request_balance`, { method: 'POST', body: JSON.stringify({ userId, amount }) });
    }

    public async requestVip(userId: string, plan: VipPlan, paymentRef: string): Promise<void> {
        return this.request<void>(`action=request_vip`, { method: 'POST', body: JSON.stringify({ userId, plan, paymentRef }) });
    }

    public async handleVipRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        return this.request<void>(`action=handle_vip_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    public async createPaymentLink(userId: string, plan: VipPlan): Promise<string> {
        return this.request<string>(`action=create_payment_link&userId=${userId}`, { method: 'POST', body: JSON.stringify({ plan }) });
    }

    public async verifyPayment(userId: string, ref: string): Promise<void> {
        return this.request<void>(`action=verify_payment&userId=${userId}&ref=${ref}`, { method: 'POST' });
    }

    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>(`action=get_global_transactions`);
    }

    public async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance&adminId=${adminId}`, { method: 'POST', body: JSON.stringify({ targetId, amount }) });
    }

    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`);
    }

    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing&itemId=${itemId}`, { method: 'POST' });
    }

    public async getRealStats(): Promise<any> {
        return this.request<any>(`action=get_real_stats`);
    }

    public async adminCleanupSystemFiles(): Promise<any> { return this.request<any>(`action=admin_cleanup_system_files`, { method: 'POST' }); }
    public async adminRepairDb(): Promise<void> { return this.request<void>(`action=admin_repair_db`, { method: 'POST' }); }

    public async scanLocalLibrary(path: string): Promise<any> {
        return this.request<any>(`action=scan_local_library&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async processScanBatch(): Promise<any> {
        return this.request<any>(`action=process_scan_batch`, { method: 'POST' });
    }

    public async smartOrganizeLibrary(): Promise<any> {
        return this.request<any>(`action=smart_organize_library`, { method: 'POST' });
    }

    public async getUnprocessedVideos(limit: number, mode: 'normal' | 'random'): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    public async updateVideoMetadata(id: string, duration: number, thumbnail: File | null, success: boolean = true): Promise<void> {
        const formData = new FormData();
        formData.append('id', id);
        formData.append('duration', duration.toString());
        formData.append('success', success ? '1' : '0');
        if (thumbnail) formData.append('thumbnail', thumbnail);
        return this.request<void>(`action=update_video_metadata`, { method: 'POST', body: formData });
    }

    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`);
    }

    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=import_ftp_file`, { method: 'POST', body: JSON.stringify({ path }) });
    }

    public async scanFtpRecursive(path: string): Promise<any> {
        return this.request<any>(`action=scan_ftp_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>(`action=get_system_settings`);
    }

    public async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        return this.request<void>(`action=update_system_settings`, { method: 'POST', body: JSON.stringify({ settings }) });
    }

    public setHomeDirty() { /* logic */ }
    public invalidateCache(key: string) { /* logic */ }

    public async getNotifications(userId: string): Promise<AppNotification[]> {
        return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`);
    }

    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read&id=${id}`, { method: 'POST' });
    }

    public async downloadVideoForOffline(video: Video): Promise<void> {
        const cache = await caches.open('streampay-videos-v1');
        const streamUrl = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        const response = await fetch(streamUrl);
        if (response.ok) await cache.put(streamUrl, response);
    }

    public async checkDownloadStatus(videoId: string): Promise<boolean> {
        const cache = await caches.open('streampay-videos-v1');
        const keys = await cache.keys();
        return keys.some(request => request.url.includes(`id=${videoId}`));
    }
}

export const db = new DBService();