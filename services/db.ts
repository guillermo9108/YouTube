import { 
    User, Video, Transaction, Comment, UserInteraction, 
    SystemSettings, Notification, MarketplaceItem, MarketplaceReview, 
    CartItem, SaleRecord, ContentRequest, BalanceRequest, 
    VideoResult, SmartCleanerResult, OrganizeResult, FtpFile
} from '../types';

class DBService {
    private baseUrl = 'api/index.php';
    private demoMode = false;
    private offlineUserKey = 'sp_offline_user';

    constructor() {
        if (localStorage.getItem('sp_demo_mode') === 'true') {
            this.demoMode = true;
        }
    }

    enableDemoMode() {
        this.demoMode = true;
        localStorage.setItem('sp_demo_mode', 'true');
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (this.demoMode) {
            console.warn("Demo mode request:", endpoint);
            return {} as T; 
        }

        let fetchUrl = this.baseUrl;
        if (endpoint.includes('index.php')) {
            fetchUrl = endpoint;
        } else {
            fetchUrl = `${this.baseUrl}?${endpoint}`;
        }

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        const token = localStorage.getItem('sp_session_token');
        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(fetchUrl, { ...options, headers });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.error) throw new Error(json.error);
            if (json.success === false) throw new Error(json.message || 'Unknown error');
            return json.data !== undefined ? json.data : json;
        } catch (e: any) {
            if (text.includes("<b>Warning</b>") || text.includes("<b>Fatal error</b>")) {
                 throw new Error("Server Error: " + text.replace(/<[^>]*>?/gm, '').substring(0, 100));
            }
            throw e;
        }
    }

    // --- Installation & Auth ---

    async checkInstallation(): Promise<boolean> {
        try {
            const res = await this.request<{installed: boolean}>('action=check_install');
            return res.installed;
        } catch { return false; }
    }

    needsSetup(): boolean {
        return false;
    }

    async verifyDbConnection(config: any): Promise<boolean> {
        const res = await this.request<{success: boolean}>('action=verify_db', {
            method: 'POST',
            body: JSON.stringify(config)
        });
        return res.success;
    }

    async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        await this.request('action=install', {
            method: 'POST',
            body: JSON.stringify({ ...dbConfig, ...adminConfig })
        });
    }

    async login(username: string, password: string): Promise<User> {
        return this.request<User>('action=login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async register(username: string, password: string, avatar?: File | null): Promise<User> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (avatar) formData.append('avatar', avatar);
        
        const response = await fetch(`${this.baseUrl}?action=register`, {
            method: 'POST',
            body: formData
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.message);
        return json.data;
    }

    async logout(userId: string): Promise<void> {
        await this.request('action=logout', { method: 'POST', body: JSON.stringify({ userId }) });
    }

    async getUser(id: string): Promise<User | null> {
        return this.request<User>(`action=get_user&id=${id}`);
    }

    async heartbeat(userId: string, token: string): Promise<boolean> {
        try {
            const res = await this.request<{valid: boolean}>('action=heartbeat', {
                method: 'POST',
                body: JSON.stringify({ userId, token })
            });
            return res.valid;
        } catch { return false; }
    }

    saveOfflineUser(user: User) {
        localStorage.setItem(this.offlineUserKey, JSON.stringify(user));
    }

    getOfflineUser(): User | null {
        const data = localStorage.getItem(this.offlineUserKey);
        return data ? JSON.parse(data) : null;
    }

    async updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
         await this.request('action=update_user', {
             method: 'POST',
             body: JSON.stringify({ userId, ...data })
         });
    }

    async uploadAvatar(userId: string, file: File): Promise<string> {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('avatar', file);
        const res = await fetch(`${this.baseUrl}?action=upload_avatar`, { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json.data.url;
    }

    async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        await this.request('action=change_password', {
            method: 'POST',
            body: JSON.stringify({ userId, oldPass, newPass })
        });
    }

    // --- Content ---

    async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>('action=get_videos');
    }

    async getVideo(id: string): Promise<Video | null> {
        return this.request<Video>(`action=get_video&id=${id}`);
    }
    
    async getRelatedVideos(videoId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_related_videos&id=${videoId}`);
    }

    async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos&creatorId=${userId}`);
    }

    async uploadVideo(
        title: string, description: string, price: number, category: string, duration: number,
        user: User, file: File, thumbnail: File | null,
        onProgress: (percent: number, loaded: number, total: number) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('price', price.toString());
            formData.append('category', category);
            formData.append('duration', duration.toString());
            formData.append('userId', user.id);
            formData.append('video', file);
            if (thumbnail) formData.append('thumbnail', thumbnail);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.baseUrl}?action=upload_video`);
            
            const token = localStorage.getItem('sp_session_token');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    onProgress(percent, e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.success) resolve();
                        else reject(new Error(json.message));
                    } catch (e) { reject(new Error("Invalid server response")); }
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network Error"));
            xhr.send(formData);
        });
    }

    async deleteVideo(videoId: string, userId: string): Promise<void> {
        await this.request('action=delete_video', {
            method: 'POST',
            body: JSON.stringify({ videoId, userId })
        });
    }

    async updateVideoMetadata(id: string, duration: number, thumbnail: File | null): Promise<void> {
         const formData = new FormData();
         formData.append('id', id);
         formData.append('duration', duration.toString());
         if (thumbnail) formData.append('thumbnail', thumbnail);
         
         await fetch(`${this.baseUrl}?action=update_video_meta`, { method: 'POST', body: formData });
    }

    async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        const res = await this.request<{isSubscribed: boolean}>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
        return res.isSubscribed;
    }

    async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>('action=toggle_subscribe', {
            method: 'POST',
            body: JSON.stringify({ userId, creatorId })
        });
    }

    // --- Interactions ---

    async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
    }

    async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>('action=add_comment', {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, text })
        });
    }

    async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>('action=rate_video', {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, type })
        });
    }

    async markWatched(userId: string, videoId: string): Promise<void> {
        await this.request('action=mark_watched', {
            method: 'POST',
            body: JSON.stringify({ userId, videoId })
        });
    }

    // --- Commerce ---

    async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        const res = await this.request<{purchased: boolean}>(`action=check_purchase&userId=${userId}&videoId=${videoId}`);
        return res.purchased;
    }

    async purchaseVideo(userId: string, videoId: string): Promise<void> {
        await this.request('action=purchase_video', {
            method: 'POST',
            body: JSON.stringify({ userId, videoId })
        });
    }

    async getUserTransactions(userId: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`action=get_transactions&userId=${userId}`);
    }
    
    async getSales(userId: string): Promise<SaleRecord[]> {
        return this.request<SaleRecord[]>(`action=get_sales&userId=${userId}`);
    }

    async updatePricesBulk(userId: string, price: number): Promise<void> {
        await this.request('action=bulk_update_prices', {
            method: 'POST',
            body: JSON.stringify({ userId, price })
        });
    }

    async requestBalance(userId: string, amount: number): Promise<void> {
        await this.request('action=request_balance', {
            method: 'POST',
            body: JSON.stringify({ userId, amount })
        });
    }

    // --- Admin ---

    async getAllUsers(): Promise<User[]> {
        return this.request<User[]>('action=admin_get_users');
    }

    async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
         await this.request('action=admin_add_balance', {
            method: 'POST',
            body: JSON.stringify({ adminId, targetId, amount })
        });
    }

    async getBalanceRequests(): Promise<BalanceRequest[]> {
        return this.request<BalanceRequest[]>('action=get_balance_requests');
    }

    async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        await this.request('action=handle_balance_request', {
            method: 'POST',
            body: JSON.stringify({ adminId, reqId, action })
        });
    }

    async getGlobalTransactions(): Promise<Transaction[]> {
         return this.request<Transaction[]>('action=admin_get_transactions');
    }

    async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>('action=get_settings');
    }

    async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        await this.request('action=update_settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }

    async adminCleanupSystemFiles(): Promise<any> {
        return this.request('action=admin_cleanup_files', { method: 'POST' });
    }

    async adminRepairDb(): Promise<void> {
        await this.request('action=admin_repair_db', { method: 'POST' });
    }

    // --- Marketplace ---

    async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=get_marketplace_items');
    }

    async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem>(`action=get_marketplace_item&id=${id}`);
    }

    async createListing(formData: FormData): Promise<void> {
        const res = await fetch(`${this.baseUrl}?action=create_listing`, { method: 'POST', body: formData });
        const json = await res.json();
        if(!json.success) throw new Error(json.message);
    }

    async editListing(id: string, userId: string, data: Partial<MarketplaceItem>): Promise<void> {
        await this.request('action=edit_listing', {
            method: 'POST',
            body: JSON.stringify({ id, userId, ...data })
        });
    }

    async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
    }

    async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        await this.request('action=add_review', {
            method: 'POST',
            body: JSON.stringify({ itemId, userId, rating, comment })
        });
    }

    async checkoutCart(userId: string, cart: CartItem[], shipping: any): Promise<void> {
        await this.request('action=checkout', {
            method: 'POST',
            body: JSON.stringify({ userId, cart, shipping })
        });
    }
    
    async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=admin_get_marketplace_items');
    }

    async adminDeleteListing(id: string): Promise<void> {
        await this.request('action=delete_listing', { method: 'POST', body: JSON.stringify({ id }) });
    }

    async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
         await this.request('action=update_order_status', {
            method: 'POST',
            body: JSON.stringify({ userId, txId, status })
         });
    }

    // --- Library / Requests ---
    
    async getRequests(filter?: string): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&filter=${filter || ''}`);
    }
    
    async requestContent(userId: string, query: string, local: boolean): Promise<void> {
        await this.request('action=request_content', {
            method: 'POST',
            body: JSON.stringify({ userId, query, useLocalNetwork: local })
        });
    }

    async updateRequestStatus(id: string, status: string): Promise<void> {
         await this.request('action=update_request_status', {
            method: 'POST',
            body: JSON.stringify({ id, status })
        });
    }

    async deleteRequest(id: string): Promise<void> {
        await this.request('action=delete_request', { method: 'POST', body: JSON.stringify({ id }) });
    }

    async searchExternal(query: string, source: string): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
    }

    async serverImportVideo(url: string): Promise<void> {
        await this.request('action=server_import', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
    }

    async scanLocalLibrary(path: string): Promise<any> {
        return this.request(`action=scan_library&path=${encodeURIComponent(path)}`);
    }

    async processScanBatch(): Promise<any> {
        return this.request('action=process_scan_batch');
    }

    async smartOrganizeLibrary(): Promise<OrganizeResult> {
        return this.request<OrganizeResult>('action=smart_organize');
    }

    async rectifyLibraryTitles(lastId?: string): Promise<any> {
        return this.request(`action=rectify_titles&lastId=${lastId || ''}`);
    }
    
    async getSmartCleanerPreview(category: string, percent: number, days: number): Promise<SmartCleanerResult> {
        return this.request<SmartCleanerResult>(`action=cleaner_preview&category=${category}&percent=${percent}&days=${days}`);
    }
    
    async executeSmartCleaner(ids: string[]): Promise<{deleted: number}> {
         return this.request<{deleted: number}>('action=execute_cleaner', {
             method: 'POST',
             body: JSON.stringify({ ids })
         });
    }

    async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=ftp_list&path=${encodeURIComponent(path)}`);
    }

    async importFtpFile(path: string): Promise<void> {
        await this.request('action=ftp_import', {
            method: 'POST',
            body: JSON.stringify({ path })
        });
    }

    async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
        return this.request<{scanned: number, added: number}>(`action=ftp_scan_recursive&path=${encodeURIComponent(path)}`);
    }
    
    async getNotifications(userId: string): Promise<Notification[]> {
        return this.request<Notification[]>(`action=get_notifications&userId=${userId}`);
    }

    async markNotificationRead(id: string): Promise<void> {
        await this.request('action=read_notification', { method: 'POST', body: JSON.stringify({ id }) });
    }
    
    invalidateCache(key: string) {
        localStorage.removeItem('sp_cache_' + key);
    }
    
    setHomeDirty() {
        this.invalidateCache('get_videos');
    }
}

export const db = new DBService();
