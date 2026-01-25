
import React, { useState, useEffect } from 'react';
import { 
    Home, Upload, User, ShieldCheck, Smartphone, Bell, X, Menu, 
    DownloadCloud, LogOut, ShoppingBag, Server, ChevronRight, Crown, 
    Smartphone as MobileIcon, MonitorDown, AlertTriangle, CheckCircle2, 
    Clock, ShoppingCart as SaleIcon, Zap, User as UserIcon, Layout as LayoutIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useCart } from '../context/CartContext';
import { useServerTask } from '../context/ServerTaskContext';
import { Link, useLocation, Outlet, useNavigate } from './Router';
import { db } from '../services/db';
import GridProcessor from './GridProcessor';

const Sidebar = ({ isOpen, onClose, user, isAdmin, logout }: any) => {
    const navigate = useNavigate();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl">
                            {user?.username?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate">@{user?.username || 'Usuario'}</div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button onClick={() => { navigate('/'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all text-left">
                        <Home size={20}/><span className="text-xs font-black uppercase tracking-widest">Inicio</span>
                    </button>
                    <button onClick={() => { navigate('/marketplace'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all text-left">
                        <ShoppingBag size={20}/><span className="text-xs font-black uppercase tracking-widest">Tienda</span>
                    </button>
                    <button onClick={() => { navigate('/requests'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all text-left">
                        <DownloadCloud size={20}/><span className="text-xs font-black uppercase tracking-widest">Pedidos</span>
                    </button>
                    {isAdmin && (
                        <button onClick={() => { navigate('/admin'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 text-indigo-300 transition-all border border-indigo-500/20 text-left">
                            <ShieldCheck size={20}/><span className="text-xs font-black uppercase tracking-widest">Panel Admin</span>
                        </button>
                    )}
                </div>
                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 text-left">
                        <LogOut size={20}/><span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  const isShortsMode = location.pathname === '/shorts';
  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (isShortsMode) return <div className="fixed inset-0 bg-black overflow-hidden"><Outlet /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-black pb-20">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>
      
      {/* Global Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="container mx-auto px-4 h-[70px] flex items-center justify-between max-w-5xl">
              <div className="flex items-center gap-4">
                  <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-indigo-400 active:scale-95 transition-all">
                      <Menu size={20}/>
                  </button>
                  <Link to="/" className="flex items-center gap-2">
                      <LayoutIcon size={24} className="text-indigo-500" />
                      <span className="text-xl font-black text-white tracking-tighter uppercase italic">StreamPay</span>
                  </Link>
              </div>
              <div className="flex items-center gap-3">
                   {isAdmin && <Link to="/admin" className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-full transition-colors"><ShieldCheck size={20}/></Link>}
                   <Link to="/profile" className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 overflow-hidden flex items-center justify-center">
                        {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{user?.username?.[0]}</span>}
                   </Link>
              </div>
          </div>
      </header>

      <main className="flex-1 container mx-auto px-4 pt-4 max-w-5xl">
        <Outlet />
      </main>

      <GridProcessor />

      {/* Navigation Bar - Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 flex justify-around items-center py-3 z-50 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:hidden">
        <Link to="/" className={isActive('/')}><Home size={22}/></Link>
        <Link to="/shorts" className={isActive('/shorts')}><MobileIcon size={22}/></Link>
        <Link to="/upload" className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg active:scale-95 transition-transform"><Upload size={24}/></Link>
        <Link to="/marketplace" className={isActive('/marketplace')}><ShoppingBag size={22}/></Link>
        <Link to="/profile" className={isActive('/profile')}><User size={22}/></Link>
      </nav>
    </div>
  );
}
