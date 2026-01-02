
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Video, Comment, UserInteraction } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from '../Router';
import { 
    Loader2, Heart, ThumbsDown, MessageCircle, Lock, 
    Download, SkipForward, ChevronRight, Home, Play
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
    const isPurchasingRef = useRef(false);

    useEffect(() => { window.scrollTo(0, 0); }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
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
        
        // Si hay un siguiente video en la colección, saltar automáticamente
        if (relatedVideos.length > 0) {
            const next = relatedVideos[0];
            toast.info(`Siguiente episodio: ${next.title} en 3s...`);
            setTimeout(() => navigate(`/watch/${next.id}`), 3000);
        }
    };

    const videoSrc = video ? (video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`) : '';

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

    return (
        <div className="flex flex-col bg-slate-950 min-h-screen animate-in fade-in">
            <div className="w-full bg-black sticky top-0 md:top-[74px] z-40 shadow-2xl border-b border-white/5">
                <div className="relative aspect-video max-w-[1600px] mx-auto">
                    {isUnlocked ? (
                        <video 
                            src={videoSrc} controls autoPlay playsInline 
                            className="w-full h-full object-contain" 
                            onEnded={handleVideoEnded}
                            crossOrigin="anonymous"
                        />
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
                        <h1 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase italic">{video?.title}</h1>
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

                <div className="lg:w-80 space-y-4">
                    <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                        <SkipForward size={16} className="text-indigo-400"/> {video?.collection ? 'Próximos en esta Serie' : 'Sugeridos para ti'}
                    </h3>
                    <div className="flex flex-col gap-4">
                        {relatedVideos.map(v => (
                            <Link key={v.id} to={`/watch/${v.id}`} className="group flex gap-3 p-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                                <div className="w-32 aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5 shadow-lg">
                                    <img src={v.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                                    {v.collection && (
                                        <div className="absolute top-1 left-1 bg-indigo-600/90 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">COLECCIÓN</div>
                                    )}
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
    );
}
