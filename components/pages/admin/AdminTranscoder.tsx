
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, AlertTriangle, Bug, X, Copy, Terminal } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    const [batchSize, setBatchSize] = useState(1);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [log, setLog] = useState<string[]>([]);
    const [showDiagnostic, setShowDiagnostic] = useState(false);

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
                    addToLog(res.completed ? "Cola finalizada." : "Detenido.");
                }
            } catch (e: any) {
                addToLog(`FALLO CRÍTICO: ${e.message}`);
                setIsRunning(false);
                isRunningRef.current = false;
                // Si el error contiene "RESPUESTA CORRUPTA", activamos el diagnóstico
                if (e.message.includes('CORRUPTA')) {
                    toast.error("Error de comunicación. Pulsa el botón de diagnóstico.");
                }
            }
        };
        loop();
    };

    const stopBatch = () => {
        isRunningRef.current = false;
        setIsRunning(false);
        addToLog("Deteniendo procesos...");
    };

    const copyDiagnostic = () => {
        navigator.clipboard.writeText(db.lastRawResponse);
        toast.success("Copiado al portapapeles");
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <Cpu size={28} className={isRunning ? 'text-indigo-400 animate-pulse' : 'text-slate-500'} />
                        <div>
                            <h3 className="text-xl font-bold text-white">Transcodificador</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase">Optimización NAS/Local</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {db.lastRawResponse && (
                            <button onClick={() => setShowDiagnostic(true)} className="p-2 bg-amber-900/20 text-amber-500 rounded-lg border border-amber-500/30 flex items-center gap-2 text-xs font-bold animate-pulse">
                                <Bug size={16}/> Ver Diagnóstico
                            </button>
                        )}
                        {!isRunning ? (
                            <button onClick={runBatch} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Iniciar</button>
                        ) : (
                            <button onClick={stopBatch} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold">Detener</button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-[10px] text-slate-500 font-black uppercase">Espera</div>
                        <div className="text-xl font-bold text-amber-500">{stats.waiting}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-[10px] text-slate-500 font-black uppercase">Progreso</div>
                        <div className="text-xl font-bold text-blue-400">{stats.processing}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-[10px] text-slate-500 font-black uppercase">Listos</div>
                        <div className="text-xl font-bold text-emerald-400">{stats.done}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-[10px] text-slate-500 font-black uppercase">Fallo</div>
                        <div className="text-xl font-bold text-red-500">{stats.failed}</div>
                    </div>
                </div>

                <div className="bg-black/80 rounded-xl p-4 font-mono text-[11px] h-40 overflow-y-auto space-y-1">
                    {log.map((line, i) => (
                        <div key={i} className={line.includes('FALLO') ? 'text-red-400' : 'text-slate-400'}>{line}</div>
                    ))}
                </div>
            </div>

            {/* Modal de Diagnóstico */}
            {showDiagnostic && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><Terminal size={18} className="text-amber-500"/> Respuesta Cruda del Servidor</h3>
                            <div className="flex gap-2">
                                <button onClick={copyDiagnostic} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="Copiar"><Copy size={18}/></button>
                                <button onClick={() => setShowDiagnostic(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X size={18}/></button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-black font-mono text-[10px] text-emerald-500 leading-relaxed whitespace-pre-wrap">
                            {db.lastRawResponse || "No hay datos de respuesta."}
                        </div>
                        <div className="p-4 bg-slate-950 text-[10px] text-slate-500 italic">
                            Copia este texto y envíamelo para saber exactamente qué está rompiendo el servidor.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
