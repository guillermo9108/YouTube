import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification, MarketplaceItem, User, SystemSettings } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder, Bell, Check, Zap, Clock, Film, ShoppingBag, Tag, Users, Star, Menu, Crown, User as UserIcon, LogOut, ShieldCheck, Heart, History, ChevronLeft
} from 'lucide-react';
import { useLocation, useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// --- Componentes Auxiliares ---

// Fix: Use React.FC to ensure standard React component typing and support for intrinsic props
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
                        <Clock size={20} className="text-slate-500 group-hover:text-amber-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Ver más tarde</span>
                    </button>
                    <button onClick={() => { navigate('/vip'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Crown size={20} className="text-slate-500 group-hover:text-amber-500"/>
                        <span className="text-xs font-black uppercase tracking-widest">VIP & Recargas</span>
                    </button>
                    <button onClick={() => { navigate('/marketplace'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <ShoppingBag size={20} className="text-slate-500 group-hover:text-emerald-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Tienda</span>
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

// Fix: Use React.FC to ensure standard React component typing
const Breadcrumbs: React.FC<{ path: string[], onNavigate: (index: number) => void }> = ({ path, onNavigate }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
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

// Fix: Use React.FC to allow standard React props like 'key' when used in list mapping (fixes error on line 298)
const SubCategoryCard: React.FC<{ name: string, videos: Video[], onClick: () => void }> = ({ name, videos, onClick }) => {
    const randomThumb = useMemo(() => {
        if (!videos || videos.length === 0) return null;
        const valid = videos.filter(v => v.thumbnailUrl && !v.thumbnailUrl.includes('default.jpg'));
        const source = valid.length > 0 ? valid : videos;
        return source[Math.floor(Math.random() * source.length)]?.thumbnailUrl;
    }, [videos]);

    return (
        <button onClick={onClick} className="group relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 ring-1 ring-white/5">
            {randomThumb ? <img src={randomThumb} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-110 transition-all duration-700" alt={name} /> : <div className="w-full h-full flex items-center justify-center text-slate-700"><Folder size={48} /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-indigo-600/90 backdrop-blur-md px-2 py-1 rounded-md shadow-lg border border-white/10"><Layers size={10} className="text-white"/><span className="text-[8px] font-black text-white uppercase tracking-widest">CARPETA</span></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] group-hover:text-indigo-300 transition-colors">{name}</h3>
                <div className="mt-2 bg-black/40 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/5"><span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{videos?.length || 0} Archivos</span></div>
            </div>
        </button>
    );
};

export default function Home() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    
    const [allVideos, setAllVideos] = useState<Video[]>([]);
    const [marketItems, setMarketItems] = useState<MarketplaceItem[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [watchedIds, setWatchedIds] = useState<string[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    
    const [visibleCount, setVisibleCount] = useState(12);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<any>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSuggestions(false);
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowNotifMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, mkt, usersRes, sets] = await Promise.all([
                db.getAllVideos(), db.getMarketplaceItems(), db.getAllUsers(), db.getSystemSettings()
            ]);
            setAllVideos((vids || []).filter(v => v && v.category && !['PENDING', 'PROCESSING', 'FAILED_METADATA'].includes(v.category)));
            setMarketItems(mkt || []);
            setAllUsers(usersRes || []);
            setCategories(sets?.categories || []);
            setSystemSettings(sets);
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act?.watched || []);
                db.getNotifications(user.id).then(n => setNotifs(n || []));
            }
        } catch (e) {} finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, [user?.id]);

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

    // --- Lógica de Explorador de Carpetas Real ---
    
    const getRelativeSegments = (video: Video) => {
        const raw = (video as any).rawPath || video.videoUrl;
        if (!raw) return [];
        const root = systemSettings?.localLibraryPath || '';
        let rel = raw;
        if (root && raw.startsWith(root)) rel = raw.substring(root.length);
        return rel.split(/[\\/]/).filter(Boolean);
    };

    const currentExploration = useMemo(() => {
        if (searchQuery) return { folders: [], videos: [] };

        const currentVideosInPath = allVideos.filter(v => {
            const segments = getRelativeSegments(v);
            return navigationPath.every((seg, i) => segments[i] === seg);
        });

        // 1. Extraer Subcarpetas únicas del siguiente nivel
        const foldersMap = new Map<string, Video[]>();
        currentVideosInPath.forEach(v => {
            const segments = getRelativeSegments(v);
            const nextSegment = segments[navigationPath.length];
            // Si hay un segmento siguiente y no es el archivo mismo (el archivo es el último segmento)
            if (nextSegment && segments.length > navigationPath.length + 1) {
                if (!foldersMap.has(nextSegment)) foldersMap.set(nextSegment, []);
                foldersMap.get(nextSegment)!.push(v);
            }
        });

        // 2. Extraer Videos que están EXACTAMENTE en esta carpeta
        const directVideos = currentVideosInPath.filter(v => {
            const segments = getRelativeSegments(v);
            return segments.length === navigationPath.length + 1;
        });

        // Ordenar
        const sortedVideos = [...directVideos].sort((a, b) => {
            const catDef = categories.find(c => c.name === navigationPath[0]);
            const mode = catDef?.sortOrder || 'LATEST';
            if (mode === 'ALPHA') return naturalCollator.compare(a.title, b.title);
            return b.createdAt - a.createdAt;
        });

        return {
            folders: Array.from(foldersMap.entries()).map(([name, vids]) => ({ name, videos: vids })),
            videos: sortedVideos
        };
    }, [navigationPath, allVideos, searchQuery, systemSettings, categories]);

    const handleNavigate = (index: number) => {
        if (index === -1) setNavigationPath([]);
        else setNavigationPath(navigationPath.slice(0, index + 1));
        setVisibleCount(12);
    };

    const unreadCount = useMemo(() => notifs.filter(n => Number(n.isRead) === 0).length, [notifs]);
    const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

    if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

    return (
        <div className="pb-20 space-y-6">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>

            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
                <div className="flex gap-3 mb-4 items-center w-full">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-400 active:scale-95 transition-transform"><Menu size={20}/></button>
                    <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
                        <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                        <input type="text" value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)} placeholder="Buscar en el servidor..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={16}/></button>}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400"><Film size={16}/></div>
                                        <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{s.label}</div><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.type}</div></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 relative">
                            <Bell size={22} className={unreadCount > 0 ? "animate-bounce" : ""} />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black">{unreadCount}</span>}
                        </button>
                    </div>
                </div>
                {!searchQuery && <Breadcrumbs path={navigationPath} onNavigate={handleNavigate} />}
            </div>

            {searchQuery ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in">
                    {allVideos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                        <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
                    ))}
                </div>
            ) : (
                <div className="space-y-10 animate-in fade-in">
                    {currentExploration.folders.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {currentExploration.folders.map(folder => (
                                <SubCategoryCard key={folder.name} name={folder.name} videos={folder.videos} onClick={() => { setNavigationPath([...navigationPath, folder.name]); setVisibleCount(12); }} />
                            ))}
                        </div>
                    )}

                    {currentExploration.videos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
                            {currentExploration.videos.slice(0, visibleCount).map(v => (
                                <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
                            ))}
                        </div>
                    ) : currentExploration.folders.length === 0 && (
                        <div className="text-center py-40 opacity-20"><Folder size={80} className="mx-auto mb-4" /><p className="font-black uppercase tracking-widest">Carpeta Vacía</p></div>
                    )}
                </div>
            )}

            {!searchQuery && currentExploration.videos.length > visibleCount && (
                <div className="py-10 flex justify-center"><button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">Ver más contenido</button></div>
            )}

            <AIConcierge videos={allVideos} isVisible={!!systemSettings?.geminiKey} />
        </div>
    );
}