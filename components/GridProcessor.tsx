
import React, { useRef, useEffect, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { Loader2, Check, X, Sparkles, AlertCircle } from 'lucide-react';
import { db } from '../services/db';

export default function GridProcessor() {
    const { activeTask, completeTask, skipTask } = useGrid();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'INIT' | 'CAPTURING' | 'DONE' | 'ERROR'>('INIT');
    const processedRef = useRef(false);
    const safetyTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (activeTask) {
            setStatus('INIT');
            processedRef.current = false;
        }
    }, [activeTask]);

    useEffect(() => {
        const vid = videoRef.current;
        if (!activeTask || !vid) return;

        let streamSrc = activeTask.videoUrl;
        const isLocal = Boolean(activeTask.isLocal) || (activeTask as any).isLocal === 1 || (activeTask as any).isLocal === "1";
        
        if (isLocal) {
            streamSrc = streamSrc.includes('action=stream') ? `${streamSrc}&t=${Date.now()}` : `api/index.php?action=stream&id=${activeTask.id}&t=${Date.now()}`;
        }

        vid.src = streamSrc;
        vid.currentTime = 0;
        vid.muted = true; 
        vid.crossOrigin = "anonymous"; 
        
        const startPlay = async () => {
            try {
                await vid.play();
                setStatus('CAPTURING');
            } catch (e) {}
        };
        startPlay();

        // Timeout de seguridad: si no procesamos en 12s, reportamos incompatibilidad
        safetyTimeoutRef.current = window.setTimeout(() => {
            if (!processedRef.current && activeTask) {
                const dur = (vid.duration && isFinite(vid.duration)) ? vid.duration : 0;
                handleForceComplete(dur, true);
            }
        }, 12000);

        return () => {
            if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
            vid.removeAttribute('src');
            vid.load();
        };
    }, [activeTask]);

    const handleForceComplete = async (duration: number, isIncompatible: boolean) => {
        if (processedRef.current || !activeTask) return;
        processedRef.current = true;
        setStatus('DONE');
        
        try {
            const fd = new FormData();
            fd.append('id', activeTask.id);
            fd.append('duration', String(duration));
            fd.append('success', '1');
            fd.append('clientIncompatible', isIncompatible ? '1' : '0');
            
            await db.request(`action=update_video_metadata`, { method: 'POST', body: fd });
            completeTask(duration, null);
        } catch(e) {
            skipTask();
        }
    };

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!activeTask || processedRef.current) return;

        // Si el navegador detecta width=0, es incompatible (se comporta como audio)
        if (vid.readyState >= 1 && vid.videoWidth === 0 && vid.duration > 0) {
            handleForceComplete(vid.duration, true);
            return;
        }

        if (vid.currentTime > 1.5 && vid.videoWidth > 0) {
            processedRef.current = true;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth;
                canvas.height = vid.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0);
                    canvas.toBlob(async (blob) => {
                        setStatus('DONE');
                        const file = blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null;
                        
                        const fd = new FormData();
                        fd.append('id', activeTask.id);
                        fd.append('duration', String(vid.duration));
                        fd.append('success', '1');
                        fd.append('clientIncompatible', '0');
                        if (file) fd.append('thumbnail', file);
                        
                        await db.request(`action=update_video_metadata`, { method: 'POST', body: fd });
                        completeTask(vid.duration, null);
                    }, 'image/jpeg', 0.7);
                } else {
                    handleForceComplete(vid.duration, false);
                }
            } catch (err) {
                handleForceComplete(vid.duration, true);
            }
        }
    };

    if (!activeTask) return null;

    return (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[60] animate-in slide-in-from-right fade-in duration-500">
            <div className={`bg-slate-900/95 backdrop-blur-md border ${status === 'ERROR' ? 'border-red-500/50' : 'border-slate-700'} rounded-2xl shadow-2xl flex items-center p-2.5 gap-3 w-72 overflow-hidden relative group`}>
                <button onClick={skipTask} className="absolute top-1.5 right-1.5 text-slate-500 hover:text-white bg-slate-800 rounded-full p-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                <div className="w-20 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800 relative">
                    <video ref={videoRef} className={`w-full h-full object-cover ${status === 'DONE' ? 'opacity-30' : 'opacity-100'}`} muted playsInline crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate} onError={() => handleForceComplete(0, true)} />
                    {status === 'DONE' && <div className="absolute inset-0 flex items-center justify-center"><Check size={20} className="text-emerald-400" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <Sparkles size={10} className="text-indigo-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{status === 'DONE' ? 'LISTO' : 'ANALIZANDO'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-white truncate" title={activeTask.title}>{activeTask.title}</div>
                    {status === 'CAPTURING' && <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-indigo-500 animate-pulse"></div></div>}
                </div>
            </div>
        </div>
    );
}
