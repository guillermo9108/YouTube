import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Menu, DownloadCloud, LogOut, ShoppingBag, Server, ChevronRight, Crown, Smartphone as MobileIcon, MonitorDown, AlertTriangle, CheckCircle2, Clock, ShoppingCart as SaleIcon, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useCart } from '../context/CartContext';
import { useServerTask } from '../context/ServerTaskContext';
import { Link, useLocation, Outlet, useNavigate } from './Router';
import { db } from '../services/db';
import { Notification as AppNotification } from '../types';
import GridProcessor from './GridProcessor';

const UploadIndicator = () => {
  const { isUploading, progress, currentFileIndex, totalFiles, uploadSpeed } = useUpload();
  if (!isUploading) return null;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 z-[40] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6">
       <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="transform -rotate-90 w-12 h-12"><circle className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" /><circle className="text-indigo-500 transition-all duration-300 ease-in-out" strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" /></svg>
          <span className="absolute text-[10px] font-bold text-white">{Math.round(progress)}%</span>
       </div>
       <div className="flex flex-col min-w-[100px]"><span className="text-xs font-bold text-white">Subiendo...</span><span className="text-[10px] text-slate-400">Archivo {currentFileIndex} de {totalFiles}</span><span className="text-[10px] text-indigo-400 font-mono">{uploadSpeed}</span></div>
    </div>
  );
};

