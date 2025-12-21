import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, Play, AlertCircle, Wand2, Database, Edit3, Sparkles, Cpu, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null, success: boolean) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando...');
    const processedRef = useRef(false);

    const streamSrc = useMemo(() => {
        let src = video.videoUrl;
        const isLocal = Boolean(video.isLocal) || (video as any).isLocal === 1 || (video as any).isLocal === "1";
        if (isLocal) {
            if (src.includes('action=stream')) src += `&t=${Date.now()}`;
            else src = `api/index.php?action=stream&id=${video.id}&t=${Date.now()}`;
        }
        return src;
    }, [video.id, video.videoUrl]);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        processedRef.current = false;
        setStatus('Iniciando...');
        vid.currentTime = 0;
        vid.src = streamSrc;
        vid.load();
        const startPlay = async () => {
            try {
                vid.muted = true; 
                await vid.play();
                setStatus('Procesando...');
            } catch (e) {
                if(vid.readyState < 1) setStatus('Esperando datos...');
            }
        };
        startPlay();
    }, [streamSrc]); 

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!vid || processedRef.current) return;
        if (vid.currentTime > 1.5 && vid.videoWidth > 0) {
            vid.pause();
            processedRef.current = true;
            setStatus('Capturando...');
            const duration = vid.duration && isFinite(vid.duration) ? vid.duration : 0;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth || 640;
                canvas.height = vid.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        const file = blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null;
                        onComplete(duration, file, true);
                    }, 'image/jpeg', 0.8);
                } else onComplete(duration, null, true);
            } catch (err) { onComplete(duration, null, true); }
        }
    };

    const handleError = () => {
        if (processedRef.current) return;
        setStatus("Error de archivo.");
        processedRef.current = true;
        setTimeout(() => onComplete(0, null, false), 1500);
    };

    return (
        <div className="w-full max-w-lg mx-auto mb-4">
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video group">
                <video ref={videoRef} className="w-full h-full object-contain" playsInline muted={true} preload="auto" crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate} onError={handleError} />
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 z-20 pointer-events-none">
                    <div className="flex items-center gap-2">
                        {status === 'Procesando...' || status === 'Capturando...' ? <Loader2 size={12} className="animate-spin text-emerald-400"/> : <div className={`w-2 h-2 rounded-full animate-pulse ${status.includes('Error') ? 'bg-red-500' : 'bg-indigo-500'}`}></div>}
                        <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">{status}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const [localPath, setLocalPath] = useState('');
    const [step2Limit, setStep2Limit] = useState(''); 
    const [isIndexing, setIsIndexing] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [isTranscoding, setIsTranscoding] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);

    useEffect(() => { 
        db.getSystemSettings().then(s => { 
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath); 
        }); 
    }, []);

    const addToLog = (msg: string) => { setScanLog(prev => [`> ${msg}`, ...prev].slice(0, 100)); };

    const handleIndexLibrary = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        setScanLog([]); 
        addToLog('Indexando archivos...');
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) { 
                addToLog(`Escaneo físico completado.`);
                addToLog(`Total archivos compatibles: ${res.totalFound}`); 
                addToLog(`Nuevos videos en cola: ${res.newToImport}`); 
                toast.success("Paso 1 Completado"); 
            }
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsIndexing(false); }
    };

    const startBrowserScan = async () => {
        addToLog("Buscando videos pendientes (PENDING)...");
        const limit = step2Limit ? parseInt(step2Limit) : 50; 
        try {
            const pending = await db.getUnprocessedVideos(limit, 'normal');
            if (pending.length === 0) { 
                addToLog("No hay videos pendientes de procesar."); 
                toast.info("Todo procesado");
                return; 
            }
            addToLog(`Iniciando extracción para ${pending.length} videos.`);
            setScanQueue(pending);
            setCurrentScanIndex(0);
            setActiveScan(true);
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
    };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null, success: boolean) => {
        const item = scanQueue[currentScanIndex];
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail, success);
            addToLog(`[OK] ${item.title} -> Ahora en estado PROCESSING`);
        } catch (e) { console.error(e); }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            setActiveScan(false);
            setScanQueue([]);
            toast.success("Paso 2 Completado");
            addToLog("Todos los videos han sido movidos a la cola de organización.");
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    const handleSmartOrganize = async () => {
        setIsOrganizing(true);
        addToLog("Iniciando Paso 3: Organización y Publicación...");
        try {
            const res = await db.smartOrganizeLibrary();
            if (res.details) res.details.forEach((d: string) => addToLog(d));
            addToLog(`Procesados: ${res.processed}. Restantes en cola: ${res.remaining}`);
            
            if (res.processed > 0) {
                toast.success("Publicación completada");
                db.invalidateCache('get_videos');
                db.setHomeDirty();
            } else {
                addToLog("No hay videos en estado 'PROCESSING'. Ejecuta el Paso 2 primero.");
            }
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsOrganizing(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center gap-3 mb-2">
                <Database size={24} className="text-indigo-400"/>
                <h2 className="text-2xl font-bold text-white">Gestión de Librería</h2>
            </div>
            
            {/* STEP 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500"></div>
                <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                    Indexar Archivos
                </h3>
                <div className="flex gap-3">
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white" placeholder="/ruta/a/tus/videos" />
                    <button onClick={handleIndexLibrary} disabled={isIndexing || activeScan} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                        {isIndexing ? <RefreshCw className="animate-spin" size={16}/> : <FolderSearch size={16}/>} Escanear
                    </button>
                </div>
            </div>

            {/* STEP 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500"></div>
                <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-400 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                    Extracción Visual (PENDING &rarr; PROCESSING)
                </h3>
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Lote de Archivos</label>
                        <input type="number" value={step2Limit} onChange={e => setStep2Limit(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Ej: 50" />
                    </div>
                    <button onClick={startBrowserScan} disabled={isIndexing || activeScan || isOrganizing} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm flex items-center gap-2 h-[38px]">
                        <Film size={16}/> Iniciar Extracción
                    </button>
                </div>
            </div>

            {/* STEP 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500"></div>
                <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                    <span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                    Publicación Final (PROCESSING &rarr; ONLINE)
                </h3>
                <p className="text-xs text-slate-500 mb-4">Este paso renombra, categoriza y pone precio a los videos procesados en el paso anterior.</p>
                <button onClick={handleSmartOrganize} disabled={isIndexing || activeScan || isOrganizing} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                    {isOrganizing ? <RefreshCw className="animate-spin" size={18}/> : <Wand2 size={18}/>} 
                    {isOrganizing ? 'Organizando...' : 'Publicar Videos en Inicio'}
                </button>
            </div>

            {/* CONSOLE LOG */}
            <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 h-48 overflow-y-auto shadow-inner relative">
                <div className="absolute top-2 right-2 opacity-50"><Terminal size={14}/></div>
                {scanLog.length === 0 ? <div className="text-slate-700">Consola de mantenimiento lista...</div> : scanLog.map((line, i) => (<div key={i} className="pb-0.5 border-b border-slate-900/50 truncate">{line}</div>))}
            </div>
            
            {/* SCANNING OVERLAY */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 p-6 shadow-2xl text-center">
                        <h3 className="text-white font-bold mb-4 flex items-center justify-center gap-2"><Film className="text-emerald-400"/> Procesando Lote...</h3>
                        <div className="text-xs text-slate-400 mb-4">{currentScanIndex + 1} / {scanQueue.length}: {scanQueue[currentScanIndex].title}</div>
                        <ScannerPlayer key={scanQueue[currentScanIndex].id} video={scanQueue[currentScanIndex]} onComplete={handleVideoProcessed} />
                        <button onClick={() => setActiveScan(false)} className="w-full mt-4 py-2 text-red-400 hover:bg-slate-800 rounded text-xs font-bold">Detener Proceso</button>
                    </div>
                </div>
            )}
        </div>
    );
}