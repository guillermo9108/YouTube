import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction, Category } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    ChevronRight, Home, Play, Info, ExternalLink, AlertTriangle, Send, CheckCircle2, Clock, Share2, X, Search, UserCheck, PlusCircle, ArrowRightCircle, Wallet, ShoppingCart, Music, ChevronDown
} from 'lucide-react';
import VideoCard from '../VideoCard';
import { useToast } from '../../context/ToastContext';
import { useGrid } from '../../context/GridContext';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export default function Watch() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const { setThrottled } = useGrid();
    const navigate = useNavigate();
    const toast = useToast();
    
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [interaction, setInteraction] = useState<UserInteraction | null>(null);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    const [visibleRelated, setVisibleRelated] = useState(12);
    
    const [likes, setLikes] = useState<number>(0);
    const [dislikes, setDislikes] = useState<number>(0);
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(false); 
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const viewMarkedRef = useRef(false);

    useEffect(() => { 
        window.scrollTo(0, 0); 
        refreshUser(); 
        viewMarkedRef.current = false;
        setThrottled(true);
        setVisibleRelated(12);
        return () => { setThrottled(false); };
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const [v, settings, all] = await Promise.all([
                    db.getVideo(id),
                    db.getSystemSettings(),
                    db.getAllVideos()
                ]);

                if (v) {
                    setVideo(v); 
                    setLikes(Number(v.likes || 0));
                    setDislikes(Number(v.dislikes || 0));

                    const currentPath = ((v as any).rawPath || v.videoUrl || '').split(/[\\/]/).slice(0, -1).join('/');
                    
                    const siblings = all.filter(ov => {
                        if (ov.id === v.id) return false;
                        const ovPath = ((ov as any).rawPath || ov.videoUrl || '').split(/[\\/]/).slice(0, -1).join('/');
                        return ovPath === currentPath;
                    }).sort((a, b) => naturalCollator.compare(a.title, b.title));

                    const otherVideos = all.filter(ov => {
                        if (ov.id === v.id) return false;
                        const ovPath = ((ov as any).rawPath || ov.videoUrl || '').split(/[\\/]/).slice(0, -1).join('/');
                        return ovPath !== currentPath;
                    }).sort(() => Math.random() - 0.5);

                    setRelatedVideos([...siblings, ...otherVideos]);
                    db.getComments(v.id).then(setComments);

                    if (user) {
                        const access = await db.hasPurchased(user.id, v.id);
                        const interact = await db.getInteraction(user.id, v.id);
                        const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
                        const isVipActive = !!(user.vipExpiry && user.vipExpiry > Date.now() / 1000);
                        setIsUnlocked(Boolean(access || isAdmin || (isVipActive && v.creatorRole === 'ADMIN') || user.id === v.creatorId));
                        setInteraction(interact);
                    }
                }
            } catch (e) {} finally { setLoading(false); }
        };
        fetchData();
    }, [id, user?.id]);

    const handlePurchase = async () => {
        if (!user || !video || isPurchasing) return;
        if (Number(user.balance) < Number(video.price)) { toast.error("Saldo insuficiente"); navigate('/vip'); return; }
        setIsPurchasing(true);
        try {
            await db.purchaseVideo(user.id, video.id);
            setIsUnlocked(true); toast.success("¡Desbloqueado!"); refreshUser();
        } catch (e: any) { toast.error(e.message); } finally { setIsPurchasing(false); }
    };

    const handleVideoEnded = async () => {
        if (!relatedVideos.length || !user) return;
        const nextVid = relatedVideos[0];
        if (!nextVid) return;

        const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
        const isVip = !!(user.vipExpiry && user.vipExpiry > Date.now() / 1000);
        const hasAccess = isAdmin || (isVip && nextVid.creatorRole === 'ADMIN') || user.id === nextVid.creatorId;

        if (hasAccess) { navigate(`/watch/${nextVid.id}`); return; }
        
        const purchased = await db.hasPurchased(user.id, nextVid.id);
        if (purchased) { navigate(`/watch/${nextVid.id}`); return; }

        if (Number(nextVid.price) <= Number(user.autoPurchaseLimit) && Number(user.balance) >= Number(nextVid.price)) {
            try {
                await db.purchaseVideo(user.id, nextVid.id);
                refreshUser(); navigate(`/watch/${nextVid.id}`);
            } catch (e) { navigate(`/watch/${nextVid.id}`); }
        } else {
            navigate(`/watch/${nextVid.id}`); 
        }
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const token = localStorage.getItem('sp_session_token') || '';
        return `api/index.php?action=stream&id=${video.id}&token=${token}&cb=${Date.now()}`;
    }, [video?.id]);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black overflow-hidden">
                    {isUnlocked ? (
                        <div className={`relative z-10 w-full h-full flex flex-col items-center justify-center ${video?.is_audio ? 'bg-slate-900/40 backdrop-blur-md' : ''}`}>
                            {video?.is_audio && video?.thumbnailUrl && !video.thumbnailUrl.includes('default.jpg') && (
                                <img src={video.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110" />
                            )}
                            <video ref={videoRef} src={streamUrl} controls autoPlay poster={video?.thumbnailUrl} className="w-full h-full object-contain" onEnded={handleVideoEnded} crossOrigin="anonymous" onPlay={() => setThrottled(true)} onPause={() => setThrottled(false)} />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                            {video && <img src={video.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110"/>}
                            <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-[48px] shadow-2xl flex flex-col items-center text-center max-w-md animate-in zoom-in-95">
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
                    <h1 className="text-2xl font-black text-white mb-4 uppercase italic tracking-tighter">{video?.title}</h1>
                    <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
                        <Link to={`/channel/${video?.creatorId}`} className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden"><img src={video?.creatorAvatarUrl} className="w-full h-full object-cover"/></Link>
                        <div>
                            <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400">@{video?.creatorName}</Link>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">{video?.views} vistas • {new Date(video!.createdAt * 1000).toLocaleDateString()}</div>
                        </div>
                    </div>
                    {video?.description && <div className="bg-white/5 p-5 rounded-3xl border border-white/5 text-sm text-slate-300 whitespace-pre-wrap">{video.description}</div>}
                </div>

                <div className="lg:w-80 space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Explorador: Recomendados</h3>
                    <div className="space-y-4">
                        {relatedVideos.slice(0, visibleRelated).map((v, idx) => (
                            <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all">
                                <div className="w-28 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shrink-0">
                                    <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                                    {idx === 0 && <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center"><Play size={20} className="text-white"/></div>}
                                </div>
                                <div className="flex-1 min-w-0 py-1">
                                    <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase leading-tight group-hover:text-indigo-400">{v.title}</h4>
                                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName}</div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {relatedVideos.length > visibleRelated && (
                        <button 
                            onClick={() => setVisibleRelated(prev => prev + 12)}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl border border-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            <ChevronDown size={14}/> Cargar más
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}