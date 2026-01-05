
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    SkipForward, ChevronRight, Home, Play, Info, ExternalLink, AlertTriangle, Send, CheckCircle2, Clock, Share2
} from 'lucide-react';
import VideoCard from '../VideoCard';
import { useToast } from '../../context/ToastContext';

export default function Watch() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [interaction, setInteraction] = useState<UserInteraction | null>(null);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    
    const [likes, setLikes] = useState(0);
    const [comments, setComments] = useState<Comment[]>([]);
    const [showComments, setShowComments] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inWatchLater, setInWatchLater] = useState(false);

    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    const isPurchasingRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const viewMarkedRef = useRef(false);
    const watchedMarkedRef = useRef(false);

    useEffect(() => { 
        window.scrollTo(0, 0); refreshUser(); 
        viewMarkedRef.current = false;
        watchedMarkedRef.current = false;
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true); setPlaybackError(null); setCountdown(null);
        
        const fetchMeta = async () => {
            try {
                const v = await db.getVideo(id);
                if (v) {
                    setVideo(v); setLikes(v.likes || 0);
                    db.getRelatedVideos(v.id).then(setRelatedVideos);
                    db.getComments(v.id).then(setComments);
                    if (user) {
                        const [access, interact] = await Promise.all([
                            db.hasPurchased(user.id, v.id), 
                            db.getInteraction(user.id, v.id)
                        ]);
                        setIsUnlocked(access || user.role === 'ADMIN' || user.id === v.creatorId);
                        setInteraction(interact);
                        setInWatchLater(user.watchLater?.includes(v.id) || false);
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
        }
        else if (countdown === 0) { handleSkipNext(); }
    }, [countdown]);

    const handleSkipNext = () => {
        if (relatedVideos.length > 0) navigate(`/watch/${relatedVideos[0].id}`);
        else navigate('/');
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
            const c = await db.addComment(user.id, video.id, newComment);
            setComments(prev => [c, ...prev]);
            setNewComment('');
        } catch (e) {} finally { setIsSubmitting(false); }
    };

    const handleToggleWatchLater = async () => {
        if (!user || !video) return;
        try {
            await db.toggleWatchLater(user.id, video.id);
            setInWatchLater(!inWatchLater);
            toast.success(!inWatchLater ? "Añadido a Ver más tarde" : "Eliminado de la lista");
            refreshUser();
        } catch (e) {}
    };

    const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!viewMarkedRef.current && vid.currentTime > 2) {
            viewMarkedRef.current = true;
            db.incrementView(video!.id);
        }
        const threshold = Math.min(vid.duration * 0.8, 60);
        if (!watchedMarkedRef.current && user && vid.currentTime > threshold) {
            watchedMarkedRef.current = true;
            db.markWatched(user.id, video!.id);
        }
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const base = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        return `${window.location.origin}/${base}&token=${localStorage.getItem('sp_session_token') || ''}`;
    }, [video]);

    const openWithSystemPlayer = async () => {
        if (!streamUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: video?.title, text: 'Abrir con reproductor externo:', url: streamUrl });
            } catch (e) { window.open(streamUrl, '_blank'); }
        } else {
            window.open(streamUrl, '_blank');
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black">
                    {isUnlocked ? (
                        playbackError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 animate-in fade-in">
                                <AlertTriangle size={48} className="text-amber-500 mb-4" />
                                <h3 className="text-xl font-black text-white uppercase italic">{playbackError}</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Saltando en <span className="text-white text-lg font-black">{countdown}s</span></p>
                                <div className="flex gap-3 mt-8">
                                    <button onClick={openWithSystemPlayer} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500"><ExternalLink size={16}/> Abrir Con...</button>
                                    <button onClick={handleSkipNext} className="px-6 py-3 bg-slate-800 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2"><SkipForward size={16}/> Saltar Ya</button>
                                </div>
                            </div>
                        ) : (
                            <video 
                                ref={videoRef} src={streamUrl} controls autoPlay playsInline className="w-full h-full object-contain" 
                                onEnded={handleSkipNext} onTimeUpdate={handleVideoTimeUpdate}
                                onError={() => { setPlaybackError("Formato Incompatible"); setCountdown(10); }}
                                onLoadedMetadata={(e) => { if (e.currentTarget.videoWidth === 0) { setPlaybackError("Codec No Soportado (Sólo Audio)"); setCountdown(10); } }}
                                crossOrigin="anonymous"
                            />
                        )
                    ) : (
                        <div onClick={() => navigate('/vip')} className="absolute inset-0 cursor-pointer group overflow-hidden">
                            {video && <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-md opacity-40 scale-110"/>}
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-6">
                                <div className="p-5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full mb-4 shadow-2xl"><Lock size={40} className="text-white"/></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Contenido Premium</h2>
                                <div className="px-6 py-2 bg-amber-500 text-black font-black rounded-full text-lg">DESBLOQUEAR POR {video?.price} $</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase italic mb-4">{video?.title}</h1>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
                            <div className="flex items-center gap-4">
                                <Link to={`/channel/${video?.creatorId}`} className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 overflow-hidden shadow-lg shrink-0">
                                    {video?.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500">{video?.creatorName[0]}</div>}
                                </Link>
                                <div>
                                    <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400">@{video?.creatorName}</Link>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{video?.views} vistas • {new Date(video!.createdAt * 1000).toLocaleDateString()}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex bg-slate-900 rounded-xl border border-white/5 overflow-hidden">
                                    <button onClick={() => handleRate('like')} className={`flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-all border-r border-white/5 ${interaction?.liked ? 'text-indigo-400' : 'text-slate-400'}`}>
                                        <Heart size={18} fill={interaction?.liked ? "currentColor" : "none"}/>
                                        <span className="text-xs font-bold">{likes}</span>
                                    </button>
                                    <button onClick={() => handleRate('dislike')} className={`px-4 py-2 hover:bg-white/5 transition-all ${interaction?.disliked ? 'text-red-400' : 'text-slate-400'}`}>
                                        <ThumbsDown size={18} fill={interaction?.disliked ? "currentColor" : "none"}/>
                                    </button>
                                </div>
                                <button onClick={handleToggleWatchLater} className={`p-2.5 rounded-xl border border-white/5 transition-all ${inWatchLater ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                                    <Clock size={18} fill={inWatchLater ? "currentColor" : "none"}/>
                                </button>
                                <button onClick={openWithSystemPlayer} className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white"><Share2 size={18}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="text-slate-300 text-sm leading-relaxed bg-slate-900/30 p-6 rounded-3xl border border-white/5">
                        {video?.description || "Sin descripción."}
                    </div>

                    {/* SECCIÓN DE COMENTARIOS */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            <MessageCircle size={20} className="text-indigo-400"/> Comentarios ({comments.length})
                        </h3>
                        
                        <form onSubmit={handleAddComment} className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0 overflow-hidden">
                                {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{user?.username[0]}</div>}
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
                                        {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{c.username[0]}</div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-black text-white">@{c.username}</span>
                                            <span className="text-[10px] text-slate-500 uppercase font-bold">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-snug">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:w-80 space-y-6">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Siguiente Contenido</h3>
                    {relatedVideos.slice(0, 10).map(v => (
                        <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all">
                            <div className="w-32 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shrink-0">
                                <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                                <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-indigo-400">{v.title}</h4>
                                <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
