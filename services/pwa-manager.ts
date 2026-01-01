
/**
 * Servicio para gestionar el estado de instalación de la PWA
 */

class PWAManager {
    private deferredPrompt: any = null;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa_can_install'));
            });
        }
    }

    public isStandalone(): boolean {
        return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    }

    public canInstall(): boolean {
        return !!this.deferredPrompt;
    }

    public async install(): Promise<boolean> {
        if (!this.deferredPrompt) return false;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.deferredPrompt = null;
            return true;
        }
        return false;
    }
}

export const pwa = new PWAManager();
