import { 
    User, Video, Transaction, VipPlan, Comment, UserInteraction, 
    Notification as AppNotification, VideoResult, ContentRequest, 
    MarketplaceItem, MarketplaceReview, BalanceRequest, VipRequest, 
    SystemSettings, FtpFile
} from '../types';
import { apiRequest } from './api-client';

/**
 * Service for handling all database and API interactions.
 */
class DBService {
    private homeDirty = false;

    // --- BASE METHODS ---
    public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        return apiRequest<T>(endpoint, options);
    }

    // --- INSTALLATION ---
    public async checkInstallation() {
        return fetch('api/install.php?action=check').then(r => r.json()).then(res => ({ status: res.data?.installed ? 'installed' : 'not_installed' })).catch(() => ({ status: 'installed' }));
    }

    public async verifyDbConnection(config: any) {
        return fetch('api/install.php?action=verify_db', { method: 'POST', body: JSON.stringify(config) }).then(r => r.json()).then(res => res.success);
    }

    public async initializeSystem(dbConfig: any, adminConfig: any) {
        return fetch('api/install.php?action=install', { method: 'POST', body: JSON.stringify({ dbConfig, adminUser: adminConfig }) }).then(r => r.json()).then(res => { if(!res.success) throw new Error(res.error); });
    }

    public enableDemoMode() { localStorage.setItem('sp_demo_mode', 'true'); }

    // --- AUTHENTICATION ---
    public async login(username: string, password: string) {
        return this.request<User>(`action=login`, { method: 'POST', body: JSON.stringify({ username, password, deviceId: navigator.userAgent.substring(0, 50) }) });
    }

    public async register(username: string, password: string, avatar?: File | null) {
        const fd = new FormData();
        fd.append('username', username); fd.append('password', password); fd.append('deviceId', navigator.userAgent.substring(0, 50));
        if (avatar) fd.append('avatar', avatar);
        return this.request<User>(`action=register`, { method: 'POST', body: fd });
    }

    public async logout(userId: string) { return this.request<void>(`action=logout`, { method: 'POST', body: JSON.stringify({ userId }) }); }
    public async getUser(userId: string) { return this.request<User | null>(`action=get_user&userId=${userId}`); }
    public async heartbeat(userId: string) { return this.request<void>(`action=heartbeat`, { method: 'POST', body: JSON.stringify({ userId }) }); }
    public saveOfflineUser(user: User) { localStorage.setItem('sp_offline_user', JSON.stringify(user)); }
    public getOfflineUser(): User | null { const data = localStorage.getItem('sp_offline_user'); return data ? JSON.parse(data) : null; }

    // --- VIDEOS ---
    public async getAllVideos() { return this.request<Video[]>('action=get_videos'); }
    public async getVideo(id: string) { return this.request<Video | null>(`action=get_video&id=${id}`); }
    public async getVideosByCreator(userId: string) { return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`); }
    public async getRelatedVideos(videoId: string) { return this.request<Video[]>(`action=get_related_videos&videoId=${videoId}`); }
    public async getUnprocessedVideos(limit = 50, mode = 'normal') { return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`); }
    public async hasPurchased(userId: string, videoId: string) { const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${userId}&videoId=${videoId}`); return res.hasPurchased; }
    public async purchaseVideo(userId: string, videoId: string) { return this.request<void>(`action=purchase_video`, { method: 'POST', body: JSON.stringify({ userId, videoId }) }); }
    public async markWatched(userId: string, videoId: string) { return this.request<void>(`action=mark_watched`, { method: 'POST', body: JSON.stringify({ userId, videoId }) }); }
    public async getUserActivity(userId: string) { return this.request<{watched: string[], liked: string[]}>(`action=get_user_activity&userId=${userId}`); }
    public async getSubscriptions(userId: string) { return this.request<string[]>(`action=get_subscriptions&userId=${userId}`); }
    public async toggleSubscribe(userId: string, creatorId: string) { return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe`, { method: 'POST', body: JSON.stringify({ userId, creatorId }) }); }
    public async checkSubscription(userId: string, creatorId: string) { const res = await this.request<{isSubscribed: boolean}>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`); return res.isSubscribed; }
    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike') { return this.request<UserInteraction>(`action=rate_video`, { method: 'POST', body: JSON.stringify({ userId, videoId, type }) }); }
    public async getInteraction(userId: string, videoId: string) { return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`); }
    public async deleteVideo(videoId: string, userId: string) { return this.request<void>(`action=delete_video`, { method: 'POST', body: JSON.stringify({ id: videoId, userId }) }); }

    // --- MARKETPLACE ---
    public async getMarketplaceItems() { return this.request<MarketplaceItem[]>('action=get_marketplace_items'); }
    public async adminGetMarketplaceItems() { return this.request<MarketplaceItem[]>('action=admin_get_marketplace_items'); }
    public async getMarketplaceItem(id: string) { return this.request<MarketplaceItem | null>(`action=get_marketplace_item&id=${id}`); }
    public async createListing(formData: FormData) { return this.request<void>(`action=create_listing`, { method: 'POST', body: formData }); }
    public async editListing(id: string, userId: string, data: any) { return this.request<void>(`action=edit_listing`, { method: 'POST', body: JSON.stringify({ id, userId, data }) }); }
    public async adminDeleteListing(itemId: string) { return this.request<void>(`action=admin_delete_listing`, { method: 'POST', body: JSON.stringify({ id: itemId }) }); }
    public async checkoutCart(userId: string, cart: any[], shippingDetails: any) { return this.request<void>(`action=checkout_cart`, { method: 'POST', body: JSON.stringify({ userId, cart, shippingDetails }) }); }
    public async getReviews(itemId: string) { return this.request<MarketplaceReview[]>(`action=get_reviews&itemId=${itemId}`); }
    public async addReview(itemId: string, userId: string, rating: number, comment: string) { return this.request<void>(`action=add_review`, { method: 'POST', body: JSON.stringify({ itemId, userId, rating, comment }) }); }

    // --- FINANCE ---
    public async getBalanceRequests() { return this.request<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}>('action=get_balance_requests'); }
    public async handleBalanceRequest(adminId: string, reqId: string, status: string) { return this.request<void>(`action=handle_balance_request`, { method: 'POST', body: JSON.stringify({ adminId, reqId, status }) }); }
    public async handleVipRequest(adminId: string, reqId: string, status: string) { return this.request<void>(`action=handle_vip_request`, { method: 'POST', body: JSON.stringify({ adminId, reqId, status }) }); }
    public async purchaseVipInstant(userId: string, plan: VipPlan) { return this.request<void>(`action=purchase_vip_instant`, { method: 'POST', body: JSON.stringify({ userId, plan }) }); }
    public async transferBalance(userId: string, targetUsername: string, amount: number) { return this.request<void>(`action=transfer_balance`, { method: 'POST', body: JSON.stringify({ userId, targetUsername, amount }) }); }
    public async adminAddBalance(adminId: string, targetId: string, amount: number) { return this.request<void>(`action=admin_add_balance`, { method: 'POST', body: JSON.stringify({ adminId, userId: targetId, amount }) }); }
    public async getGlobalTransactions() { return this.request<any>('action=get_global_transactions'); }

    // --- ADMIN & SYSTEM ---
    public async getSystemSettings() { return this.request<SystemSettings>('action=get_system_settings'); }
    public async updateSystemSettings(settings: Partial<SystemSettings>) { return this.request<void>('action=update_system_settings', { method: 'POST', body: JSON.stringify(settings) }); }
    public async getAllUsers() { return this.request<User[]>('action=get_all_users'); }
    public async searchUsers(userId: string, query: string) { return this.request<User[]>(`action=search_users`, { method: 'POST', body: JSON.stringify({ userId, q: query }) }); }
    public async updateUserProfile(userId: string, data: any) {
        if (data.avatar instanceof File || data.newPassword) {
            const fd = new FormData(); fd.append('userId', userId);
            Object.entries(data).forEach(([key, val]) => { if (val instanceof File) fd.append(key, val); else if (typeof val === 'object') fd.append(key, JSON.stringify(val)); else if (val !== undefined && val !== null) fd.append(key, String(val)); });
            return this.request<void>(`action=update_user_profile`, { method: 'POST', body: fd });
        }
        return this.request<void>(`action=update_user_profile`, { method: 'POST', body: JSON.stringify({ userId, ...data }) });
    }

    // --- MAINTENANCE ---
    public async scanLocalLibrary(path: string) { return this.request<any>(`action=scan_local_library`, { method: 'POST', body: JSON.stringify({ path }) }); }
    
    // Fix: Added missing processScanBatch method to handle background library indexing and thumbnail generation in batches.
    public async processScanBatch() { return this.request<any>(`action=process_scan_batch`, { method: 'POST' }); }

    public async updateVideoMetadata(id: string, duration: number, thumbnail: File | null, success = true) {
        const fd = new FormData(); fd.append('id', id); fd.append('duration', String(duration)); fd.append('success', success ? '1' : '0');
        if (thumbnail) fd.append('thumbnail', thumbnail);
        return this.request<void>(`action=update_video_metadata`, { method: 'POST', body: fd });
    }
    public async smartOrganizeLibrary() { return this.request<any>(`action=smart_organize_library`, { method: 'POST' }); }
    public async fixLibraryMetadata() { return this.request<any>(`action=fix_library_metadata`, { method: 'POST' }); }
    public async adminCleanupSystemFiles() { return this.request<any>(`action=admin_cleanup_files`, { method: 'POST' }); }
    public async adminRepairDb() { return this.request<any>(`action=admin_repair_db`, { method: 'POST' }); }

    // --- OTHER ---
    public async getRequests(status = 'ALL') { return this.request<ContentRequest[]>(`action=get_requests&status=${status}`); }
    public async requestContent(userId: string, query: string, isVip: boolean) { return this.request<void>(`action=request_content`, { method: 'POST', body: JSON.stringify({ userId, query, isVip }) }); }
    public async updateRequestStatus(id: string, status: string) { return this.request<void>(`action=update_request_status`, { method: 'POST', body: JSON.stringify({ id, status }) }); }
    public async deleteRequest(id: string) { return this.request<void>(`action=delete_request`, { method: 'POST', body: JSON.stringify({ id }) }); }
    public async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE') { return this.request<VideoResult[]>(`action=search_external&q=${encodeURIComponent(query)}&source=${source}`); }
    public async serverImportVideo(url: string) { return this.request<void>(`action=server_import&url=${encodeURIComponent(url)}`, { method: 'POST' }); }
    public async getComments(videoId: string) { return this.request<Comment[]>(`action=get_comments&id=${videoId}`); }
    public async addComment(userId: string, videoId: string, text: string) { return this.request<Comment>(`action=add_comment`, { method: 'POST', body: JSON.stringify({ userId, videoId, text }) }); }
    public async getNotifications(userId: string) { return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`); }
    public async markNotificationRead(id: string) { return this.request<void>(`action=mark_notification_read`, { method: 'POST', body: JSON.stringify({ id }) }); }
    public async listFtpFiles(path: string) { return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`); }
    public async importFtpFile(path: string) { return this.request<void>(`action=import_ftp_file&path=${encodeURIComponent(path)}`, { method: 'POST' }); }
    public async scanFtpRecursive(path: string) { return this.request<{scanned: number, added: number}>(`action=scan_ftp_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' }); }
    
    public invalidateCache(key?: string) {}
    public setHomeDirty() { this.homeDirty = true; }
    
    public async checkDownloadStatus(videoId: string): Promise<boolean> {
        if (!('caches' in window)) return false;
        const cache = await caches.open('streampay-videos-v1');
        const v = await this.getVideo(videoId);
        if (!v) return false;
        const match = await cache.match(v.videoUrl);
        return !!match;
    }

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

    public async uploadVideo(title: string, description: string, price: number, category: string, duration: number, user: User, file: File, thumbnail: File | null, onProgress: (p: number, l: number, t: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('action', 'upload_video');
            formData.append('title', title); formData.append('description', description); formData.append('price', String(price)); formData.append('category', category); formData.append('duration', String(duration)); formData.append('userId', user.id); formData.append('video', file);
            if (thumbnail) formData.append('thumbnail', thumbnail);
            xhr.upload.onprogress = (event) => { if (event.lengthComputable) { onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total); } };
            xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { resolve(); } else { reject(new Error(`Upload failed ${xhr.status}`)); } };
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.open('POST', 'api/index.php?action=upload_video');
            xhr.send(formData);
        });
    }
}

export const db = new DBService();