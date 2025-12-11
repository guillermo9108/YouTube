
import React, { useEffect, useState, useRef } from 'react';
import { Video, Comment, UserInteraction } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { Loader2, CheckCircle2, Heart, ThumbsDown, MessageCircle, Share2, Lock, Play, ArrowLeft, Send, ExternalLink, MonitorPlay, Crown } from 'lucide-react';
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
    const [comments, setComments] = useState<Comment[]>([]);
    
    // Related Videos State
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    const [loadingRelated, setLoadingRelated] = useState(false);
    
    // Comment Form
    const [newComment, setNewComment] = useState('');

    // Scroll to top on load
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    // Load Video Metadata (Only runs on ID change)
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setVideo(null); // Reset to prevent stale state
        setIsUnlocked(false); // Reset lock state
        setRelatedVideos([]); // Reset related
        setLoadingRelated(true); // Start loading related

        const fetchMeta = async () => {
            try {
                const v = await db.getVideo(id);
                if (v) {
                    setVideo(v);
                    
                    // Load related
                    db.getRelatedVideos(v.id)
                      .then((res: Video[]) => setRelatedVideos(res))
                      .catch(err => console.error("Related error", err))
                      .finally(() => setLoadingRelated(false));

                    // Load comments
                    db.getComments(v.id).then(setComments).catch(() => {});
                } else {
                    toast.error("Video no encontrado");
                    setLoadingRelated(false);
                }
            } catch (e: any) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchMeta();
    }, [id]);

    // Check Permissions & User Interaction (Runs on ID or User ID Change)
    useEffect(() => {
        if (!id || !user || !video) return;

        const checkAccess = async () => {
            // Permissions
            if (user.role === 'ADMIN' || user.id === video.creatorId) {
                setIsUnlocked(true);
            } else {
                try {
                    // Check if already unlocked locally to prevent flicker
                    if (!isUnlocked) {
                        const purchased = await db.hasPurchased(user.id, video.id);
                        if (purchased) setIsUnlocked(true);
                    }
                } catch (e) {}
            }

            // Interactions
            db.getInteraction(user.id, video.id).then(setInteraction).catch(() => {});
        };

        checkAccess();
    }, [id, user?.id, video?.id]); 

    const handlePurchase = async () => {
        if (!user || !video) return;
        if (user.balance < video.price) {
            // Show VIP Upsell instead of just error
            return;
        }

        try {
            await db.purchaseVideo(user.id, video.id);
            // Optimistic Update
            setIsUnlocked(true);
            refreshUser(); // Update balance in background
            toast.success("Video desbloqueado");
        } catch (e: any) {
            toast.error("Error al comprar: " + e.message);
        }
    };

    const handleRate = async (type: 'like' | 'dislike') => {
        if (!user || !video) return;
        try {
            const res = await db.rateVideo(user.id, video.id, type);
            setInteraction(res);
        } catch (e) {}
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !video || !newComment.trim()) return;
        try {
            const c = await db.addComment(user.id, video.id, newComment);
            setComments(prev => [c, ...prev]);
            setNewComment('');
        } catch(e) { toast.error("Error posting comment"); }
    };

    // --- CRITICAL PATH FIX ---
    // Ensure local videos use the stream API, not raw filesystem paths.
    // Handles cases where backend might send raw path or cache is stale.
    const getVideoSrc = (v: Video | null) => {
        if (!v) return '';
        const isLocal = Boolean(v.isLocal) || (v as any).isLocal === 1 || (v as any).isLocal === "1";
        if (isLocal && v.videoUrl && !v.videoUrl.includes('action=stream')) {
            return `api/index.php?action=stream&id=${v.id}`;
        }
        return v.videoUrl;
    };

    // --- EXTERNAL PLAYER HELPERS ---
    const openExternal = (type: 'vlc' | 'intent') => {
        if (!video) return;
        const relativeSrc = getVideoSrc(video);
        // Convert relative API URL to Absolute URL for external apps
        const absoluteUrl = new URL(relativeSrc, window.location.href).href;
        
        if (type === 'vlc') {
            window.location.href = `vlc://${absoluteUrl}`;
        } else {
            // Android Intent to open video/*
            const intent = `intent:${absoluteUrl}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
            window.location.href = intent;
        }
    };

    const videoSrc = getVideoSrc(video);

    return (
        <div className="flex flex-col animate-in fade-in min-h-screen bg-slate-950">
            
            {/* 
                FULL WIDTH PLAYER 
                - sticky top-0: Only for PORTRAIT (Vertical) and DESKTOP
                - landscape:relative: Scrolls with page on mobile landscape to allow reading comments
            */}
            <div className="w-full bg-black z-40 shadow-2xl border-b border-slate-800 transition-all duration-300 portrait:sticky portrait:top-0 landscape:relative md:sticky md:top-[74px]">
                <div className={`relative w-full mx-auto max-w-[2000px] ${isUnlocked ? 'aspect-video' : 'aspect-video md:aspect-[21/9] lg:aspect-video'}`}>
                    {isUnlocked && video ? (
                        <>
                            <video 
                                src={videoSrc} 
                                poster={video.thumbnailUrl} 
                                controls 
                                autoPlay 
                                playsInline
                                className="w-full h-full object-contain bg-black"
                                crossOrigin="anonymous"
                                onEnded={() => {
                                    if(user && !interaction?.isWatched) {
                                        db.markWatched(user.id, video.id).catch(() => {});
                                        setInteraction(prev => prev ? {...prev, isWatched: true} : null);
                                    }
                                }}
                            />
                            {/* External Player Prompt (Subtle) */}
                            <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                                <button 
                                    onClick={() => openExternal('intent')} 
                                    className="bg-black/60 text-white p-2 rounded-full backdrop-blur-md hover:bg-indigo-600 border border-white/20"
                                    title="Abrir en reproductor externo"
                                >
                                    <ExternalLink size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0">
                                {video && (
                                    <img 
                                        src={video.thumbnailUrl} 
                                        className="w-full h-full object-cover blur-md scale-110 opacity-50"
                                        alt="Locked Content"
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/60"></div>
                            </div>
                            
                            {/* Compact Lock Card */}
                            {video && (
                                <div className="relative z-20 bg-slate-900/90 backdrop-blur-md p-6 md:p-8 rounded-2xl border border-slate-700 text-center max-w-sm mx-4 shadow-2xl flex flex-col items-center">
                                    <Lock className="mb-3 text-amber-400" size={40}/>
                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Contenido Premium</h2>
                                    <p className="text-slate-400 mb-4 text-xs md:text-sm">Este video requiere acceso para visualizarlo.</p>
                                    <div className="text-3xl md:text-4xl font-black text-amber-400 mb-6">{video.price} $</div>
                                    
                                    {user && user.balance < video.price ? (
                                        <div className="w-full space-y-2">
                                            <div className="bg-red-900/20 border border-red-500/30 text-red-300 text-xs py-2 px-3 rounded-lg mb-2">
                                                Saldo insuficiente ({user.balance.toFixed(2)} $)
                                            </div>
                                            <button 
                                                onClick={() => navigate('/vip')} 
                                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold py-3 rounded-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm"
                                            >
                                                <Crown size={16}/> Obtener VIP / Recargar
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={handlePurchase} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm md:text-base">
                                            Desbloquear Ahora
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Troubleshooting Bar for Codec Issues */}
            {isUnlocked && (
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs md:text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                        <AlertCircle className="text-amber-500" size={14} /> 
                        ¿Problemas de audio/video?
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => openExternal('intent')} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                            <MonitorPlay size={14} /> <span className="font-bold">App Externa</span>
                        </button>
                        <button onClick={() => openExternal('vlc')} className="hidden md:flex items-center gap-1 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 px-3 py-1.5 rounded-lg border border-orange-600/30 transition-colors">
                            <ExternalLink size={14} /> <span className="font-bold">VLC</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area (Constrained Width) */}
            <div className="w-full max-w-7xl mx-auto p-4 lg:px-8 flex flex-col lg:flex-row gap-6 mt-4">
                
                {/* Info & Comments */}
                <div className="flex-1 min-w-0">
                    {/* Info */}
                    {video && (
                        <div className="mb-6">
                            <h1 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight">{video.title}</h1>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                                <div className="flex items-center gap-3">
                                    <Link to={`/channel/${video.creatorId}`}>
                                        <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                                            {video.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{video.creatorName[0]}</div>}
                                        </div>
                                    </Link>
                                    <div>
                                        <Link to={`/channel/${video.creatorId}`} className="font-bold text-white hover:underline block">{video.creatorName}</Link>
                                        <div className="text-xs text-slate-500">{new Date(video.createdAt * 1000).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                                    <button onClick={() => handleRate('like')} className={`flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors ${interaction?.liked ? 'text-indigo-400 border-indigo-500/50' : 'text-slate-400'}`}>
                                        <Heart size={18} fill={interaction?.liked ? "currentColor" : "none"}/>
                                        <span className="text-sm font-bold">{video.likes}</span>
                                    </button>
                                    <button onClick={() => handleRate('dislike')} className={`px-4 py-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors ${interaction?.disliked ? 'text-red-400 border-red-500/50' : 'text-slate-400'}`}>
                                        <ThumbsDown size={18} fill={interaction?.disliked ? "currentColor" : "none"}/>
                                    </button>
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors text-slate-400">
                                        <Share2 size={18}/> <span className="hidden md:inline text-sm font-bold">Compartir</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900/50 rounded-xl p-4 mt-4 text-sm text-slate-300 whitespace-pre-wrap">
                                {video.description || "Sin descripción."}
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    <div className="mb-8">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><MessageCircle size={18}/> Comentarios ({comments.length})</h3>
                        
                        {user && (
                            <form onSubmit={handlePostComment} className="flex gap-3 mb-6">
                                <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600">
                                    {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : null}
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        value={newComment} 
                                        onChange={e => setNewComment(e.target.value)} 
                                        className="w-full bg-transparent border-b border-slate-700 text-white pb-2 focus:border-indigo-500 outline-none transition-colors placeholder-slate-600"
                                        placeholder="Añade un comentario..."
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button disabled={!newComment.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-colors">Comentar</button>
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="space-y-4">
                            {comments.map((c: Comment) => (
                                <div key={c.id} className="flex gap-3 animate-in fade-in">
                                    <Link to={`/channel/${c.userId}`} className="w-8 h-8 rounded-full bg-slate-800 shrink-0 overflow-hidden border border-slate-700">
                                        {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-500">{c.username[0]}</div>}
                                    </Link>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <Link to={`/channel/${c.userId}`} className="text-xs font-bold text-white hover:underline">{c.username}</Link>
                                            <span className="text-[10px] text-slate-600">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-300 mt-0.5">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Related */}
                <div className="w-full lg:w-80 shrink-0">
                    <h3 className="font-bold text-white mb-4">A continuación</h3>
                    <div className="flex flex-col gap-3">
                        {loadingRelated ? (
                            <div className="text-center py-10 flex flex-col items-center">
                                <Loader2 className="animate-spin text-indigo-500 mb-2" />
                                <span className="text-slate-500 text-sm italic">Buscando sugerencias...</span>
                            </div>
                        ) : relatedVideos.length > 0 ? (
                            relatedVideos.map((v: Video) => (
                                <VideoCard key={v.id} video={v} isUnlocked={false} isWatched={false} />
                            ))
                        ) : (
                            <div className="text-slate-500 text-sm text-center py-10 italic border border-slate-800 rounded-xl bg-slate-900/50">
                                No hay videos relacionados.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
// Helper import needed for new icon
import { AlertCircle } from 'lucide-react';
