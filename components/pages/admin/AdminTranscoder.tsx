import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Layers, ShieldCheck, Bug } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false); // Usar ref para controlar el bucle sin problemas de scope
    const [batchSize, setBatchSize] = useState(1);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
    const [log, setLog] = useState<string[]>([]);

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
                addToLog("AVISO: FFmpeg no detectado en el servidor. La conversión fallará.");
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

    const runBatch = async () => {
        if (isRunningRef.current) return;
        setIsRunning(true);
        isRunningRef.current = true;
        addToLog(`Iniciando motor con lote de ${batchSize} video(s)...`);
        
        const loop = async () => {
            if (!isRunningRef.current) return;
            
            try {
                // Pasamos el limit explícitamente en la query
                const res = await db.request<any>(`action=admin_transcode_batch&limit=${batchSize}`);
                
                if (res.processed > 0) {
                    addToLog(`Éxito: ${res.processed} video(s) convertidos.`);
                    loadStats();
                }

                if (res.errors && res.errors.length > 0) {
                    res.errors.forEach((err: string) => addToLog(`ERROR: ${err}`));
                }
                
                if (!res.completed && isRunningRef.current) {
                    addToLog("Siguiente lote en 3 segundos...");
                    setTimeout(loop, 3000);
                } else {
                    setIsRunning(false);
                    isRunningRef.current = false;
                    addToLog(res.completed ? "Cola de transcodificación finalizada." : "Proceso detenido.");
                    if (res.completed) toast.success("Conversión completada");
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
        addToLog("Deteniendo procesos tras el lote actual...");
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${isRunning ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Cpu size={28} className={isRunning ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                Transcodificador FFmpeg
                                {ffmpegOk === true && <span title="FFmpeg OK"><ShieldCheck size={16} className="text-emerald-500" /></span>}
                                {ffmpegOk === false && <span title="FFmpeg No Encontrado"><AlertTriangle size={16} className="text-red-500" /></span>}
                            </h3>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Optimización de Compatibilidad</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="px-3">
                            <label className="block text-[9px] uppercase font-black text-slate-500 mb-1">Simultáneos</label>
                            <div className="flex items-center gap-3">
                                <Layers size={14} className="text-indigo-400"/>
                                <select 
                                    value={batchSize} 
                                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                                    disabled={isRunning}
                                    className="bg-transparent text-white font-bold outline-none cursor-pointer"
                                >
                                    {[1, 2, 3, 4, 5, 10].map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        {!isRunning ? (
                            <button 
                                onClick={runBatch} 
                                disabled={stats.waiting === 0 || ffmpegOk === false}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                            >
                                <Play size={18}/> Iniciar
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

                <div className="bg-black/80 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                             <Bug size={12}/> Consola de Diagnóstico
                         </span>
                         <button onClick={() => setLog([])} className="text-[9px] text-slate-600 hover:text-white uppercase font-bold">Limpiar Log</button>
                    </div>
                    <div className="h-64 overflow-y-auto p-4 font-mono text-[11px] space-y-1">
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

                <div className="mt-6 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 bg-amber-900/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start">
                        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
                        <div className="text-xs text-slate-400 leading-relaxed">
                            <strong className="text-amber-200 block mb-1">Aviso sobre Lotes:</strong>
                            Aumentar el número de videos simultáneos consumirá más núcleos de CPU. En servidores con recursos limitados (Raspberry Pi, NAS básicos), se recomienda mantener el lote en 1 o 2 para evitar bloqueos del sistema.
                        </div>
                    </div>
                    <div className="flex-1 bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start">
                        <Bug size={20} className="text-blue-400 shrink-0 mt-0.5"/>
                        <div className="text-xs text-slate-400 leading-relaxed">
                            <strong className="text-blue-200 block mb-1">¿No sucede nada?</strong>
                            Si el botón no inicia acciones, pulsa en "Configuración" y verifica que la opción "Auto Transcode" esté activa y que FFmpeg esté correctamente instalado en tu servidor local.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}