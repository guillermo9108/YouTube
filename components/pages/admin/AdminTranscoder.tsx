
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Bug, X, Copy, Terminal, Layers, Clock, FileVideo, ShieldCheck, Zap, Pause, Filter, History } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    
    // -- Estados Persistentes (localStorage) --
    const [isRunning, setIsRunning] = useState(() => localStorage.getItem('sp_tr_running') === 'true');
    const [batchSize, setBatchSize] = useState(() => parseInt(localStorage.getItem('sp_tr_batch') || '1'));
    
    // -- Filtros Persistentes --
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('sp_tr_filters');
        return saved ? JSON.parse(saved) : {
            days: 0,
            onlyNonMp4: true,
            onlyIncompatible: true
        };
    });

    // -- Datos del Servidor --
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    
    // -- UI Helpers --
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const isRunningRef = useRef(isRunning);
    const loopActive = useRef(false);

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

    // Al cargar el componente y persistir filtros
    useEffect(() => { 
        loadStats(); 
        if (isRunning) {
            runBatch();
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('sp_tr_filters', JSON.stringify(filters));
    }, [filters]);

    // Sincronizar estados con Ref y LocalStorage
    useEffect(() => {
        isRunningRef.current = isRunning;
        localStorage.setItem('sp_tr_running', isRunning.toString());
    }, [isRunning]);

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
            toast.info(`Escaneo: ${res.count} videos cumplen los criterios.`);
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
            toast.success(`${res.affected} videos listos para convertir.`);
            setScanResult(null);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
    };

    const runBatch = async () => {
        if (loopActive.current) return;
        
        loopActive.current = true;
        setIsRunning(true);
        addToLog(`Motor activado. Procesando en lotes de ${batchSize}...`);
        
        const loop = async () => {
            if (!isRunningRef.current) {
                loopActive.current = false;
                return;
            }
            
            try {
                const res = await db.request<any>(`action=admin_transcode_batch&limit=${batchSize}`);
                if (res.processed > 0) {
                    addToLog(`Éxito: ${res.processed} video(s) convertidos.`);
                    loadStats();
                }
                
                if (!res.completed && isRunningRef.current) {
                    // Pequeña pausa para no saturar el event loop
                    setTimeout(loop, 2000); 
                } else {
                    setIsRunning(false);
                    loopActive.current = false;
                    addToLog(res.completed ? "Procesamiento finalizado." : "Motor detenido.");
                }
            } catch (e: any) {
                addToLog(`FALLO: ${e.message}`);
                setIsRunning(false);
                loopActive.current = false;
            }
        };
        loop();
    };

    const stopBatch = () => {
        setIsRunning(false);
        addToLog("Solicitud de pausa enviada...");
    };

    const totalInvolved = stats.waiting + stats.done + stats.processing;
    const progressPercent = totalInvolved > 0 ? Math.round((stats.done / totalInvolved) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in max-w-6xl mx-auto pb-24">
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* COLUMNA FILTROS */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Filter size={18} className="text-indigo-400"/> Segmentación
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest">Días desde el registro</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 text-slate-500" size={14}/>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={filters.days} 
                                        onChange={e => setFilters({...filters, days: parseInt(e.target.value) || 0})}
                                        placeholder="0 = Todos"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${filters.onlyNonMp4 ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-900 border-slate-700'}`}>
                                        {filters.onlyNonMp4 && <CheckCircle2 size={12} className="text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        hidden
                                        checked={filters.onlyNonMp4} 
                                        onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})}
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-white">Formatos no-MP4</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${filters.onlyIncompatible ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-900 border-slate-700'}`}>
                                        {filters.onlyIncompatible && <CheckCircle2 size={12} className="text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        hidden
                                        checked={filters.onlyIncompatible} 
                                        onChange={e => setFilters({...filters, onlyIncompatible: e.target.checked})}
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-white">Incompatibles</span>
                                </label>
                            </div>

                            <button 
                                onClick={handlePreScan}
                                disabled={isScanning}
                                className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-500/20 transition-all active:scale-95"
                            >
                                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <Layers size={14}/>}
                                Pre-Escanear Videos
                            </button>

                            {scanResult !== null && (
                                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl animate-in zoom-in-95 text-center">
                                    <p className="text-xs text-emerald-400 mb-3 font-medium">Encontrados: <strong>{scanResult}</strong></p>
                                    <button 
                                        onClick={handleAddFilteredToQueue}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-[10px] uppercase tracking-tighter shadow-lg shadow-emerald-900/20"
                                    >
                                        Agregar a la cola
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Zap size={18} className="text-amber-400"/> Potencia de Lote
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Simultáneos</span>
                                <span className="text-sm font-black text-amber-400">{batchSize}</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" max="10" 
                                value={batchSize} 
                                onChange={e => setBatchSize(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="bg-amber-900/10 p-3 rounded-lg border border-amber-500/10">
                                <p className="text-[9px] text-amber-500/70 italic leading-snug">
                                    Nota: Valores altos aceleran la cola pero aumentan drásticamente la carga de CPU de tu NAS.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA DASHBOARD PRINCIPAL */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        
                        {/* Efecto decorativo de CPU de fondo */}
                        <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none text-indigo-500">
                            <Cpu size={250} />
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
                            <div className="flex items-center gap-5">
                                <div className={`p-5 rounded-3xl transition-all duration-500 ${isRunning ? 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : 'bg-slate-800'}`}>
                                    <Cpu size={32} className={isRunning ? 'text-white animate-spin-slow' : 'text-slate-500'} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Estado del Motor</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                        <span className={`text-xs font-black uppercase tracking-[0.2em] ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isRunning ? 'Procesando activamente' : 'Motor en Standby'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                {!isRunning ? (
                                    <button onClick={runBatch} className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-indigo-900/40 active:scale-95 transition-all">
                                        <Play size={20} fill="currentColor"/> INICIAR MOTOR
                                    </button>
                                ) : (
                                    <button onClick={stopBatch} className="flex-1 md:flex-none px-10 py-4 bg-slate-800 hover:bg-red-900/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-2xl font-black flex items-center justify-center gap-3 transition-all">
                                        <Pause size={20} fill="currentColor"/> PAUSAR COLA
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* BARRA DE PROGRESO INTEGRAL */}
                        <div className="mb-10 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                            <div className="flex justify-between items-end mb-3 px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronización Total</span>
                                    <span className="text-xs text-slate-400 font-bold">{stats.done} de {totalInvolved} completados</span>
                                </div>
                                <span className="text-3xl font-black text-white tabular-nums">{progressPercent}%</span>
                            </div>
                            <div className="h-5 bg-slate-900 border border-slate-800 rounded-full p-1 overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(79,70,229,0.3)] relative"
                                    style={{ width: `${progressPercent}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                            </div>
                        </div>

                        {/* GRID DE ESTADÍSTICAS */}
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
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">Finalizados</div>
                                <div className="text-2xl font-black text-emerald-400">{stats.done}</div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex flex-col items-center group hover:border-red-500/30 transition-colors">
                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">Errores</div>
                                <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                            </div>
                        </div>

                        {/* TERMINAL DE REGISTROS */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Terminal size={14}/> Consola de Eventos
                                </span>
                                {db.lastRawResponse && (
                                    <button onClick={() => setShowDiagnostic(true)} className="text-[10px] font-black text-amber-500/70 hover:text-amber-500 transition-colors uppercase">Depuración Avanzada</button>
                                )}
                            </div>
                            <div className="bg-black/95 rounded-2xl p-5 font-mono text-[11px] h-40 overflow-y-auto space-y-2 scrollbar-hide border border-slate-800/50 shadow-inner">
                                {log.map((line, i) => (
                                    <div key={i} className={`flex gap-3 ${line.includes('FALLO') || line.includes('Error') ? 'text-red-400' : 'text-slate-400'}`}>
                                        <span className="opacity-20 shrink-0 select-none">{">"}</span>
                                        <span className="leading-relaxed">{line}</span>
                                    </div>
                                ))}
                                {log.length === 0 && <div className="opacity-20 italic text-center py-10">Esperando comunicación con el motor local...</div>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600/5 border border-indigo-500/20 p-6 rounded-3xl flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                            <History size={24}/>
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm">Estado Persistente Activado</h4>
                            <p className="text-xs text-slate-400">Puedes cerrar esta pestaña o la sesión; los videos en cola continuarán procesándose siempre que dejes el motor encendido.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE DIAGNÓSTICO CRUDO */}
            {showDiagnostic && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3">
                                <Bug size={18} className="text-amber-500"/> Auditoría de Respuestas PHP
                            </h3>
                            <button onClick={() => setShowDiagnostic(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto bg-black font-mono text-[10px] text-emerald-500 whitespace-pre-wrap selection:bg-emerald-500 selection:text-black">
                            {db.lastRawResponse || "No hay respuestas registradas aún."}
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                            <button 
                                onClick={() => { navigator.clipboard.writeText(db.lastRawResponse); toast.success("Copiado"); }}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                            >
                                <Copy size={14}/> Copiar Log
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
