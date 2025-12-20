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
    const [isRectifying, setIsRectifying] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isTranscoding, setIsTranscoding] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const [transcodeStats, setTranscodeStats] = useState({ processed: 0, remaining: 0 });

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
            if (res.success) { addToLog(`Encontrados: ${res.totalFound}`); addToLog(`Nuevos: ${res.newToImport}`); toast.success("Paso 1 Completado"); }
            else if (res.error) addToLog(`Error: ${res.error}`);
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsIndexing(false); }
    };

    const startBrowserScan = async () => {
        addToLog("Cargando videos pendientes...");
        const limit = step2Limit ? parseInt(step2Limit) : 0; 
        try {
            const pending = await db.getUnprocessedVideos(limit, 'normal');
            if (pending.length === 0) { addToLog("No hay videos pendientes."); return; }
            addToLog(`Iniciando escáner para ${pending.length} videos.`);
            setScanQueue(pending);
            setCurrentScanIndex(0);
            setActiveScan(true);
        } catch (e: any) { addToLog(`Error cargando cola: ${e.message}`); }
    };

    const stopActiveScan = () => { setActiveScan(false); setScanQueue([]); };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null, success: boolean) => {
        const item = scanQueue[currentScanIndex];
        try {
            const res = await db.updateVideoMetadata(item.id, duration, thumbnail, success);
            if (!success) {
                if (res.status === 'discarded') addToLog(`Descartado: ${item.title} (Demasiados fallos)`);
                else addToLog(`Fallo registrado: ${item.title}`);
            } else {
                addToLog(`Procesado y Organizado: ${item.title}`);
            }
        } catch (e) { console.error(e); }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Paso 2 Completado");
            addToLog("Escaneo visual finalizado.");
            db.invalidateCache('get_videos');
            db.setHomeDirty();
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    const handleSmartOrganize = async () => {
        setIsOrganizing(true);
        addToLog("Iniciando organización por lotes...");
        const processBatch = async () => {
            try {
                const res = await db.smartOrganizeLibrary();
                if (res.details) res.details.forEach((d: string) => addToLog(d));
                if (res.remaining && res.remaining > 0) {
                    setTimeout(processBatch, 500);
                } else {
                    addToLog("Organización Finalizada.");
                    toast.success("Paso 3 Completado");
                    setIsOrganizing(false);
                    db.invalidateCache('get_videos');
                    db.setHomeDirty();
                }
            } catch (e: any) { addToLog(`Error: ${e.message}`); setIsOrganizing(false); }
        };
        processBatch();
    };

    const handleTranscodeQueue = async () => {
        setIsTranscoding(true);
        addToLog("Iniciando cola de transcodificación FFmpeg...");
        const processTranscode = async () => {
            try {
                const res = await db.request<any>('action=admin_transcode_batch');
                if (res.processed > 0) {
                    setTranscodeStats({ processed: transcodeStats.processed + res.processed, remaining: res.remaining });
                    addToLog(`Transcodificados: ${res.processed} videos. Restantes: ${res.remaining}`);
                }
                if (!res.completed) {
                    setTimeout(processTranscode, 1000);
                } else {
                    addToLog("Transcodificación masiva finalizada.");
                    toast.success("Cola de conversión terminada");
                    setIsTranscoding(false);
                }
            } catch (e: any) { addToLog(`Error Transcoding: ${e.message}`); setIsTranscoding(false); }
        };
        processTranscode();
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center gap-3 mb-2">
                <Database size={24} className="text-indigo-400"/>
                <h2 className="text-2xl font-bold text-white">Gestión de Librería</h2>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500"></div>
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-white flex items-center gap-2"><span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>Indexar Archivos</h3>{isIndexing && <Loader2 className="animate-spin text-blue-500"/>}</div>
                <div className="flex gap-3"><input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white" placeholder="/storage/..." /><button onClick={handleIndexLibrary} disabled={isIndexing || activeScan || isOrganizing || isTranscoding} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2"><FolderSearch size={16}/> Escanear</button></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500"></div>
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-white flex items-center gap-2"><span className="bg-emerald-500/20 text-emerald-400 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>Extracción Visual</h3></div>
                {!activeScan ? (
                    <div className="flex gap-3 items-end">
                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Límite</label><input type="number" value={step2Limit} onChange={e => setStep2Limit(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Todos" /></div>
                        <button onClick={startBrowserScan} disabled={isIndexing || isOrganizing || isTranscoding} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm flex items-center gap-2 h-[38px]"><Film size={16}/> Iniciar Escáner</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs text-slate-400"><span>Video {currentScanIndex + 1} de {scanQueue.length}</span></div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${((currentScanIndex) / scanQueue.length) * 100}%`}}></div></div>
                    </div>
                )}
            </div>

            {/* NEW: TRANSCODER QUEUE SECTION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-indigo-500/20 text-indigo-400 w-6 h-6 rounded flex items-center justify-center text-xs">FF</span>
                        Transcodificación WebReady (H.264)
                    </h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <button onClick={handleTranscodeQueue} disabled={isIndexing || activeScan || isTranscoding} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                        {isTranscoding ? <RefreshCw className="animate-spin" size={18}/> : <Cpu size={18}/>}
                        {isTranscoding ? 'Procesando Cola...' : 'Iniciar Conversión Masiva'}
                    </button>
                    
                    {isTranscoding && (
                        <div className="flex-1 w-full bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500"/>
                                <span className="text-xs text-slate-400 font-bold">Restantes: <span className="text-white">{transcodeStats.remaining}</span></span>
                            </div>
                            <span className="text-[10px] text-indigo-400 font-mono animate-pulse uppercase font-black">FFmpeg Activado</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500"></div>
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-white flex items-center gap-2"><span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>Mantenimiento Final</h3></div>
                <button onClick={handleSmartOrganize} disabled={isIndexing || activeScan || isTranscoding} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"><Wand2 size={18}/> Organizar y Publicar</button>
            </div>

            <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 h-48 overflow-y-auto shadow-inner relative">
                <div className="absolute top-2 right-2 opacity-50"><Terminal size={14}/></div>
                {scanLog.map((line, i) => (<div key={i} className="pb-0.5 border-b border-slate-900/50 truncate">{line}</div>))}
            </div>
            
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 p-6 shadow-2xl">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Film className="text-emerald-400"/> Escaneando...</h3>
                        <ScannerPlayer key={scanQueue[currentScanIndex].id} video={scanQueue[currentScanIndex]} onComplete={handleVideoProcessed} />
                        <button onClick={stopActiveScan} className="w-full mt-4 py-2 text-red-400 hover:bg-slate-800 rounded text-xs font-bold">Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
}