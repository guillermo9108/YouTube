
import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Menu, DownloadCloud, LogOut, ShoppingBag, Server, ChevronRight, Crown, Smartphone as MobileIcon, MonitorDown, AlertTriangle, CheckCircle2, Clock, ShoppingCart as SaleIcon, Zap, User as UserIcon } from 'lucide-react';
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

const NotificationBell = ({ notifs, setNotifs, isMobile = false }: any) => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const hasUnread = notifs.some((n: any) => !n.isRead);
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
                            <h3 className="font-black text-white text-sm uppercase tracking-widest">Actividad</h3>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={18} className="text-slate-500"/></button>
                        </div>
                        <div className="overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
                            {notifs.length === 0 ? <div className="p-16 text-center text-slate-500 text-xs font-bold uppercase italic opacity-40">Sin actividad</div> : <div className="divide-y divide-white/5 pb-8">{notifs.map((n: any) => (<div key={n.id} onClick={() => { if(!n.isRead) db.markNotificationRead(n.id); navigate(n.link); setIsOpen(false); }} className={`group p-4 flex gap-4 hover:bg-white/5 cursor-pointer transition-all ${!n.isRead ? 'bg-indigo-500/5' : ''}`}><p className={`text-[13px] leading-snug ${!n.isRead ? 'text-white font-bold' : 'text-slate-400'}`}>{n.text}</p></div>))}</div>}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  useEffect(() => { 
      if(user) {
          db.getNotifications(user.id).then(setNotifs); 
          const int = setInterval(() => db.getNotifications(user.id).then(setNotifs), 30000);
          return () => clearInterval(int);
      }
  }, [user]);

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  const isShortsMode = location.pathname === '/shorts';
  const isAdminMode = location.pathname.startsWith('/admin');
  const isHomeMode = location.pathname === '/';

  const Avatar = ({ size=24, className='' }: any) => (
      <div className={`rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center shrink-0 ${className}`} style={{width: size, height: size}}>
        {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-white font-bold uppercase" style={{fontSize: size*0.4}}>{user?.username?.[0] || '?'}</span>}
      </div>
  );

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : (isAdminMode || isHomeMode ? '' : 'pb-20 md:pb-0')}`}>
      {/* Mobile Header - EXPLICITLY HIDDEN for Home and Admin on Mobile */}
      {!isShortsMode && !isAdminMode && !isHomeMode && (
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-slate-900/95 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
            <Link to="/" className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</Link>
            <div className="flex items-center gap-3">
                 <Link to="/vip" className="text-amber-400"><Crown size={20}/></Link>
                 <NotificationBell notifs={notifs} setNotifs={setNotifs} isMobile={true} />
            </div>
        </header>
      )}

      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</Link>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/vip" className="text-sm font-bold text-amber-400 hover:text-amber-300 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-500/30">VIP & Recargas</Link>
          <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full text-indigo-300">{Number(user?.balance || 0).toFixed(2)} $</span>
          <Link to="/" className={isActive('/')}>Inicio</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/upload" className={isActive('/upload')}>Subir</Link>
          <Link to="/profile" className="p-1 rounded-full hover:bg-slate-800"><Avatar size={32}/></Link>
        </div>
      </header>

      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : (isAdminMode || isHomeMode ? 'flex-1 pt-0 md:pt-8 md:container md:mx-auto md:max-w-5xl' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl')}>
        <Outlet />
      </main>

      <UploadIndicator />
      <ServerTaskIndicator />
      <GridProcessor />

      {/* Mobile Footer - EXPLICITLY HIDDEN for Home and Admin on Mobile */}
      {!isShortsMode && !isAdminMode && !isHomeMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-white/5 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={isActive('/')}><Home size={22}/></Link>
          <Link to="/shorts" className={isActive('/shorts')}><Smartphone size={22}/></Link>
          <Link to="/upload" className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg"><Upload size={24}/></Link>
          <Link to="/profile" className={isActive('/profile')}><Avatar size={24}/></Link>
        </nav>
      )}
    </div>
  );
}
