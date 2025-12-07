import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Check, Menu, DownloadCloud, LogOut, Compass, WifiOff, Clock, ShoppingBag, ShoppingCart, Server, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useCart } from '../context/CartContext';
import { useServerTask } from '../context/ServerTaskContext';
import { Link, useLocation, Outlet, useNavigate } from './Router';
import { db } from '../services/db';
import { Notification as AppNotification } from '../types';

const UploadIndicator = () => {
  const { isUploading, progress, currentFileIndex, totalFiles, uploadSpeed } = useUpload();
  
  if (!isUploading) return null;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 z-[40] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6">
       <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="transform -rotate-90 w-12 h-12">
            <circle className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" />
            <circle className="text-indigo-500 transition-all duration-300 ease-in-out" strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" />
          </svg>
          <span className="absolute text-[10px] font-bold text-white">{Math.round(progress)}%</span>
       </div>
       <div className="flex flex-col min-w-[100px]">
          <span className="text-xs font-bold text-white">Subiendo...</span>
          <span className="text-[10px] text-slate-400">Archivo {currentFileIndex} de {totalFiles}</span>
          <span className="text-[10px] text-indigo-400 font-mono">{uploadSpeed}</span>
       </div>
    </div>
  );
};

const ServerTaskIndicator = () => {
    const { isScanning, progress, currentFile } = useServerTask();
    const navigate = useNavigate();

    if (!isScanning) return null;

    return (
        <div 
            onClick={() => navigate('/admin')}
            className="fixed bottom-24 md:bottom-28 right-4 z-[40] bg-slate-900 border border-emerald-900/50 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6 cursor-pointer hover:bg-slate-800 transition-colors"
        >
            <div className="relative w-12 h-12 flex items-center justify-center bg-emerald-900/20 rounded-full">
                <Server size={24} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="flex flex-col min-w-[120px]">
                <span className="text-xs font-bold text-white flex items-center gap-1">Escaneando NAS...</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{currentFile || 'Iniciando...'}</span>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress.percent}%` }}></div>
                </div>
                <span className="text-[9px] text-emerald-400 mt-0.5 text-right">{progress.current} / {progress.total}</span>
            </div>
        </div>
    );
};

const NotificationBell = ({ isMobile = false }: { isMobile?: boolean }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const lastNotifIdRef = useRef<string | null>(null);
    const hasUnread = notifs.some(n => !n.isRead);

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

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

    const triggerSystemNotification = async (n: AppNotification) => {
        if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const options: any = {
                    body: n.text,
                    icon: n.avatarUrl || '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    tag: n.id,
                    data: { url: n.link },
                    vibrate: [200, 100, 200]
                };
                if ((n as any).thumbnailUrl) options.image = (n as any).thumbnailUrl;
                registration.showNotification("StreamPay", options);
            } catch (e) { console.error(e); }
        }
    };

    useEffect(() => {
        if(user) fetchNotifs();
        const interval = setInterval(() => { if(user) fetchNotifs(); }, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const handleClick = (n: AppNotification) => {
        if(!n.isRead) db.markNotificationRead(n.id).catch(() => {});
        navigate(n.link);
        setIsOpen(false);
        setNotifs(prev => prev.map(p => p.id === n.id ? {...p, isRead: true} : p));
    };

    if (!user) return null;

    return (
        <>
            <button onClick={() => setIsOpen(!isOpen)} className={`relative p-2 rounded-full transition-colors ${isMobile ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Bell size={isMobile ? 24 : 20} />
                {hasUnread && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-slate-900"></span>}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
                    
                    <div className={`
                        fixed z-[100] bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col
                        ${isMobile 
                            ? 'bottom-0 left-0 right-0 rounded-t-2xl max-h-[75vh] animate-in slide-in-from-bottom duration-300 border-t-2 border-t-indigo-500/50' 
                            : 'top-16 right-4 w-80 rounded-xl max-h-[80vh] animate-in fade-in zoom-in-95 origin-top-right'
                        }
                    `}>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/90 backdrop-blur-md sticky top-0 z-10">
                            <h3 className="font-bold text-white flex items-center gap-2"><Bell size={18} className="text-indigo-400"/> Notificaciones</h3>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full bg-slate-900 border border-slate-800"><X size={18} className="text-slate-400 hover:text-white"/></button>
                        </div>
                        
                        <div className="overflow-y-auto overscroll-contain flex-1 bg-slate-900">
                            {notifs.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center opacity-50">
                                        <Bell size={32}/>
                                    </div>
                                    <p>Sin notificaciones</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/50 pb-8">
                                    {notifs.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleClick(n)}
                                            className={`p-4 flex gap-4 hover:bg-slate-800/80 cursor-pointer transition-colors active:bg-slate-800 ${!n.isRead ? 'bg-indigo-900/10 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden border border-slate-700 mt-1">
                                                {n.avatarUrl ? <img src={n.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Bell size={16}/></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm leading-snug ${!n.isRead ? 'text-white font-semibold' : 'text-slate-400'}`}>{n.text}</p>
                                                <span className="text-[10px] text-slate-600 block mt-1.5 flex items-center gap-1">
                                                    <Clock size={10}/> {new Date(n.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            {!n.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shrink-0 animate-pulse"></div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isMobile && <div className="h-safe-area-bottom bg-slate-900 h-6"></div>}
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

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  const isShortsMode = location.pathname === '/shorts';

  const Avatar = ({ size=24, className='' }: {size?: number, className?: string}) => (
      user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className={`rounded-full object-cover ${className}`} style={{width: size, height: size}} />
      ) : (
          <div className={`rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold ${className}`} style={{width: size, height: size, fontSize: size*0.4}}>
              {user?.username?.[0]}
          </div>
      )
  );

  // Robust check for Admin Role
  const isAdmin = user && user.role && user.role.trim().toUpperCase() === 'ADMIN';

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : 'pb-20 md:pb-0'}`}>
      
      {/* 
        ========================================
        NUEVO SIDEBAR (MENÚ LATERAL) RECONSTRUIDO
        ========================================
      */}
      {showSidebar && (
        <div className="fixed inset-0 z-[150] flex font-sans">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowSidebar(false)}></div>
            
            {/* Drawer Content */}
            <div className="relative w-72 bg-slate-900 h-full shadow-2xl flex flex-col border-r border-slate-800 animate-in slide-in-from-left duration-300">
                
                {/* Drawer Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</span>
                    <button onClick={() => setShowSidebar(false)} className="p-2 bg-slate-800 text-slate-300 rounded-full hover:text-white hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Scrollable Links */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    
                    {/* ACCESO ADMINISTRACIÓN (Prioridad Alta) */}
                    {isAdmin && (
                        <div className="mb-4 pb-4 border-b border-slate-800">
                            <p className="px-3 text-[10px] uppercase font-bold text-amber-500 mb-2">Sistema</p>
                            <Link 
                                to="/admin" 
                                onClick={() => setShowSidebar(false)} 
                                className="flex items-center gap-3 px-4 py-3 bg-amber-950/30 text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-900/40 transition-colors group"
                            >
                                <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                                <span className="font-bold">Administración</span>
                                <ChevronRight size={16} className="ml-auto opacity-50"/>
                            </Link>
                        </div>
                    )}

                    {/* Navegación Principal */}
                    <p className="px-3 text-[10px] uppercase font-bold text-slate-500 mt-2 mb-1">Navegación</p>
                    
                    <Link to="/" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <Home size={20} className="text-indigo-400"/> Inicio
                    </Link>
                    
                    <Link to="/shorts" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <Smartphone size={20} className="text-pink-400"/> Shorts
                    </Link>
                    
                    <Link to="/marketplace" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <ShoppingBag size={20} className="text-emerald-400"/> Tienda
                    </Link>

                    <div className="h-px bg-slate-800 my-2 mx-2"></div>

                    {/* Acciones de Usuario */}
                    <p className="px-3 text-[10px] uppercase font-bold text-slate-500 mt-2 mb-1">Tu Cuenta</p>

                    <Link to="/upload" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <Upload size={20} className="text-blue-400"/> Subir Video
                    </Link>

                    <Link to="/requests" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <DownloadCloud size={20} className="text-purple-400"/> Peticiones
                    </Link>

                    <Link to="/profile" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-slate-800 rounded-xl transition-colors">
                        <User size={20} className="text-slate-400"/> Mi Perfil
                    </Link>
                </div>

                {/* Footer / Logout */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 pb-safe-area-bottom">
                    <button 
                        onClick={() => { logout(); setShowSidebar(false); }} 
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 bg-red-950/20 hover:bg-red-900/30 rounded-xl font-bold transition-colors border border-red-900/30"
                    >
                        <LogOut size={20}/> Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER (Desktop) */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Link to="/profile" className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800">
                <Avatar size={32} />
            </Link>
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            StreamPay
            </Link>
        </div>
        <div className="flex items-center gap-6">
          {/* Admin Link for Desktop */}
          {isAdmin && (
              <Link to="/admin" className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-sm bg-amber-950/40 px-4 py-2 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all">
                  <ShieldCheck size={16}/> Administración
              </Link>
          )}

          {user && <NotificationBell />}
          <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full text-indigo-300">
             {Number(user?.balance || 0).toFixed(2)} Saldo
          </span>
          <Link to="/" className={isActive('/')}>Inicio</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/marketplace" className={isActive('/marketplace')}>Tienda</Link>
          
          <Link to="/upload" className={isActive('/upload')}>Subir</Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl'}>
        <Outlet />
      </main>
      
      <UploadIndicator />
      <ServerTaskIndicator />

      {/* Bottom Nav (Mobile) */}
      {!isShortsMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
            <Home size={22} />
            <span className="text-[10px]">Inicio</span>
          </Link>

          <Link to="/shorts" className={`flex flex-col items-center gap-1 ${isActive('/shorts')}`}>
            <Smartphone size={22} />
            <span className="text-[10px]">Shorts</span>
          </Link>
          
          <div className="relative -top-5">
             <Link to="/upload" className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg border-4 border-black">
                <Upload size={24} />
             </Link>
          </div>

          <Link to="/marketplace" className={`flex flex-col items-center gap-1 ${isActive('/marketplace')}`}>
             <ShoppingBag size={22} />
             <span className="text-[10px]">Tienda</span>
          </Link>

          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setShowSidebar(true)}>
             <Menu size={22} className="text-slate-400"/>
             <span className="text-[10px] text-slate-400">Menú</span>
          </div>
        </nav>
      )}
    </div>
  );
}