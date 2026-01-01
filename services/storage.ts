
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Gestor de persistencia con manejo de errores
 */
export const storage = {
    get<T>(key: string, fallback: T): T {
        try {
            const item = localStorage.getItem(key);
            if (!item) return fallback;
            const parsed = JSON.parse(item);
            // Si el item es un objeto, nos aseguramos que no sea null
            return (parsed !== null) ? parsed : fallback;
        } catch (e) {
            console.error(`Storage Error [${key}]:`, e);
            return fallback;
        }
    },

    set(key: string, value: any): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Storage Write Error [${key}]:`, e);
        }
    },

    remove(key: string): void {
        localStorage.removeItem(key);
    },

    clearSession(): void {
        this.remove(STORAGE_KEYS.USER_ID);
        this.remove(STORAGE_KEYS.TOKEN);
        this.remove(STORAGE_KEYS.OFFLINE_USER);
        this.remove(STORAGE_KEYS.CART);
    }
};

export const session = {
    get<T>(key: string, fallback: T): T {
        try {
            const item = sessionStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch (e) { return fallback; }
    },
    set(key: string, value: any): void {
        sessionStorage.setItem(key, JSON.stringify(value));
    },
    remove(key: string): void {
        sessionStorage.removeItem(key);
    }
};
