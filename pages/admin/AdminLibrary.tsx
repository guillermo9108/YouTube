
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, SkipForward, Play, AlertCircle } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete }: { video: Video, onComplete: (dur: number, thumb: File | null) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Iniciando...');
    const [needsInteraction, setNeedsInteraction] = useState(false);
    const processedRef = useRef(false);

    // Timeout de seguridad: 60 segundos por video máximo
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!processedRef.current) {
                console.warn("Scanner timeout global");
                const vid = videoRef.current;
                const dur = vid && vid.duration && isFinite(vid.duration) ? vid.duration : 0;
                finishProcess(dur, null);
            }
        }, 60000);
        return () => clearTimeout(timer);
    }, [video]);

    useEffect(() => {
        // Reset al cambiar de video
        processedRef.current = false;
        setNeedsInteraction(false);
        setStatus('Cargando...');
        
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, [video]);

    const finishProcess = (duration: number, file: File | null) => {
        if (processedRef.current) return;
        processedRef.current = true;
        
        setStatus("Guardando...");
        // Pequeño delay para UX
        setTimeout(() => {
            onComplete(duration, file);
        }, 300); 
    };

    const attemptPlay = () => {
        const vid = videoRef.current;
        if (!vid) return;

        const p = vid.play();
        if (p !== undefined) {
            p.then(() => {
                setNeedsInteraction(false);
                setStatus('Reproduciendo...');
            }).catch(e => {
                console.warn("Autoplay bloqueado:", e);
                setNeedsInteraction(true);
                setStatus('Esperando interacción...');
                // Intentar muteado como fallback
                vid.muted = true;
                vid.play().catch(() => setNeedsInteraction(true));
            });
        }
    };

    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (!vid) return;
        setStatus(`Duración: ${Math.floor(vid.duration)}s`);
        // Esperar un momento antes de reproducir para asegurar buffer
        setTimeout(attemptPlay, 500);
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid || processedRef.current) return;

        // Mostrar progreso
        if (!needsInteraction) {
            setStatus(`Escaneando: ${vid.currentTime.toFixed(1)}s`);
        }

        // LÓGICA DE CAPTURA: Esperar a 2 segundos
        if (vid.currentTime > 2.0) {
            vid.pause();
            setStatus("Capturando...");

            const duration = isFinite(vid.duration) ? vid.duration : 0;

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640; 
                canvas.height = 360; 
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // crossOrigin='anonymous' no está puesto en el video tag para evitar errores de red en local
                    // Esto significa que si el video viene de otro dominio sin CORS, canvas fallará (Tainted)
                    // Si es local (mismo origen), funcionará.
                    try {
                        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(blob => {
                            if (blob) {
                                const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                                finishProcess(duration, file);
                            } else {
                                finishProcess(duration, null);
                            }
                        }, 'image/jpeg', 0.7);
                    } catch (drawErr) {
                        console.warn("Canvas Tainted (Security):", drawErr);
                        // Si falla por seguridad, guardamos duración y seguimos
                        finishProcess(duration, null);
                    }
                } else {
                    finishProcess(duration, null);
                }
            } catch (e) {
                finishProcess(duration, null);
            }
        }
    };

    const handleError = (e: any) => {
        console.error("Video Error:", e);
        setStatus("Error de reproducción");
        // Esperar un poco para que el usuario vea el error, luego saltar
        setTimeout(() => {
            if (!processedRef.current) {
                finishProcess(0, null);
            }
        }, 3000);
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
            <div className="relative aspect-video bg-black flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    src={video.videoUrl} 
                    className="w-full h-full object-contain" 
                    muted={false} // Intentar con sonido primero si el usuario interactuó
                    controls // CRÍTICO: Permitir al usuario dar play manual
                    playsInline
                    preload="auto"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                
                {/* Overlay de Estado */}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white border border-white/10 z-10">
                    {status}
                </div>

                {/* Botón de Interacción Manual (Si autoplay falla) */}
                {needsInteraction && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer" onClick={attemptPlay}>
                        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                            <Play size={40} className="text-white ml-2" />
                        </div>
                        <p className="mt-4 text-white font-bold text-lg">Click para Iniciar Escáner</p>
                    </div>
                )}
            </div>
            
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                <div className="min-w-0 flex-1 mr-4">
                    <h3 className="font-bold text-white truncate text-sm">{video.title}</h3>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{video.videoUrl}</p>
                </div>
                <button 
                    onClick={() => finishProcess(0, null)} 
                    className="shrink-0 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 px-4 py-2 rounded flex items-center gap-2 border border-red-900/50 transition-colors"
                >
                    <SkipForward size={14}/> Forzar Salto
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
                    
                    <ScannerPlayer 
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
