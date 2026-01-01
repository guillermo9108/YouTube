
/**
 * Constantes Globales de StreamPay
 */

export const APP_CONFIG = {
    NAME: 'StreamPay',
    VERSION: '1.8.0',
    DEFAULT_AVATAR: 'https://ui-avatars.com/api/?background=4f46e5&color=fff&size=128',
    THUMB_FALLBACK: 'https://via.placeholder.com/640x360/0f172a/334155?text=Video+No+Disponible',
    COOLDOWN_BETWEEN_TASKS: 10000,
    MAX_AUTO_PURCHASE_LIMIT: 20.0,
    API_BASE_URL: 'api/index.php',
};

export const STORAGE_KEYS = {
    USER_ID: 'sp_current_user_id',
    TOKEN: 'sp_session_token',
    OFFLINE_USER: 'sp_offline_user',
    CART: 'sp_cart',
    DEMO_MODE: 'sp_demo_mode',
    NAV_CONTEXT: 'sp_nav_context',
};

export const UI_STRINGS = {
    SESSION_EXPIRED: 'Sesión expirada o abierta en otro dispositivo.',
    NETWORK_ERROR: 'Error de conexión con el servidor local.',
    PURCHASE_CONFIRM: (price: number) => `¿Desbloquear contenido por ${price.toFixed(2)} $?`,
};
