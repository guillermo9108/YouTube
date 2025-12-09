
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Play, Terminal, CheckCircle, AlertTriangle, Film } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete }: { video: Video, onComplete: (dur: number, thumb: File | null) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Iniciando...');
    const [corsMode, setCorsMode] = useState<'anonymous' | undefined>('anonymous');
    const [attempt, setAttempt] = useState(1);
    const durationRef = useRef(0);

    // Timeout de seguridad
    useEffect(() => {
        const timer = setTimeout(() => {
            console.warn("Scanner timeout for", video.title);
            if (durationRef.current > 0) {
                onComplete(durationRef.current, null);
            } else {
                onComplete(0, null);
            }
        }, 12000); 
        return () => clearTimeout(timer);
    }, [video, onComplete]);

    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (!vid) return;
        durationRef.current = vid.duration || 0;
        setStatus(`Duración: ${Math.floor(vid.duration)}s. Buscando imagen...`);
        const target = Math.min(Math.max(5, vid.duration * 0.15), vid.duration - 1);
        vid.currentTime = target;
    };

    const handleSeeked = async () => {
        const vid = videoRef.current;
        if (!vid) return;

        let file: File | null = null;
        if (corsMode === 'anonymous') {
            setStatus('Extrayendo miniatura...');
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
                    if (blob) file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                }
            } catch (e) { console.warn("Canvas Tainted:", e); }
        }
        onComplete(durationRef.current, file);
    };

    const handleError = async () => {
        const vid = videoRef.current;
        const msg = vid?.error?.message || "Error desconocido";
        console.warn(`Error reproducción (Intento ${attempt}):`, msg, vid?.error?.code);

        // DEBUGGING: If error, try to fetch the URL to see if it returns HTML/Error text
        if (attempt === 1) {
            setStatus("Verificando respuesta del servidor...");
            try {
                const res = await fetch(video.videoUrl, { method: 'HEAD' });
                const type = res.headers.get('content-type');
                if (type && type.includes('text/html')) {
                    setStatus(`ERROR CRÍTICO: Servidor envió HTML en lugar de Video.`);
                    // Stop trying, this is a backend config issue
                    setTimeout(() => onComplete(0, null), 2000);
                    return;
                }
            } catch(e) {}

            setStatus(`Reintentando sin CORS...`);
            setCorsMode(undefined); 
            setAttempt(2);
            if (vid) {
                const separator = video.videoUrl.includes('?') ? '&' : '?';
                vid.src = `${video.videoUrl}${separator}retry=${Date.now()}`;
                vid.load();
            }
        } else {
            setStatus('Formato no soportado. Guardando sin datos...');
            onComplete(0, null);
        }
    };

    const initialSrc = `${video.videoUrl}${video.videoUrl.includes('?') ? '&' : '?'}scan=${Date.now()}`;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-lg w-full mx-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4 flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    src={attempt === 1 ? initialSrc : undefined}
                    crossOrigin={corsMode} 
                    className="w-full h-full object-contain opacity-50" 
                    muted 
                    playsInline 
                    autoPlay 
                    onLoadedMetadata={handleLoadedMetadata} 
                    onSeeked={handleSeeked}
                    onError={handleError} 
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-2" />
                    {attempt === 2 && <AlertTriangle size={24} className="text-amber-500 animate-pulse"/>}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white text-[10px] py-1 text-center font-mono border-t border-slate-800">
                    {status}
                </div>
            </div>
            
            <div className="text-center text-xs text-slate-500 w-full flex justify-between px-4">
                <span>Modo: {corsMode ? 'Full' : 'Basic'}</span>
                <span>Intento: {attempt}/2</span>
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
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            const duraFmt = duration > 0 ? `${Math.floor(duration)}s` : 'Error';
            const thumbIcon = thumbnail ? '📸' : '❌';
            addToLog(`Procesado: ${item.title} | ${duraFmt} | Img: ${thumbIcon}`);
        } catch (e: any) {
            addToLog(`Fallo al guardar DB: ${item.title}`);
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
