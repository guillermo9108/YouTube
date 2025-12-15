
import React, { useRef, useEffect, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { Loader2, Check, X, Sparkles } from 'lucide-react';

export default function GridProcessor() {
    const { activeTask, completeTask, skipTask } = useGrid();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'INIT' | 'CAPTURING' | 'DONE' | 'ERROR'>('INIT');
    const processedRef = useRef(false);

    // Reset state when task changes
    useEffect(() => {
        if (activeTask) {
            setStatus('INIT');
            processedRef.current = false;
        }
    }, [activeTask]);

    // --- STEP 2 LOGIC (Robust Streaming & Capture) ---
    useEffect(() => {
        const vid = videoRef.current;
        if (!activeTask || !vid) return;

        // 1. URL Transformation (Critical for Local Files)
        let streamSrc = activeTask.videoUrl;
        const isLocal = Boolean(activeTask.isLocal) || (activeTask as any).isLocal === 1 || (activeTask as any).isLocal === "1";
        if (isLocal && !streamSrc.includes('action=stream')) {
            streamSrc = `api/index.php?action=stream&id=${activeTask.id}`;
        }

        // 2. Setup Video
        vid.src = streamSrc;
        vid.currentTime = 0;
        vid.muted = true; // Required for autoplay
        
        // 3. Attempt Play
        const startPlay = async () => {
            try {
                await vid.play();
                setStatus('CAPTURING');
            } catch (e) {
                console.warn("Autoplay blocked, waiting for interaction or retry", e);
                // Even if blocked, sometimes loading metadata is enough for a black frame, 
                // but we really want playback for a valid thumb.
                // We'll try to capture anyway after a timeout if play fails.
            }
        };
        startPlay();

        // Safety Timeout: If nothing happens in 15s, skip to avoid getting stuck
        const safetyTimer = setTimeout(() => {
            if (!processedRef.current) {
                console.warn("GridProcessor timeout for:", activeTask.title);
                skipTask();
            }
        }, 15000);

        return () => {
            clearTimeout(safetyTimer);
            vid.removeAttribute('src');
            vid.load();
        };
    }, [activeTask]);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!activeTask || processedRef.current) return;

        // --- CAPTURE LOGIC (From AdminLibrary Step 2) ---
        // Wait for > 1.0s to ensure we aren't getting a black starting frame
        if (vid.currentTime > 1.0) {
            vid.pause();
            processedRef.current = true;
            
            try {
                const canvas = document.createElement('canvas');
                // Use actual dimensions if available, else 640x360 default
                canvas.width = vid.videoWidth || 640;
                canvas.height = vid.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(async (blob) => {
                        setStatus('DONE');
                        if (blob) {
                            const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                            await completeTask(vid.duration || 0, file);
                        } else {
                            await completeTask(vid.duration || 0, null);
                        }
                    }, 'image/jpeg', 0.7);
                } else {
                    completeTask(vid.duration || 0, null);
                }
            } catch (err) {
                console.error("Canvas error", err);
                completeTask(vid.duration || 0, null);
            }
        }
    };

    const handleError = () => {
        if (!processedRef.current) {
            setStatus('ERROR');
            setTimeout(skipTask, 1000);
        }
    };

    if (!activeTask) return null;

    // --- COMPACT UI ---
    return (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 animate-in slide-in-from-right fade-in duration-500">
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl flex items-center p-2 gap-3 w-64 overflow-hidden relative">
                
                {/* Close Button */}
                <button 
                    onClick={skipTask} 
                    className="absolute top-1 right-1 text-slate-500 hover:text-white bg-slate-900/50 rounded-full p-0.5 z-20"
                >
                    <X size={12} />
                </button>

                {/* Mini Player / Thumbnail Preview */}
                <div className="w-16 h-10 bg-black rounded overflow-hidden shrink-0 border border-slate-800 relative">
                    <video 
                        ref={videoRef}
                        className={`w-full h-full object-cover ${status === 'DONE' ? 'opacity-50' : 'opacity-100'}`}
                        muted
                        playsInline
                        crossOrigin="anonymous"
                        onTimeUpdate={handleTimeUpdate}
                        onError={handleError}
                    />
                    {status === 'DONE' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Check size={16} className="text-emerald-400" />
                        </div>
                    )}
                </div>

                {/* Compact Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                            {status === 'DONE' ? '¡AGREGADO!' : 'NUEVO'}
                        </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate w-full" title={activeTask.title}>
                        {activeTask.title}
                    </div>
                    {status === 'CAPTURING' && (
                        <div className="w-full h-0.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
