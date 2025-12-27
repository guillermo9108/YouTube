
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { 
    Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, 
    Filter, History, AlertCircle, Activity, Box, Radio, Trash2, Settings2, 
    Plus, X, ChevronRight, FileVideo, AlertTriangle, RotateCcw, ShieldAlert, FileText, ScrollText
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [activeProcesses, setActiveProcesses] = useState<{id: string, title: string, vidId: string}[]>([]);
    const [localStats, setLocalStats] = useState<any>(null);
    const [queue, setQueue] = useState<any[]>([]);
    const [failedVids, setFailedVids] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [showFailedList, setShowFailedList] = useState(false);
    
    const [technicalLog, setTechnicalLog] = useState<string | null>(null);
    const [isLoadingTechLog, setIsLoadingTechLog] = useState(false);

    const [editingProfile, setEditingProfile] = useState({ extension: '', command_args: '-c:v libx264 -preset superfast -crf 23 -c:a aac', description: '' });

    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('sp_tr_filters');
        return saved ? JSON.parse(saved) : { days: 0, onlyNonMp4: true, onlyIncompatible: true };
    });

    const loadData = async () => {
        try {
            const all = await db.getAllVideos();
            const waitingVids = all.filter((v: any) => v.transcode_status === 'WAITING');
            const failedOnes = all.filter((v: any) => v.transcode_status === 'FAILED');
            const processingOnes = all.filter((v: any) => v.transcode_status === 'PROCESSING');
            
            setQueue(waitingVids);
            setFailedVids(failedOnes);
            
            setStats({
                waiting: waitingVids.length,
                processing: processingOnes.length,
                failed: failedOnes.length,
                done: all.filter((v: any) => v.transcode_status === 'DONE').length
            });
            
            const lStats: any = await db.request('action=admin_get_local_stats');
            setLocalStats(lStats);
            setActiveProcesses(lStats.active_processes || []);

            const profileData: any = await db.request('action=admin_get_transcode_profiles');
            setProfiles(profileData || []);

            const settings = await db.getSystemSettings();
            setIsRunning(!!settings.is_transcoder_active);
            
            const realLogs: any = await db.request('action=admin_get_logs');
            if (Array.isArray(realLogs)) setLog(realLogs);
            
        } catch (e) {}
    };

    useEffect(() => { 
        loadData(); 
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchTechnicalLog = async () => {
        setIsLoadingTechLog(true);
        try {
            const res = await db.request<string>('action=admin_get_transcode_log');
            setTechnicalLog(res);
        } catch (e) { toast.error("No se pudo obtener el log técnico."); }
        finally { setIsLoadingTechLog(false); }
    };

    const handleAction = async (action: string) => {
        try {
            await db.request(`action=${action}`, { method: 'POST' });
            toast.success("Operación completada");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const handleEmergencyReset = async () => {
        if (!confirm("Esto forzará a todos los videos en estado 'Procesando' a volver a 'En espera' y detendrá FFmpeg. ¿Continuar?")) return;
        try {
            await db.request('action=admin_reset_transcoder_states', { method: 'POST' });
            toast.success("Reseteo completado. La cola se ha sincronizado.");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        try {
            await db.updateSystemSettings({ is_transcoder_active: true });
            setIsRunning(true);
            toast.info("Motor iniciado. Procesando cola...");
            await db.request('action=admin_transcode_batch');
        } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto pb-24 px-2">
            
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <Box size={18} className="text-slate-500"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Cola</span>
                    </div>
                    <div className="text-2xl font-black text-white">{stats.waiting}</div>
                </div>
                <div className={`bg-slate-900 border p-4 rounded-2xl shadow-lg transition-colors ${localStats?.orphans_detected > 0 ? 'border-red-500/50' : 'border-emerald-500/30'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <Activity size={18} className={localStats?.orphans_detected > 0 ? 'text-red-400' : 'text-emerald-400'}/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En DB</span>
                    </div>
                    <div className={`text-2xl font-black ${localStats?.orphans_detected > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {stats.processing}
                        {localStats?.orphans_detected > 0 && (
                            <span className="text-xs ml-2 opacity-60">({localStats.orphans_detected} huérfanos)</span>
                        )}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg border-red-500/30 cursor-pointer" onClick={() => setShowFailedList(true)}>
                    <div className="flex justify-between items-center mb-2">
                        <AlertTriangle size={18} className="text-red-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fallidos</span>
                    </div>
                    <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <CheckCircle2 size={18} className="text-blue-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OK</span>
                    </div>
                    <div className="text-2xl font-black text-blue-400">{stats.done}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Lateral: Motor Control & Emergency */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Motor Control */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-tr transition-opacity duration-1000 ${isRunning ? 'from-indigo-600/20 to-emerald-600/10 opacity-100' : 'opacity-0'}`}></div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isRunning ? 'bg-indigo-600 shadow-xl animate-pulse' : 'bg-slate-800'}`}>
                                <Cpu size={32} className={isRunning ? 'text-white' : 'text-slate-500'} />
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Transcoder v2.1</h3>
                            <p className="text-[10px] text-slate-500 mt-1 mb-6">Estado del motor: {isRunning ? 'Activo' : 'Detenido'}</p>
                            
                            <div className="flex flex-col gap-2 w-full">
                                <button 
                                    onClick={isRunning ? () => handleAction('admin_stop_transcoder') : startMotor} 
                                    className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${isRunning ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                >
                                    {isRunning ? <><Pause size={18}/> PARAR MOTOR</> : <><Play size={18} fill="currentColor"/> INICIAR MOTOR</>}
                                </button>
                                <button onClick={fetchTechnicalLog} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase text-slate-400 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 flex items-center justify-center gap-2">
                                    <ScrollText size={14}/> Ver Log Técnico
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Emergency Tool */}
                    {localStats?.orphans_detected > 0 && (
                        <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-4 animate-in zoom-in">
                            <div className="flex items-center gap-3 text-red-400 mb-3">
                                <ShieldAlert size={20}/>
                                <span className="text-xs font-black uppercase">Problema Detectado</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                                Hay {localStats.orphans_detected} videos que la DB cree que se están convirtiendo pero no hay ningún proceso real. Esto bloquea la cola.
                            </p>
                            <button 
                                onClick={handleEmergencyReset}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                            >
                                Limpiar Huérfanos Ahora
                            </button>
                        </div>
                    )}

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 text-xs flex items-center gap-2">
                            <Filter size={14} className="text-indigo-400"/> Generar Tareas
                        </h3>
                        <button onClick={() => handleAction('admin_retry_failed_transcodes')} className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-2.5 rounded-xl text-[10px] flex items-center justify-center gap-2 transition-all mb-3">
                            <RotateCcw size={14}/> Reintentar Fallidos
                        </button>
                    </div>
                </div>

                {/* Central: Active OS Processes */}
                <div className="lg:col-span-8 space-y-6">
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity size={16} className="text-emerald-400"/> Procesos Reales en el Servidor (OS)
                        </h4>
                        
                        <div className="space-y-3">
                            {activeProcesses.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl">
                                    <Zap size={32} className="mx-auto mb-2 text-slate-800 opacity-20"/>
                                    <p className="text-xs text-slate-600">No hay ejecuciones activas de FFmpeg.</p>
                                </div>
                            ) : activeProcesses.map(p => (
                                <div key={p.id} className="bg-slate-950 border border-indigo-500/20 p-4 rounded-xl flex items-center justify-between group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <RefreshCw size={14} className="text-emerald-500 animate-spin"/>
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-white truncate block">{p.title}</span>
                                            <span className="text-[9px] text-slate-500 font-mono">STATUS: RENDERING</span>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">{p.id}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Terminal de Eventos */}
                    <div className="bg-black rounded-2xl p-5 border border-slate-800 shadow-2xl h-80 flex flex-col">
                         <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-2 text-slate-500">
                                 <Terminal size={14}/>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Logs de Sincronización</span>
                             </div>
                             <button onClick={() => handleAction('admin_clear_logs')} className="text-[9px] text-slate-600 hover:text-slate-400 font-bold uppercase">Limpiar</button>
                         </div>
                         <div className="font-mono text-[10px] flex-1 overflow-y-auto space-y-1 custom-scrollbar text-slate-500">
                            {log.map((line, i) => (
                                <div key={i} className={`flex gap-3 ${line.includes('ERROR') || line.includes('FALLIDO') ? 'text-red-400' : (line.includes('Lanzada') ? 'text-indigo-400' : 'text-slate-500')}`}>
                                    <span className="opacity-20 shrink-0">[{i}]</span>
                                    <span>{line}</span>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </div>

            {/* Modal: Tech Log Viewer */}
            {technicalLog && (
                <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                        <div className="p-4 bg-slate-950 border-b border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ScrollText size={20} className="text-indigo-400"/>
                                <h4 className="font-black text-white text-sm uppercase tracking-widest">Log de Salida de FFmpeg (Último Intento)</h4>
                            </div>
                            <button onClick={() => setTechnicalLog(null)} className="p-2 hover:bg-slate-800 rounded-full text-white"><X/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-black/50 font-mono text-xs leading-relaxed text-indigo-200 custom-scrollbar">
                            <pre className="whitespace-pre-wrap">{technicalLog}</pre>
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-700 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Usa este log para diagnosticar errores de codecs o rutas</span>
                            <button onClick={fetchTechnicalLog} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                <RefreshCw size={14} className={isLoadingTechLog ? 'animate-spin' : ''}/> Actualizar Log
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Fallidos */}
            {showFailedList && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center">
                            <h4 className="font-black text-white uppercase text-sm">Videos con Error de Codec</h4>
                            <button onClick={() => setShowFailedList(false)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {failedVids.map(v => (
                                <div key={v.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                                    <h5 className="font-bold text-white text-xs mb-1">{v.title}</h5>
                                    <div className="text-[9px] text-red-400 font-mono italic">Motivo: {v.reason || 'FFmpeg finalizó con error'}</div>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button onClick={() => db.request(`action=admin_remove_from_queue&videoId=${v.id}`, {method:'POST'}).then(loadData)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-400 rounded-lg">QUITAR DE COLA</button>
                                    </div>
                                </div>
                            ))}
                            {failedVids.length === 0 && <p className="text-center py-10 text-slate-500 italic">No hay fallos registrados.</p>}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
