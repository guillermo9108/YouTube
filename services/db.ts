import {
    User, Video, Transaction, Comment, UserInteraction,
    SystemSettings, MarketplaceItem, MarketplaceReview,
    CartItem, SaleRecord, ContentRequest, BalanceRequest,
    VideoCategory, SmartCleanerResult, FtpFile, Notification, VideoResult
} from '../types';

class DBService {
    private demoMode: boolean = false;
    private baseUrl: string = 'api/';

    constructor() {
        // Check for demo mode preference
        if (localStorage.getItem('sp_demo_mode') === 'true') {
            this.demoMode = true;
        }
    }

    enableDemoMode() {
        this.demoMode = true;
        localStorage.setItem('sp_demo_mode', 'true');
    }

    private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T> {
        if (this.demoMode) {
            console.warn("Demo mode active: " + endpoint);
            return {} as T; 
        }

        const headers: Record<string, string> = {};
        if (!(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const token = localStorage.getItem('sp_session_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config: RequestInit = {
            method,
            headers: body instanceof FormData ? undefined : headers,
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, config);
        
        if (response.status === 401) {
             // Handle logout scenario if needed
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (!json.success && json.success !== undefined) {
                 throw new Error(json.error || 'API Error');
            }
            return json.data !== undefined ? json.data : json;
        } catch (e) {
            console.error("Invalid JSON response", text);
            throw new Error(text || "Network error");
        }
    }

    // --- AUTH ---

    async login(username: string, password: string): Promise<User> {
        return this.request<User>('index.php?action=login', 'POST', { username, password });
    }

    async register(username: string, password: string, avatar?: File | null): Promise<User> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (avatar) formData.append('avatar', avatar);
        return this.request<User>('index.php?action=register', 'POST', formData);
    }

    async logout(userId: string): Promise<void> {
        await this.request('index.php?action=logout', 'POST', { userId });
    }

    async heartbeat(userId: string, token: string): Promise<boolean> {
        try {
            const res = await this.request<{valid: boolean}>('index.php?action=heartbeat', 'POST', { userId, token });
            return res.valid;
        } catch (e) {
            return false;
        }
    }

    async getUser(id: string): Promise<User | null> {
        return this.request<User>(`index.php?action=get_user&id=${id}`);
    }

    saveOfflineUser(user: User) {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    getOfflineUser(): User | null {
        const u = localStorage.getItem('sp_offline_user');
        return u ? JSON.parse(u) : null;
    }

    async checkInstallation(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}index.php?action=check_install`);
            const json = await res.json();
            return json.installed;
        } catch {
            return false;
        }
    }

    needsSetup(): boolean {
        return false;
    }

    async verifyDbConnection(config: any): Promise<boolean> {
        const res = await this.request<{success: boolean}>('index.php?action=verify_db', 'POST', config);
        return res.success;
    }

    async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        await this.request('index.php?action=install', 'POST', { dbConfig, adminConfig });
    }

    // --- USERS & PROFILE ---

    async getAllUsers(): Promise<User[]> {
        return this.request<User[]>('index.php?action=admin_get_users');
    }

    async updateUserProfile(userId: string, data: Partial<User>): Promise<User> {
        return this.request<User>('index.php?action=update_profile', 'POST', { userId, ...data });
    }

    async uploadAvatar(userId: string, file: File): Promise<string> {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('avatar', file);
        const res = await this.request<{avatarUrl: string}>('index.php?action=upload_avatar', 'POST', formData);
        return res.avatarUrl;
    }

    async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        await this.request('index.php?action=change_password', 'POST', { userId, oldPass, newPass });
    }

    async requestBalance(userId: string, amount: number): Promise<void> {
        await this.request('index.php?action=request_balance', 'POST', { userId, amount });
    }

    async getBalanceRequests(): Promise<BalanceRequest[]> {
        return this.request<BalanceRequest[]>('index.php?action=admin_get_balance_requests');
    }

    async handleBalanceRequest(adminId: string, reqId: string, action: 'APPROVED' | 'REJECTED'): Promise<void> {
        // Fix: Use 'requestId' instead of 'reqId' to match PHP expectation
        await this.request('index.php?action=admin_handle_balance_request', 'POST', { adminId, requestId: reqId, action });
    }

    async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
        await this.request('index.php?action=admin_add_balance', 'POST', { adminId, targetId, amount });
    }

    async getUserTransactions(userId: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`index.php?action=get_transactions&userId=${userId}`);
    }

    async getGlobalTransactions(): Promise<any[]> {
        return this.request<any[]>('index.php?action=admin_get_global_transactions');
    }

    async getSales(userId: string): Promise<SaleRecord[]> {
        return this.request<SaleRecord[]>(`index.php?action=get_sales&userId=${userId}`);
    }
    
    async updateOrderStatus(sellerId: string, saleId: string, status: string): Promise<void> {
        await this.request('index.php?action=update_order_status', 'POST', { sellerId, saleId, status });
    }

    async getNotifications(userId: string): Promise<Notification[]> {
        return this.request<Notification[]>(`index.php?action=get_notifications&userId=${userId}`);
    }

    async markNotificationRead(id: string): Promise<void> {
        await this.request('index.php?action=read_notification', 'POST', { id });
    }

    // --- VIDEOS ---

    async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>('index.php?action=get_videos');
    }

    async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`index.php?action=get_videos&creatorId=${userId}`);
    }

    async getVideo(id: string): Promise<Video | null> {
        return this.request<Video>(`index.php?action=get_video&id=${id}`);
    }

    async uploadVideo(title: string, description: string, price: number, category: VideoCategory, duration: number, user: User, file: File, thumbnail: File | null, onProgress?: (percent: number, loaded: number, total: number) => void): Promise<void> {
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
            xhr.open('POST', this.baseUrl + 'index.php?action=upload_video', true);
            
            const token = localStorage.getItem('sp_session_token');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = (e.loaded / e.total) * 100;
                    onProgress(percent, e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.success) resolve();
                        else reject(new Error(json.error));
                    } catch {
                        reject(new Error("Invalid server response"));
                    }
                } else {
                    reject(new Error("Upload failed"));
                }
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(formData);
        });
    }

    async deleteVideo(id: string, userId: string): Promise<void> {
        await this.request('index.php?action=delete_video', 'POST', { id, userId });
    }

    async updateVideoMetadata(id: string, duration: number, thumbnail: File | null): Promise<void> {
        const formData = new FormData();
        formData.append('id', id);
        formData.append('duration', duration.toString());
        if (thumbnail) formData.append('thumbnail', thumbnail);
        await this.request('index.php?action=update_video_metadata', 'POST', formData);
    }
    
    async updatePricesBulk(userId: string, price: number): Promise<void> {
        await this.request('index.php?action=update_prices_bulk', 'POST', { userId, price });
    }

    // --- INTERACTIONS ---

    async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        const res = await this.request<{purchased: boolean}>(`index.php?action=check_purchase&userId=${userId}&videoId=${videoId}`);
        return res.purchased;
    }

    async purchaseVideo(userId: string, videoId: string): Promise<void> {
        await this.request('index.php?action=purchase_video', 'POST', { userId, videoId });
    }

    async getInteraction(userId: string, videoId: string): Promise<UserInteraction> {
        return this.request<UserInteraction>(`index.php?action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>('index.php?action=rate_video', 'POST', { userId, videoId, type });
    }

    async markWatched(userId: string, videoId: string): Promise<void> {
        await this.request('index.php?action=mark_watched', 'POST', { userId, videoId });
    }

    async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        const res = await this.request<{subscribed: boolean}>(`index.php?action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
        return res.subscribed;
    }

    async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>('index.php?action=toggle_subscribe', 'POST', { userId, creatorId });
    }

    async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`index.php?action=get_comments&videoId=${videoId}`);
    }

    async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>('index.php?action=add_comment', 'POST', { userId, videoId, text });
    }
    
    async getRelatedVideos(videoId: string, context?: any): Promise<Video[]> {
        // Pass context if needed
        return this.request<Video[]>(`index.php?action=get_related&videoId=${videoId}`);
    }

    // --- MARKETPLACE ---

    async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('index.php?action=get_marketplace_items');
    }

    async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem>(`index.php?action=get_marketplace_item&id=${id}`);
    }

    async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('index.php?action=admin_get_marketplace_items');
    }

    async createListing(formData: FormData): Promise<void> {
        await this.request('index.php?action=create_listing', 'POST', formData);
    }

    async editListing(id: string, userId: string, data: Partial<MarketplaceItem>): Promise<void> {
        await this.request('index.php?action=edit_listing', 'POST', { id, userId, ...data });
    }

    async adminDeleteListing(id: string): Promise<void> {
        await this.request('index.php?action=admin_delete_listing', 'POST', { id });
    }

    async checkoutCart(userId: string, cart: CartItem[], shipping: any): Promise<void> {
        await this.request('index.php?action=checkout_cart', 'POST', { userId, cart, shipping });
    }

    async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`index.php?action=get_reviews&itemId=${itemId}`);
    }

    async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        await this.request('index.php?action=add_review', 'POST', { itemId, userId, rating, comment });
    }

    // --- SYSTEM & ADMIN ---

    async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>('index.php?action=get_system_settings');
    }

    async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        await this.request('index.php?action=update_system_settings', 'POST', { settings });
    }

    async scanLocalLibrary(path: string): Promise<{success: boolean, totalFound?: number, newToImport?: number, errors?: string[]}> {
        return this.request('index.php?action=scan_local_library', 'POST', { path });
    }

    async processScanBatch(): Promise<{processed: any[], remaining: number, completed: boolean}> {
        return this.request('index.php?action=process_scan_batch', 'POST');
    }

    async smartOrganizeLibrary(): Promise<any> {
        return this.request('index.php?action=smart_organize_library', 'POST');
    }

    async rectifyLibraryTitles(lastId?: string): Promise<{processed: number, lastId: string, completed: boolean}> {
        return this.request('index.php?action=rectify_library_titles', 'POST', { lastId });
    }

    async adminCleanupSystemFiles(): Promise<any> {
        return this.request('index.php?action=admin_cleanup_system_files', 'POST');
    }

    async adminRepairDb(): Promise<void> {
        await this.request('index.php?action=admin_repair_db', 'POST');
    }

    async getSmartCleanerPreview(category: string, percent: number, days: number): Promise<SmartCleanerResult> {
        // Fix: Use correct endpoint name defined in API
        return this.request<SmartCleanerResult>('index.php?action=admin_smart_cleaner_preview', 'POST', { category, percent, days });
    }

    async executeSmartCleaner(ids: string[]): Promise<{deleted: number}> {
        // Fix: Use correct endpoint name defined in API
        return this.request<{deleted: number}>('index.php?action=admin_smart_cleaner_execute', 'POST', { ids });
    }

    // --- EXTERNAL & REQUESTS ---

    async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`index.php?action=search_external&query=${encodeURIComponent(query)}&source=${source}`);
    }
    
    async serverImportVideo(url: string): Promise<void> {
        await this.request('index.php?action=server_import_video', 'POST', { url });
    }

    async requestContent(userId: string, query: string, useLocal: boolean): Promise<void> {
        await this.request('index.php?action=request_content', 'POST', { userId, query, useLocal });
    }

    async getRequests(status: string = 'ALL'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`index.php?action=get_requests&status=${status}`);
    }

    async updateRequestStatus(id: string, status: string): Promise<void> {
        await this.request('index.php?action=admin_update_request_status', 'POST', { id, status });
    }

    async deleteRequest(id: string): Promise<void> {
        await this.request('index.php?action=delete_request', 'POST', { requestId: id });
    }

    // --- FTP ---
    
    async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>('index.php?action=list_ftp_files', 'POST', { path });
    }

    async importFtpFile(path: string): Promise<void> {
        await this.request('index.php?action=import_ftp_file', 'POST', { path });
    }

    async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
        return this.request('index.php?action=scan_ftp_recursive', 'POST', { path });
    }

    // --- CACHE & UTIL ---
    
    invalidateCache(key?: string) {
        // Placeholder for cache invalidation logic if implementing client-side caching
    }

    setHomeDirty() {
        // Placeholder to trigger home refresh
    }
}

export const db = new DBService();