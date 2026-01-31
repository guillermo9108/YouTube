import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction, Category } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    ChevronRight, Home, Play, Info, ExternalLink, AlertTriangle, Send, CheckCircle2, Clock, Share2, X, Search, UserCheck, PlusCircle, ArrowRightCircle, Wallet, ShoppingCart, Music, ChevronDown, Bell, BellOff, ListFilter
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useGrid } from '../../context/GridContext';

export default function Watch() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const { setThrottled } = useGrid();
    const navigate = useNavigate();
    const toast = useToast();
    
    const searchContext = useMemo(() => {
        const hash = window.location.hash;
        if (!hash.includes('?')) return null;
        const params = new URLSearchParams(hash.split('?')[1]);
        return params.get('q');
    }, [id, window.location.hash]);

    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [interaction, setInteraction] = useState<UserInteraction | null>(null);
    
    // Suggestion List
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    const [visibleRelated, setVisibleRelated] = useState(12);
    const [hasMoreRelated, setHasMoreRelated] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    
    // Comments
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(false); 
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Share Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareSearch, setShareSearch] = useState('');
    const [shareSuggestions, setShareSuggestions] = useState<any[]>([]);
    const shareTimeout = useRef<any>(null);

    // Lazy Extraction
    const [extractionAttempted, setExtractionAttempted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { 
        window.scrollTo(0, 0); 
        setThrottled(true);
        setExtractionAttempted(false);
        return () => { setThrottled(false); };
    }, [id]);

    useEffect(() => {
        if (!id) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const v = await db.getVideo(id);
                if (!v) { setLoading(false); return; }
                setVideo(v); 

                // Sugerencias Dinámicas
                if (searchContext) {
                    const searchRes = await db.getVideos(0, 30, '', searchContext);
                    setRelatedVideos(searchRes.videos.filter(rv => rv.id !== v.id));
                } else {
                    const rel = await db.getRelatedVideos(v.id, 0);
                    setRelatedVideos(rel);
                }

                db.getComments(v.id).then(setComments);

                if (user) {
                    const [access, interact] = await Promise.all([
                        db.hasPurchased(user.id, v.id),
                        db.getInteraction(user.id, v.id)
                    ]);
                    
                    setInteraction(interact);

                    // Lógica de Desbloqueo Real
                    const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
                    const isCreator = String(user.id) === String(v.creatorId);
                    const isVipActive = !!(user.vipExpiry && Number(user.vipExpiry) > Date.now() / 1000);
                    const hasVipAccessToAdmin = isVipActive && v.creatorRole?.trim().toUpperCase() === 'ADMIN';

                    setIsUnlocked(access || isAdmin || isCreator || hasVipAccessToAdmin);
                }
            } catch (e) { console.error("Watch Error:", e); } 
            finally { setLoading(false); }
        };

        fetchData();
    }, [id, user?.id, searchContext]);

    // Lazy Thumbnail Extraction
    const handleTimeUpdate = async () => {
        const el = videoRef.current;
        if (!el || !video || extractionAttempted || !isUnlocked) return;
        if (video.thumbnailUrl && !video.thumbnailUrl.includes('default.jpg')) return;

        if (!video.is_audio && el.currentTime > 2 && el.videoWidth > 0) {
            setExtractionAttempted(true);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = el.videoWidth; canvas.height = el.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(el, 0, 0);
                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            const file = new File([blob], "thumb_auto.jpg", { type: "image/jpeg" });
                            await db.updateVideoMetadata(video.id, Math.floor(el.duration), file);
                            setVideo(prev => prev ? { ...prev, thumbnailUrl: URL.createObjectURL(blob) } : null);
                        }
                    }, 'image/jpeg', 0.8);
                }
            } catch (e) { console.warn("Extraction failed", e); }
        }
    };

    const handleRate = async (type: 'like' | 'dislike') => {
        if (!user || !video) return;
        try { await db.rateVideo(user.id, video.id, type); toast.success("Voto registrado"); } catch(e) {}
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !video || !newComment.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const c = await db.addComment(user.id, video.id, newComment.trim());
            setComments(prev => [c, ...prev]);
            setNewComment('');
        } catch(e) { toast.error("Error al comentar"); }
        finally { setIsSubmitting(false); }
    };

    const handlePurchase = async () => {
        if (!user || !video || isPurchasing) return;
        if (Number(user.balance) < Number(video.price)) { toast.error("Saldo insuficiente"); navigate('/vip'); return; }
        setIsPurchasing(true);
        try {
            await db.purchaseVideo(user.id, video.id);
            setIsUnlocked(true); refreshUser();
        } catch (e: any) { toast.error(e.message); } finally { setIsPurchasing(false); }
    };

    const handleShareSearch = (val: string) => {
        setShareSearch(val);
        if (shareTimeout.current) clearTimeout(shareTimeout.current);
        if (val.length < 2) { setShareSuggestions([]); return; }
        shareTimeout.current = setTimeout(async () => {
            if (!user) return;
            const hits = await db.searchUsers(user.id, val);
            setShareSuggestions(hits);
        }, 300);
    };

    const sendVideoToUser = async (targetUsername: string) => {
        if (!user || !video) return;
        toast.success(`Video recomendado a @${targetUsername}`);
        setShowShareModal(false); setShareSearch(''); setShareSuggestions([]);
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const token = localStorage.getItem('sp_session_token') || '';
        return `api/index.php?action=stream&id=${video.id}&token=${token}&cb=${Date.now()}`;
    }, [video?.id]);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in relative">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black overflow-hidden">
                    {isUnlocked ? (
                        <video 
                            ref={videoRef} src={streamUrl} controls autoPlay crossOrigin="anonymous"
                            poster={video?.thumbnailUrl} className="w-full h-full object-contain" 
                            onTimeUpdate={handleTimeUpdate}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                            {video && <img src={video.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110"/>}
                            <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-[48px] shadow-2xl flex flex-col items-center text-center max-w-md">
                                <Lock size={24} className="text-amber-500 mb-4"/>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Contenido Premium</h2>
                                <button onClick={handlePurchase} disabled={isPurchasing} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-3xl transition-all shadow-xl active:scale-95">
                                    {isPurchasing ? 'PROCESANDO...' : `DESBLOQUEAR POR ${video?.price} $`}
                                </button>
                                <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo: {Number(user?.balance || 0).toFixed(2)} $</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">{video?.title}</h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8 mb-8">
                        <div className="flex items-center gap-4">
                            <Link to={`/channel/${video?.creatorId}`} className="w-12 h-12 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-white/10">
                                {video?.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-indigo-600">{video?.creatorName?.[0]}</div>}
                            </Link>
                            <div className="min-w-0">
                                <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400 block truncate">@{video?.creatorName}</Link>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{video?.creatorRole === 'ADMIN' ? 'Oficial' : 'Verificado'}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-900 rounded-2xl p-1 border border-white/5">
                                <button onClick={() => handleRate('like')} className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-all"><Heart size={18}/></button>
                                <button onClick={() => handleRate('dislike')} className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-all"><ThumbsDown size={18}/></button>
                            </div>
                            <button onClick={() => setShowShareModal(true)} className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-300 hover:text-white"><Share2 size={18}/></button>
                            <button onClick={() => setShowComments(true)} className="flex items-center gap-2 bg-slate-900 border border-white/5 px-5 py-3 rounded-2xl text-slate-300 hover:text-white transition-all">
                                <MessageCircle size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">{comments.length}</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 text-sm text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                        {video?.description || 'Sin descripción disponible.'}
                    </div>
                </div>

                <div className="lg:w-80 space-y-4 shrink-0">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2"><Play size={12} className="text-indigo-500"/> Sugerencias</h3>
                    <div className="space-y-4">
                        {relatedVideos.map((v) => {
                            const contextSuffix = searchContext ? `?q=${encodeURIComponent(searchContext)}` : '';
                            return (
                                <Link key={v.id} to={`/watch/${v.id}${contextSuffix}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all">
                                    <div className="w-32 aspect-video bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-white/5"><img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /></div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase leading-tight group-hover:text-indigo-400 transition-colors">{v.title}</h4>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2"><Share2 size={18} className="text-indigo-400"/> Compartir Video</h3>
                            <button onClick={() => setShowShareModal(false)} className="p-2 bg-slate-800 text-slate-500 hover:text-white rounded-2xl transition-all"><X/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-4 text-slate-500" size={18}/>
                                <input 
                                    type="text" value={shareSearch} onChange={e => handleShareSearch(e.target.value)}
                                    placeholder="Buscar usuario..."
                                    className="w-full bg-slate-950 border border-white/5 rounded-[24px] pl-12 pr-4 py-4 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {shareSuggestions.map(s => (
                                    <button key={s.username} onClick={() => sendVideoToUser(s.username)} className="w-full p-4 flex items-center gap-4 hover:bg-indigo-600 rounded-[24px] transition-all group">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/5 shadow-lg">
                                            {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm font-black text-white bg-slate-700">{s.username?.[0]}</div>}
                                        </div>
                                        <span className="text-sm font-black text-white">@{s.username}</span>
                                        <ArrowRightCircle size={20} className="ml-auto opacity-0 group-hover:opacity-100 text-white"/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Overlay Comments Drawer */}
            {showComments && (
                <div className="fixed inset-0 z-[100] flex items-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full lg:max-w-md lg:absolute lg:right-0 lg:top-0 lg:h-full bg-slate-900 rounded-t-[40px] lg:rounded-none h-[80%] flex flex-col border-t lg:border-l border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-500">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
                            <h3 className="font-black text-white uppercase text-xs tracking-widest">Comentarios</h3>
                            <button onClick={() => setShowComments(false)} className="text-slate-400 bg-slate-800 p-2.5 rounded-2xl hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {comments.map(c => (
                                <div key={c.id} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-800 shrink-0 border border-white/5 overflow-hidden">
                                        {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{c.username?.[0]}</div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2 mb-1">
                                            <span className="text-xs font-black text-slate-200">@{c.username}</span>
                                            <span className="text-[8px] text-slate-600 uppercase font-bold">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-snug">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddComment} className="p-6 bg-slate-950 border-t border-white/5 flex gap-3 pb-safe">
                            <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-slate-900 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="Escribe un comentario..." />
                            <button type="submit" disabled={!newComment.trim() || isSubmitting} className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-30 shadow-xl active:scale-90 transition-all"><Send size={20} /></button>
                        </form>
                    </div>
                    <div className="hidden lg:block flex-1" onClick={() => setShowComments(false)}></div>
                </div>
            )}
        </div>
    );
}