
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
        
        if (options.method === 'POST' && !(options.body instanceof FormData) && typeof options.body === 'string') {
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/json'
            };
        }

        return fetch(url, options).then(async (response) => {
            const rawText = await response.text();

            if (response.status === 401) {
                window.dispatchEvent(new Event('sp_session_expired'));
                throw new Error("Session expired");
            }

            let json: any;
            try {
                json = JSON.parse(rawText);
            } catch (e) {
                console.error("Malformed JSON response:", rawText);
                throw new Error(`Respuesta no válida del servidor (${response.status}). Verifica la configuración PHP.`);
            }

            if (json.success === false) {
                throw new Error(json.error || 'Error desconocido en el servidor');
            }

            return json.data as T;
        });
    }

    // --- INSTALLATION & SETUP ---

    public async checkInstallation(): Promise<{status: string}> {
        // El instalador está en api/install.php, no en index.php
        return fetch('api/install.php?action=check')
            .then(r => r.json())
            .then(res => {
                // Adaptamos la respuesta del backend al formato que espera App.tsx
                return { status: res.data?.installed ? 'installed' : 'not_installed' };
            })
            .catch(() => ({ status: 'installed' })); // En caso de duda (offline), asumimos instalado
    }

    public async verifyDbConnection(config: any): Promise<boolean> {
        return fetch('api/install.php?action=verify_db', {
            method: 'POST',
            body: JSON.stringify(config)
        }).then(r => r.json()).then(res => res.success);
    }

    public async initializeSystem(dbConfig: any, adminConfig: any): Promise<void> {
        return fetch('api/install.php?action=install', {
            method: 'POST',
            body: JSON.stringify({ dbConfig, adminUser: adminConfig })
        }).then(async r => {
            const res = await r.json();
            if(!res.success) throw new Error(res.error);
        });
    }

    public enableDemoMode(): void {
        localStorage.setItem('sp_demo_mode', 'true');
    }

    // --- AUTHENTICATION ---

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
        return this.request<User>(`action=register`, {
            method: 'POST',
            body: fd
        });
    }

    public async logout(userId: string): Promise<void> {
        return this.request<void>(`action=logout&userId=${userId}`);
    }

    public async getUser(userId: string): Promise<User | null> {
        return this.request<User | null>(`action=get_user&userId=${userId}`);
    }

    public async heartbeat(userId: string): Promise<void> {
        return this.request<void>(`action=heartbeat&userId=${userId}`);
    }

    public saveOfflineUser(user: User): void {
        localStorage.setItem('sp_offline_user', JSON.stringify(user));
    }

    public getOfflineUser(): User | null {
        const data = localStorage.getItem('sp_offline_user');
        return data ? JSON.parse(data) : null;
    }

    // --- VIDEO MANAGEMENT ---

    public async getAllVideos(): Promise<Video[]> {
        return this.request<Video[]>('action=get_videos');
    }

    public async getVideo(id: string): Promise<Video | null> {
        return this.request<Video | null>(`action=get_video&id=${id}`);
    }

    public async getVideosByCreator(userId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_videos_by_creator&userId=${userId}`);
    }

    public async getRelatedVideos(videoId: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_related_videos&videoId=${videoId}`);
    }

    public async getUnprocessedVideos(limit: number, mode: string): Promise<Video[]> {
        return this.request<Video[]>(`action=get_unprocessed_videos&limit=${limit}&mode=${mode}`);
    }

    public async getUserActivity(userId: string): Promise<{watched: string[]}> {
        return this.request<{watched: string[]}>(`action=get_user_activity&userId=${userId}`);
    }

    public async getSubscriptions(userId: string): Promise<string[]> {
        return this.request<string[]>(`action=get_subscriptions&userId=${userId}`);
    }

    public async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
        return this.request<boolean>(`action=check_subscription&userId=${userId}&creatorId=${creatorId}`);
    }

    public async toggleSubscribe(userId: string, creatorId: string): Promise<{isSubscribed: boolean}> {
        return this.request<{isSubscribed: boolean}>(`action=toggle_subscribe&userId=${userId}&creatorId=${creatorId}`, { method: 'POST' });
    }

    public async getSystemSettings(): Promise<SystemSettings> {
        return this.request<SystemSettings>('action=get_system_settings');
    }

    public async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
        return this.request<void>('action=update_system_settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }

    public async hasPurchased(userId: string, videoId: string): Promise<boolean> {
        const res = await this.request<{hasPurchased: boolean}>(`action=has_purchased&userId=${userId}&videoId=${videoId}`);
        return res.hasPurchased;
    }

    public async purchaseVideo(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=purchase_video&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async rateVideo(userId: string, videoId: string, type: 'like' | 'dislike'): Promise<UserInteraction> {
        return this.request<UserInteraction>(`action=rate_video&userId=${userId}&videoId=${videoId}&type=${type}`, { method: 'POST' });
    }

    public async getInteraction(userId: string, videoId: string): Promise<UserInteraction | null> {
        return this.request<UserInteraction | null>(`action=get_interaction&userId=${userId}&videoId=${videoId}`);
    }

    public async markWatched(userId: string, videoId: string): Promise<void> {
        return this.request<void>(`action=mark_watched&userId=${userId}&videoId=${videoId}`, { method: 'POST' });
    }

    public async getComments(videoId: string): Promise<Comment[]> {
        return this.request<Comment[]>(`action=get_comments&id=${videoId}`);
    }

    public async addComment(userId: string, videoId: string, text: string): Promise<Comment> {
        return this.request<Comment>(`action=add_comment`, {
            method: 'POST',
            body: JSON.stringify({ userId, videoId, text })
        });
    }

    public async deleteVideo(videoId: string, userId: string): Promise<void> {
        return this.request<void>(`action=delete_video&id=${videoId}&userId=${userId}`, { method: 'POST' });
    }

    // --- OFFLINE & UPLOAD ---

    public async checkDownloadStatus(videoId: string): Promise<boolean> {
        if (!('caches' in window)) return false;
        const cache = await caches.open('streampay-videos-v1');
        const all = await this.getAllVideos();
        const v = all.find(x => x.id === videoId);
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
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) resolve();
                        else reject(new Error(res.error));
                    } catch (e) { resolve(); }
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

    public async searchExternal(query: string, source: 'STOCK' | 'YOUTUBE'): Promise<VideoResult[]> {
        return this.request<VideoResult[]>(`action=search_external&q=${encodeURIComponent(query)}&source=${source}`);
    }

    public async serverImportVideo(url: string): Promise<void> {
        return this.request<void>(`action=server_import&url=${encodeURIComponent(url)}`, { method: 'POST' });
    }

    public async getRequests(status: string = 'ALL'): Promise<ContentRequest[]> {
        return this.request<ContentRequest[]>(`action=get_requests&status=${status}`);
    }

    public async requestContent(userId: string, query: string, isVip: boolean): Promise<void> {
        return this.request<void>(`action=request_content`, {
            method: 'POST',
            body: JSON.stringify({ userId, query, isVip })
        });
    }

    public async updateRequestStatus(id: string, status: string): Promise<void> {
        return this.request<void>(`action=update_request_status&id=${id}&status=${status}`, { method: 'POST' });
    }

    public async deleteRequest(id: string): Promise<void> {
        return this.request<void>(`action=delete_request&id=${id}`, { method: 'POST' });
    }

    // --- MARKETPLACE ---

    public async getMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=get_marketplace_items');
    }

    public async adminGetMarketplaceItems(): Promise<MarketplaceItem[]> {
        return this.request<MarketplaceItem[]>('action=admin_get_marketplace_items');
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

    public async adminDeleteListing(itemId: string): Promise<void> {
        return this.request<void>(`action=admin_delete_listing&id=${itemId}`, { method: 'POST' });
    }

    public async checkoutCart(userId: string, cart: any[], shippingDetails: any): Promise<void> {
        return this.request<void>(`action=checkout_cart`, {
            method: 'POST',
            body: JSON.stringify({ userId, cart, shippingDetails })
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

    // --- FINANCE ---

    public async getBalanceRequests(): Promise<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}> {
        return this.request<{balance: BalanceRequest[], vip: VipRequest[], activeVip?: Partial<User>[]}>('action=get_balance_requests');
    }

    public async handleBalanceRequest(adminId: string, reqId: string, status: string): Promise<void> {
        return this.request<void>(`action=handle_balance_request&adminId=${adminId}&reqId=${reqId}&status=${status}`, { method: 'POST' });
    }

    public async handleVipRequest(adminId: string, reqId: string, status: string): Promise<void> {
        return this.request<void>(`action=handle_vip_request&adminId=${adminId}&reqId=${reqId}&status=${status}`, { method: 'POST' });
    }

    public async purchaseVipInstant(userId: string, plan: VipPlan): Promise<void> {
        return this.request<void>(`action=purchase_vip_instant`, {
            method: 'POST',
            body: JSON.stringify({ userId, plan })
        });
    }

    public async transferBalance(userId: string, targetUsername: string, amount: number): Promise<void> {
        return this.request<void>(`action=transfer_balance`, {
            method: 'POST',
            body: JSON.stringify({ userId, targetUsername, amount })
        });
    }

    public async adminAddBalance(adminId: string, targetId: string, amount: number): Promise<void> {
        return this.request<void>(`action=admin_add_balance`, {
            method: 'POST',
            body: JSON.stringify({ adminId, userId: targetId, amount })
        });
    }

    public async getGlobalTransactions(): Promise<any> {
        return this.request<any>('action=get_global_transactions');
    }

    // --- USER MANAGEMENT ---

    public async getAllUsers(): Promise<User[]> {
        return this.request<User[]>('action=get_all_users');
    }

    public async searchUsers(userId: string, query: string): Promise<User[]> {
        return this.request<User[]>(`action=search_users&userId=${userId}&q=${encodeURIComponent(query)}`);
    }

    public async updateUserProfile(userId: string, data: any): Promise<void> {
        if (data.avatar instanceof File || data.newPassword) {
            const fd = new FormData();
            fd.append('userId', userId);
            Object.entries(data).forEach(([key, val]) => {
                if (val instanceof File) fd.append(key, val);
                else if (typeof val === 'object') fd.append(key, JSON.stringify(val));
                else if (val !== undefined && val !== null) fd.append(key, String(val));
            });
            return this.request<void>(`action=update_user_profile`, { method: 'POST', body: fd });
        }
        return this.request<void>(`action=update_user_profile`, { 
            method: 'POST', 
            body: JSON.stringify({ userId, ...data }) 
        });
    }

    // --- LIBRARY & MAINTENANCE ---

    public async scanLocalLibrary(path: string): Promise<any> {
        return this.request<any>(`action=scan_library`, { 
            method: 'POST', 
            body: JSON.stringify({ path }) 
        });
    }

    public async processScanBatch(): Promise<any> {
        // En el sistema actual, el Paso 2 es manejado por el frontend VideoLibrary
        // Esta es una función de conveniencia
        return { completed: true };
    }

    public async updateVideoMetadata(id: string, duration: number, thumbnail: File | null, success: boolean = true): Promise<void> {
        const fd = new FormData();
        fd.append('id', id);
        fd.append('duration', String(duration));
        fd.append('success', success ? '1' : '0');
        if (thumbnail) fd.append('thumbnail', thumbnail);
        return this.request<void>(`action=update_video_metadata`, {
            method: 'POST',
            body: fd
        });
    }

    public async smartOrganizeLibrary(): Promise<any> {
        return this.request<any>(`action=smart_organize_library`, { method: 'POST' });
    }

    public async adminCleanupSystemFiles(): Promise<any> {
        return this.request<any>(`action=admin_cleanup_files`, { method: 'POST' });
    }

    public async adminRepairDb(): Promise<any> {
        return this.request<any>(`action=admin_repair_db`, { method: 'POST' });
    }

    public invalidateCache(key?: string) {}

    public setHomeDirty() {
        this.homeDirty = true;
    }

    // --- NOTIFICATIONS ---

    public async getNotifications(userId: string): Promise<AppNotification[]> {
        return this.request<AppNotification[]>(`action=get_notifications&userId=${userId}`);
    }

    public async markNotificationRead(id: string): Promise<void> {
        return this.request<void>(`action=mark_notification_read`, { 
            method: 'POST', 
            body: JSON.stringify({ id }) 
        });
    }

    // --- FTP MANAGEMENT ---

    public async listFtpFiles(path: string): Promise<FtpFile[]> {
        return this.request<FtpFile[]>(`action=list_ftp_files&path=${encodeURIComponent(path)}`);
    }

    public async importFtpFile(path: string): Promise<void> {
        return this.request<void>(`action=import_ftp_file&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    public async scanFtpRecursive(path: string): Promise<{scanned: number, added: number}> {
        return this.request<{scanned: number, added: number}>(`action=scan_ftp_recursive&path=${encodeURIComponent(path)}`, { method: 'POST' });
    }
}

export const db = new DBService();
