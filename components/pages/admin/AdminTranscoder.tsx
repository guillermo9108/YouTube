
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, Filter, History, AlertCircle } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    
    // -- Estados --
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

            // Sincronización real con el servidor
            const settings = await db.getSystemSettings();
            if (settings.is_transcoder_active) {
                if (!isRunning) {
                    setIsRunning(true);
                    stopRequested.current = false;
                    if (showSyncMessage) addToLog("Motor sincronizado: Recuperando estado activo.");
                }
            } else {
                if (isRunning && !loopActive.current) {
                    setIsRunning(false);
                }
            }
        } catch (e) {}
    };

    // Inicialización y refresco periódico cada 15s
    useEffect(() => { 
        loadStats(true); 
        const interval = setInterval(() => loadStats(false), 15000);
        return () => clearInterval(interval);
    }, []);

    // Monitor del bucle infinito (Motor)
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
            toast.info(`Escaneo completado: ${res.count} videos.`);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAddFilteredToQueue = async () => {
        if (!confirm(`¿Confirmas agregar ${scanResult} videos a la cola de conversión?`)) return;
        try {
            const res = await db.request<{affected: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'EXECUTE' })
            });
            toast.success(`${res.affected} videos añadidos a la cola.`);
            setScanResult(null);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        if (isRunning) return;
        try {
            // Primero avisamos al servidor que encienda el semáforo
            await db.updateSystemSettings({ is_transcoder_active: true });
            stopRequested.current = false;
            setIsRunning(true);
            addToLog("Encendiendo motor de conversión...");
        } catch (e: any) { toast.error(e.message); }
    };

    const stopMotor = async () => {
        try {
            addToLog("Solicitando detención total al servidor...");
            stopRequested.current = true;
            // Acción física: El servidor matará el proceso FFmpeg inmediatamente
            await db.request(`action=admin_stop_transcoder`);
            setIsRunning(false);
            loopActive.current = false;
            toast.success("Motor detenido y CPU liberado.");
            addToLog("Motor apagado correctamente.");
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const runBatchLoop = async () => {
        if (loopActive.current) return;
        loopActive.current = true;

        const loop = async () => {
            // Verificación previa local
            if (stopRequested.current) {
                loopActive.current = false;
                setIsRunning(false);
                return;
            }

            try {
                // Solicitar procesamiento de un lote atómico (1 solo video para evitar timeouts)
                const res = await db.request<any>(`action=admin_transcode_batch`);
                
                if (res.processed > 0) {
                    addToLog(`Éxito: 1 video convertido correctamente.`);
                    loadStats();
                }

                // Si el servidor está ocupado, esperamos un poco más antes de la siguiente petición
                if (res.message === 'Servidor ocupado. Evitando saturación.') {
                    setTimeout(loop, 10000); 
                    return;
                }

                // Verificar si el servidor apagó el motor (ej: terminó la cola)
                const settings = await db.getSystemSettings();
                if (!settings.is_transcoder_active || res.completed) {
                    setIsRunning(false);
                    loopActive.current = false;
                    addToLog(res.completed ? "Librería al día. Cola finalizada." : "Motor detenido por el sistema.");
                    return;
                }

                // Siguiente iteración tras pausa de respiro para el disco
                setTimeout(loop, 4000);
            } catch (e: any) {
                addToLog(`Error Servidor: ${e.message}`);
                // Si hay un error de conexión, esperamos 15s antes de reintentar
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
                
                {/* FILTROS */}
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

                {/* DASHBOARD */}
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
                                            {isRunning ? 'Ejecutando lote' : 'Motor en Standby'}
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
                                    <button onClick={stopMotor} className="flex-1 md:flex-none px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                                        <Pause size={20} fill="currentColor"/> DETENER MOTOR
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Banner de Servidor Ocupado */}
                        {isBusyServer && (
                            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-400 text-sm animate-pulse">
                                <AlertCircle size={18}/>
                                <span>El servidor está procesando activamente un archivo. El motor esperará su turno automáticamente.</span>
                            </div>
                        )}

                        <div className="mb-10 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                            <div className="flex justify-between items-end mb-3 px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso de Librería</span>
                                    <span className="text-xs text-slate-400 font-bold">{stats.done} archivos convertidos</span>
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
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2 px-2"><Terminal size={14}/> Log de Eventos Real</span>
                            <div className="bg-black/95 rounded-2xl p-5 font-mono text-[11px] h-40 overflow-y-auto space-y-2 border border-slate-800/50 shadow-inner scrollbar-hide">
                                {log.map((line, i) => (
                                    <div key={i} className={`flex gap-3 ${line.includes('Error') ? 'text-red-400' : 'text-slate-400'}`}>
                                        <span className="opacity-20 shrink-0 select-none">{">"}</span>
                                        <span className="leading-relaxed">{line}</span>
                                    </div>
                                ))}
                                {log.length === 0 && <div className="text-slate-700 italic">Esperando inicio de motor...</div>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600/5 border border-indigo-500/20 p-6 rounded-3xl flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400"><History size={24}/></div>
                        <div>
                            <h4 className="text-white font-bold text-sm">Prevención de Saturación Activa</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">Al pulsar "DETENER MOTOR", se envía una señal de terminación inmediata al servidor. El estado se conserva aunque refresques la pestaña.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
