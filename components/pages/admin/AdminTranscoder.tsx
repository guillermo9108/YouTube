
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Bug, X, Copy, Terminal, Layers, Clock, FileVideo, ShieldCheck, Zap, Pause } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    
    // -- Estados Persistentes (localStorage) --
    const [isRunning, setIsRunning] = useState(() => localStorage.getItem('sp_tr_running') === 'true');
    const [batchSize, setBatchSize] = useState(() => parseInt(localStorage.getItem('sp_tr_batch') || '1'));
    
    // -- Filtros --
    const [filters, setFilters] = useState({
        days: 0,
        onlyNonMp4: true,
        onlyIncompatible: true
    });

    // -- Datos del Servidor --
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    
    // -- UI Helpers --
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const isRunningRef = useRef(isRunning);

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

    // Al cargar el componente
    useEffect(() => { 
        loadStats(); 
        if (isRunning) {
            runBatch();
        }
    }, []);

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
            toast.info(`Escaneo completado: ${res.count} videos coinciden.`);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAddFilteredToQueue = async () => {
        if (!confirm(`¿Deseas agregar ${scanResult} videos a la cola de conversión?`)) return;
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

    const runBatch = async () => {
        if (isRunning && !isRunningRef.current) return; // Ya está corriendo un bucle
        
        setIsRunning(true);
        addToLog(`Motor iniciado. Lote: ${batchSize} video(s).`);
        
        const loop = async () => {
            if (!isRunningRef.current) return;
            
            try {
                const res = await db.request<any>(`action=admin_transcode_batch&limit=${batchSize}`);
                if (res.processed > 0) {
                    addToLog(`Éxito: ${res.processed} procesado(s).`);
                    loadStats();
                }
                
                if (!res.completed && isRunningRef.current) {
                    setTimeout(loop, 3000); // Pausa de 3s entre peticiones para respirar
                } else {
                    setIsRunning(false);
                    addToLog(res.completed ? "Cola terminada." : "Motor detenido por el usuario.");
                }
            } catch (e: any) {
                addToLog(`FALLO CRÍTICO: ${e.message}`);
                setIsRunning(false);
                if (e.message.includes('CORRUPTA')) toast.error("Error de comunicación servidor.");
            }
        };
        loop();
    };

    const stopBatch = () => {
        setIsRunning(false);
        addToLog("Deteniendo al finalizar lote actual...");
    };

    const totalInvolved = stats.waiting + stats.done + stats.processing;
    const progressPercent = totalInvolved > 0 ? Math.round((stats.done / totalInvolved) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto pb-20">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* PANEL IZQUIERDO: CONFIG & FILTROS */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Layers size={18} className="text-indigo-400"/> Escáner de Incompatibilidad
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Días desde creación</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={filters.days} 
                                    onChange={e => setFilters({...filters, days: parseInt(e.target.value) || 0})}
                                    placeholder="0 = Todos los tiempos"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.onlyNonMp4} 
                                        onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})}
                                        className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Solo formatos no-MP4</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.onlyIncompatible} 
                                        onChange={e => setFilters({...filters, onlyIncompatible: e.target.checked})}
                                        className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Solo marcados como incompatibles</span>
                                </label>
                            </div>

                            <button 
                                onClick={handlePreScan}
                                disabled={isScanning}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 border border-slate-700"
                            >
                                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <Zap size={14}/>}
                                Pre-Escanear Videos
                            </button>

                            {scanResult !== null && (
                                <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-xl animate-in zoom-in-95">
                                    <p className="text-xs text-indigo-300 text-center mb-2 font-medium">Se encontraron <strong>{scanResult}</strong> videos.</p>
                                    <button 
                                        onClick={handleAddFilteredToQueue}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase"
                                    >
                                        Agregar a la cola
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-emerald-400"/> Configuración de Lote
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Videos por petición</label>
                                    <span className="text-xs font-bold text-emerald-400">{batchSize}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" max="10" 
                                    value={batchSize} 
                                    onChange={e => setBatchSize(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <p className="text-[9px] text-slate-500 mt-2 italic leading-relaxed">
                                    * Aumentar el lote acelera el proceso pero puede saturar el CPU de tu NAS. Recomendado: 1-2.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PANEL CENTRAL: PROGRESO & MOTOR */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        
                        {/* Background Decor */}
                        <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none text-indigo-500">
                            <Cpu size={200} />
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl ${isRunning ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-slate-800'}`}>
                                    <Cpu size={24} className={isRunning ? 'text-white animate-spin' : 'text-slate-500'} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Estado del Motor</h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isRunning ? 'Ejecutando Cola' : 'Motor en Pausa'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                {!isRunning ? (
                                    <button onClick={runBatch} className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20 active:scale-95 transition-all">
                                        <Play size={18} fill="currentColor"/> Iniciar Procesos
                                    </button>
                                ) : (
                                    <button onClick={stopBatch} className="flex-1 md:flex-none px-8 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                                        <Pause size={18} fill="currentColor"/> Pausar Motor
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Barra de Progreso */}
                        <div className="mb-8">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progreso de la Cola Actual</span>
                                <span className="text-xl font-black text-white">{progressPercent}%</span>
                            </div>
                            <div className="h-4 bg-slate-950 border border-slate-800 rounded-full p-0.5 overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-500">
                                <span>TOTAL: {totalInvolved}</span>
                                <span className="text-emerald-400">LISTOS: {stats.done}</span>
                            </div>
                        </div>

                        {/* Stats Cards Mini */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                                <div className="text-[9px] text-slate-500 font-black uppercase mb-1">En Espera</div>
                                <div className="text-lg font-bold text-amber-500">{stats.waiting}</div>
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                                <div className="text-[9px] text-slate-500 font-black uppercase mb-1">Procesando</div>
                                <div className="text-lg font-bold text-blue-400">{stats.processing}</div>
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                                <div className="text-[9px] text-slate-500 font-black uppercase mb-1">Finalizados</div>
                                <div className="text-lg font-bold text-emerald-400">{stats.done}</div>
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                                <div className="text-[9px] text-slate-500 font-black uppercase mb-1">Errores</div>
                                <div className="text-lg font-bold text-red-500">{stats.failed}</div>
                            </div>
                        </div>

                        {/* Terminal Log */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Terminal size={12}/> Eventos en Tiempo Real</span>
                                {db.lastRawResponse && (
                                    <button onClick={() => setShowDiagnostic(true)} className="text-[10px] font-bold text-amber-500 hover:underline">Ver Diagnóstico</button>
                                )}
                            </div>
                            <div className="bg-black/90 rounded-xl p-4 font-mono text-[11px] h-32 overflow-y-auto space-y-1.5 scrollbar-hide border border-slate-800">
                                {log.map((line, i) => (
                                    <div key={i} className={`flex gap-2 ${line.includes('FALLO') || line.includes('Fallo') ? 'text-red-400' : 'text-slate-400'}`}>
                                        <span className="opacity-30">#</span>
                                        <span>{line}</span>
                                    </div>
                                ))}
                                {log.length === 0 && <div className="opacity-20 italic">Esperando actividad del motor...</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Diagnóstico Crudo */}
            {showDiagnostic && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><Bug size={18} className="text-amber-500"/> Debugger de Salida</h3>
                            <button onClick={() => setShowDiagnostic(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X size={18}/></button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-black font-mono text-[10px] text-emerald-500 whitespace-pre-wrap">
                            {db.lastRawResponse}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
