
import React, { useState, useEffect } from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Check, Menu, DownloadCloud, LogOut, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { Link, useLocation, Outlet, useNavigate } from './Router';
import { db } from '../services/db';
import { Notification } from '../types';

const UploadIndicator = () => {
  const { isUploading, progress, currentFileIndex, totalFiles, uploadSpeed } = useUpload();
  
  if (!isUploading) return null;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6">
       <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="transform -rotate-90 w-12 h-12">
            <circle className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" />
            <circle className="text-indigo-500 transition-all duration-300 ease-in-out" strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" />
          </svg>
          <span className="absolute text-[10px] font-bold text-white">{Math.round(progress)}%</span>
       </div>
       <div className="flex flex-col min-w-[100px]">
          <span className="text-xs font-bold text-white">Uploading...</span>
          <span className="text-[10px] text-slate-400">File {currentFileIndex} of {totalFiles}</span>
          <span className="text-[10px] text-indigo-400 font-mono">{uploadSpeed}</span>
       </div>
    </div>
  );
};

const NotificationBell = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifs, setNotifs] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const hasUnread = notifs.some(n => !n.isRead);

    const fetchNotifs = async () => {
        if(user) {
            const list = await db.getNotifications(user.id);
            setNotifs(list);
        }
    };

    useEffect(() => {
        if(user) fetchNotifs();
        const interval = setInterval(() => { if(user) fetchNotifs(); }, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const handleClick = (n: Notification) => {
        if(!n.isRead) db.markNotificationRead(n.id);
        navigate(n.link);
        setIsOpen(false);
        fetchNotifs();
    };

    if (!user) return null;

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-white relative p-2">
                <Bell size={20} />
                {hasUnread && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-slate-900"></span>}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-white">Notifications</h3>
                            <button onClick={() => setIsOpen(false)}><X size={16} className="text-slate-500 hover:text-white"/></button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifs.length === 0 ? (
                                <div className="p-6 text-center text-slate-500 text-xs">No new notifications.</div>
                            ) : (
                                <div className="divide-y divide-slate-800">
                                    {notifs.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleClick(n)}
                                            className={`p-3 flex gap-3 hover:bg-slate-800 cursor-pointer transition-colors ${!n.isRead ? 'bg-slate-800/50' : ''}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0 overflow-hidden">
                                                {/* Could implement avatar here if returned by API */}
                                                <div className="w-full h-full flex items-center justify-center text-slate-400"><Bell size={16}/></div>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-xs ${!n.isRead ? 'text-white font-bold' : 'text-slate-400'}`}>{n.text}</p>
                                                <span className="text-[10px] text-slate-600">{new Date(n.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            {!n.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showSidebar, setShowSidebar] = useState(false);

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  const isShortsMode = location.pathname === '/shorts';

  const Avatar = ({ size=24, className='' }: {size?: number, className?: string}) => (
      user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className={`rounded-full object-cover ${className}`} style={{width: size, height: size}} />
      ) : (
          <User size={size} className={className} />
      )
  );

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : 'pb-20 md:pb-0'}`}>
      
      {/* Global Sidebar Drawer (Desktop/Tablet) */}
      {showSidebar && (
        <div className="fixed inset-0 z-[60] flex">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSidebar(false)}></div>
            <div className="relative w-64 bg-slate-900 border-r border-slate-800 h-full p-4 flex flex-col animate-in slide-in-from-left duration-200">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-slate-800 rounded-full"><Menu size={24} /></button>
                    <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</span>
                </div>
                
                <div className="space-y-1 flex-1">
                    <Link to="/" className="flex items-center gap-4 px-4 py-3 text-white bg-slate-800 rounded-lg font-medium">
                        <Home size={20}/> Home
                    </Link>
                    <Link to="/shorts" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Smartphone size={20}/> Shorts
                    </Link>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <Link to="/requests" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <DownloadCloud size={20}/> Requests
                    </Link>
                    <Link to="/upload" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Upload size={20}/> Upload
                    </Link>
                    <Link to="/profile" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <User size={20}/> Profile
                    </Link>
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button onClick={logout} className="flex items-center gap-4 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-lg font-medium w-full text-left">
                        <LogOut size={20}/> Logout
                    </button>
                </div>
            </div>
        </div>
      )}

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
             Balance: {user?.balance} Saldo
          </span>
          {user?.role === 'ADMIN' && (
             <Link to="/admin" className={isActive('/admin')}>Admin</Link>
          )}
          <Link to="/" className={isActive('/')}>Browse</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/requests" className={isActive('/requests')}>Requests</Link>
          <Link to="/upload" className={isActive('/upload')}>Upload</Link>
          <Link to="/profile" className={`flex items-center gap-2 ${isActive('/profile')}`}>
            <Avatar size={20} />
            Profile
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl'}>
        <Outlet />
      </main>
      
      <UploadIndicator />

      {/* Bottom Nav */}
      {!isShortsMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
            <Home size={22} />
            <span className="text-[10px]">Home</span>
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

          <div className="flex flex-col items-center gap-1 text-slate-400">
             <NotificationBell />
             <span className="text-[10px]">Alerts</span>
          </div>

          <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile')}`}>
            <Avatar size={22} />
            <span className="text-[10px]">Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
