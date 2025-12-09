
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, Play, AlertTriangle, SkipForward } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete }: { video: Video, onComplete: (dur: number, thumb: File | null) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando...');
    const [errorCount, setErrorCount] = useState(0);
    const processedRef = useRef(false);

    // Timeout de seguridad: Si en 20 segundos no avanza, marcar como error/skip
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!processedRef.current) {
                console.warn("Scanner timeout - Forzando fin");
                finishProcess(0, null);
            }
        }, 20000);
        return () => clearTimeout(timer);
    }, [video]);

    useEffect(() => {
        // Reset state on new video
        processedRef.current = false;
        setStatus('Inicializando...');
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, [video]);

    const finishProcess = (duration: number, file: File | null) => {
        if (processedRef.current) return;
        processedRef.current = true;
        onComplete(duration, file);
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid || processedRef.current) return;

        setStatus(`Reproduciendo: ${vid.currentTime.toFixed(1)}s`);

        // IGUAL QUE EN WATCH.TSX: Esperamos a que avance un poco (1.5s) para asegurar imagen válida
        if (vid.currentTime > 1.5 && vid.duration > 0) {
            vid.pause();
            setStatus("Procesando imagen...");

            let file: File | null = null;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth; // Usar resolución nativa
                canvas.height = vid.videoHeight;
                
                // Reducir si es 4K para ahorrar memoria
                if (canvas.width > 1920) {
                    const ratio = 1920 / canvas.width;
                    canvas.width = 1920;
                    canvas.height = canvas.height * ratio;
                }

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (blob) file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                        finishProcess(vid.duration, file);
                    }, 'image/jpeg', 0.7);
                } else {
                    finishProcess(vid.duration, null);
                }
            } catch (e) {
                console.warn("Canvas Security Error (CORS):", e);
                // Si falla la foto (ej: CORS), guardamos SOLO la duración (Prioridad #1)
                finishProcess(vid.duration, null);
            }
        }
    };

    const handleError = (e: any) => {
        console.error("Error Reproducción:", e);
        setStatus("Error de formato/codec. Saltando...");
        // Si falla totalmente, enviamos 0. El padre decidirá si lo marca como error o guarda lo que tiene.
        setTimeout(() => finishProcess(0, null), 1000);
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95">
            <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    src={video.videoUrl} 
                    className="w-full h-full object-contain" 
                    controls 
                    autoPlay
                    muted 
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                    // IMPORTANTE: Sin crossOrigin explícito para máxima compatibilidad de reproducción en servidores simples.
                    // Si el servidor backend está en el mismo origen (api/...), el canvas funcionará.
                />
                
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-mono text-emerald-400 border border-emerald-500/30 shadow-lg z-10 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin"/>
                    {status}
                </div>
            </div>
            
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-white truncate max-w-md">{video.title}</h3>
                    <p className="text-xs text-slate-400">Extrayendo metadatos en tiempo real...</p>
                </div>
                <button onClick={() => finishProcess(0, null)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded flex items-center gap-1">
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
        setScanLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
            // Guardamos metadatos. 
            // Si duration > 0, es un éxito (aunque no haya thumbnail).
            // Si duration == 0, fue un error de carga, PERO igual llamamos al update
            // para que el backend pueda decidir si lo deja en PENDING o le pone duración 0.
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            
            const duraFmt = duration > 0 ? `${Math.floor(duration)}s` : 'Error/Skip';
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
            // Pequeña pausa para liberar memoria del navegador
            setTimeout(() => setCurrentScanIndex(nextIdx), 300);
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
                    <p><strong>Nota:</strong> El paso 2 abrirá un reproductor. Mantén la ventana activa para que el navegador genere las miniaturas. Si un video falla, se guardará con duración 0.</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 h-[500px]">
                <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 flex-1 overflow-y-auto shadow-inner relative">
                    <div className="absolute top-2 right-2 text-slate-600 opacity-50 pointer-events-none"><Terminal size={16}/></div>
                    <div className="flex flex-col gap-1">
                        {scanLog.map((line, i) => (
                            <div key={i} className={`pb-1 break-all ${line.includes('Error') ? 'text-red-400' : (line.includes('IMPORTANTE') ? 'text-amber-400 font-bold' : 'text-slate-400')}`}>
                                {line}
                            </div>
                        ))}
                    </div>
                    {(isIndexing || activeScan) && <div className="animate-pulse text-emerald-500 mt-2">_ Procesando...</div>}
                </div>
            </div>

            {/* Modal de Escaneo Visual */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300 p-4">
                    <ScannerPlayer 
                        video={scanQueue[currentScanIndex]} 
                        onComplete={handleVideoProcessed} 
                    />
                    
                    <div className="mt-8 flex gap-4">
                        <button onClick={stopActiveScan} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-full font-bold text-sm transition-colors border border-red-800">
                            Cancelar Todo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
