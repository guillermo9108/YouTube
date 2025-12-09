
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Play, Terminal, CheckCircle, AlertTriangle, Film } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete }: { video: Video, onComplete: (dur: number, thumb: File | null) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando flujo de video...');
    const [corsMode, setCorsMode] = useState<'anonymous' | undefined>('anonymous');
    const [retryCount, setRetryCount] = useState(0);
    const capturedRef = useRef(false);

    // Timeout de seguridad global (30 segundos por video)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!capturedRef.current) {
                console.warn("Scanner timeout for", video.title);
                // Si se agota el tiempo, intentamos guardar lo que tengamos
                const vid = videoRef.current;
                const dur = vid?.duration && !isNaN(vid.duration) ? vid.duration : 0;
                onComplete(dur, null);
            }
        }, 30000); 
        return () => clearTimeout(timer);
    }, [video, onComplete]);

    // Lógica idéntica a Watch.tsx: Escuchar el progreso natural
    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid || capturedRef.current) return;

        // Si ya tenemos duración y el video ha avanzado más de 1 segundo
        if (vid.duration > 0 && vid.currentTime > 1.0) {
            capturedRef.current = true;
            setStatus('Capturando datos...');
            vid.pause();

            let file: File | null = null;

            // Intentar extraer miniatura si tenemos permisos CORS
            if (corsMode === 'anonymous') {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 360;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(blob => {
                            if (blob) file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                            onComplete(vid.duration, file);
                        }, 'image/jpeg', 0.7);
                        return; // Salir, el callback del blob finalizará
                    }
                } catch (e) {
                    console.warn("Canvas Tainted (CORS restriction):", e);
                }
            }
            
            // Si falló el canvas o no hay CORS, guardamos solo duración
            onComplete(vid.duration, file);
        }
    };

    const handleError = () => {
        if (capturedRef.current) return;
        
        const vid = videoRef.current;
        const err = vid?.error;
        console.warn(`Error reproducción: ${err?.code} - ${err?.message}`);

        if (retryCount === 0) {
            setStatus('Error de seguridad. Reintentando modo compatible...');
            setRetryCount(1);
            setCorsMode(undefined); // Quitamos 'anonymous' para permitir cargar sin headers CORS (pierde miniatura, gana duración)
            if (vid) {
                vid.load(); // Recargar con nueva config
            }
        } else {
            // Si falla de nuevo, nos rendimos pero NO bloqueamos la cola. Guardamos duración 0.
            capturedRef.current = true;
            setStatus('Formato no soportado. Saltando...');
            onComplete(0, null);
        }
    };

    // Forzamos cache-busting para evitar que el navegador use una respuesta fallida anterior
    const srcUrl = `${video.videoUrl}${video.videoUrl.includes('?') ? '&' : '?'}scanner_t=${Date.now()}`;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-lg w-full mx-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4 flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    src={srcUrl}
                    crossOrigin={corsMode} 
                    className="w-full h-full object-contain" 
                    muted 
                    autoPlay
                    playsInline 
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                
                {/* Overlay de estado */}
                <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] text-white font-mono">
                    {corsMode ? 'Modo: Full' : 'Modo: Compatible'}
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-2" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white text-[10px] py-1 text-center font-mono border-t border-slate-800">
                    {status}
                </div>
            </div>
            
            <div className="text-xs text-slate-500 text-center">
                No cierres esta ventana. Procesando video...
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
                    addToLog("IMPORTANTE: Ejecuta el Paso 2 para obtener duración.");
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
            addToLog("No hay videos pendientes.");
            return;
        }
        addToLog(`Iniciando escáner para ${pending.length} videos.`);
        setScanQueue(pending);
        setCurrentScanIndex(0);
        setActiveScan(true);
    };

    const stopActiveScan = () => { setActiveScan(false); setScanQueue([]); };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
        const item = scanQueue[currentScanIndex];
        
        // Guardamos, aunque duration sea 0, para quitarle el estado 'PENDING'
        // Esto evita bucles infinitos.
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            
            const duraFmt = duration > 0 ? `${Math.floor(duration)}s` : 'N/A';
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
            // Pequeña pausa para permitir que el navegador libere memoria del Canvas anterior
            setTimeout(() => setCurrentScanIndex(nextIdx), 200);
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
                        <Film size={20}/> Paso 2: Escáner Visual
                    </button>
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

            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <ScannerPlayer 
                        video={scanQueue[currentScanIndex]} 
                        onComplete={handleVideoProcessed} 
                    />
                    <div className="mt-6 text-slate-400 font-bold font-mono text-sm flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700">
                        <Loader2 className="animate-spin text-indigo-500" size={16}/>
                        Video {currentScanIndex + 1} de {scanQueue.length}
                    </div>
                    <button onClick={stopActiveScan} className="mt-8 text-slate-500 hover:text-red-400 underline text-xs transition-colors">Cancelar Escaneo</button>
                </div>
            )}
        </div>
    );
}
