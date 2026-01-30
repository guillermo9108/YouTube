import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Notification as AppNotification, User } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Folder, Bell, Menu, Crown, User as UserIcon, LogOut, ShieldCheck, MessageSquare, Loader2, Tag
} from 'lucide-react';
import { useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';
import { useToast } from '../../context/ToastContext';

// --- Componentes Auxiliares ---

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, user: User | null, isAdmin: boolean, logout: () => void }> = ({ isOpen, onClose, user, isAdmin, logout }) => {
    const navigate = useNavigate();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 border-2 border-white/10 overflow-hidden shadow-lg">
                            {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-white text-xl">{user?.username?.[0] || '?'}</div>}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate">@{user?.username || 'Usuario'}</div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</div>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tu Saldo</p>
                        <div className="text-xl font-black text-emerald-400">{Number(user?.balance || 0).toFixed(2)} $</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => { navigate('/'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <HomeIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Inicio</span>
                    </button>
                    <button onClick={() => { navigate('/profile'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <UserIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Mi Perfil</span>
                    </button>
                    <button onClick={() => { navigate('/watch-later'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Bell size={20} className="text-slate-500 group-hover:text-amber-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Ver más tarde</span>
                    </button>
                    <button onClick={() => { navigate('/vip'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Crown size={20} className="text-slate-500 group-hover:text-amber-500"/>
                        <span className="text-xs font-black uppercase tracking-widest">VIP & Recargas</span>
                    </button>
                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <button onClick={() => { navigate('/admin'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all border border-indigo-500/20">
                                <ShieldCheck size={20}/><span className="text-xs font-black uppercase tracking-widest">Panel Admin</span>
                            </button>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut size={20}/><span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Breadcrumbs: React.FC<{ path: string[], onNavigate: (index: number) => void }> = ({ path, onNavigate }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <button onClick={() => onNavigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors shrink-0">
            <HomeIcon size={16}/>
        </button>
        {path.map((segment, i) => (
            <React.Fragment key={`${segment}-${i}`}>
                <ChevronRight size={12} className="text-slate-600 shrink-0"/>
                <button 
                    onClick={() => onNavigate(i)}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${i === path.length - 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {segment}
                </button>
            </React.Fragment>
        ))}
    </div>
);

export default function Home() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    
    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Data State (Paginación)
    const [videos, setVideos] = useState<Video[]>([]);
    const [folders, setFolders] = useState<{ name: string; count: number }[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    
    // Filters State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TODOS');
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    const [activeCategories, setActiveCategories] = useState<string[]>(['TODOS']);
    
    // Secondary Data
    const [watchedIds, setWatchedIds] = useState<string[]>([]);
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [geminiActive, setGeminiActive] = useState(false);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<any>(null);

    const currentFolder = navigationPath.join('/');

    // 1. Cargar configuración inicial
    useEffect(() => {
        db.getSystemSettings().then(s => setGeminiActive(!!s.geminiKey));
        if (user) {
            db.getUserActivity(user.id).then(act => setWatchedIds(act?.watched || []));
            db.getNotifications(user.id).then(setNotifs);
        }
    }, [user?.id]);

    // 2. Cargador de Videos (Paginado)
    const fetchVideos = async (p: number, reset: boolean = false) => {
        if (loading || (loadingMore && !reset)) return;
        
        if (reset) {
            setLoading(true);
            setVideos([]);
            setFolders([]);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await db.getVideos(p, 40, currentFolder, searchQuery, selectedCategory);
            
            if (reset) {
                setVideos(res.videos);
                setFolders(res.folders);
                setActiveCategories(['TODOS', ...res.activeCategories]);
            } else {
                setVideos(prev => [...prev, ...res.videos]);
            }
            
            setHasMore(res.hasMore);
            setPage(p);
        } catch (e) {
            toast.error("Error al sincronizar catálogo");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // 3. Trigger de carga cuando cambian filtros
    useEffect(() => {
        fetchVideos(0, true);
    }, [currentFolder, searchQuery, selectedCategory]);

    // 4. Infinite Scroll Observer
    useEffect(() => {
        if (!hasMore || loading || loadingMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                fetchVideos(page + 1);
            }
        }, { threshold: 0.1, rootMargin: '400px' });

        if (loadMoreRef.current) observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [page, hasMore, loading, loadingMore]);

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
        
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await db.getSearchSuggestions(val);
                setSuggestions(res || []);
                setShowSuggestions(res?.length > 0);
            } catch(e) {}
        }, 300);
    };

    const handleSuggestionClick = (s: any) => {
        setSearchQuery(s.label); setShowSuggestions(false); db.saveSearch(s.label);
        if (s.type === 'VIDEO') navigate(`/watch/${s.id}`);
        else if (s.type === 'MARKET') navigate(`/marketplace/${s.id}`);
        else if (s.type === 'USER') navigate(`/channel/${s.id}`);
    };

    const handleNavigate = (index: number) => {
        if (index === -1) setNavigationPath([]);
        else setNavigationPath(navigationPath.slice(0, index + 1));
    };

    const handleNotifClick = async (n: AppNotification) => {
        if (Number(n.isRead) === 0) {
            try {
                await db.markNotificationRead(n.id);
                setNotifs(prev => prev.map(p => p.id === n.id ? { ...p, isRead: true } : p));
            } catch(e) {}
        }
        setShowNotifMenu(false);
        navigate(n.link);
    };

    const unreadCount = useMemo(() => notifs.filter(n => Number(n.isRead) === 0).length, [notifs]);
    const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

    return (
        <div className="pb-20 space-y-6">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>

            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5 shadow-2xl">
                <div className="flex gap-3 mb-4 items-center w-full">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-400 active:scale-95 transition-transform"><Menu size={20}/></button>
                    <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
                        <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={(e) => handleSearchChange(e.target.value)} 
                            onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)}
                            placeholder="Buscar en miles de archivos..." 
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={16}/></button>}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400"><Layers size={16}/></div>
                                        <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{s.label}</div><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.type}</div></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 relative active:scale-95 transition-transform">
                            <Bell size={22} className={unreadCount > 0 ? "animate-bounce" : ""} />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black">{unreadCount}</span>}
                        </button>
                        {showNotifMenu && (
                            <div className="absolute top-full right-0 mt-3 w-80 bg-slate-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden z-[60] animate-in fade-in zoom-in-95 origin-top-right">
                                <div className="p-5 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                                    <h4 className="font-black text-white uppercase text-[10px] tracking-widest">Notificaciones</h4>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {notifs.length === 0 ? (
                                        <div className="py-12 text-center text-slate-600 flex flex-col items-center gap-3"><MessageSquare size={32} className="opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Sin alertas</p></div>
                                    ) : notifs.map(n => (
                                        <button key={n.id} onClick={() => handleNotifClick(n)} className={`w-full p-4 flex gap-4 text-left border-b border-white/5 transition-all hover:bg-white/5 ${Number(n.isRead) === 0 ? 'bg-indigo-500/[0.03]' : 'opacity-60'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 shrink-0 flex items-center justify-center">{n.avatarUrl ? <img src={n.avatarUrl} className="w-full h-full object-cover" /> : <Bell size={16} className="text-slate-500" />}</div>
                                            <div className="flex-1 min-w-0"><div className="flex justify-between items-start mb-0.5"><span className="text-[9px] font-black text-indigo-400 uppercase">{n.type}</span></div><p className="text-xs leading-snug truncate text-white">{n.text}</p></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!searchQuery && (
                    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
                        {activeCategories.map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    selectedCategory === cat 
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/40 scale-105' 
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
                
                {!searchQuery && <Breadcrumbs path={navigationPath} onNavigate={handleNavigate} />}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={48} />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Optimizando librería...</p>
                </div>
            ) : (
                <div className="space-y-10 animate-in fade-in duration-500">
                    
                    {/* Render de Carpetas con visibilidad móvil optimizada (Proporción 4:5 y paddings menores) */}
                    {!searchQuery && folders.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                            {folders.map(folder => (
                                <button 
                                    key={folder.name} 
                                    onClick={() => setNavigationPath([...navigationPath, folder.name])}
                                    className="group relative aspect-[4/5] sm:aspect-video rounded-[24px] sm:rounded-[32px] overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500 shadow-2xl hover:scale-[1.03] transition-all duration-300 ring-1 ring-white/10"
                                >
                                    {/* Fondo con degradado para legibilidad del texto blanco */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-indigo-500/10"></div>
                                    
                                    <div className="relative h-full flex flex-col p-4 sm:p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 sm:p-2.5 bg-slate-800/80 rounded-xl border border-white/5 text-indigo-400">
                                                <Folder size={20} className="sm:w-7 sm:h-7" />
                                            </div>
                                            <div className="bg-indigo-600/20 backdrop-blur-md px-1.5 sm:px-2 py-0.5 rounded-lg border border-indigo-500/30">
                                                <span className="text-[7px] sm:text-[8px] text-indigo-200 font-black uppercase tracking-widest">{folder.count} FILE</span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-auto pt-4">
                                            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight text-left leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-indigo-300 transition-colors line-clamp-3">
                                                {folder.name}
                                            </h3>
                                            <div className="w-6 h-1 bg-indigo-500 mt-2 rounded-full group-hover:w-16 transition-all duration-500"></div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Grid de Contenido Aplanado */}
                    <div>
                        {!searchQuery && (
                            <div className="flex items-center gap-2 mb-6 px-1">
                                <Tag size={16} className="text-indigo-500" />
                                <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Contenido disponible</h2>
                                <div className="flex-1 h-px bg-white/5"></div>
                            </div>
                        )}
                        
                        {videos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
                                {videos.map(v => (
                                    <VideoCard 
                                        key={v.id} 
                                        video={v} 
                                        isUnlocked={isAdmin || user?.id === v.creatorId} 
                                        isWatched={watchedIds.includes(v.id)} 
                                    />
                                ))}
                            </div>
                        ) : folders.length === 0 && (
                            <div className="text-center py-40 opacity-20 flex flex-col items-center gap-4">
                                <Folder size={80} />
                                <p className="font-black uppercase tracking-widest">Sin contenido en esta ubicación</p>
                            </div>
                        )}
                    </div>

                    {hasMore && (
                        <div ref={loadMoreRef} className="py-20 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-slate-700" size={32} />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Cargando más resultados...</p>
                        </div>
                    )}
                </div>
            )}

            <AIConcierge videos={videos} isVisible={geminiActive} />
        </div>
    );
}