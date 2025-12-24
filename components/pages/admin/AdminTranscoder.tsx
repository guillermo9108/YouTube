
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, Filter, History } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    
    // -- Estados Persistentes (localStorage) --
    const [isRunning, setIsRunning] = useState(false);
    const [batchSize, setBatchSize] = useState(() => parseInt(localStorage.getItem('sp_tr_batch') || '1'));
    
    // -- Filtros Persistentes --
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('sp_tr_filters');
        return saved ? JSON.parse(saved) : { days: 0, onlyNonMp4: true, onlyIncompatible: true };
    });

    // -- Datos del Servidor --
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    
    const loopActive = useRef(false);
    const stopRequested = useRef(false);

    const loadStats = async () => {
        try {
            const all = await db.getAllVideos();
            const waiting = all.filter((v: any) => v.transcode_status === 'WAITING').length;
            const processing = all.filter((v: any) => v.transcode_status === 'PROCESSING').length;
            const failed = all.filter((v: any) => v.transcode_status === 'FAILED').length;
            const done = all.filter((v: any) => v.transcode_status === 'DONE').length;
            setStats({ waiting, processing, failed, done });

            // Verificar estado del motor en el servidor
            const settings = await db.getSystemSettings();
            if (settings.is_transcoder_active) {
                if (!isRunning) {
                    setIsRunning(true);
                    addToLog("Motor detectado como ACTIVO en el servidor. Sincronizando...");
                }
            } else {
                setIsRunning(false);
            }
        } catch (e) {}
    };

    // Al cargar el componente
    useEffect(() => { 
        loadStats(); 
    }, []);

    // Monitorear cambios en isRunning para manejar el bucle
    useEffect(() => {
        if (isRunning && !loopActive.current) {
            runBatchLoop();
        }
    }, [isRunning]);

    useEffect(() => {
        localStorage.setItem('sp_tr_filters', JSON.stringify(filters));
    }, [filters]);

    useEffect(() => {
        localStorage.setItem('sp_tr_batch', batchSize.toString());
    }, [batchSize]);

    const addToLog = (msg: string) => { 
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30)); 
    };

    // -- ACCIONES --

    const handlePreScan = async () => {
        setIsScanning(true);
        setScanResult(null);
        try {
            const res = await db.request<{count: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'PREVIEW' })
            });
            setScanResult(res.count);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAddFilteredToQueue = async () => {
        if (!confirm(`¿Confirmas agregar ${scanResult} videos a la cola?`)) return;
        try {
            const res = await db.request<{affected: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'EXECUTE' })
            });
            toast.success(`${res.affected} videos añadidos.`);
            setScanResult(null);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        if (isRunning) return;
        try {
            // Avisar al servidor que el motor debe encenderse
            await db.updateSystemSettings({ is_transcoder_active: true });
            setIsRunning(true);
            stopRequested.current = false;
            addToLog("Encendiendo motor global...");
        } catch (e: any) { toast.error(e.message); }
    };

    const stopMotor = async () => {
        try {
            // Avisar al servidor que el motor debe apagarse
            await db.updateSystemSettings({ is_transcoder_active: false });
            stopRequested.current = true;
            addToLog("Señal de parada enviada. El motor se detendrá al finalizar el video actual.");
        } catch (e: any) { toast.error(e.message); }
    };

    const runBatchLoop = async () => {
        if (loopActive.current) return;
        loopActive.current = true;

        const loop = async () => {
            // 1. Verificar si el usuario pidió parar desde el frontend
            if (stopRequested.current) {
                loopActive.current = false;
                setIsRunning(false);
                addToLog("Motor detenido exitosamente.");
                return;
            }

            try {
                // Solicitar proceso de 1 video (batchSize 1 para evitar saturación)
                const res = await db.request<any>(`action=admin_transcode_batch&limit=1`);
                
                if (res.processed > 0) {
                    addToLog(`Éxito: Video convertido correctamente.`);
                    loadStats();
                }

                // 2. Verificar si el servidor apagó el motor (ej: cola vacía)
                const settings = await db.getSystemSettings();
                if (!settings.is_transcoder_active) {
                    setIsRunning(false);
                    loopActive.current = false;
                    addToLog(res.completed ? "Procesamiento finalizado (Cola vacía)." : "Motor apagado por servidor.");
                    return;
                }

                // Continuar bucle
                setTimeout(loop, 4000);
            } catch (e: any) {
                addToLog(`Error: ${e.message}`);
                // Si hay error, apagamos por seguridad
                await db.updateSystemSettings({ is_transcoder_active: false });
                setIsRunning(false);
                loopActive.current = false;
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
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Filter size={18} className="text-indigo-400"/> Segmentación
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest">Antigüedad (Días)</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 text-slate-500" size={14}/>
                                    <input 
                                        type="number" min="0"
                                        value={filters.days} 
                                        onChange={e => setFilters({...filters, days: parseInt(e.target.value) || 0})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                                    />
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
                        <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none text-indigo-500"><Cpu size={250} /></div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className={`p-5 rounded-3xl transition-all duration-500 ${isRunning ? 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : 'bg-slate-800'}`}>
                                    <Cpu size={32} className={isRunning ? 'text-white animate-spin-slow' : 'text-slate-500'} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Motor de Conversión</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                        <span className={`text-xs font-black uppercase tracking-[0.2em] ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isRunning ? 'Ejecutando proceso' : 'Motor en Standby'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                {!isRunning ? (
                                    <button onClick={startMotor} className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-indigo-900/40 active:scale-95 transition-all">
                                        <Play size={20} fill="currentColor"/> INICIAR MOTOR
                                    </button>
                                ) : (
                                    <button onClick={stopMotor} className="flex-1 md:flex-none px-10 py-4 bg-slate-800 hover:bg-red-900/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-2xl font-black flex items-center justify-center gap-3 transition-all">
                                        <Pause size={20} fill="currentColor"/> PAUSAR MOTOR
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mb-10 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                            <div className="flex justify-between items-end mb-3 px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado de la Cola</span>
                                    <span className="text-xs text-slate-400 font-bold">{stats.done} completados</span>
                                </div>
                                <span className="text-3xl font-black text-white tabular-nums">{progressPercent}%</span>
                            </div>
                            <div className="h-5 bg-slate-900 border border-slate-800 rounded-full p-1 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(79,70,229,0.3)]" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:border-amber-500/30 transition-colors">
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">En Cola</div>
                                <div className="text-2xl font-black text-amber-500">{stats.waiting}</div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:border-blue-500/30 transition-colors">
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">Activos</div>
                                <div className="text-2xl font-black text-blue-400">{stats.processing}</div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:border-emerald-500/30 transition-colors">
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">Listos</div>
                                <div className="text-2xl font-black text-emerald-400">{stats.done}</div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:border-red-500/30 transition-colors">
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">Errores</div>
                                <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2 px-2"><Terminal size={14}/> Log de Eventos</span>
                            <div className="bg-black/95 rounded-2xl p-5 font-mono text-[11px] h-40 overflow-y-auto space-y-2 border border-slate-800/50 shadow-inner scrollbar-hide">
                                {log.map((line, i) => (
                                    <div key={i} className={`flex gap-3 ${line.includes('Error') ? 'text-red-400' : 'text-slate-400'}`}>
                                        <span className="opacity-20 shrink-0 select-none">{">"}</span>
                                        <span className="leading-relaxed">{line}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600/5 border border-indigo-500/20 p-6 rounded-3xl flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400"><History size={24}/></div>
                        <div>
                            <h4 className="text-white font-bold text-sm">Prevención de Saturación</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">El motor usa semáforos en base de datos. Solo un video se procesa a la vez independientemente de cuántas pestañas tengas abiertas.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
