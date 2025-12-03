import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Check, Menu, DownloadCloud, LogOut, Compass, WifiOff, Clock, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useCart } from '../context/CartContext';
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
                
                // System Notification Trigger
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
                    {/* Backdrop - Z-Index 90 to cover almost everything */}
                    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
                    
                    {/* Responsive Container - Z-Index 100 to appear ABOVE the bottom nav bar (which is z-50) */}
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
                                    <p>No hay notificaciones</p>
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
                                                    <Clock size={10}/> {new Date(n.timestamp < 10000000000 ? n.timestamp * 1000 : n.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            {!n.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shrink-0 animate-pulse"></div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Safe area spacer for mobile navigation/gestures */}
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
  const { cartCount } = useCart();
  const [showSidebar, setShowSidebar] = useState(false);

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  // Use startsWith to correctly handle URLs like /shorts?id=...
  const isShortsMode = location.pathname.startsWith('/shorts');

  const Avatar = ({ size=24, className='' }: {size?: number, className?: string}) => (
      user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className={`rounded-full object-cover ${className}`} style={{width: size, height: size}} />
      ) : (
          <User size={size} className={className} />
      )
  );

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : 'pb-20 md:pb-0'}`}>
      
      {/* Global Sidebar Drawer */}
      {showSidebar && (
        <div className="fixed inset-0 z-[110] flex">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSidebar(false)}></div>
            <div className="relative w-64 bg-slate-900 border-r border-slate-800 h-full p-4 flex flex-col animate-in slide-in-from-left duration-200">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-slate-800 rounded-full"><Menu size={24} /></button>
                    <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</span>
                </div>
                
                <div className="space-y-1 flex-1">
                    {(user?.role === 'ADMIN') && (
                        <Link to="/admin" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-amber-400 bg-amber-900/10 hover:bg-amber-900/20 rounded-lg font-medium mb-4 border border-amber-500/20">
                            <ShieldCheck size={20}/> Panel Admin
                        </Link>
                    )}

                    <Link to="/" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-white bg-slate-800 rounded-lg font-medium">
                        <Home size={20}/> Inicio
                    </Link>
                    <Link to="/shorts" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Smartphone size={20}/> Shorts
                    </Link>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <Link to="/marketplace" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-900/20 rounded-lg font-medium">
                        <ShoppingBag size={20}/> Tienda
                    </Link>
                    <Link to="/marketplace/cart" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <ShoppingCart size={20}/> Carrito ({cartCount})
                    </Link>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <Link to="/requests" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <DownloadCloud size={20}/> Peticiones
                    </Link>
                    <Link to="/upload" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Upload size={20}/> Subir
                    </Link>
                    <Link to="/profile" onClick={() => setShowSidebar(false)} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <User size={20}/> Perfil
                    </Link>
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button onClick={() => { logout(); setShowSidebar(false); }} className="flex items-center gap-4 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-lg font-medium w-full text-left">
                        <LogOut size={20}/> Salir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER (Desktop) */}
      {!isShortsMode && (
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <button onClick={() => setShowSidebar(true)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800">
                <Menu size={24} />
            </button>
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            StreamPay
            </Link>
        </div>
        <div className="flex items-center gap-6">
          {user && <NotificationBell />}
          <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full text-indigo-300">
             {user?.balance} Saldo
          </span>
          <Link to="/" className={isActive('/')}>Inicio</Link>
          <Link to="/marketplace" className={isActive('/marketplace')}>Tienda</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/upload" className={isActive('/upload')}>Subir</Link>
          <Link to="/marketplace/cart" className="relative text-slate-400 hover:text-white">
              <ShoppingCart size={24} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </Link>
          <Link to="/profile" className={`flex items-center gap-2 ${isActive('/profile')}`}>
            <Avatar size={24} />
          </Link>
        </div>
      </header>
      )}

      {/* Main Content */}
      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl'}>
        <Outlet />
      </main>
      
      <UploadIndicator />

      {/* Bottom Nav (Mobile) */}
      {!isShortsMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
            <Home size={22} />
            <span className="text-[10px]">Inicio</span>
          </Link>

          <Link to="/marketplace" className={`flex flex-col items-center gap-1 ${isActive('/marketplace')}`}>
            <ShoppingBag size={22} />
            <span className="text-[10px]">Tienda</span>
          </Link>
          
          <div className="relative -top-5">
             <Link to="/upload" className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg border-4 border-black">
                <Upload size={24} />
             </Link>
          </div>

          <Link to="/marketplace/cart" className={`flex flex-col items-center gap-1 relative ${isActive('/marketplace/cart')}`}>
             <div className="relative">
                 <ShoppingCart size={22} />
                 {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">{cartCount}</span>}
             </div>
             <span className="text-[10px]">Carrito</span>
          </Link>

          <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile')}`}>
            <Avatar size={22} />
            <span className="text-[10px]">Perfil</span>
          </Link>
        </nav>
      )}
    </div>
  );
}