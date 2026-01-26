
import React, { useState } from 'react';
import { 
    Home, ShieldCheck, Menu, 
    DownloadCloud, LogOut, ShoppingBag, ChevronRight, Crown, 
    User as UserIcon, Layout as LayoutIcon, Clock, ShoppingCart as SaleIcon,
    Zap, Search, History, Wallet, Smartphone, Upload, Bell, X, MonitorDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, Outlet, useNavigate } from './Router';
import GridProcessor from './GridProcessor';
import { useCart } from '../context/CartContext';

const Sidebar = ({ isOpen, onClose, user, isAdmin, logout }: any) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    if (!isOpen) return null;

    const navItems = [
        { label: 'Inicio', icon: Home, path: '/' },
        { label: 'Mi Perfil', icon: UserIcon, path: '/profile' },
        { label: 'Ver más tarde', icon: Clock, path: '/watch-later' },
        { label: 'Marketplace', icon: ShoppingBag, path: '/marketplace' },
        { label: 'Sugerencias', icon: DownloadCloud, path: '/requests' },
        { label: 'Premium VIP', icon: Crown, path: '/vip', color: 'text-amber-400' },
    ];

    return (
        <div className="fixed inset-0 z-[200] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="absolute top-0 left-0 bottom-0 w-[300px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-8 bg-slate-950 border-b border-white/5">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-indigo-600/20">
                            {user?.username?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate text-lg">@{user?.username || 'Usuario'}</div>
                            <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">{user?.role}</div>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Mi Balance</p>
                        <div className="text-xl font-black text-emerald-400">{Number(user?.balance || 0).toFixed(2)} $</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                    {navItems.map((item) => (
                        <button 
                            key={item.path}
                            onClick={() => { navigate(item.path); onClose(); }} 
                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${location.pathname === item.path ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-4">
                                <item.icon size={20} className={item.color || ''} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                            </div>
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}

                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <button 
                                onClick={() => { navigate('/admin'); onClose(); }} 
                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all"
                            >
                                <ShieldCheck size={20}/><span className="text-[10px] font-black uppercase tracking-widest">Panel Admin</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-colors font-black text-[10px] uppercase tracking-widest">
                        <LogOut size={20}/><span className="tracking-[0.2em]">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const isShortsMode = location.pathname === '/shorts';
  const isHomePage = location.pathname === '/';
  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (isShortsMode) return <div className="fixed inset-0 bg-black overflow-hidden"><Outlet /></div>;

  const navIconClass = (path: string) => 
    `flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${location.pathname === path ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500'}`;

  return (
    <div className="min-h-screen flex flex-col bg-black overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>
      
      {/* Header Dinámico */}
      <header className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isHomePage ? 'bg-transparent border-none' : 'bg-black/60 backdrop-blur-2xl border-b border-white/5 h-[74px]'}`}>
          <div className="container mx-auto px-4 h-full flex items-center justify-between max-w-7xl">
              <div className="flex items-center gap-5">
                  <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className={`p-3 bg-slate-900 border border-white/10 rounded-2xl text-indigo-400 active:scale-90 hover:bg-slate-800 transition-all shadow-lg ${isHomePage ? 'mt-4' : ''}`}
                  >
                      <Menu size={22}/>
                  </button>
                  
                  {!isHomePage && (
                    <Link to="/" className="flex items-center gap-3 group animate-in fade-in">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-600/20 group-hover:rotate-12 transition-transform">
                          <LayoutIcon size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-black text-white tracking-tighter uppercase italic hidden xs:block">StreamPay</span>
                    </Link>
                  )}
              </div>
              
              {!isHomePage && (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
                    <div className="hidden md:flex bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-2 items-center gap-3">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo</div>
                            <div className="text-sm font-black text-emerald-400">{Number(user?.balance || 0).toFixed(2)} $</div>
                    </div>

                    {isAdmin && (
                        <Link to="/admin" className="p-3 text-amber-500 hover:bg-amber-500/10 rounded-2xl transition-all border border-transparent hover:border-amber-500/20 hidden sm:flex">
                            <ShieldCheck size={22}/>
                        </Link>
                    )}
                    
                    <Link to="/profile" className="w-11 h-11 rounded-2xl bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center hover:border-indigo-500/50 transition-all shadow-lg">
                            {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="Profile" /> : <span className="text-white font-black">{user?.username?.[0]}</span>}
                    </Link>
                </div>
              )}
          </div>
      </header>

      {/* Main Content Area con paddings dinámicos */}
      <main className={`flex-1 container mx-auto px-4 ${isHomePage ? 'pt-6' : 'pt-[94px]'} pb-24 md:pb-8 max-w-7xl animate-in fade-in duration-700`}>
        <Outlet />
      </main>

      <GridProcessor />

      {/* Navigation Bar - Bottom (Móvil) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center py-4 z-[150] safe-area-bottom md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <Link to="/" className={navIconClass('/')}>
              <Home size={22} />
              <span className="text-[8px] font-black uppercase mt-1">Inicio</span>
          </Link>
          <Link to="/shorts" className={navIconClass('/shorts')}>
              <Zap size={22} />
              <span className="text-[8px] font-black uppercase mt-1">Shorts</span>
          </Link>
          <Link to="/marketplace" className={navIconClass('/marketplace')}>
              <ShoppingBag size={22} />
              <span className="text-[8px] font-black uppercase mt-1">Tienda</span>
          </Link>
          <Link to="/cart" className="relative flex flex-col items-center justify-center w-12 h-12">
              <div className={navIconClass('/cart')}>
                  <SaleIcon size={22} />
                  <span className="text-[8px] font-black uppercase mt-1">Carrito</span>
              </div>
              {cart.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-slate-900 animate-in zoom-in">
                      {cart.length}
                  </span>
              )}
          </Link>
          <Link to="/profile" className={navIconClass('/profile')}>
              {/* Fix: Use UserIcon instead of User to match renamed import from lucide-react */}
              <UserIcon size={22} />
              <span className="text-[8px] font-black uppercase mt-1">Perfil</span>
          </Link>
      </nav>

      {/* Desktop Floating Action Buttons */}
      <div className="hidden md:flex fixed bottom-8 right-8 flex-col gap-3 z-50">
          <Link to="/upload" className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/40 hover:scale-110 active:scale-95 transition-all">
              <Upload size={24} />
          </Link>
          <Link to="/cart" className="w-14 h-14 bg-slate-900 border border-white/10 hover:border-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all relative">
              <SaleIcon size={24} />
              {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black">
                      {cart.length}
                  </span>
              )}
          </Link>
      </div>
    </div>
  );
}
