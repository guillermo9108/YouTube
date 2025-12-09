
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, SkipForward, Play } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete }: { video: Video, onComplete: (dur: number, thumb: File | null) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Iniciando...');
    const processedRef = useRef(false);
    const retryCount = useRef(0);

    // Timeout de seguridad global: Si en 30s no pasa nada, avanzar.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!processedRef.current) {
                console.warn("Scanner timeout global");
                const vid = videoRef.current;
                const dur = vid && vid.duration && isFinite(vid.duration) ? vid.duration : 0;
                finishProcess(dur, null);
            }
        }, 30000);
        return () => clearTimeout(timer);
    }, [video]);

    useEffect(() => {
        // Reset al cambiar de video
        processedRef.current = false;
        retryCount.current = 0;
        setStatus('Cargando metadatos...');
        
        if (videoRef.current) {
            // Cargar explícitamente
            videoRef.current.load();
        }
    }, [video]);

    const finishProcess = (duration: number, file: File | null) => {
        if (processedRef.current) return;
        processedRef.current = true;
        
        // Pequeño delay visual para que el usuario vea que pasó algo
        setStatus("Guardando...");
        setTimeout(() => {
            onComplete(duration, file);
        }, 500); 
    };

    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (!vid) return;
        setStatus(`Duración detectada: ${Math.floor(vid.duration)}s`);
        
        // Intentar reproducir para sacar la foto
        const playPromise = vid.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn("Autoplay bloqueado, intentando mute", e);
                vid.muted = true;
                vid.play().catch(err => {
                    console.error("No se pudo reproducir:", err);
                    // Si no reproduce, guardamos solo la duración (Prioridad #1)
                    finishProcess(vid.duration, null);
                });
            });
        }
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid || processedRef.current) return;

        setStatus(`Progreso: ${vid.currentTime.toFixed(1)}s`);

        // IGUAL QUE WATCH.TSX: Esperar a > 1.0s para asegurar frame válido
        if (vid.currentTime > 1.0 && vid.duration > 0) {
            vid.pause();
            setStatus("Extrayendo miniatura...");

            try {
                const canvas = document.createElement('canvas');
                // Limitar resolución para no saturar memoria en Android
                canvas.width = 640; 
                canvas.height = 360; 
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (blob) {
                            const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                            finishProcess(vid.duration, file);
                        } else {
                            finishProcess(vid.duration, null);
                        }
                    }, 'image/jpeg', 0.6); // Calidad media para velocidad
                } else {
                    finishProcess(vid.duration, null);
                }
            } catch (e) {
                console.warn("Canvas error (CORS?)", e);
                // Si falla la foto, guardamos duración
                finishProcess(vid.duration, null);
            }
        }
    };

    const handleError = (e: any) => {
        const vid = videoRef.current;
        console.error("Error Media:", e);
        
        if (retryCount.current < 2) {
            retryCount.current++;
            setStatus(`Reintentando (${retryCount.current})...`);
            setTimeout(() => {
                if(vid) {
                    vid.load();
                    vid.play().catch(() => {});
                }
            }, 1000);
        } else {
            // Si falló todo, intentar salvar al menos la duración si se detectó
            const dur = vid && vid.duration && isFinite(vid.duration) ? vid.duration : 0;
            finishProcess(dur, null);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95">
            <div className="relative aspect-video bg-black flex items-center justify-center">
                {/* 
                   IMPORTANTE: 
                   - crossOrigin no establecido para evitar preflight OPTIONS que fallan en algunos servidores locales.
                   - muted=true es CRÍTICO para autoplay en Chrome/Android.
                */}
                <video 
                    ref={videoRef} 
                    src={video.videoUrl} 
                    className="w-full h-full object-contain" 
                    muted 
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
                    <Loader2 size={32} className="animate-spin text-indigo-500 mb-2"/>
                    <span className="text-white font-mono text-xs bg-black/60 px-2 py-1 rounded">{status}</span>
                </div>
            </div>
            
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                <div className="min-w-0">
                    <h3 className="font-bold text-white truncate text-sm">{video.title}</h3>
                    <p className="text-[10px] text-slate-400 truncate">{video.videoUrl}</p>
                </div>
                <button onClick={() => finishProcess(0, null)} className="shrink-0 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 px-3 py-1.5 rounded flex items-center gap-1 border border-red-900/50 transition-colors">
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
        setScanLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
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
            
            const duraFmt = duration > 0 ? `${Math.floor(duration)}s` : '0s';
            const thumbIcon = thumbnail ? '📸' : '⚪';
            addToLog(`[${currentScanIndex + 1}/${scanQueue.length}] ${item.title.substring(0, 15)}... | ${duraFmt} | ${thumbIcon}`);
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
                    <p><strong>Nota:</strong> Mantén esta ventana abierta. El sistema reproducirá cada video brevemente para extraer metadatos.</p>
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
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 p-4">
                    <div className="text-white mb-4 font-bold text-lg">Procesando {currentScanIndex + 1} de {scanQueue.length}</div>
                    
                    <ScannerPlayer 
                        video={scanQueue[currentScanIndex]} 
                        onComplete={handleVideoProcessed} 
                    />
                    
                    <div className="mt-8 flex gap-4">
                        <button onClick={stopActiveScan} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-full font-bold text-sm transition-colors border border-red-800">
                            Detener
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
