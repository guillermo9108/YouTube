
import React, { useRef, useEffect, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { Loader2, CheckCircle2, Film, X } from 'lucide-react';

export default function GridProcessor() {
    const { activeTask, completeTask, skipTask } = useGrid();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'LOADING' | 'PROCESSING' | 'DONE' | 'ERROR'>('LOADING');
    const [progress, setProgress] = useState(0);

    // Reset state when task changes
    useEffect(() => {
        if (activeTask) {
            setStatus('LOADING');
            setProgress(0);
        }
    }, [activeTask]);

    // Handle Processing Logic
    useEffect(() => {
        const vid = videoRef.current;
        if (!activeTask || !vid) return;

        // Ensure we use the stream URL to avoid CORS issues
        let src = activeTask.videoUrl;
        const isLocal = Boolean(activeTask.isLocal) || (activeTask as any).isLocal === 1;
        if (isLocal && !src.includes('action=stream')) {
            src = `api/index.php?action=stream&id=${activeTask.id}`;
        }
        vid.src = src;
        vid.load();

        const handleCanPlay = () => {
            // Seek to a random point (between 10% and 30%) to avoid black frames at start
            if (status === 'LOADING') {
                const targetTime = Math.max(2, vid.duration * 0.15); // At least 2 seconds in
                vid.currentTime = targetTime;
                setStatus('PROCESSING');
            }
        };

        const handleSeeked = () => {
            if (status === 'PROCESSING') {
                captureAndSubmit();
            }
        };

        const handleError = () => {
            console.warn("GridProcessor: Error loading video", activeTask.title);
            setStatus('ERROR');
            setTimeout(skipTask, 1000);
        };

        vid.addEventListener('loadeddata', handleCanPlay);
        vid.addEventListener('seeked', handleSeeked);
        vid.addEventListener('error', handleError);

        return () => {
            vid.removeEventListener('loadeddata', handleCanPlay);
            vid.removeEventListener('seeked', handleSeeked);
            vid.removeEventListener('error', handleError);
            vid.removeAttribute('src'); // Cleanup
        };
    }, [activeTask, status]);

    const captureAndSubmit = async () => {
        const vid = videoRef.current;
        if (!vid) return;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        setStatus('DONE');
                        const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                        await completeTask(vid.duration, file);
                    } else {
                        // Failed to blob, submit just duration
                        await completeTask(vid.duration, null);
                    }
                }, 'image/jpeg', 0.7);
            }
        } catch (e) {
            // CORS error likely, submit duration only
            await completeTask(vid.duration, null);
        }
    };

    if (!activeTask) return null;

    return (
        <div className="fixed bottom-20 right-4 md:bottom-4 md:right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-72 flex flex-col">
                {/* Header */}
                <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {status === 'DONE' ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                            <Loader2 size={16} className="text-indigo-400 animate-spin" />
                        )}
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {status === 'DONE' ? 'Completado' : 'Analizando Contenido'}
                        </span>
                    </div>
                    {status !== 'DONE' && (
                        <button onClick={skipTask} className="text-slate-500 hover:text-white"><X size={14}/></button>
                    )}
                </div>

                {/* Content */}
                <div className="p-3 flex gap-3 items-center relative bg-slate-900/80 backdrop-blur-md">
                    {/* Mini Player */}
                    <div className="w-20 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-700 relative">
                        <video 
                            ref={videoRef}
                            className={`w-full h-full object-cover ${status === 'DONE' ? 'opacity-50' : 'opacity-100'}`}
                            muted
                            crossOrigin="anonymous"
                            playsInline
                        />
                        {status === 'DONE' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-emerald-400 drop-shadow-md"/>
                            </div>
                        )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate mb-1">
                            {activeTask.title}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            {status === 'LOADING' && 'Cargando stream...'}
                            {status === 'PROCESSING' && 'Generando vista previa...'}
                            {status === 'DONE' && '¡Video agregado a la librería!'}
                            {status === 'ERROR' && 'Error al procesar.'}
                        </div>
                    </div>
                </div>

                {/* Progress Bar (Fake but visual feedback) */}
                {status !== 'DONE' && (
                    <div className="h-1 bg-slate-800 w-full">
                        <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