const ServerTaskIndicator = () => {
    const { isScanning, progress, currentFile } = useServerTask();
    const navigate = useNavigate();
    if (!isScanning) return null;
    return (
        <div onClick={() => navigate('/admin')} className="fixed bottom-24 md:bottom-28 right-4 z-[40] bg-slate-900 border border-emerald-900/50 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6 cursor-pointer hover:bg-slate-800 transition-colors">
            <div className="relative w-12 h-12 flex items-center justify-center bg-emerald-900/20 rounded-full"><Server size={24} className="text-emerald-500 animate-pulse" /></div>
            <div className="flex flex-col min-w-[120px]"><span className="text-xs font-bold text-white flex items-center gap-1">Escaneando NAS...</span><span className="text-[10px] text-slate-400 truncate max-w-[120px]">{currentFile || 'Iniciando...'}</span><div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress.percent}%` }}></div></div><span className="text-[9px] text-emerald-400 mt-0.5 text-right">{progress.current} / {progress.total}</span></div>
        </div>
    );
};

// Fixed NotificationBell: Logic lifted to Layout component
const NotificationBell = ({ 
    notifs, 
    setNotifs, 
    isMobile = false 
}: { 
    notifs: AppNotification[], 
    setNotifs: React.Dispatch<React.SetStateAction<AppNotification[]>>, 
    isMobile?: boolean 
}) => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const hasUnread = notifs.some(n => !n.isRead);

    const handleClick = (n: AppNotification) => { 
        if(!n.isRead) db.markNotificationRead(n.id).catch(() => {}); 
        navigate(n.link); 
        setIsOpen(false); 
        setNotifs(prev => prev.map(p => p.id === n.id ? {...p, isRead: true} : p)); 
    };

    return (
        <>
            <button onClick={() => setIsOpen(!isOpen)} className={`relative p-2 rounded-full transition-colors ${isMobile ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Bell size={isMobile ? 24 : 20} />
                {hasUnread && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]" onClick={() => setIsOpen(false)}></div>
                    <div className={`fixed z-[100] bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col ${isMobile ? 'bottom-0 left-0 right-0 rounded-t-3xl max-h-[85vh] animate-in slide-in-from-bottom duration-500' : 'top-16 right-4 w-96 rounded-2xl max-h-[80vh] animate-in fade-in zoom-in-95 origin-top-right'}`}>
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/40 sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <Zap size={18} className="text-amber-400 fill-amber-400"/>
                                <h3 className="font-black text-white text-sm uppercase tracking-widest">Actividad</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={18} className="text-slate-500"/></button>
                        </div>

                        <div className="overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
                            {notifs.length === 0 ? (
                                <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center"><Bell size={32} className="opacity-20"/></div>
                                    <p className="text-sm font-bold uppercase tracking-tighter opacity-40 italic">Todo en orden por aquí</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5 pb-8">
                                    {notifs.map(n => (
                                        <div key={n.id} onClick={() => handleClick(n)} className={`group p-4 flex gap-4 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98] ${!n.isRead ? 'bg-indigo-500/5' : ''}`}>
                                            <div className="relative shrink-0 mt-1">
                                                <div className={`w-12 h-12 rounded-xl bg-slate-800 overflow-hidden border border-white/10 ${n.type === 'SALE' ? 'ring-2 ring-emerald-500/30' : ''}`}>
                                                    {n.avatarUrl ? (
                                                        <img src={n.avatarUrl} className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                            {n.type === 'SALE' ? <SaleIcon size={20} className="text-emerald-400"/> : <Bell size={20}/>}
                                                        </div>
                                                    )}
                                                </div>
                                                {!n.isRead && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-900 animate-pulse shadow-lg shadow-indigo-500/50"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${n.type === 'SALE' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                                        {n.type === 'SALE' ? 'Venta Exitosa' : (n.type === 'UPLOAD' ? 'Nuevo Video' : 'Sistema')}
                                                    </span>
                                                    <span className="text-[9px] text-slate-600 font-bold whitespace-nowrap">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <p className={`text-[13px] leading-snug mt-1 ${!n.isRead ? 'text-white font-bold' : 'text-slate-400'}`}>{n.text}</p>
                                                {n.type === 'SALE' && (
                                                    <div className="mt-2 text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">Recargo de Saldo +</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isMobile && <div className="h-safe-area-bottom bg-slate-950/80 h-8"></div>}
                    </div>
                </>
            )}
        </>
    );
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // LIFTED NOTIFICATION LOGIC
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const lastNotifIdRef = useRef<string | null>(null);
  const hasUnread = notifs.some(n => !n.isRead);

  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, []);

  const triggerSystemNotification = async (n: AppNotification) => { 
      if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) { 
          try { const registration = await navigator.serviceWorker.ready; registration.showNotification("StreamPay", { body: n.text, icon: '/pwa-192x192.png', tag: n.id, data: { url: n.link } }); } catch (e) { console.error(e); } 
      } 
  };

  const fetchNotifs = async () => {
      if(user) { 
          try { 
              const list = await db.getNotifications(user.id); 
              setNotifs(list); 
              if (list.length > 0) { 
                  const latest = list[0]; 
                  if (latest.id !== lastNotifIdRef.current && !latest.isRead) { 
                      lastNotifIdRef.current = latest.id; 
                      triggerSystemNotification(latest); 
                  } 
              } 
          } catch(e) {} 
      }
  };

  useEffect(() => { 
      if(user) fetchNotifs(); 
      const interval = setInterval(() => { if(user) fetchNotifs(); }, 20000); 
      return () => clearInterval(interval); 
  }, [user]);

  useEffect(() => {
    const secure = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'https:';
    setIsSecure(secure);
    const checkStandalone = () => {
        const isApp = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsStandalone(isApp);
    };
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);
    if ((window as any).deferredPrompt) {
        setInstallPrompt((window as any).deferredPrompt);
        setShowInstallBanner(true);
    }
    const handler = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
        (window as any).deferredPrompt = e;
        if (!isStandalone) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    const promptEvent = installPrompt || (window as any).deferredPrompt;
    if (!promptEvent) {
        alert("Para instalar:\n\n1. En Chrome: Menú (⋮) -> Instalar aplicación\n2. En iOS (Safari): Compartir -> Añadir a inicio");
        return;
    }
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
        setInstallPrompt(null);
        setShowInstallBanner(false);
    }
  };

  const dismissInstall = () => {
      setShowInstallBanner(false);
      setBannerDismissed(true);
  };

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  const isShortsMode = location.pathname === '/shorts';

  const Avatar = ({ size=24, className='' }: {size?: number, className?: string}) => (
      user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className={`rounded-full object-cover ${className}`} style={{width: size, height: size}} />
      ) : (
          <div className={`rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold ${className}`} style={{width: size, height: size, fontSize: size*0.4}}>{user?.username?.[0]}</div>
      )
  );

  const isAdmin = user && user.role && user.role.trim().toUpperCase() === 'ADMIN';

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : 'pb-20 md:pb-0'}`}>
      {showSidebar && (
        <div className="fixed inset-0 z-[150] flex font-sans">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowSidebar(false)}></div>
            <div className="relative w-72 bg-slate-900 h-full shadow-2xl flex flex-col border-r border-slate-800 animate-in slide-in-from-left duration-300">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</span>
                    <button onClick={() => setShowSidebar(false)} className="p-2 bg-slate-800 text-slate-300 rounded-full hover:text-white hover:bg-slate-700 transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <div className="mb-2">
                        <Link to="/vip" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-black font-bold bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 rounded-xl transition-colors shadow-lg shadow-amber-900/20">
                            <Crown size={20} className="text-black"/> VIP & Recargas
                        </Link>
                    </div>
                    {!isStandalone && (
                        <button onClick={handleInstallClick} className="w-full flex items-center gap-3 px-4 py-3 text-white font-bold bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30 mb-2 animate-in zoom-in">
                            <MobileIcon size={20} /> Instalar Aplicación
                        </button>
                    )}
                    {isAdmin && (
                        <div className="mb-4 pb-4 border-b border-slate-800">
                            <p className="px-3 text-[10px] uppercase font-bold text-slate-500 mb-2">Sistema</p>
                            <Link to="/admin" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-indigo-300 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors group">
                                <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                                <span className="font-bold">Administración</span>
                                <ChevronRight size={16} className="ml-auto opacity-50"/>
                            </Link>
                        </div>
                    )}
                    <p className="px-3 text-[10px] uppercase font-bold text-slate-500 mt-2 mb-1">Navegación</p>
                    <Link to="/" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><Home size={20} className="text-indigo-400"/> Inicio</Link>
                    <Link to="/shorts" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><Smartphone size={20} className="text-pink-400"/> Shorts</Link>
                    <Link to="/marketplace" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><ShoppingBag size={20} className="text-emerald-400"/> Tienda</Link>
                    <div className="h-px bg-slate-800 my-2 mx-2"></div>
                    <p className="px-3 text-[10px] uppercase font-bold text-slate-500 mt-2 mb-1">Tu Cuenta</p>
                    <Link to="/upload" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><Upload size={20} className="text-blue-400"/> Subir Video</Link>
                    <Link to="/requests" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><DownloadCloud size={20} className="text-purple-400"/> Peticiones</Link>
                    <Link to="/profile" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"><User size={20} className="text-slate-400"/> Mi Perfil</Link>
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-950 pb-safe-area-bottom">
                    <button onClick={() => { logout(); setShowSidebar(false); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 bg-red-950/20 hover:bg-red-900/30 rounded-xl font-bold transition-colors border border-red-900/30">
                        <LogOut size={20}/> Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
      )}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Link to="/profile" className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"><Avatar size={32} /></Link>
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</Link>
        </div>
        <div className="flex items-center gap-6">
          {isAdmin && <Link to="/admin" className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-sm bg-amber-950/40 px-4 py-2 rounded-full border border-amber-500/30 shadow-sm transition-all"><ShieldCheck size={16}/> Administración</Link>}
          {user && <NotificationBell notifs={notifs} setNotifs={setNotifs} />}
          {!isStandalone && (
              <button onClick={handleInstallClick} className="text-sm font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1 animate-pulse hover:animate-none">
                  <MonitorDown size={14}/> Instalar App
              </button>
          )}
          <Link to="/vip" className="text-sm font-bold text-amber-400 hover:text-amber-300 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-500/30">VIP</Link>
          <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full text-indigo-300">{Number(user?.balance || 0).toFixed(2)} Saldo</span>
          <Link to="/" className={isActive('/')}>Inicio</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/marketplace" className={isActive('/marketplace')}>Tienda</Link>
          <Link to="/upload" className={isActive('/upload')}>Subir</Link>
        </div>
      </header>
      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl'}>
        <Outlet />
      </main>
      <UploadIndicator />
      <ServerTaskIndicator />
      <GridProcessor />
      {!isStandalone && !bannerDismissed && (showInstallBanner || !isSecure) && (
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-900 border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500 pb-safe-area-bottom">
              <div className="p-4 flex items-center gap-4 max-w-lg mx-auto">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg text-white font-bold text-xl">SP</div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm">Instalar StreamPay</h4>
                      {!isSecure ? (
                          <p className="text-red-400 text-xs flex items-center gap-1 font-bold mt-0.5"><AlertTriangle size={12}/> Requiere HTTPS o Localhost</p>
                      ) : (
                          <p className="text-slate-400 text-xs mt-0.5">Acceso rápido y modo offline.</p>
                      )}
                  </div>
                  {isSecure ? (
                      <button onClick={handleInstallClick} className="bg-white text-indigo-900 px-5 py-2.5 rounded-full text-xs font-bold shadow hover:bg-slate-100 transition-colors active:scale-95">Instalar</button>
                  ) : (
                      <button onClick={dismissInstall} className="text-slate-500 hover:text-white"><X size={20}/></button>
                  )}
                  {isSecure && <button onClick={dismissInstall} className="p-2 text-slate-500 hover:text-white rounded-full"><X size={20}/></button>}
              </div>
          </div>
      )}
      {!isShortsMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-white/5 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}><Home size={22} /><span className="text-[10px] font-bold uppercase tracking-widest">Inicio</span></Link>
          <Link to="/shorts" className={`flex flex-col items-center gap-1 ${isActive('/shorts')}`}><Smartphone size={22} /><span className="text-[10px] font-bold uppercase tracking-widest">Shorts</span></Link>
          <div className="relative -top-5">
             <Link to="/upload" className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 border-4 border-black active:scale-95 transition-transform"><Upload size={24} /></Link>
          </div>
          <div className="relative flex flex-col items-center gap-1 cursor-pointer" onClick={() => setShowSidebar(true)}>
            {hasUnread && <span className="absolute -top-1 right-2 w-2 h-2 bg-indigo-500 rounded-full"></span>}
            <Menu size={22} className="text-slate-400"/>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menú</span>
          </div>
          <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile')}`}><Avatar size={22} /><span className="text-[10px] font-bold uppercase tracking-widest">Perfil</span></Link>
        </nav>
      )}
    </div>
  );
}
