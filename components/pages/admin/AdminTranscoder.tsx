import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, Filter, History, AlertCircle, Activity, Box, Radio } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [isBusyServer, setIsBusyServer] = useState(false);
    const [batchSize, setBatchSize] = useState(() => parseInt(localStorage.getItem('sp_tr_batch') || '1'));
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('sp_tr_filters');
        return saved ? JSON.parse(saved) : { days: 0, onlyNonMp4: true, onlyIncompatible: true };
    });
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const loopActive = useRef(false);
    const stopRequested = useRef(false);

    const loadStats = async (showSyncMessage = false) => {
        try {
            const all = await db.getAllVideos();
            const waiting = all.filter((v: any) => v.transcode_status === 'WAITING').length;
            const processingCount = all.filter((v: any) => v.transcode_status === 'PROCESSING').length;
            const failed = all.filter((v: any) => v.transcode_status === 'FAILED').length;
            const done = all.filter((v: any) => v.transcode_status === 'DONE').length;
            setStats({ waiting, processing: processingCount, failed, done });
            setIsBusyServer(processingCount > 0);
            
            const settings = await db.getSystemSettings();
            if (settings.is_transcoder_active) {
                if (!isRunning) {
                    setIsRunning(true);
                    stopRequested.current = false;
                }
            } else if (isRunning) {
                setIsRunning(false);
            }
        } catch (e) {}
    };

    useEffect(() => { 
        loadStats(true); 
        const interval = setInterval(() => loadStats(false), 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isRunning && !loopActive.current) runBatchLoop();
    }, [isRunning]);

    const addToLog = (msg: string) => { 
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30)); 
    };

    const handlePreScan = async () => {
        setIsScanning(true);
        try {
            const res = await db.request<{count: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'PREVIEW' })
            });
            setScanResult(res.count);
            toast.info(`Escaneo: ${res.count} videos`);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAddFilteredToQueue = async () => {
        if (!confirm(`¿Confirmas agregar ${scanResult} videos?`)) return;
        try {
            const res = await db.request<{affected: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'EXECUTE' })
            });
            toast.success(`${res.affected} en cola.`);
            setScanResult(null);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        if (isRunning) return;
        try {
            await db.updateSystemSettings({ is_transcoder_active: true });
            stopRequested.current = false;
            setIsRunning(true);
            addToLog("Encendiendo motor FFmpeg...");
        } catch (e: any) { toast.error(e.message); }
    };

    const stopMotor = async () => {
        try {
            stopRequested.current = true;
            await db.request(`action=admin_stop_transcoder`);
            setIsRunning(false);
            loopActive.current = false;
            toast.success("Motor detenido.");
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const runBatchLoop = async () => {
        if (loopActive.current) return;
        loopActive.current = true;
        
        const loop = async () => {
            if (stopRequested.current) {
                loopActive.current = false;
                setIsRunning(false);
                return;
            }
            
            try {
                const res = await db.request<any>(`action=admin_transcode_batch`);
                
                if (res.message === 'Servidor Ocupado') {
                    // Si el servidor está al límite, esperamos un poco más antes de reintentar
                    setTimeout(loop, 10000); 
                    return;
                }
                
                if (res.processed > 0) {
                    addToLog(`Éxito: Video optimizado.`);
                    loadStats();
                }

                if (res.completed) {
                    setIsRunning(false);
                    loopActive.current = false;
                    addToLog("Librería optimizada al 100%.");
                    await db.updateSystemSettings({ is_transcoder_active: false });
                    return;
                }

                // Continuar bucle si sigue activo
                const settings = await db.getSystemSettings();
                if (!settings.is_transcoder_active) {
                    setIsRunning(false);
                    loopActive.current = false;
                    addToLog("Motor apagado por el sistema.");
                    return;
                }

                setTimeout(loop, 4000);
            } catch (e: any) {
                addToLog(`Error: ${e.message}`);
                // Reintentar tras error con delay prudencial
                setTimeout(loop, 15000);
            }
        };
        loop();
    };

    const totalInvolved = stats.waiting + stats.done + stats.processing;
    const progressPercent = totalInvolved > 0 ? Math.round((stats.done / totalInvolved) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in max-w-6xl mx-auto pb-24 px-2">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"><Filter size={100} /></div>
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Filter size={18} className="text-indigo-400"/> Segmentación
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest">Antigüedad (Días)</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 text-slate-500" size={14}/>
                                    <input type="number" min="0" value={filters.days} onChange={e => setFilters({...filters, days: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                            </div>
                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={filters.onlyNonMp4} onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                    <span className="text-xs text-slate-400 group-hover:text-white">Formatos no-MP4</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={filters.onlyIncompatible} onChange={e => setFilters({...filters, onlyIncompatible: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                    <span className="text-xs text-slate-400 group-hover:text-white">Incompatibles</span>
                                </label>
                            </div>
                            <button onClick={handlePreScan} disabled={isScanning} className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-500/20 transition-all">
                                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <Layers size={14}/>} Pre-Escanear
                            </button>
                            {scanResult !== null && (
                                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl animate-in zoom-in-95 text-center">
                                    <p className="text-xs text-emerald-400 mb-3 font-medium">Coincidencias: <strong>{scanResult}</strong></p>
                                    <button onClick={handleAddFilteredToQueue} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-[10px] uppercase">Agregar a cola</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20"><Activity size={40} className={isRunning ? 'text-emerald-500 animate-pulse' : 'text-slate-500'} /></div>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className={`p-6 rounded-3xl transition-all duration-700 ${isRunning ? 'bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.5)] rotate-12 scale-110' : 'bg-slate-800'}`}>
                                    <Cpu size={40} className={isRunning ? 'text-white animate-spin' : 'text-slate-500'} style={{animationDuration: '3s'}} />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">Transcode Engine</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></div>
                                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isRunning ? 'System: Processing Batch' : 'System: Idle / Standby'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {!isRunning ? (
                                    <button onClick={startMotor} className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black flex items-center gap-3 shadow-2xl transition-all active:scale-95 group">
                                        <Play size={20} fill="currentColor" className="group-hover:scale-110 transition-transform"/> ENCENDER
                                    </button>
                                ) : (
                                    <button onClick={stopMotor} className="px-10 py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black flex items-center gap-3 shadow-2xl transition-all active:scale-95">
                                        <Pause size={20} fill="currentColor"/> APAGAR
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            {[
                                { label: 'En Espera', val: stats.waiting, color: 'text-amber-500', icon: Radio },
                                { label: 'Activos', val: stats.processing, color: 'text-blue-400', icon: Cpu },
                                { label: 'Optimizados', val: stats.done, color: 'text-emerald-400', icon: CheckCircle2 },
                                { label: 'Errores', val: stats.failed, color: 'text-red-500', icon: AlertCircle },
                            ].map((s, i) => (
                                <div key={i} className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:bg-slate-800/20 transition-all">
                                    <s.icon size={16} className={`${s.color} mb-3 opacity-50 group-hover:opacity-100 transition-opacity`}/>
                                    <div className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">{s.label}</div>
                                    <div className={`text-3xl font-black ${s.color}`}>{s.val}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-950/80 p-8 rounded-3xl border border-slate-800 shadow-inner">
                            <div className="flex justify-between items-end mb-4">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Estado de la Biblioteca</div>
                                <div className="text-4xl font-black text-white font-mono">{progressPercent}%</div>
                            </div>
                            <div className="h-6 bg-slate-900 border border-slate-800 rounded-full p-1.5 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-600 via-emerald-500 to-indigo-400 rounded-full transition-all duration-1000 shadow-[0_0_30px_rgba(79,70,229,0.3)]" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>

                        <div className="mt-10 space-y-3">
                            <div className="flex items-center gap-2 px-2 text-slate-600">
                                <Terminal size={14}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">Real-time Activity Stream</span>
                            </div>
                            <div className="bg-black rounded-2xl p-6 font-mono text-[11px] h-48 overflow-y-auto space-y-2 border border-slate-800 shadow-2xl scrollbar-hide">
                                {log.map((line, i) => (
                                    <div key={i} className={`flex gap-3 animate-in slide-in-from-left-2 ${line.includes('Error') ? 'text-red-400' : 'text-slate-500'}`}>
                                        <span className="opacity-10 shrink-0">#</span>
                                        <span className="leading-relaxed">{line}</span>
                                    </div>
                                ))}
                                {log.length === 0 && <div className="text-slate-800 italic animate-pulse">Initializing communication interface...</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}