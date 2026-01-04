
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
    const { activeVideo, isPlaying, currentTime, playVideo, setPlaying, updateTime } = useVideoPlayer();
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

    // 1. Cargar metadatos y verificar acceso
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
                        const isVipActive = user.vipExpiry && user.vipExpiry > (Date.now() / 1000);
                        const isAdmin = user.role?.toUpperCase() === 'ADMIN';
                        const isOwner = user.id === v.creatorId;

                        // Verificación local inmediata de privilegios
                        if (isAdmin || isOwner || isVipActive) {
                            setIsUnlocked(true);
                            setIsWatchLater(user.watchLater?.includes(id) || false);
                            // Sincronizar con el reproductor global
                            playVideo(v, activeVideo?.id === v.id ? currentTime : 0);
                        } else {
                            // Si no tiene privilegios, consultar si lo compró
                            const hasPurchased = await db.hasPurchased(user.id, v.id);
                            setIsUnlocked(hasPurchased);
                            setIsWatchLater(user.watchLater?.includes(id) || false);
                            if (hasPurchased) {
                                playVideo(v, activeVideo?.id === v.id ? currentTime : 0);
                            }
                        }
                    }
                }
            } catch (e) {} finally { setLoading(false); }
        };
        fetchMeta();
    }, [id, user?.id]);

    // 2. Control manual de reproducción (Forzar Play al cargar fuente)
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid || !isUnlocked || !video) return;

        if (isPlaying) {
            const playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay prevenido por el navegador
                    setPlaying(false);
                });
            }
        } else {
            vid.pause();
        }
    }, [isPlaying, isUnlocked, video?.id]);

    // 3. Manejo de transición (Siguiente Video)
    const handleSkipNext = () => {
        if (relatedVideos.length > 0) {
            navigate(`/watch/${relatedVideos[0].id}`);
        } else {
            navigate('/');
        }
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
                playVideo(video, 0);
            } catch (e: any) { toast.error(e.message); isPurchasingRef.current = false; }
        }
    };

    const handleOnPlay = () => {
        if (!viewCountedRef.current && video) {
            db.incrementViewCount(video.id).catch(() => {});
            viewCountedRef.current = true;
        }
        setPlaying(true);
    };

    const handleOnPause = () => {
        setPlaying(false);
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (vid && user && video) {
            updateTime(vid.currentTime);
            
            if (!watchedThresholdRef.current) {
                // Registro de "visto" al superar 80% o 1 min
                if (vid.currentTime > 60 || (vid.duration > 0 && vid.currentTime / vid.duration > 0.8)) {
                    db.markWatched(user.id, video.id).catch(() => {});
                    watchedThresholdRef.current = true;
                }
            }
        }
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
        toast.info("Enlace copiado.");
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
                                        Saltando en <span className="text-white text-lg font-black">{countdown}s</span>
                                    </p>
                                    
                                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                                        <div className="relative">
                                            <button onClick={() => setShowOpenWith(!showOpenWith)} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 shadow-xl">
                                                <ExternalLink size={16}/> Abrir con...
                                            </button>
                                            {showOpenWith && (
                                                <div className="absolute bottom-full mb-2 left-0 w-48 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                                                    <button onClick={() => window.open(streamUrl, '_blank')} className="w-full p-3 text-left text-[10px] font-bold uppercase text-white hover:bg-indigo-600 flex items-center gap-2 border-b border-white/5"><Play size={12}/> Navegador</button>
                                                    <button onClick={copyStreamLink} className="w-full p-3 text-left text-[10px] font-bold uppercase text-white hover:bg-indigo-600 flex items-center gap-2"><Copy size={12}/> Copiar Enlace</button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleSkipNext} className="px-6 py-3 bg-slate-800 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2">
                                            <SkipForward size={16}/> Siguiente
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <video 
                                    ref={videoRef}
                                    src={streamUrl} 
                                    controls playsInline 
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
                        </div>
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
