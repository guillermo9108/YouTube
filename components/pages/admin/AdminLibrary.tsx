import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, Wand2, Database, RefreshCw, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null, success: boolean) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Iniciando...');
    const processedRef = useRef(false);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        vid.src = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        vid.muted = true;
        vid.play().catch(() => setStatus('Codec no soportado'));
    }, [video]);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (processedRef.current) return;
        if (vid.currentTime > 1.5 && vid.videoWidth > 0) {
            processedRef.current = true;
            setStatus('Capturando...');
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vid, 0, 0);
                canvas.toBlob(blob => {
                    const file = blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null;
                    onComplete(vid.duration, file, true);
                }, 'image/jpeg', 0.8);
            } else onComplete(vid.duration, null, true);
        }
    };

    return (
        <div className="bg-black rounded-lg overflow-hidden aspect-video relative border border-slate-800">
            <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={handleTimeUpdate} onError={() => onComplete(0, null, false)} />
            <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] text-white font-mono uppercase">{status}</div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const [localPath, setLocalPath] = useState('');
    const [isIndexing, setIsIndexing] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const [stats, setStats] = useState({ pending: 0, processing: 0, public: 0 });

    const loadStats = async () => {
        try {
            const all = await db.getAllVideos();
            const unprocessed = await db.getUnprocessedVideos(9999, 'normal');
            const procCount = all.filter(v => v.category === 'PROCESSING').length;
            setStats({ 
                pending: unprocessed.length, 
                processing: procCount,
                public: all.length 
            });
        } catch(e) {}
    };

    useEffect(() => { 
        db.getSystemSettings().then(s => setLocalPath(s.localLibraryPath || '')); 
        loadStats();
    }, []);

    const addToLog = (msg: string) => { setScanLog(prev => [`> ${msg}`, ...prev].slice(0, 50)); };

    const handleStep1 = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        addToLog('Iniciando escaneo de disco...');
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            
            // Mostrar mensaje detallado del backend
            if (res.message) addToLog(res.message);
            addToLog(`Escaneo completado. Encontrados: ${res.totalFound}. Nuevos: ${res.newToImport}`);
            
            toast.success("Paso 1 Finalizado");
            loadStats();
        } catch (e: any) { addToLog(`ERROR: ${e.message}`); }
        finally { setIsIndexing(false); }
    };

    const handleStep2 = async () => {
        addToLog("Buscando videos PENDING...");
        try {
            const pending = await db.getUnprocessedVideos(50, 'normal');
            if (pending.length === 0) {
                addToLog("No hay videos PENDING.");
                return;
            }
            setScanQueue(pending);
            setCurrentScanIndex(0);
            setActiveScan(true);
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
    };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null, success: boolean) => {
        const item = scanQueue[currentScanIndex];
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail, success);
            addToLog(`${success ? '[OK]' : '[FAIL]'} ${item.title}`);
        } catch (e) { console.error(e); }
        
        if (currentScanIndex + 1 >= scanQueue.length) {
            setActiveScan(false);
            toast.success("Paso 2 Finalizado");
            addToLog("Lote procesado. Listos para Paso 3.");
            loadStats();
        } else {
            setCurrentScanIndex(prev => prev + 1);
        }
    };

    const handleStep3 = async () => {
        setIsOrganizing(true);
        addToLog("Iniciando Organización de videos...");
        try {
            const res = await db.smartOrganizeLibrary();
            addToLog(`Procesados: ${res.processed}. Pendientes: ${res.remaining}`);
            if (res.processed > 0) {
                toast.success("Publicación completada");
                db.setHomeDirty();
            } else addToLog("No hay videos en PROCESSING.");
            loadStats();
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsOrganizing(false); }
    };

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Database className="text-indigo-400"/> Gestión de Librería</h2>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Pendientes (P1)</div>
                    <div className="text-xl font-bold text-amber-500 flex items-center justify-center gap-1"><Clock size={16}/> {stats.pending}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">En Cola (P2)</div>
                    <div className="text-xl font-bold text-blue-500 flex items-center justify-center gap-1"><RefreshCw size={16}/> {stats.processing}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Públicos (Final)</div>
                    <div className="text-xl font-bold text-emerald-500 flex items-center justify-center gap-1"><CheckCircle2 size={16}/> {stats.public}</div>
                </div>
            </div>
            
            {/* STEP 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-400"><span className="bg-blue-400/20 w-6 h-6 rounded flex items-center justify-center text-xs">1</span> Escaneo de Disco</h3>
                <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold tracking-wider">Registra los archivos físicos en la base de datos.</p>
                <div className="flex gap-2">
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="flex-1 bg-black border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono" placeholder="/ruta/videos" />
                    <button onClick={handleStep1} disabled={isIndexing} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        {isIndexing ? <RefreshCw className="animate-spin" size={16}/> : <FolderSearch size={16}/>} Escanear
                    </button>
                </div>
            </div>

            {/* STEP 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-emerald-400"><span className="bg-emerald-400/20 w-6 h-6 rounded flex items-center justify-center text-xs">2</span> Extracción Visual (Browser)</h3>
                <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold tracking-wider">Captura miniaturas y duración. Requiere que esta pestaña esté activa.</p>
                <button onClick={handleStep2} disabled={activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all">
                    <Film size={18}/> Iniciar Extracción {stats.pending > 0 && `(${stats.pending})`}
                </button>
            </div>

            {/* STEP 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-purple-400"><span className="bg-purple-400/20 w-6 h-6 rounded flex items-center justify-center text-xs">3</span> Organización Inteligente</h3>
                <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold tracking-wider">Aplica limpieza de nombres, categorías y precios base.</p>
                <button onClick={handleStep3} disabled={isOrganizing} className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all">
                    {isOrganizing ? <RefreshCw className="animate-spin" size={18}/> : <Wand2 size={18}/>} Publicar Videos {stats.processing > 0 && `(${stats.processing})`}
                </button>
            </div>

            {/* LOG */}
            <div className="bg-black p-4 rounded-xl border border-slate-800 h-40 overflow-y-auto font-mono text-[10px] text-slate-400 shadow-inner">
                {scanLog.map((l, i) => <div key={i} className="border-b border-white/5 py-1">{l}</div>)}
                {scanLog.length === 0 && <div className="opacity-30">Consola de mantenimiento lista...</div>}
            </div>

            {activeScan && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-md text-center shadow-2xl">
                        <h4 className="font-bold text-white mb-2 flex items-center justify-center gap-2"><Film size={18} className="text-emerald-400"/> Procesando {currentScanIndex + 1} de {scanQueue.length}</h4>
                        <p className="text-[10px] text-slate-400 mb-4 truncate font-mono">{scanQueue[currentScanIndex].title}</p>
                        <ScannerPlayer key={scanQueue[currentScanIndex].id} video={scanQueue[currentScanIndex]} onComplete={handleVideoProcessed} />
                        <div className="mt-6 space-y-3">
                            <p className="text-[10px] text-slate-500 italic">Si el video no carga tras 10 segundos, el sistema lo saltará automáticamente para evitar bloqueos.</p>
                            <button onClick={() => setActiveScan(false)} className="text-red-400 text-xs font-bold uppercase tracking-widest hover:text-red-300">Detener Extracción</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}