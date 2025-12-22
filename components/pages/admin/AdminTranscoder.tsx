import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Layers, ShieldCheck, Bug, Search, Filter, Calendar, HardDrive, FileType } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    const [batchSize, setBatchSize] = useState(1);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
    const [log, setLog] = useState<string[]>([]);
    
    // Filtros de Escaneo
    const [isScanningIncompatible, setIsScanningIncompatible] = useState(false);
    const [scanConfig, setScanConfig] = useState({
        days: 0,
        source: 'ALL', // ALL, LOCAL, SERVER
        onlyNonMp4: false
    });

    const loadStats = async () => {
        try {
            const all = await db.getAllVideos();
            const waiting = all.filter((v: any) => v.transcode_status === 'WAITING').length;
            const processing = all.filter((v: any) => v.transcode_status === 'PROCESSING').length;
            const failed = all.filter((v: any) => v.transcode_status === 'FAILED').length;
            const done = all.filter((v: any) => v.transcode_status === 'DONE').length;
            setStats({ waiting, processing, failed, done });
        } catch (e) {}
    };

    const checkFfmpeg = async () => {
        try {
            const res = await db.request<any>('action=admin_get_local_stats');
            setFfmpegOk(res.ffmpeg_available);
            if(!res.ffmpeg_available) {
                addToLog("AVISO: FFmpeg no detectado. Instala FFmpeg para habilitar la conversión.");
            }
        } catch (e) {}
    };

    useEffect(() => { 
        loadStats(); 
        checkFfmpeg();
    }, []);

    const addToLog = (msg: string) => { 
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50)); 
    };

    const handleScanIncompatible = async () => {
        if (isScanningIncompatible) return;
        setIsScanningIncompatible(true);
        addToLog(`Iniciando escaneo (Filtros: ${scanConfig.source}, >${scanConfig.days}d, Solo No-MP4: ${scanConfig.onlyNonMp4 ? 'Sí' : 'No'})...`);
        
        try {
            const res = await db.request<any>('action=admin_scan_incompatible', {
                method: 'POST',
                body: JSON.stringify(scanConfig)
            });
            
            addToLog(`Escaneo finalizado. Analizados: ${res.scanned}. Marcados para convertir: ${res.marked}.`);
            
            if (res.marked > 0) {
                toast.success(`${res.marked} videos añadidos a la cola.`);
                loadStats();
            } else {
                toast.info("No se encontraron nuevos videos incompatibles.");
            }
        } catch (e: any) {
            addToLog(`ERROR EN ESCANEO: ${e.message}`);
            toast.error("Fallo al escanear videos");
        } finally {
            setIsScanningIncompatible(false);
        }
    };

    const runBatch = async () => {
        if (isRunningRef.current) return;
        setIsRunning(true);
        isRunningRef.current = true;
        addToLog(`Iniciando motor con lote de ${batchSize} video(s)...`);
        
        const loop = async () => {
            if (!isRunningRef.current) return;
            try {
                const res = await db.request<any>(`action=admin_transcode_batch&limit=${batchSize}`);
                if (res.processed > 0) {
                    addToLog(`Éxito: ${res.processed} video(s) convertidos.`);
                    loadStats();
                }
                if (!res.completed && isRunningRef.current) {
                    setTimeout(loop, 2000);
                } else {
                    setIsRunning(false);
                    isRunningRef.current = false;
                    addToLog(res.completed ? "Cola de transcodificación finalizada." : "Proceso detenido.");
                }
            } catch (e: any) {
                addToLog(`FALLO CRÍTICO: ${e.message}`);
                setIsRunning(false);
                isRunningRef.current = false;
            }
        };
        loop();
    };

    const stopBatch = () => {
        isRunningRef.current = false;
        setIsRunning(false);
        addToLog("Deteniendo procesos...");
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-6xl mx-auto">
            {/* Cabecera y Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${isRunning ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Cpu size={28} className={isRunning ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                Motor de Conversión
                                {ffmpegOk === true && <span title="FFmpeg OK"><ShieldCheck size={16} className="text-emerald-500" /></span>}
                                {ffmpegOk === false && <span title="FFmpeg No Encontrado"><AlertTriangle size={16} className="text-red-500" /></span>}
                            </h3>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Optimización de Compatibilidad H.264</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="px-3">
                            <label className="block text-[9px] uppercase font-black text-slate-500 mb-1">Simultáneos</label>
                            <select 
                                value={batchSize} 
                                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                                disabled={isRunning}
                                className="bg-transparent text-white font-bold outline-none cursor-pointer text-sm"
                            >
                                {[1, 2, 3, 5, 10].map(n => <option key={n} value={n} className="bg-slate-900">{n} video(s)</option>)}
                            </select>
                        </div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        {!isRunning ? (
                            <button 
                                onClick={runBatch} 
                                disabled={stats.waiting === 0 || ffmpegOk === false}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                            >
                                <Play size={18}/> Iniciar Motor
                            </button>
                        ) : (
                            <button 
                                onClick={stopBatch} 
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg animate-pulse"
                            >
                                <RefreshCw className="animate-spin" size={18}/> Detener
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">En Espera</div>
                        <div className="text-2xl font-black text-amber-500">{stats.waiting}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Procesando</div>
                        <div className="text-2xl font-black text-blue-400">{stats.processing}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Listos</div>
                        <div className="text-2xl font-black text-emerald-400">{stats.done}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Fallidos</div>
                        <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                    </div>
                </div>

                {/* Panel de Filtros de Escaneo */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4 text-white font-bold text-sm uppercase tracking-wider">
                        <Filter size={16} className="text-indigo-400"/> Opciones de Escaneo de Incompatibilidad
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Filtro por Antigüedad */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Calendar size={12}/> Agregados hace (Días)</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="range" min="0" max="60" value={scanConfig.days} 
                                    onChange={e => setScanConfig({...scanConfig, days: parseInt(e.target.value)})}
                                    className="flex-1 accent-indigo-500"
                                />
                                <span className="text-sm font-mono text-white w-12">{scanConfig.days === 0 ? '∞' : scanConfig.days + 'd'}</span>
                            </div>
                        </div>

                        {/* Filtro por Origen */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><HardDrive size={12}/> Origen de Archivos</label>
                            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                {['ALL', 'LOCAL', 'SERVER'].map(s => (
                                    <button 
                                        key={s} onClick={() => setScanConfig({...scanConfig, source: s})}
                                        className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${scanConfig.source === s ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                    >
                                        {s === 'ALL' ? 'Todos' : s === 'LOCAL' ? 'NAS' : 'Subidos'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro por Extensión */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><FileType size={12}/> Formato</label>
                            <label className="flex items-center gap-3 cursor-pointer group bg-slate-900 p-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-colors">
                                <input 
                                    type="checkbox" checked={scanConfig.onlyNonMp4}
                                    onChange={e => setScanConfig({...scanConfig, onlyNonMp4: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 accent-indigo-500"
                                />
                                <span className="text-[11px] font-bold text-slate-300">Sólo archivos NO .MP4</span>
                            </label>
                        </div>
                    </div>

                    <button 
                        onClick={handleScanIncompatible}
                        disabled={isScanningIncompatible || isRunning || ffmpegOk === false}
                        className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-700 shadow-xl"
                    >
                        {isScanningIncompatible ? <RefreshCw className="animate-spin" size={18}/> : <Search size={18}/>}
                        {isScanningIncompatible ? 'Analizando archivos...' : 'Iniciar Escaneo Inteligente'}
                    </button>
                </div>

                {/* Consola */}
                <div className="bg-black/80 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                             <Bug size={12}/> Consola de Diagnóstico
                         </span>
                         <button onClick={() => setLog([])} className="text-[9px] text-slate-600 hover:text-white uppercase font-bold">Limpiar</button>
                    </div>
                    <div className="h-48 overflow-y-auto p-4 font-mono text-[11px] space-y-1">
                        {log.length === 0 ? (
                            <p className="text-slate-700 italic">Esperando órdenes...</p>
                        ) : (
                            log.map((line, i) => (
                                <div key={i} className={`py-1 border-b border-white/5 ${line.includes('ERROR') || line.includes('FALLO') ? 'text-red-400' : line.includes('Éxito') ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {line}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}