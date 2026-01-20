import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction, Category } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    ChevronRight, Home, Play, Info, ExternalLink, AlertTriangle, Send, CheckCircle2, Clock, Share2, X, Search, UserCheck, PlusCircle, ArrowRightCircle, Wallet, ShoppingCart
} from 'lucide-react';
import VideoCard from '../VideoCard';
import { useToast } from '../../context/ToastContext';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export default function Watch() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [interaction, setInteraction] = useState<UserInteraction | null>(null);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    const [visibleRelatedCount, setVisibleRelatedCount] = useState(15);
    
    const [likes, setLikes] = useState<number>(0);
    const [dislikes, setDislikes] = useState<number>(0);
    
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(false); 
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showShareModal, setShowShareModal] = useState(false);
    const [shareSearch, setShareSearch] = useState('');
    const [shareSuggestions, setShareSuggestions] = useState<any[]>([]);
    const shareTimeout = useRef<any>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const viewMarkedRef = useRef(false);

    useEffect(() => { 
        window.scrollTo(0, 0); 
        refreshUser(); 
        viewMarkedRef.current = false;
        setShowComments(false);
        setVisibleRelatedCount(15);
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const [v, settings] = await Promise.all([
                    db.getVideo(id),
                    db.getSystemSettings()
                ]);

                if (v) {
                    setVideo(v); 
                    setLikes(Number(v.likes || 0));
                    setDislikes(Number(v.dislikes || 0));

                    const related = await db.getRelatedVideos(v.id);
                    const catDef = (settings.categories || []).find(c => c.name === v.category || c.name === v.parent_category);
                    const sortMode = catDef?.sortOrder || 'ALPHA'; 
                    
                    const prevId = sessionStorage.getItem('sp_prev_video_id');
                    
                    related.sort((a, b) => {
                        const aSameSub = a.category === v.category;
                        const bSameSub = b.category === v.category;
                        if (aSameSub && !bSameSub) return -1;
                        if (!aSameSub && bSameSub) return 1;

                        const aSameParent = a.parent_category === v.parent_category;
                        const bSameParent = b.parent_category === v.parent_category;
                        if (aSameParent && !bSameParent) return -1;
                        if (!aSameParent && bSameParent) return 1;

                        return 0;
                    });

                    const sameSubVideos = related.filter(rv => rv.category === v.category);
                    const otherVideos = related.filter(rv => rv.category !== v.category);

                    if (sortMode === 'ALPHA') {
                        const nextInSequence = sameSubVideos.filter(rv => naturalCollator.compare(rv.title, v.title) > 0)
                            .sort((a, b) => naturalCollator.compare(a.title, b.title));
                        
                        const prevInSequence = sameSubVideos.filter(rv => naturalCollator.compare(rv.title, v.title) < 0)
                            .sort((a, b) => naturalCollator.compare(a.title, b.title));
                        
                        let finalOrder = [...nextInSequence, ...prevInSequence, ...otherVideos];

                        if (prevId && finalOrder.length > 1 && finalOrder[0].id === prevId) {
                            const loopingVid = finalOrder.shift();
                            if (loopingVid) finalOrder.push(loopingVid);
                        }

                        setRelatedVideos(finalOrder);
                    } else {
                        let finalOrder = [...related];
                        if (prevId && finalOrder.length > 1 && finalOrder[0].id === prevId) {
                            const loopingVid = finalOrder.shift();
                            if (loopingVid) finalOrder.push(loopingVid);
                        }
                        setRelatedVideos(finalOrder);
                    }

                    db.getComments(v.id).then(setComments);

                    if (user) {
                        const [access, interact] = await Promise.all([
                            db.hasPurchased(user.id, v.id), 
                            db.getInteraction(user.id, v.id)
                        ]);
                        
                        const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
                        const isCreator = user.id === v.creatorId;
                        
                        // RESTRICCIÓN VIP: Solo tiene acceso automático al contenido del ADMIN
                        const isVipActive = !!(user.vipExpiry && user.vipExpiry > Date.now() / 1000);
                        const hasVipAccess = isVipActive && v.creatorRole === 'ADMIN';
                        
                        setIsUnlocked(Boolean(access || isAdmin || isCreator || hasVipAccess));
                        setInteraction(interact);
                    }
                }
            } catch (e) {} finally { setLoading(false); }
        };
        fetchData();
    }, [id, user?.id]);

    const handlePurchase = async () => {
        if (!user || !video || isPurchasing) return;
        
        if (Number(user.balance) < Number(video.price)) {
            toast.error("Saldo insuficiente para comprar este video.");
            navigate('/vip');
            return;
        }

        setIsPurchasing(true);
        try {
            await db.purchaseVideo(user.id, video.id);
            setIsUnlocked(true);
            toast.success("¡Video desbloqueado con éxito!");
            refreshUser();
        } catch (e: any) {
            toast.error("Error al procesar la compra: " + e.message);
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRate = async (type: 'like' | 'dislike') => {
        if (!user || !video) return;
        try {
            const res = await db.rateVideo(user.id, video.id, type);
            setInteraction(res);
            if (res.newLikeCount !== undefined) setLikes(res.newLikeCount);
            if (res.newDislikeCount !== undefined) setDislikes(res.newDislikeCount);
        } catch (e) {}
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !video || !newComment.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const c = await db.addComment(user.id, video.id, newComment);
            setComments(prev => [c, ...prev]);
            setNewComment('');
        } catch (e) {} finally { setIsSubmitting(false); }
    };

    const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!viewMarkedRef.current && vid.currentTime > 2) {
            viewMarkedRef.current = true;
            db.incrementView(video!.id);
        }
    };

    const navigateToNext = (nextVid: Video) => {
        if (video) sessionStorage.setItem('sp_prev_video_id', video.id);
        navigate(`/watch/${nextVid.id}`);
    };

    const handleVideoEnded = async () => {
        if (!relatedVideos.length || !user || !video) return;
        const nextVid = relatedVideos[0] || null;

        if (!nextVid) {
            toast.info("Has llegado al final de la colección.");
            return;
        }

        const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
        const isVipActive = !!(user.vipExpiry && user.vipExpiry > Date.now() / 1000);
        const hasVipAccess = isVipActive && nextVid.creatorRole === 'ADMIN';
        
        const hasAccess = isAdmin || user.id === nextVid.creatorId || hasVipAccess;
        
        if (hasAccess) { navigateToNext(nextVid); return; }
        
        const purchased = await db.hasPurchased(user.id, nextVid.id);
        if (purchased) { navigateToNext(nextVid); return; }

        const price = Number(nextVid.price);
        const limit = Number(user.autoPurchaseLimit || 0);
        
        if (price <= limit && Number(user.balance) >= price) {
            try {
                toast.info(`Autocomprando: ${nextVid.title}...`);
                await db.purchaseVideo(user.id, nextVid.id);
                toast.success(`Desbloqueado automáticamente: ${nextVid.title}`);
                refreshUser(); 
                navigateToNext(nextVid);
            } catch (e) { 
                toast.error("Fallo en autocompra automática."); 
                navigateToNext(nextVid);
            }
        } else {
            navigateToNext(nextVid); 
        }
    };

    const handleShareSearch = (val: string) => {
        setShareSearch(val);
        if (shareTimeout.current) clearTimeout(shareTimeout.current);
        if (val.length < 2) { setShareSuggestions([]); return; }
        shareTimeout.current = setTimeout(async () => {
            if (!user) return;
            try {
                const hits = await db.searchUsers(user.id, val);
                setShareSuggestions(hits);
            } catch(e) {}
        }, 300);
    };

    const sendVideoToUser = async (targetUsername: string) => {
        if (!user || !video) return;
        try {
            await db.request(`action=share_video`, {
                method: 'POST',
                body: JSON.stringify({ videoId: video.id, senderId: user.id, targetUsername })
            });
            toast.success(`Video enviado a @${targetUsername}`);
            setShowShareModal(false);
            setShareSearch('');
            setShareSuggestions([]);
        } catch (e: any) { toast.error(e.message); }
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const token = localStorage.getItem('sp_session_token') || '';
        const base = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        return `${base}&token=${token}&cb=${Date.now()}`;
    }, [video?.id]);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black">
                    {isUnlocked ? (
                        <video 
                            ref={videoRef} 
                            src={streamUrl} 
                            controls 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-contain" 
                            onTimeUpdate={handleVideoTimeUpdate}
                            onEnded={handleVideoEnded}
                            crossOrigin="anonymous"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                            {video && <img src={video.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110"/>}
                            
                            <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-[32px] md:rounded-[48px] shadow-2xl flex flex-col items-center text-center max-w-[90%] md:max-w-md animate-in zoom-in-95 duration-500">
                                <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-3 md:mb-4 border border-amber-500/20">
                                    <Lock size={24} className="text-amber-500"/>
                                </div>
                                
                                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter mb-1 leading-none">Contenido Premium</h2>
                                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mb-6 px-4">Desbloquea para siempre este contenido</p>
                                
                                <div className="flex flex-col gap-2 w-full">
                                    <button 
                                        onClick={handlePurchase}
                                        disabled={isPurchasing}
                                        className={`w-full py-3.5 md:py-4 px-6 rounded-2xl md:rounded-3xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl ${user && Number(user.balance) >= Number(video?.price) ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/10' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'}`}
                                    >
                                        {isPurchasing ? <Loader2 className="animate-spin" size={18}/> : <ShoppingCart size={18}/>}
                                        {isPurchasing ? 'PROCESANDO...' : `COMPRAR POR ${video?.price} $`}
                                    </button>
                                    
                                    <button 
                                        onClick={() => navigate('/vip')}
                                        className="w-full py-2.5 md:py-3 text-[10px] md:text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] hover:text-white transition-colors"
                                    >
                                        Recargar Saldo
                                    </button>
                                </div>
                                
                                {user && (
                                    <div className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full border ${Number(user.balance) < Number(video?.price) ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                                        <Wallet size={12} className={Number(user.balance) < Number(video?.price) ? 'text-red-400' : 'text-emerald-400'}/>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${Number(user.balance) < Number(video?.price) ? 'text-red-400' : 'text-slate-400'}`}>
                                            Mi Saldo: {Number(user.balance).toFixed(2)} $
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase italic mb-4">{video?.title}</h1>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
                            <div className="flex items-center gap-4">
                                <Link to={`/channel/${video?.creatorId}`} className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 overflow-hidden shadow-lg shrink-0">
                                    {video?.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500">{video?.creatorName?.[0] || '?'}</div>}
                                </Link>
                                <div>
                                    <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400">@{video?.creatorName || 'Usuario'}</Link>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{video?.views} vistas • {new Date(video!.createdAt * 1000).toLocaleDateString()}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex bg-slate-900 rounded-xl border border-white/5 overflow-hidden">
                                    <button onClick={() => handleRate('like')} className={`flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-all border-r border-white/5 ${interaction?.liked ? 'text-indigo-400' : 'text-slate-400'}`}>
                                        <Heart size={18} fill={interaction?.liked ? "currentColor" : "none"}/>
                                        <span className="text-xs font-bold">{likes}</span>
                                    </button>
                                    <button onClick={() => handleRate('dislike')} className={`flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-all border-r border-white/5 ${interaction?.disliked ? 'text-red-400' : 'text-slate-400'}`}>
                                        <ThumbsDown size={18} fill={interaction?.disliked ? "currentColor" : "none"}/>
                                        <span className="text-xs font-bold">{dislikes}</span>
                                    </button>
                                </div>
                                <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 transition-all ${showComments ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                                    <MessageCircle size={18} fill={showComments ? "currentColor" : "none"}/>
                                    <span className="text-xs font-bold">{comments.length}</span>
                                </button>
                                <button onClick={() => setShowShareModal(true)} className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white"><Share2 size={18}/></button>
                            </div>
                        </div>
                        {video?.description && (
                            <div className="mt-6 bg-white/5 p-5 rounded-3xl border border-white/5">
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{video.description}</p>
                            </div>
                        )}
                    </div>

                    {showComments && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
                                Conversación
                            </h3>
                            
                            <form onSubmit={handleAddComment} className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden border border-white/10">
                                    {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{user?.username?.[0] || '?'}</div>}
                                </div>
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                        placeholder="Escribe un comentario público..."
                                        className="w-full bg-slate-900 border-b border-white/10 p-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                    <button disabled={!newComment.trim() || isSubmitting} className="absolute right-0 bottom-2 text-indigo-400 disabled:opacity-30">
                                        <Send size={18}/>
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-5">
                                {comments.map(c => (
                                    <div key={c.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden">
                                            {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{c.username?.[0] || '?'}</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-black text-white">@{c.username || 'Anónimo'}</span>
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-400 leading-snug">{c.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:w-80 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Siguiente Contenido</h3>
                        <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">SECUENCIA ACTIVA</span>
                    </div>
                    
                    <div className="space-y-4">
                        {relatedVideos.slice(0, visibleRelatedCount).map((v, idx) => (
                            <Link key={v.id} to={`/watch/${v.id}`} onClick={(e) => { e.preventDefault(); navigateToNext(v); }} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all">
                                <div className="w-32 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shrink-0">
                                    <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                                    {idx === 0 && (
                                        <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRightCircle size={32} className="text-white drop-shadow-xl"/>
                                        </div>
                                    )}
                                    {v.category === video?.category && (
                                        <div className="absolute top-1 right-1 bg-indigo-600 p-1 rounded-md shadow-lg border border-white/20">
                                            <CheckCircle2 size={10} className="text-white"/>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-1">
                                    <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-indigo-400">{v.title}</h4>
                                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName || 'Usuario'}</div>
                                    <div className="text-[8px] text-indigo-400 font-black uppercase mt-0.5 truncate">{v.category}</div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {relatedVideos.length > visibleRelatedCount && (
                        <button 
                            onClick={() => setVisibleRelatedCount(prev => prev + 15)}
                            className="w-full py-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            <PlusCircle size={14}/> Cargar más relacionados
                        </button>
                    )}
                </div>
            </div>

            {showShareModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2"><Share2 size={18} className="text-indigo-400"/> Compartir con Usuario</h3>
                            <button onClick={() => setShowShareModal(false)} className="text-slate-500 hover:text-white"><X/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                                <input 
                                    type="text" value={shareSearch} onChange={e => handleShareSearch(e.target.value)}
                                    placeholder="Buscar por nombre de usuario..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {shareSuggestions.map(s => (
                                    <button 
                                        key={s.username} 
                                        onClick={() => sendVideoToUser(s.username)}
                                        className="w-full p-3 flex items-center gap-4 hover:bg-indigo-600 rounded-2xl transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0">
                                            {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/20">{s.username?.[0] || '?'}</div>}
                                        </div>
                                        <span className="text-sm font-bold text-white group-hover:text-white">@{s.username}</span>
                                        <UserCheck size={16} className="ml-auto opacity-0 group-hover:opacity-100 text-white"/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}