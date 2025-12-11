
import { 
    User, Video, Transaction, Comment, UserInteraction, 
    SystemSettings, VideoCategory, MarketplaceItem, 
    MarketplaceReview, CartItem, SaleRecord, ContentRequest, 
    BalanceRequest, SmartCleanerResult, VideoResult, FtpFile, Notification,
    OrganizeResult
} from '../types';

export class DBService {
    private baseUrl = 'api/index.php';
    private demoMode = false;

    constructor() {
        if (localStorage.getItem('sp_demo_mode') === 'true') {
            this.demoMode = true;
        }
    }

    enableDemoMode() {
        this.demoMode = true;
        localStorage.setItem('sp_demo_mode', 'true');
    }

    private async request<T>(query: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('sp_session_token');
        const headers: any = options?.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${this.baseUrl}?${query}`, {
            ...options,
            headers: {
                ...headers
            }
        });

        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.success === false) throw new Error(json.error || json.message || "API Error");
            return json.data as T;
        } catch (e: any) {
            console.error("API Response Parse Error:", text);
            throw new Error(e.message || "Invalid JSON response");
        }
    }

    // --- Core Methods ---

    async getUnprocessedVideos(limit: number = 0, mode: 'normal' | 'random' = 'normal'): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    async updateVideoMetadata(id: string, duration: number, thumbnail: File | null): Promise<void> {
         const formData = new FormData();
         formData.append('id', id);
         formData.append('duration', duration.toString());
         if (thumbnail) formData.append('thumbnail', thumbnail);
         
         const headers: any = {};
         const token = localStorage.getItem('sp_session_token');
         if (token) headers['Authorization'] = `Bearer ${token}`;

         const res = await fetch(`${this.baseUrl}?action=update_video_metadata`, { 
             method: 'POST', 
             body: formData,
             headers
         });
         
         if (!res.ok) throw new Error("Metadata update failed");
         const json = await res.json();
         if (!json.success) throw new Error(json.message || "Metadata update failed");
    }

    // --- Auth & User ---
    
    async login(u: string, p: string): Promise<User> { 
        return this.request<User>(`action=login`, { method: 'POST', body: JSON.stringify({username: u, password: p}) }); 
    }

    async register(u: string, p: string, a?: File|null): Promise<User> { 
        const formData = new FormData();
        formData.append('username', u);
        formData.append('password', p);
        if(a) formData.append('avatar', a);
        
        const res = await fetch(`${this.baseUrl}?action=register`, { method: 'POST', body: formData });
        const json = await res.json();
        if(!json.success) throw new Error(json.message);
        return json.data;
    }

    async logout(uid: string): Promise<void> { 
        this.request(`action=logout&user_id=${uid}`); 
    }

    async getUser(id: string): Promise<User | null> { 
        return this.request<User>(`action=get_user&id=${id}`); 
    }

    saveOfflineUser(u: User) { 
        localStorage.setItem('sp_offline_user', JSON.stringify(u)); 
    }

    getOfflineUser(): User | null { 
        const u = localStorage.getItem('sp_offline_user'); 
        return u ? JSON.parse(u) : null; 
    }

    async heartbeat(uid: string, token: string): Promise<boolean> { 
        try { 
            await this.request(`action=heartbeat`, { method: 'POST', body: JSON.stringify({ userId: uid, token }) }); 
            return true; 
        } catch(e) { 
            return false; 
        }
    }
    
    // --- Videos ---

    async getAllVideos(): Promise<Video[]> { 
        return this.request<Video[]>(`action=get_videos`); 
    }

    async getVideo(id: string): Promise<Video | null> { 
        return this.request<Video>(`action=get_video&id=${id}`); 
    }

    async getRelatedVideos(id: string): Promise<Video[]> { 
        return this.request<Video[]>(`action=get_related_videos&id=${id}`); 
    }

    async getVideosByCreator(id: string): Promise<Video[]> { 
        return this.request<Video[]>(`action=get_creator_videos&creatorId=${id}`); 
    }

    async deleteVideo(id: string, uid: string): Promise<void> { 
        return this.request(`action=delete_video`, { method: 'POST', body: JSON.stringify({ id, userId: uid }) }); 
    }
    
    // --- Interactions ---

    async getComments(vid: string): Promise<Comment[]> { 
        return this.request<Comment[]>(`action=get_comments&videoId=${vid}`); 
    }

    async addComment(uid: string, vid: string, text: string): Promise<Comment> { 
        return this.request<Comment>(`action=add_comment`, { method: 'POST', body: JSON.stringify({userId: uid, videoId: vid, text}) }); 
    }

    async getInteraction(uid: string, vid: string): Promise<UserInteraction> { 
        return this.request<UserInteraction>(`action=get_interaction&userId=${uid}&videoId=${vid}`); 
    }

    async rateVideo(uid: string, vid: string, type: string): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video`, { method: 'POST', body: JSON.stringify({userId: uid, videoId: vid, rating: type})});
    }

    async markWatched(uid: string, vid: string): Promise<void> { 
        this.request(`action=mark_watched`, { method: 'POST', body: JSON.stringify({userId: uid, videoId: vid})}); 
    }

    // --- Subscriptions ---

    async checkSubscription(subscriberId: string, creatorId: string): Promise<boolean> {
        const res = await this.request<{isSubscribed: boolean}>(`action=check_subscription&subscriberId=${subscriberId}&creatorId=${creatorId}`);
        return res.isSubscribed;
    }

    async toggleSubscribe(subscriberId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe`, { method: 'POST', body: JSON.stringify({subscriberId, creatorId})});
    }
    
    // --- Commerce ---

    async hasPurchased(uid: string, vid: string): Promise<boolean> { 
        const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${uid}&videoId=${vid}`); 
        return res.hasPurchased;
    }

    async purchaseVideo(uid: string, vid: string): Promise<void> { 
        return this.request(`action=purchase_video`, { method: 'POST', body: JSON.stringify({userId: uid, videoId: vid})}); 
    }

    async getUserTransactions(uid: string): Promise<Transaction[]> { 
        return this.request<Transaction[]>(`action=get_transactions&userId=${uid}`); 
    }
    
    // --- Upload ---

    async uploadVideo(title: string, desc: string, price: number, cat: string, dur: number, user: User, file: File, thumb: File|null, onProgress: (p:number, l:number, t:number)=>void): Promise<void> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', desc);
            formData.append('price', price.toString());
            formData.append('category', cat);
            formData.append('duration', dur.toString());
            formData.append('creatorId', user.id); // Backend expects creatorId
            formData.append('video', file);
            if(thumb) formData.append('thumbnail', thumb);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.baseUrl}?action=upload_video`);
            const token = localStorage.getItem('sp_session_token');
            if(token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            
            xhr.upload.onprogress = (e) => {
                if(e.lengthComputable) onProgress((e.loaded/e.total)*100, e.loaded, e.total);
            };
            
            xhr.onload = () => {
                if(xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if(json.success) resolve(); else reject(new Error(json.error || 'Upload failed'));
                    } catch(e) { reject(new Error("Invalid JSON from server")); }
                }
                else reject(new Error(xhr.statusText));
            };
            xhr.onerror = () => reject(new Error("Network Error"));
            xhr.send(formData);
        });
    }

    // --- System ---

    async getSystemSettings(): Promise<SystemSettings> { 
        return this.request<SystemSettings>(`action=get_system_settings`); 
    }

    async updateSystemSettings(s: Partial<SystemSettings>): Promise<void> { 
        return this.request(`action=update_system_settings`, { method: 'POST', body: JSON.stringify({settings: s})}); 
    }
    
    // --- Admin ---

    async getAllUsers(): Promise<User[]> { 
        return this.request<User[]>(`action=get_all_users`); 
    }

    async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
        return this.request(`action=admin_add_balance`, { method: 'POST', body: JSON.stringify({adminId, targetUserId: targetId, amount})});
    }
    
    // --- Notifications ---

    async getNotifications(uid: string): Promise<Notification[]> { 
        return this.request<Notification[]>(`action=get_notifications&userId=${uid}`); 
    }

    async markNotificationRead(id: string): Promise<void> { 
        return this.request(`action=mark_notification_read`, { method: 'POST', body: JSON.stringify({notifId: id}) }); 
    }

    // --- Requests ---

    async searchExternal(q: string, src: string): Promise<VideoResult[]> { 
        return this.request<VideoResult[]>(`action=search_external`, { method: 'POST', body: JSON.stringify({query: q, source: src}) }); 
    }

    async requestContent(uid: string, q: string, local: boolean): Promise<void> {
        return this.request(`action=request_content`, { method: 'POST', body: JSON.stringify({userId: uid, query: q, useLocalNetwork: local})});
    }

    async getRequests(filter: string = 'ALL'): Promise<ContentRequest[]> { 
        return this.request<ContentRequest[]>(`action=get_requests&status=${filter}`); 
    }

    async deleteRequest(id: string): Promise<void> { 
        return this.request(`action=delete_request`, { method: 'POST', body: JSON.stringify({requestId: id}) }); 
    }

    async updateRequestStatus(id: string, status: string): Promise<void> { 
        return this.request(`action=admin_update_request_status`, { method: 'POST', body: JSON.stringify({id, status})}); 
    }

    // --- Misc ---

    invalidateCache(key: string) { localStorage.removeItem('sp_cache_' + key); }
    setHomeDirty() { this.invalidateCache('get_videos'); }
    
    // Improved Check Installation handling Offline mode
    async checkInstallation(): Promise<{status: 'installed' | 'not_installed' | 'error'}> { 
        try { 
            const res = await this.request<any>('action=check'); 
            return { status: res.installed ? 'installed' : 'not_installed' };
        } catch(e) { 
            return { status: 'error' }; 
        } 
    }
    
    needsSetup(): boolean { return false; } 

    // --- Admin Library ---

    async scanLocalLibrary(path: string): Promise<any> { 
        return this.request(`action=scan_local_library`, { method: 'POST', body: JSON.stringify({path}) }); 
    }

    async processScanBatch(): Promise<any> { 
        return this.request(`action=process_queue`); 
    }

    async smartOrganizeLibrary(): Promise<any> { 
        return this.request(`action=smart_organize`); 
    }

    async rectifyLibraryTitles(lastId?: string): Promise<any> { 
        return this.request(`action=rectify_titles`, { method: 'POST', body: JSON.stringify({lastId}) }); 
    }

    // --- Profile ---

    async updateUserProfile(uid: string, data: Partial<User>): Promise<void> { 
        return this.request(`action=update_user`, { method: 'POST', body: JSON.stringify({userId: uid, updates: data})}); 
    }

    async updatePricesBulk(uid: string, price: number): Promise<void> {
        return this.request(`action=update_prices_bulk`, { method: 'POST', body: JSON.stringify({creatorId: uid, newPrice: price})});
    }

    async uploadAvatar(uid: string, file: File): Promise<void> { 
        const formData = new FormData();
        formData.append('userId', uid);
        formData.append('avatar', file);
        await fetch(`${this.baseUrl}?action=update_avatar`, { method: 'POST', body: formData });
    }

    async changePassword(uid: string, oldP: string, newP: string): Promise<void> {
        return this.request(`action=change_password`, { method: 'POST', body: JSON.stringify({userId: uid, oldPass: oldP, newPass: newP})});
    }

    async requestBalance(uid: string, amount: number): Promise<void> {
        return this.request(`action=request_balance`, { method: 'POST', body: JSON.stringify({userId: uid, amount})});
    }

    async getBalanceRequests(): Promise<BalanceRequest[]> { 
        return this.request<BalanceRequest[]>(`action=admin_get_balance_requests`); 
    }

    async handleBalanceRequest(adminId: string, reqId: string, status: string): Promise<void> {
        return this.request(`action=admin_handle_balance_request`, { method: 'POST', body: JSON.stringify({adminId, requestId: reqId, action: status})});
    }

    // --- FTP ---

    async listFtpFiles(path: string): Promise<FtpFile[]> { 
        return this.request<FtpFile[]>(`action=ftp_list`, { method: 'POST', body: JSON.stringify({path}) }); 
    }

    async importFtpFile(path: string): Promise<void> { 
        return this.request(`action=ftp_import`, { method: 'POST', body: JSON.stringify({path}) }); 
    }

    async scanFtpRecursive(path: string): Promise<any> { 
        return this.request(`action=scan_ftp_recursive`, { method: 'POST', body: JSON.stringify({path}) }); 
    }

    // --- Marketplace ---

    async getMarketplaceItems(): Promise<MarketplaceItem[]> { 
        return this.request<MarketplaceItem[]>(`action=get_marketplace_items`); 
    }

    async getMarketplaceItem(id: string): Promise<MarketplaceItem|null> { 
        return this.request<MarketplaceItem>(`action=get_marketplace_item&id=${id}`); 
    }

    async createListing(formData: FormData): Promise<void> { 
        const token = localStorage.getItem('sp_session_token');
        await fetch(`${this.baseUrl}?action=create_listing`, { 
            method: 'POST', 
            body: formData, 
            headers: token ? { 'Authorization': `Bearer ${token}` } : {} 
        });
    }

    async editListing(id: string, sellerId: string, data: any): Promise<void> {
        return this.request(`action=edit_listing`, { method: 'POST', body: JSON.stringify({id, userId: sellerId, data})});
    }

    async getReviews(itemId: string): Promise<MarketplaceReview[]> { 
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`); 
    }

    async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        return this.request(`action=add_review`, { method: 'POST', body: JSON.stringify({itemId, userId, rating, comment})});
    }

    async checkoutCart(userId: string, cart: CartItem[], shipping: any): Promise<void> {
        return this.request(`action=checkout_cart`, { method: 'POST', body: JSON.stringify({userId, cart, shippingDetails: shipping})});
    }

    async getSales(userId: string): Promise<SaleRecord[]> { 
        return this.request<SaleRecord[]>(`action=get_sales&userId=${userId}`); 
    }

    async updateOrderStatus(userId: string, txId: string, status: string): Promise<void> {
        return this.request(`action=update_order_status`, { method: 'POST', body: JSON.stringify({userId, transactionId: txId, status})});
    }

    async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> { 
        return this.request<MarketplaceItem[]>(`action=admin_get_marketplace_items`); 
    }

    async adminDeleteListing(id: string): Promise<void> { 
        return this.request(`action=admin_delete_listing`, { method: 'POST', body: JSON.stringify({id}) }); 
    }

    // --- Admin Tools ---

    async adminCleanupSystemFiles(): Promise<any> { 
        return this.request(`action=admin_cleanup_system_files`); 
    }

    async adminRepairDb(): Promise<void> { 
        return this.request(`action=admin_repair_db`); 
    }

    async getSmartCleanerPreview(cat: string, pct: number, days: number): Promise<SmartCleanerResult> {
        return this.request<SmartCleanerResult>(`action=admin_smart_cleaner_preview`, {
            method: 'POST',
            body: JSON.stringify({ category: cat, percentage: pct, safeHarborDays: days })
        });
    }

    async executeSmartCleaner(ids: string[]): Promise<any> {
        return this.request(`action=admin_smart_cleaner_execute`, { method: 'POST', body: JSON.stringify({videoIds: ids})});
    }

    async getGlobalTransactions(): Promise<any[]> { 
        return this.request<any[]>(`action=admin_get_global_transactions`); 
    }

    // --- Setup ---

    async verifyDbConnection(config: any): Promise<boolean> { 
        try { 
            await this.request(`action=verify_db`, { method: 'POST', body: JSON.stringify(config)}); 
            return true; 
        } catch(e) { return false; } 
    }

    async initializeSystem(config: any, admin: any): Promise<void> {
        return this.request(`action=install`, { method: 'POST', body: JSON.stringify({dbConfig: config, adminUser: admin})});
    }

    // --- Server ---

    async serverImportVideo(url: string): Promise<void> { 
        return this.request(`action=server_import_video`, { method: 'POST', body: JSON.stringify({url}) }); 
    }
}

export const db = new DBService();
