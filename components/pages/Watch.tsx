
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    SkipForward, ChevronRight, Home, Play, Info, ExternalLink, 
    AlertTriangle, Send, CheckCircle2, Bookmark, BookmarkPlus, 
    Share2, MoreHorizontal, Copy
} from 'lucide-react';
import VideoCard from '../VideoCard';
import { useToast } from '../../context/ToastContext';
import { useVideoPlayer } from '../../context/VideoPlayerContext';

export default function Watch() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const { activeVideo, isPlaying, currentTime, playVideo, togglePlay, updateTime } = useVideoPlayer();
    const navigate = useNavigate();
    const toast = useToast();
    
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [interaction, setInteraction] = useState<UserInteraction | null>(null);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    
    const [likes, setLikes] = useState(0);
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isWatchLater, setIsWatchLater] = useState(false);

    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [showOpenWith, setShowOpenWith] = useState(false);

    const isPurchasingRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const viewCountedRef = useRef(false);
    const watchedThresholdRef = useRef(false);

    useEffect(() => { 
        window.scrollTo(0, 0);
        refreshUser();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setPlaybackError(null);
        setCountdown(null);
        setShowComments(false);
        viewCountedRef.current = false;
        watchedThresholdRef.current = false;

        const fetchMeta = async () => {
            try {
                const v = await db.getVideo(id);
                if (v) {
                    setVideo(v);
                    setLikes(v.likes || 0);
                    db.getRelatedVideos(v.id).then(setRelatedVideos);
                    db.getComments(v.id).then(setComments);
                    
                    if (user) {
                        const [access, interact] = await Promise.all([
                            db.hasPurchased(user.id, v.id),
                            db.getInteraction(user.id, v.id)
                        ]);
                        const unlocked = access || user.role === 'ADMIN' || user.id === v.creatorId;
                        setIsUnlocked(unlocked);
                        setInteraction(interact);
                        setIsWatchLater(user.watchLater?.includes(id) || false);

                        // Si el video ya está en el global player, sincronizamos
                        if (unlocked && activeVideo?.id === v.id) {
                            if (videoRef.current) {
                                videoRef.current.currentTime = currentTime;
                                if (isPlaying) videoRef.current.play().catch(() => {});
                            }
                        } else if (unlocked) {
                            // Si es un video nuevo, lo cargamos en el global
                            playVideo(v, 0);
                        }
                    }
                }
            } catch (e) {} finally { setLoading(false); }
        };
        fetchMeta();
    }, [id, user?.id]);

    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const t = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(t);
        } else if (countdown === 0) {
            handleSkipNext();
        }
    }, [countdown]);

    // Sincronizar estado externo (MiniPlayer) -> Local
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid || !video || activeVideo?.id !== video.id) return;

        if (isPlaying) {
            vid.play().catch(() => {});
        } else {
            vid.pause();
        }
    }, [isPlaying, video?.id]);

    const handleSkipNext = () => {
        if (relatedVideos.length > 0) navigate(`/watch/${relatedVideos[0].id}`);
        else navigate('/');
    };

    const handlePurchase = async (skipConfirm = false) => {
        if (!user || !video || isPurchasingRef.current) return;
        if (Number(user.balance) < video.price) { 
            toast.error("Saldo insuficiente.");
            navigate('/vip'); return; 
        }
        if (skipConfirm || confirm(`¿Desbloquear por ${video.price} $?`)) {
            isPurchasingRef.current = true;
            try {
                await db.purchaseVideo(user.id, video.id);
                setIsUnlocked(true); refreshUser();
                toast.success("Contenido desbloqueado");
                // Al desbloquear, cargamos en el global player
                playVideo(video, 0);
            } catch (e: any) { toast.error(e.message); isPurchasingRef.current = false; }
        }
    };

    const handleToggleWatchLater = async () => {
        if (!user || !id) return;
        try {
            const newList = await db.toggleWatchLater(user.id, id);
            setIsWatchLater(newList.includes(id));
            toast.success(newList.includes(id) ? "Añadido a Ver más tarde" : "Quitado de Ver más tarde");
        } catch (e) {}
    };

    const handleOnPlay = () => {
        if (!viewCountedRef.current && video) {
            db.incrementViewCount(video.id).catch(() => {});
            viewCountedRef.current = true;
        }
        if (!isPlaying) togglePlay();
    };

    const handleOnPause = () => {
        if (isPlaying) togglePlay();
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (vid && user && video) {
            updateTime(vid.currentTime);
            
            if (!watchedThresholdRef.current) {
                // Se marca como visto al llegar al 80% o tras 1 minuto
                if (vid.currentTime > 60 || (vid.duration > 0 && vid.currentTime / vid.duration > 0.8)) {
                    db.markWatched(user.id, video.id).catch(() => {});
                    watchedThresholdRef.current = true;
                }
            }
        }
    };

    const handleRate = async (type: 'like' | 'dislike') => {
        if (!user || !video) return;
        try {
            const res = await db.rateVideo(user.id, video.id, type);
            setInteraction(res);
            if (res.newLikeCount !== undefined) setLikes(res.newLikeCount);
        } catch (e) {}
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !video || !newComment.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const comment = await db.addComment(user.id, video.id, newComment);
            setComments(prev => [comment, ...prev]);
            setNewComment('');
            toast.success("Comentario publicado");
        } catch (e) { toast.error("Error al comentar"); }
        finally { setIsSubmitting(false); }
    };

    const handleVideoError = () => {
        setPlaybackError("Formato no compatible");
        setCountdown(10);
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const base = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        return `${base}&token=${user?.sessionToken || ''}`;
    }, [video, user?.sessionToken]);

    const copyStreamLink = () => {
        const fullUrl = window.location.origin + '/' + streamUrl;
        navigator.clipboard.writeText(fullUrl);
        toast.info("Enlace copiado. Pégalo en VLC o MX Player.");
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black">
                    {isUnlocked ? (
                        <>
                            {playbackError ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 animate-in fade-in duration-500">
                                    <AlertTriangle size={48} className="text-amber-500 mb-4" />
                                    <h3 className="text-xl font-black text-white uppercase italic">{playbackError}</h3>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">
                                        Saltando automáticamente en <span className="text-white text-lg font-black">{countdown}s</span>
                                    </p>
                                    
                                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                                        <div className="relative">
                                            <button onClick={() => setShowOpenWith(!showOpenWith)} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 shadow-xl">
                                                <ExternalLink size={16}/> Abrir con...
                                            </button>
                                            {showOpenWith && (
                                                <div className="absolute bottom-full mb-2 left-0 w-48 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                                                    <button onClick={() => window.open(streamUrl, '_blank')} className="w-full p-3 text-left text-[10px] font-bold uppercase text-white hover:bg-indigo-600 flex items-center gap-2 border-b border-white/5"><Play size={12}/> Reproductor Navegador</button>
                                                    <button onClick={copyStreamLink} className="w-full p-3 text-left text-[10px] font-bold uppercase text-white hover:bg-indigo-600 flex items-center gap-2"><Copy size={12}/> Copiar Enlace Directo</button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleSkipNext} className="px-6 py-3 bg-slate-800 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2">
                                            <SkipForward size={16}/> Siguiente
                                        </button>
                                    </div>
                                    <button onClick={() => setCountdown(null)} className="mt-4 text-[9px] text-slate-600 uppercase font-black hover:text-slate-400">Detener conteo</button>
                                </div>
                            ) : (
                                <video 
                                    ref={videoRef}
                                    src={streamUrl} 
                                    controls autoPlay playsInline 
                                    className="w-full h-full object-contain" 
                                    onPlay={handleOnPlay}
                                    onPause={handleOnPause}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleSkipNext}
                                    onError={handleVideoError}
                                    crossOrigin="anonymous"
                                />
                            )}
                        </>
                    ) : (
                        <div onClick={() => handlePurchase(false)} className="absolute inset-0 cursor-pointer group overflow-hidden">
                            {video && <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-md opacity-40 scale-110 group-hover:scale-105 transition-transform duration-700"/>}
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-6">
                                <div className="p-5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full mb-4 group-hover:scale-110 transition-transform shadow-2xl">
                                    <Lock size={40} className="text-white"/>
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Contenido Premium</h2>
                                <div className="px-6 py-2 bg-amber-500 text-black font-black rounded-full text-lg shadow-xl active:scale-95 transition-all">
                                    DESBLOQUEAR POR {video?.price} $
                                </div>
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
                                    {video?.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500">{video?.creatorName[0]}</div>}
                                </Link>
                                <div>
                                    <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400 transition-colors">@{video?.creatorName}</Link>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{video?.views} vistas • {new Date(video!.createdAt * 1000).toLocaleDateString()}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-white/5">
                                <button 
                                    onClick={() => handleRate('like')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${interaction?.liked ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <Heart size={18} fill={interaction?.liked ? "currentColor" : "none"} />
                                    <span className="text-xs font-black">{likes}</span>
                                </button>
                                <button 
                                    onClick={() => handleRate('dislike')}
                                    className={`p-2 rounded-xl transition-all ${interaction?.disliked ? 'text-red-400 bg-red-400/10' : 'text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <ThumbsDown size={18} />
                                </button>
                                <div className="w-px h-6 bg-white/10 mx-1"></div>
                                <button 
                                    onClick={handleToggleWatchLater}
                                    className={`p-3 rounded-xl transition-all ${isWatchLater ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:bg-slate-800'}`}
                                    title="Ver más tarde"
                                >
                                    {isWatchLater ? <Bookmark size={18} fill="currentColor"/> : <BookmarkPlus size={18}/>}
                                </button>
                                <button 
                                    onClick={() => setShowComments(!showComments)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${showComments ? 'bg-white text-black' : 'text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <MessageCircle size={18} />
                                    <span className="text-xs font-black">{comments.length}</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 text-slate-300 text-sm leading-relaxed bg-slate-900/30 p-6 rounded-3xl border border-white/5">
                            {video?.description || "Sin descripción."}
                        </div>

                        {showComments && (
                            <div className="mt-10 space-y-6 animate-in slide-in-from-top-4">
                                <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                    <MessageCircle size={18} className="text-indigo-400"/> Comentarios ({comments.length})
                                </h3>

                                {user && (
                                    <form onSubmit={handleAddComment} className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden">
                                            {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{user.username[0]}</div>}
                                        </div>
                                        <div className="flex-1 flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                placeholder="Añadir un comentario..."
                                                className="flex-1 bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-sm text-white py-2 transition-colors"
                                            />
                                            <button disabled={!newComment.trim() || isSubmitting} type="submit" className="bg-indigo-600 p-2.5 rounded-full text-white hover:bg-indigo-500 disabled:opacity-30 transition-all active:scale-90">
                                                {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-6 pt-4">
                                    {comments.length === 0 ? (
                                        <div className="text-center py-10 text-slate-600 italic text-xs uppercase font-bold tracking-widest">Aún no hay comentarios</div>
                                    ) : comments.map(c => (
                                        <div key={c.id} className="flex gap-4 group">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden">
                                                {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{c.username[0]}</div>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-black text-white">@{c.username}</span>
                                                    <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-400 leading-snug">{c.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:w-80 space-y-6">
                    {relatedVideos.slice(0, 10).map(v => (
                        <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                            <div className="w-28 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shrink-0 shadow-lg">
                                <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                                <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-indigo-400 transition-colors">{v.title}</h4>
                                <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
