import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
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

    useEffect(() => { loadStats(); }, []);

    const addToLog = (msg: string) => { setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30)); };

    const runBatch = async () => {
        if (isRunning) return;
        setIsRunning(true);
        addToLog("Iniciando motor de transcodificación...");
        
        const loop = async () => {
            try {
                const res = await db.request<any>('action=admin_transcode_batch');
                if (res.processed > 0) {
                    addToLog(`Procesados ${res.processed} videos exitosamente.`);
                    loadStats();
                }
                
                if (!res.completed && isRunning) {
                    setTimeout(loop, 2000);
                } else {
                    setIsRunning(false);
                    addToLog("Cola de transcodificación completada.");
                    toast.success("Conversión finalizada");
                }
            } catch (e: any) {
                addToLog(`ERROR: ${e.message}`);
                setIsRunning(false);
            }
        };
        
        loop();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shadow-inner">
                            <Cpu size={28} className={isRunning ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Transcodificador FFmpeg</h3>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Optimización de Compatibilidad Web</p>
                        </div>
                    </div>
                    <button 
                        onClick={runBatch} 
                        disabled={isRunning || stats.waiting === 0}
                        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isRunning ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 active:scale-95'}`}
                    >
                        {isRunning ? <RefreshCw className="animate-spin" size={20}/> : <Play size={20}/>}
                        {isRunning ? 'Procesando...' : 'Iniciar Conversión'}
                    </button>
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
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Convertidos</div>
                        <div className="text-2xl font-black text-emerald-400">{stats.done}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase mb-1">Fallidos</div>
                        <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                    </div>
                </div>

                <div className="bg-black/50 rounded-xl border border-slate-800 p-4 font-mono text-[11px] h-64 overflow-y-auto shadow-inner">
                    <p className="text-indigo-400 mb-2 font-bold tracking-widest opacity-50 uppercase">Consola de Salida:</p>
                    {log.length === 0 ? (
                        <p className="text-slate-700 italic">Listo para procesar...</p>
                    ) : (
                        log.map((line, i) => <div key={i} className="py-1 border-b border-white/5 text-slate-300">{line}</div>)
                    )}
                </div>

                <div className="mt-6 bg-amber-900/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start">
                    <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
                    <div className="text-xs text-slate-400 leading-relaxed">
                        <strong className="text-amber-200 block mb-1">Aviso de Rendimiento:</strong>
                        La transcodificación es una tarea intensiva para el CPU. Si el servidor está en una NAS o VPS pequeño, la reproducción de otros videos podría ralentizarse durante el proceso. FFmpeg convertirá automáticamente a H.264 MP4 con perfil Web-Optimized.
                    </div>
                </div>
            </div>
        </div>
    );
}