
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    Download, SkipForward, ChevronRight, Home, Play, Zap, Info, ExternalLink, AlertTriangle
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
    
    // Estados de Error de Reproducción
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [isAudioOnly, setIsAudioOnly] = useState(false);

    const isPurchasingRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { window.scrollTo(0, 0); }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setPlaybackError(null);
        setIsAudioOnly(false);

        const fetchMeta = async () => {
            try {
                const v = await db.getVideo(id);
                if (v) {
                    setVideo(v);
                    db.getRelatedVideos(v.id).then(setRelatedVideos);
                    if (user) {
                        const [access, interact] = await Promise.all([
                            db.hasPurchased(user.id, v.id),
                            db.getInteraction(user.id, v.id)
                        ]);
                        setIsUnlocked(access || user.role === 'ADMIN' || user.id === v.creatorId);
                        setInteraction(interact);
                    }
                }
            } catch (e) {} finally { setLoading(false); }
        };
        fetchMeta();
    }, [id, user?.id]);

    const handlePurchase = async (skipConfirm = false) => {
        if (!user || !video || isPurchasingRef.current) return;
        if (Number(user.balance) < video.price) { navigate('/vip'); return; }
        if (skipConfirm || confirm(`¿Desbloquear contenido por ${video.price} $?`)) {
            isPurchasingRef.current = true;
            try {
                await db.purchaseVideo(user.id, video.id);
                setIsUnlocked(true);
                refreshUser();
                toast.success("Contenido desbloqueado");
            } catch (e: any) { toast.error(e.message); isPurchasingRef.current = false; }
        }
    };

    const handleVideoEnded = () => {
        if (!user || !video) return;
        db.markWatched(user.id, video.id).catch(() => {});
        
        if (relatedVideos.length > 0) {
            const next = relatedVideos[0];
            toast.info(`Siguiente: ${next.title} en 3s...`);
            setTimeout(() => navigate(`/watch/${next.id}`), 3000);
        }
    };

    // Detección de incompatibilidad (Codec no soportado)
    const handleVideoError = () => {
        const error = videoRef.current?.error;
        if (error) {
            console.warn("Video Error Code:", error.code);
            setPlaybackError("El navegador no puede reproducir este formato de video.");
        }
    };

    // Detección de incompatibilidad visual (Se oye pero no se ve - HEVC/H265 sin soporte nativo)
    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (vid && vid.videoWidth === 0 && vid.duration > 0) {
            setIsAudioOnly(true);
            setPlaybackError("Detectado como Audio. El video requiere un reproductor externo.");
        }
    };

    const streamUrl = useMemo(() => {
        if (!video) return '';
        const base = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        // Inyectamos token para que aplicaciones externas puedan autenticar
        return `${base}&token=${user?.sessionToken || ''}`;
    }, [video, user?.sessionToken]);

    const openExternalPlayer = (method: 'DIRECT' | 'VLC' | 'MX') => {
        if (!streamUrl) return;
        
        // Protocolos específicos
        if (method === 'VLC') {
            window.location.href = `vlc://${window.location.origin}/${streamUrl}`;
        } else if (method === 'MX') {
            window.location.href = `intent:${window.location.origin}/${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(video?.title || '')};end`;
        } else {
            // Abrir link directo (el sistema preguntará qué app usar)
            window.open(streamUrl, '_blank');
        }
        toast.info("Intentando abrir reproductor externo...");
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    const nextVideo = relatedVideos[0];

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto bg-black">
                    {isUnlocked ? (
                        <>
                            {playbackError ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900">
                                    <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                        <AlertTriangle size={40} className="text-amber-500" />
                                    </div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Incompatibilidad de Formato</h3>
                                    <p className="text-slate-400 text-xs mb-8 max-w-md leading-relaxed uppercase font-bold tracking-widest opacity-60">
                                        {playbackError} <br/> (Codec HEVC/H.265 o MKV detectado)
                                    </p>
                                    
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button onClick={() => openExternalPlayer('DIRECT')} className="px-6 py-3 bg-white text-black font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95">
                                            <ExternalLink size={16}/> Abrir en VLC / MX
                                        </button>
                                        <a href={streamUrl} download={`${video?.title}.mp4`} className="px-6 py-3 bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all active:scale-95">
                                            <Download size={16}/> Descargar Archivo
                                        </a>
                                    </div>
                                    <button onClick={() => setPlaybackError(null)} className="mt-6 text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase underline">Intentar reproducir aquí de nuevo</button>
                                </div>
                            ) : (
                                <video 
                                    ref={videoRef}
                                    src={streamUrl} 
                                    controls autoPlay playsInline 
                                    className="w-full h-full object-contain" 
                                    onEnded={handleVideoEnded}
                                    onError={handleVideoError}
                                    onLoadedMetadata={handleLoadedMetadata}
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
                                <div className="px-6 py-2 bg-amber-500 text-black font-black rounded-full text-lg shadow-xl shadow-amber-900/20 active:scale-95 transition-all">
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
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                           <Home size={12}/> <ChevronRight size={10}/> {video?.category} {video?.collection && <> <ChevronRight size={10}/> {video.collection}</>}
                        </div>
                        <div className="flex justify-between items-start gap-4">
                            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase italic">{video?.title}</h1>
                            {isUnlocked && (
                                <button onClick={() => openExternalPlayer('DIRECT')} className="shrink-0 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-indigo-400 hover:text-white transition-colors" title="Abrir en App Externa">
                                    <ExternalLink size={20}/>
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 border-y border-white/5 py-4">
                            <div className="flex items-center gap-4">
                                <Link to={`/channel/${video?.creatorId}`} className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 overflow-hidden shadow-lg">
                                    {video?.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500">{video?.creatorName[0]}</div>}
                                </Link>
                                <div>
                                    <Link to={`/channel/${video?.creatorId}`} className="font-black text-white hover:text-indigo-400 transition-colors">@{video?.creatorName}</Link>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{video?.views} vistas • {new Date(video!.createdAt * 1000).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 text-slate-300 text-sm leading-relaxed bg-slate-900/30 p-6 rounded-3xl border border-white/5">
                            {video?.description || "Sin descripción."}
                        </div>
                    </div>
                </div>

                <div className="lg:w-80 space-y-6">
                    {nextVideo && (
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-5 shadow-inner">
                            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <Zap size={14} className="fill-indigo-400"/> Próximo en Reproducción
                            </h3>
                            <Link to={`/watch/${nextVideo.id}`} className="group block space-y-3">
                                <div className="aspect-video rounded-2xl overflow-hidden relative border border-white/10 shadow-xl">
                                    <img src={nextVideo.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Play size={40} className="text-white fill-white"/>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white leading-tight uppercase italic line-clamp-2 group-hover:text-indigo-400 transition-colors">{nextVideo.title}</h4>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Siguiente Episodio</p>
                                </div>
                            </Link>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="font-black text-white text-xs uppercase tracking-[0.1em] flex items-center gap-2 opacity-50 px-2">
                            Más contenido relacionado
                        </h3>
                        <div className="flex flex-col gap-4">
                            {relatedVideos.slice(nextVideo ? 1 : 0).map(v => (
                                <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                                    <div className="w-28 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shrink-0 shadow-lg">
                                        <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <h4 className="text-xs font-black text-white line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-indigo-400 transition-colors">{v.title}</h4>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">@{v.creatorName}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
