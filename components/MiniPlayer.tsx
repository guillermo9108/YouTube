
import React, { useRef, useEffect } from 'react';
import { useVideoPlayer } from '../context/VideoPlayerContext';
import { useNavigate } from './Router';
import { X, Play, Pause, Maximize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MiniPlayer() {
    const { activeVideo, isPlaying, currentTime, isMinimized, togglePlay, closePlayer, updateTime } = useVideoPlayer();
    const navigate = useNavigate();
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid || !activeVideo) return;

        // Sincronizar tiempo al montar/cambiar
        if (Math.abs(vid.currentTime - currentTime) > 1) {
            vid.currentTime = currentTime;
        }

        if (isPlaying) {
            vid.play().catch(() => {});
        } else {
            vid.pause();
        }
    }, [isPlaying, activeVideo]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            updateTime(videoRef.current.currentTime);
        }
    };

    const handleBackToVideo = () => {
        if (activeVideo) {
            navigate(`/watch/${activeVideo.id}`);
        }
    };

    if (!activeVideo || !isMinimized) return null;

    const streamUrl = activeVideo.videoUrl.includes('action=stream') 
        ? activeVideo.videoUrl 
        : `api/index.php?action=stream&id=${activeVideo.id}&token=${user?.sessionToken || ''}`;

    return (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] w-64 md:w-80 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="relative w-full h-full group">
                <video 
                    ref={videoRef}
                    src={streamUrl}
                    className="w-full h-full object-cover cursor-pointer"
                    onTimeUpdate={handleTimeUpdate}
                    onClick={handleBackToVideo}
                    playsInline
                    muted={false}
                    crossOrigin="anonymous"
                />
                
                {/* Overlay de controles al pasar el mouse/touch */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all">
                        {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}
                    </button>
                    <button onClick={handleBackToVideo} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all">
                        <Maximize2 size={20} />
                    </button>
                </div>

                {/* Botón Cerrar siempre visible */}
                <button 
                    onClick={(e) => { e.stopPropagation(); closePlayer(); }} 
                    className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors z-10"
                >
                    <X size={14} />
                </button>

                {/* Título mini */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{activeVideo.title}</p>
                </div>
            </div>
        </div>
    );
}
