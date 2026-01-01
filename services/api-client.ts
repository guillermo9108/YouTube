
/**
 * Cliente de API robusto y desacoplado
 */

export const logRemote = async (message: string, level: 'ERROR' | 'INFO' | 'WARNING' = 'ERROR') => {
    try {
        await fetch(`api/index.php?action=client_log`, {
            method: 'POST',
            body: JSON.stringify({ message, level })
        });
    } catch(e) {}
};

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `api/index.php?${endpoint}`;
    
    const token = localStorage.getItem('sp_session_token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    if (options.method === 'POST' && !(options.body instanceof FormData) && typeof options.body === 'string') {
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
    }

    try {
        const response = await fetch(url, options);
        const rawText = await response.text();

        if (response.status === 401) {
            window.dispatchEvent(new Event('sp_session_expired'));
            throw new Error("Sesión expirada");
        }

        let json: any;
        try {
            json = JSON.parse(rawText);
        } catch (e) {
            const snippet = rawText.substring(0, 300);
            logRemote(`Malformed JSON from ${endpoint}: ${snippet}`, 'ERROR');
            throw new Error(`Error de respuesta del servidor (Formato inválido).`);
        }

        if (json.success === false) {
            if (endpoint !== 'action=heartbeat') {
                logRemote(`API Error (${endpoint}): ${json.error}`, 'WARNING');
            }
            throw new Error(json.error || 'Error desconocido');
        }

        return json.data as T;
    } catch (err: any) {
        if (!(err instanceof Error && err.message.includes('Sesión'))) {
            logRemote(`Network Error: ${err.message} (${endpoint})`, 'ERROR');
        }
        throw err;
    }
}
