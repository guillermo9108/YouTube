
import { 
    User, Video, Transaction, VipPlan, Comment, UserInteraction, 
    Notification as AppNotification, VideoResult, ContentRequest, 
    MarketplaceItem, MarketplaceReview, BalanceRequest, VipRequest, 
    SmartCleanerResult, FtpFile, SystemSettings 
} from '../types';

/**
 * Service for handling all database and API interactions.
 * Connects the frontend to the PHP backend.
 */
class DBService {
    private homeDirty = false;

    /**
     * Core request utility for communicating with the PHP backend.
     */
    public request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = endpoint.startsWith('http') ? endpoint : `api/index.php?${endpoint}`;
        
        // Fix: Ensure correct headers for JSON POST requests
        if (options.method === 'POST' && !(options.body instanceof FormData) && typeof options.body === 'string') {
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/json'
            };
        }

        return fetch(url, options).then(async (response) => {
            if (response.status === 401) {
                window.dispatchEvent(new Event('sp_session_expired'));
                throw new Error("Session expired");
            }
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Network response was not ok' }));
                throw new Error(error.message || 'Network response was not ok');
            }
            return response.json();
        });
    }

    // --- INSTALLATION & SETUP ---

    // Fix: Added checkInstallation method
    public async checkInstallation(): Promise<{status: string}> {
        return this.request<{status: string}>('action=check_installation');
    }

    // Fix: Added verifyDbConnection method
    public async verifyDbConnection(config: any): Promise<boolean> {
        return this.request<boolean>('action=verify_db', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    // Fix: Added initializeSystem method
    public async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        return this.request<void>('action=initialize_system', {
            method: 'POST',
            body: JSON.stringify({ dbConfig, adminConfig })
        });
    }

    // Fix: Added enableDemoMode method
    public enableDemoMode(): void {
        localStorage.setItem('sp_demo_mode', 'true');
    }

    // --- AUTHENTICATION ---

    // Fix: Added login method
    public async login(username: string, password: string): Promise<User> {
        return this.request<User>(`action=login`, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // Fix: Added register method
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

    // Fix: Added logout method
    public async logout(userId: string): Promise<void> {
        return this.request<void>(`action=logout&userId=${userId}`);
    }

    // Fix: Added getUser method
    public async getUser(userId: string): Promise<User | null> {
        return this.request<User | null>(`action=get_user&userId=${userId}`);
    }

    // Fix: Added heartbeat method
    public async heartbeat(userId: string): Promise<void> {
        return this.request<void>(`action=heartbeat&userId=${userId}`);
    }

    // Fix: Added saveOfflineUser method
    public saveOfflineUser(user: User): void {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    // Fix: Added getOfflineUser method
    public getOfflineUser(): User | null {
        const data = localStorage.getItem('sp_offline_user');
        return data ? JSON.parse(data) : null;
    }

    // --- VIDEO MANAGEMENT ---

    // Fix: Added getAllVideos method
    public async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>('action=get_videos');
    }

    // Fix: Added getVideo method
    public async getVideo(id: string): Promise<Video | null> {
        return this.request<Video | null>(`action=get_video&id=${id}`);
    }

    // Fix: Added getVideosByCreator method
    public async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`);
    }

    // Fix: Added getRelatedVideos method
    public async getRelatedVideos(videoId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_related_videos&videoId=${videoId}`);
    }

    // Fix: Added getUnprocessedVideos method
    public async getUnprocessedVideos(limit: number, mode: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    // Fix: Added getUserActivity method
    public async getUserActivity(userId: string): Promise<{watched: string[]}> {
        return this.request<{watched: string[]}>(`action=get_user_activity&userId=${userId}`);
    }

    // Fix: Added getSubscriptions method
    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    // Fix: Added checkSubscription method
    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        return this.request<boolean>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
    }

    // Fix: Added toggleSubscribe method
    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe&userId=${userId}&creatorId=${creatorId}`, { method: 'POST' });
    }

    // Fix: Added getSystemSettings method
    public async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>('action=get_settings');
    }

    // Fix: Added updateSystemSettings method
    public async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        return this.request<void>('action=update_settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }

    // Fix: Added hasPurchased method
    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        return this.request<boolean>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
    }

    // Fix: Added purchaseVideo method
    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    // Fix: Added rateVideo method
    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video&userId=${userId}&videoId=${videoId}&type=${type}`, { method: 'POST' });
    }

    // Fix: Added getInteraction method
    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    // Fix: Added markWatched method
    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    // Fix: Added getComments method
    public async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&videoId=${videoId}`);
    }

    // Fix: Added addComment method
    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, text })
        });
    }

    // Fix: Added deleteVideo method
    public async deleteVideo(videoId: string, userId: string): Promise<void> {
        return this.request<void>(`action=delete_video&videoId=${videoId}&userId=${userId}`, { method: 'POST' });
    }

    // --- OFFLINE & UPLOAD ---

    // Fix: Added checkDownloadStatus method
    public async checkDownloadStatus(videoId: string): Promise<boolean> {
        const cache = await caches.open('streampay-videos-v1');
        const all = await this.getAllVideos();
        const v = all.find(x => x.id === videoId);
        if (!v) return false;
        const match = await cache.match(v.videoUrl);
        return !!match;
    }

    // Fix: Added downloadVideoForOffline method
    public async downloadVideoForOffline(video: Video): Promise<void> {
        if ('serviceWorker' in navigator && 'BackgroundFetchManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            // @ts-ignore
            await registration.backgroundFetch.fetch(video.id, [video.videoUrl], {
                title: `Descargando: ${video.title}`,
                icons: [{ src: video.thumbnailUrl, sizes: '192x192', type: 'image/jpeg' }]
            });
        } else {
            const cache = await caches.open('streampay-videos-v1');
            await cache.add(video.videoUrl);
        }
    }

    // Fix: Added uploadVideo method with progress callback
    public async uploadVideo(
        title: string,
        description: string,
        price: number,
        category: string,
        duration: number,
        user: User,
        file: File,
        thumbnail: File | null,
        onProgress: (percent: number, loaded: number, total: number) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('action', 'upload_video');
            formData.append('title', title);
            formData.append('description', description);
            formData.append('price', String(price));
            formData.append('category', category);
            formData.append('duration', String(duration));
            formData.append('userId', user.id);
            formData.append('video', file);
            if (thumbnail) formData.append('thumbnail', thumbnail);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent, event.loaded, event.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.open('POST', 'api/index.php');
            xhr.send(formData);
        });
    }

    // --- EXTERNAL & REQUESTS ---

    // Fix: Added searchExternal method
    public async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&q=${encodeURIComponent(query)}&source=${source}`);
    }

    // Fix: Added serverImportVideo method
    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import_video&url=${encodeURIComponent(url)}`, { method: 'POST' });
    }

    // Fix: Added getRequests method
    public async getRequests(filter: string = 'ALL'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&filter=${filter}`);
    }

    // Fix: Added requestContent method
    public async requestContent(userId: string, query: string, isVip: boolean): Promise<void> {
        return this.request<void>(`action=request_content`, {
            method: 'POST',
            body: JSON.stringify({ userId, query, isVip })
        });
    }

    // Fix: Added updateRequestStatus method
    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=update_request_status&id=${id}&status=${status}`, { method: 'POST' });
    }

    // Fix: Added deleteRequest method
    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request&id=${id}`, { method: 'POST' });
    }

    // --- MARKETPLACE ---

    // Fix: Added getMarketplaceItems method
    public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=get_marketplace_items');
    }

    // Fix: Added adminGetMarketplaceItems method
    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=admin_get_marketplace_items');
    }

    // Fix: Added getMarketplaceItem method
    public async getMarketplaceItem(id: string): Promise<MarketplaceItem | null> {
        return this.request<MarketplaceItem | null>(`action=get_marketplace_item&id=${id}`);
    }

    // Fix: Added createListing method
    public async createListing(formData: FormData): Promise<void> {
        return this.request<void>(`action=create_listing`, {
            method: 'POST',
            body: formData
        });
    }

    // Fix: Added editListing method
    public async editListing(id: string, userId: string, data: any): Promise<void> {
        return this.request<void>(`action=edit_listing`, {
            method: 'POST',
            body: JSON.stringify({ id, userId, ...data })
        });
    }

    // Fix: Added adminDeleteListing method
    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing&itemId=${itemId}`, { method: 'POST' });
    }

    // Fix: Added checkoutCart method
    public async checkoutCart(userId: string, items: any[], shipping: any): Promise<void> {
        return this.request<void>(`action=checkout_cart`, {
            method: 'POST',
            body: JSON.stringify({ userId, items, shipping })
        });
    }

    // Fix: Added getReviews method
    public async getReviews(itemId: string): Promise<MarketplaceReview[]> {
        return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`);
    }

    // Fix: Added addReview method
    public async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<void> {
        return this.request<void>(`action=add_review`, {
            method: 'POST',
            body: JSON.stringify({ itemId, userId, rating, comment })
        });
    }

    // --- FINANCE ---

    // Fix: Added getBalanceRequests method
    public async getBalanceRequests(): Promise<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> {
        return this.request<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}>('action=get_balance_requests');
    }

    // Fix: Added handleBalanceRequest method
    public async handleBalanceRequest(adminId: string, reqId: string, action: string): Promise<void> {
        return this.request<void>(`action=handle_balance_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    // Fix: Added handleVipRequest method
    public async handleVipRequest(adminId: string, reqId: string, action: string): Promise<void> {
        return this.request<void>(`action=handle_vip_request&adminId=${adminId}&reqId=${reqId}&status=${action}`, { method: 'POST' });
    }

    // Fix: Added purchaseVipInstant method
    public async purchaseVipInstant(userId: string, plan: VipPlan): Promise<void> {
        return this.request<void>(`action=purchase_vip_instant`, {
            method: 'POST',
            body: JSON.stringify({ userId, planId: plan.id })
        });
    }

    // Fix: Added transferBalance method
    public async transferBalance(fromId: string, toUsername: string, amount: number): Promise<void> {
        return this.request<void>(`action=transfer_balance`, {
            method: 'POST',
            body: JSON.stringify({ fromId, toUsername, amount })
        });
    }

    // Fix: Added adminAddBalance method
    public async adminAddBalance(adminId: string, userId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance`, {
            method: 'POST',
            body: JSON.stringify({ adminId, userId, amount })
        });
    }

    // Fix: Added getGlobalTransactions method
    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>('action=get_global_transactions');
    }

    // --- USER MANAGEMENT ---

    // Fix: Added getAllUsers method
    public async getAllUsers(): Promise<User[]> {
        return this.request<User[]>('action=get_all_users');
    }

    // Fix: Added searchUsers method
    public async searchUsers(userId: string, query: string): Promise<User[]> {
        return this.request<User[]>(`action=search_users&userId=${userId}&q=${encodeURIComponent(query)}`);
    }

    // Fix: Added updateUserProfile method with FormData support for avatar
    public async updateUserProfile(userId: string, data: any): Promise<void> {
        if (data.avatar instanceof File || data.newPassword) {
            const fd = new FormData();
            fd.append('userId', userId);
            Object.entries(data).forEach(([key, val]) => {
                if (val instanceof File) fd.append(key, val);
                else if (typeof val === 'object') fd.append(key, JSON.stringify(val));
                else fd.append(key, String(val));
            });
            return this.request<void>(`action=update_user_profile`, { method: 'POST', body: fd });
        }
        return this.request<void>(`action=update_user_profile&userId=${userId}`, { 
            method: 'POST', 
            body: JSON.stringify(data) 
        });
    }

    // --- LIBRARY & MAINTENANCE ---

    // Fix: Added scanLocalLibrary method
    public async scanLocalLibrary(path: string): Promise<any> {
        return this.request<any>(`action=scan_local_library&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    // Fix: Added processScanBatch method
    public async processScanBatch(): Promise<any> {
        return this.request<any>(`action=process_scan_batch`, { method: 'POST' });
    }

    // Fix: Added updateVideoMetadata method
    public async updateVideoMetadata(id: string, duration: number, thumbnail: File | null, success: boolean = true): Promise<void> {
        const fd = new FormData();
        fd.append('videoId', id);
        fd.append('duration', String(duration));
        fd.append('success', success ? '1' : '0');
        if (thumbnail) fd.append('thumbnail', thumbnail);
        return this.request<void>(`action=update_video_metadata`, {
            method: 'POST',
            body: fd
        });
    }

    // Fix: Added smartOrganizeLibrary method
    public async smartOrganizeLibrary(): Promise<any> {
        return this.request<any>(`action=smart_organize_library`, { method: 'POST' });
    }

    // Fix: Added adminCleanupSystemFiles method
    public async adminCleanupSystemFiles(): Promise<any> {
        return this.request<any>(`action=admin_cleanup_files`, { method: 'POST' });
    }

    // Fix: Added adminRepairDb method
    public async adminRepairDb(): Promise<any> {
        return this.request<any>(`action=admin_repair_db`, { method: 'POST' });
    }

    // Fix: Added invalidateCache placeholder
    public invalidateCache(key?: string) {
        // Cache invalidation logic placeholder
    }

    // Fix: Added setHomeDirty method
    public setHomeDirty() {
        this.homeDirty = true;
    }

    // --- NOTIFICATIONS ---

    // Fix: Added getNotifications method
    public async getNotifications(userId: string): Promise<AppNotification[]> {
        return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`);
    }

    // Fix: Added markNotificationRead method
    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read&id=${id}`, { method: 'POST' });
    }

    // --- FTP ---

    // Fix: Added listFtpFiles method
    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`);
    }

    // Fix: Added importFtpFile method
    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=import_ftp_file&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    // Fix: Added scanFtpRecursive method
    public async scanFtpRecursive(path: string): Promise<any> {
        return this.request<any>(`action=scan_ftp_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }
}

export const db = new DBService();
