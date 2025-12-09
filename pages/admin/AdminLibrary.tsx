
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, SkipForward, Play, AlertCircle } from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando...');
    const [isError, setIsError] = useState(false);
    const processedRef = useRef(false);

    // CRITICAL FIX: Ensure URL is always a stream URL for local files/scans
    // This handles cases where backend might send raw paths (e.g. /storage/...)
    // or if the user's browser cache is stale.
    const getVideoSrc = (v: Video) => {
        if (v.videoUrl.startsWith('http') || v.videoUrl.startsWith('blob')) return v.videoUrl;
        // If it looks like a path (starts with / or has no protocol), force stream API
        // This bypasses "Not allowed to load local resource" errors.
        return `api/index.php?action=stream&id=${v.id}`;
    };

    const streamSrc = getVideoSrc(video);

    // Watch.tsx Style Autoplay Logic
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;

        // Reset state
        processedRef.current = false;
        setIsError(false);
        setStatus('Iniciando...');

        // Debug log
        console.log("Scanner attempting play:", streamSrc);

        const startPlay = async () => {
            try {
                // Intento 1: Reproducción normal con sonido bajo
                vid.volume = 0.1; 
                await vid.play();
                setStatus('Reproduciendo...');
            } catch (e) {
                console.warn("Autoplay blocked, trying muted...", e);
                try {
                    // Intento 2: Muteado (Fallback estándar de navegadores)
                    vid.muted = true;
                    await vid.play();
                    setStatus('Reproduciendo (Muteado)...');
                } catch (e2) {
                    console.error("Playback failed completely", e2);
                    setStatus('Esperando click manual...');
                }
            }
        };

        // Pequeño delay para asegurar que el DOM esté listo y el navegador no se sature
        const timer = setTimeout(startPlay, 500);
        return () => clearTimeout(timer);
    }, [video, streamSrc]); 

    // Watch.tsx Style Time Update & Capture Logic
    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!vid || processedRef.current) return;

        setStatus(`Escaneando: ${vid.currentTime.toFixed(1)}s`);

        // Esperamos a 1.5s (Igual que Watch.tsx repair logic) para asegurar imagen estable
        if (vid.currentTime > 1.5) {
            vid.pause();
            processedRef.current = true;
            setStatus('Capturando...');

            const duration = vid.duration && isFinite(vid.duration) ? vid.duration : 0;
            let file: File | null = null;

            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth || 640;
                canvas.height = vid.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (blob) {
                            file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                        }
                        onComplete(duration, file);
                    }, 'image/jpeg', 0.8);
                } else {
                    // Fallback si falla contexto 2d
                    onComplete(duration, null);
                }
            } catch (err) {
                console.warn("Capture error (Likely CORS/Tainted)", err);
                // Si falla la captura (ej. CORS), al menos guardamos la duración
                onComplete(duration, null);
            }
        }
    };

    const handleError = (e: any) => {
        if (processedRef.current) return;
        console.error("Media Error:", e);
        setIsError(true);
        setStatus("Error al reproducir. Reintentando...");
        
        // Esperar 4 segundos y saltar automáticamente si falla
        setTimeout(() => {
            if (!processedRef.current) {
                processedRef.current = true;
                onComplete(0, null);
            }
        }, 4000);
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
            <div className="relative aspect-video bg-black flex items-center justify-center">
                {/* 
                   NOTA: No usamos crossOrigin="anonymous" aquí para mantener paridad exacta con Watch.tsx 
                   y evitar Preflight OPTIONS que fallan en servidores simples.
                */}
                <video 
                    ref={videoRef} 
                    src={streamSrc} 
                    className="w-full h-full object-contain" 
                    controls // Importante: Permite al usuario dar play si el autoplay falla
                    playsInline
                    preload="auto"
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                
                {/* Status Overlay */}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white border border-white/10 z-10 pointer-events-none">
                    {status}
                </div>

                {/* Botón Gigante de Play si falla el Autoplay */}
                {status.includes('Esperando') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 cursor-pointer" onClick={() => videoRef.current?.play()}>
                        <div className="w-20 h-20 bg-indigo-600/90 rounded-full flex items-center justify-center animate-pulse shadow-2xl">
                            <Play size={40} className="text-white ml-2"/>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                <div className="min-w-0 flex-1 mr-4">
                    <h3 className="font-bold text-white truncate text-sm">{video.title}</h3>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{streamSrc}</p>
                </div>
                <button 
                    onClick={() => { processedRef.current = true; onComplete(0, null); }} 
                    className="shrink-0 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 px-4 py-2 rounded flex items-center gap-2 border border-red-900/50 transition-colors"
                >
                    <SkipForward size={14}/> Saltar
                </button>
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const [localPath, setLocalPath] = useState('');
    const [isIndexing, setIsIndexing] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [activeScan, setActiveScan] = useState(false);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
    }, []);

    const addToLog = (msg: string) => {
        setScanLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));
    };

    const handleIndexLibrary = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        setScanLog([]); 
        addToLog('Iniciando indexado de archivos...');
        addToLog(`Ruta: ${localPath}`);
        
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) {
                addToLog(`Archivos encontrados: ${res.totalFound}`);
                addToLog(`Nuevos añadidos a cola: ${res.newToImport}`);
                if (res.newToImport > 0) {
                    addToLog("IMPORTANTE: Ejecuta el Paso 2 para procesar.");
                } else {
                    addToLog("La librería está actualizada.");
                }
            } else {
                addToLog(`Error: ${res.errors || 'Desconocido'}`);
            }
        } catch (e: any) {
            addToLog(`Error Crítico: ${e.message}`);
        } finally {
            setIsIndexing(false);
        }
    };

    const startBrowserScan = async () => {
        addToLog("Cargando cola de procesamiento...");
        const pending = await db.getUnprocessedVideos();
        if (pending.length === 0) {
            addToLog("No hay videos pendientes de procesar.");
            return;
        }
        addToLog(`Iniciando escáner visual para ${pending.length} videos.`);
        setScanQueue(pending);
        setCurrentScanIndex(0);
        setActiveScan(true);
    };

    const stopActiveScan = () => { setActiveScan(false); setScanQueue([]); };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
        const item = scanQueue[currentScanIndex];
        
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            
            const duraFmt = duration > 0 ? `${Math.floor(duration)}s` : 'Err';
            const thumbIcon = thumbnail ? '📸' : '⚪';
            addToLog(`[${currentScanIndex + 1}/${scanQueue.length}] ${item.title.substring(0, 20)}... | ${duraFmt} | ${thumbIcon}`);
        } catch (e: any) {
            addToLog(`Error guardando DB: ${item.title}`);
        }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("¡Importación Completada!");
            addToLog("--- PROCESO TERMINADO ---");
            db.invalidateCache('index.php?action=get_videos');
            db.setHomeDirty();
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escáner de Librería</h3>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/storage/emulated/0/DCIM/Camera" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleIndexLibrary} disabled={isIndexing || activeScan} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                        {isIndexing ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Buscar Archivos
                    </button>
                    
                    <button onClick={startBrowserScan} disabled={isIndexing || activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all">
                        <Film size={20}/> Paso 2: Procesar (Escáner Visual)
                    </button>
                </div>
                
                <div className="text-xs text-slate-500 mt-2 bg-slate-950 p-3 rounded border border-slate-800">
                    <p className="mb-1"><strong className="text-indigo-400">Nota Importante:</strong></p>
                    <p>El "Paso 2" abrirá un reproductor. Si el video no inicia automáticamente, <strong>haz click en él</strong>. El sistema necesita reproducir al menos 2 segundos de cada video para extraer la miniatura y duración real.</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 h-[500px]">
                <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 flex-1 overflow-y-auto shadow-inner relative">
                    <div className="absolute top-2 right-2 text-slate-600 opacity-50 pointer-events-none"><Terminal size={16}/></div>
                    <div className="flex flex-col gap-1">
                        {scanLog.map((line, i) => (
                            <div key={i} className={`pb-1 break-all border-b border-slate-900/50 ${line.includes('Error') ? 'text-red-400' : (line.includes('IMPORTANTE') ? 'text-amber-400 font-bold' : 'text-slate-400')}`}>
                                {line}
                            </div>
                        ))}
                    </div>
                    {(isIndexing || activeScan) && <div className="animate-pulse text-emerald-500 mt-2">_ Procesando...</div>}
                </div>
            </div>

            {/* Modal de Escaneo Visual */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center animate-in fade-in duration-300 p-4">
                    <div className="w-full max-w-2xl flex justify-between items-center mb-4 text-white">
                        <h2 className="font-bold text-xl flex items-center gap-2"><Film className="text-emerald-500"/> Escáner Activo</h2>
                        <span className="font-mono bg-slate-800 px-3 py-1 rounded text-sm">{currentScanIndex + 1} / {scanQueue.length}</span>
                    </div>
                    
                    {/* CRITICAL: Key prop ensures fresh mount for every video */}
                    <ScannerPlayer 
                        key={scanQueue[currentScanIndex].id}
                        video={scanQueue[currentScanIndex]} 
                        onComplete={handleVideoProcessed} 
                    />
                    
                    <div className="mt-6 flex flex-col items-center gap-2">
                        <p className="text-slate-400 text-sm">Por favor, no cierres esta ventana.</p>
                        <button onClick={stopActiveScan} className="px-6 py-2 text-red-400 hover:text-red-300 text-sm font-bold transition-colors">
                            Cancelar Proceso
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
