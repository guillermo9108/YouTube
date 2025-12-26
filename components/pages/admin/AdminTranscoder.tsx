
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { 
    Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, 
    Filter, History, AlertCircle, Activity, Box, Radio, Trash2, Settings2, 
    Plus, X, ChevronRight, FileVideo, AlertTriangle, RotateCcw
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [activeProcesses, setActiveProcesses] = useState<{id: string, title: string}[]>([]);
    const [queue, setQueue] = useState<any[]>([]);
    const [failedVids, setFailedVids] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [showFailedList, setShowFailedList] = useState(false);
    
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
            setQueue(waitingVids);
            setFailedVids(failedOnes);
            
            setStats({
                waiting: waitingVids.length,
                processing: all.filter((v: any) => v.transcode_status === 'PROCESSING').length,
                failed: failedOnes.length,
                done: all.filter((v: any) => v.transcode_status === 'DONE').length
            });
            
            const localStats: any = await db.request('action=admin_get_local_stats');
            setActiveProcesses(localStats.active_processes || []);

            const profileData: any = await db.request('action=admin_get_transcode_profiles');
            setProfiles(profileData || []);

            const settings = await db.getSystemSettings();
            setIsRunning(!!settings.is_transcoder_active);
        } catch (e) {}
    };

    useEffect(() => { 
        loadData(); 
        const interval = setInterval(loadData, 3000);
        return () => clearInterval(interval);
    }, []);

    const addToLog = (msg: string) => { 
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50)); 
    };

    const handlePreScan = async () => {
        setIsScanning(true);
        localStorage.setItem('sp_tr_filters', JSON.stringify(filters));
        try {
            const res = await db.request<{count: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'PREVIEW' })
            });
            setScanResult(res.count);
            toast.info(`Análisis completo: ${res.count} videos para convertir.`);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAddFilteredToQueue = async () => {
        try {
            const res = await db.request<{affected: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'EXECUTE' })
            });
            toast.success(`${res.affected} videos añadidos a la cola.`);
            setScanResult(null);
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const handleAction = async (action: string) => {
        try {
            await db.request(`action=${action}`, { method: 'POST' });
            toast.success("Operación completada");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        try {
            await db.updateSystemSettings({ is_transcoder_active: true });
            setIsRunning(true);
            addToLog("Motor iniciado. Comprobando cola...");
            // Trigger batch inmediato
            db.request('action=admin_transcode_batch').catch(()=>{});
        } catch (e: any) { toast.error(e.message); }
    };

    const stopMotor = async () => {
        try {
            await db.request(`action=admin_stop_transcoder`);
            setIsRunning(false);
            addToLog("Motor detenido manualmente.");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const saveProfile = async () => {
        if(!editingProfile.extension || !editingProfile.command_args) return;
        try {
            await db.request(`action=admin_save_transcode_profile`, {
                method: 'POST',
                body: JSON.stringify(editingProfile)
            });
            toast.success("Perfil de extensión guardado");
            setShowProfileEditor(false);
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto pb-24 px-2">
            
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg group hover:border-indigo-500/50 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <Box size={18} className="text-slate-500 group-hover:text-indigo-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Cola</span>
                    </div>
                    <div className="text-2xl font-black text-white">{stats.waiting}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg group hover:border-emerald-500/50 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <Activity size={18} className="text-slate-500 group-hover:text-emerald-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Activos</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{stats.processing}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg group hover:border-red-500/50 transition-all cursor-pointer" onClick={() => setShowFailedList(true)}>
                    <div className="flex justify-between items-center mb-2">
                        <AlertTriangle size={18} className="text-slate-500 group-hover:text-red-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fallidos</span>
                    </div>
                    <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg group hover:border-blue-500/50 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <CheckCircle2 size={18} className="text-slate-500 group-hover:text-blue-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Terminados</span>
                    </div>
                    <div className="text-2xl font-black text-blue-400">{stats.done}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Lateral: Motor Control & Filters */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Motor Control */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative group">
                        <div className={`absolute inset-0 bg-gradient-to-tr transition-opacity duration-1000 ${isRunning ? 'from-indigo-600/20 via-transparent to-emerald-600/10 opacity-100' : 'opacity-0'}`}></div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-4 transition-all duration-500 ${isRunning ? 'bg-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.4)] animate-pulse' : 'bg-slate-800'}`}>
                                <Cpu size={40} className={isRunning ? 'text-white' : 'text-slate-500'} />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Motor de Conversión</h3>
                            <p className="text-xs text-slate-500 mt-1 mb-6">Procesa videos incompatibles para web en segundo plano.</p>
                            
                            <button 
                                onClick={isRunning ? stopMotor : startMotor} 
                                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${isRunning ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                            >
                                {isRunning ? <><Pause size={20}/> DETENER MOTOR</> : <><Play size={20} fill="currentColor"/> INICIAR MOTOR</>}
                            </button>
                        </div>
                    </div>

                    {/* Master Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleAction('admin_retry_failed_transcodes')} className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:bg-slate-800 flex flex-col items-center gap-2 group">
                            <RotateCcw size={20} className="text-amber-500 group-hover:rotate-180 transition-transform duration-500"/>
                            <span className="text-[10px] font-black text-slate-300 uppercase">Reintentar Todo</span>
                        </button>
                        <button onClick={() => handleAction('admin_clear_transcode_queue')} className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:bg-red-900/20 group">
                            <Trash2 size={20} className="text-red-500 mx-auto mb-2"/>
                            <span className="text-[10px] font-black text-slate-300 uppercase text-center block">Vaciar Cola</span>
                        </button>
                    </div>

                    {/* Segmentación */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 text-sm flex items-center gap-2">
                            <Filter size={16} className="text-indigo-400"/> Generador de Tareas
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-xs text-slate-400">Archivos no-MP4</span>
                                    <input type="checkbox" checked={filters.onlyNonMp4} onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                </label>
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-xs text-slate-400">Marcar Incompatibles</span>
                                    <input type="checkbox" checked={filters.onlyIncompatible} onChange={e => setFilters({...filters, onlyIncompatible: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                </label>
                            </div>
                            <button onClick={handlePreScan} disabled={isScanning} className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-500/10 transition-all">
                                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <History size={14}/>} Analizar Biblioteca
                            </button>
                            {scanResult !== null && scanResult > 0 && (
                                <button onClick={handleAddFilteredToQueue} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg shadow-emerald-900/20 animate-in zoom-in">
                                    Añadir {scanResult} a la cola
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Central: Active Processes & Logs */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* Procesos en ejecución real */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400"/> Monitor de Procesos Activos
                            </h4>
                            <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 font-mono">LIVE SYNC</span>
                        </div>
                        
                        <div className="space-y-4">
                            {activeProcesses.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl">
                                    <Zap size={32} className="mx-auto mb-2 text-slate-800"/>
                                    <p className="text-sm text-slate-600">No hay procesos activos en el servidor.</p>
                                </div>
                            ) : activeProcesses.map(p => (
                                <div key={p.id} className="bg-slate-950 border border-emerald-500/20 p-4 rounded-2xl animate-in slide-in-from-right-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                <RefreshCw size={16} className="text-emerald-500 animate-spin"/>
                                            </div>
                                            <span className="text-sm font-bold text-white truncate">{p.title}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">PID: {p.id.split('_').pop()}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 animate-progress-indeterminate shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Consola de Eventos */}
                    <div className="bg-black rounded-2xl p-6 border border-slate-800 shadow-2xl">
                         <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-4">
                             <div className="flex items-center gap-2 text-slate-400">
                                 <Terminal size={16}/>
                                 <span className="text-xs font-black uppercase tracking-widest">Terminal del Sistema</span>
                             </div>
                             <button onClick={() => setLog([])} className="text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase">Limpiar Terminal</button>
                         </div>
                         <div className="font-mono text-[11px] h-64 overflow-y-auto space-y-2 custom-scrollbar">
                            {log.map((line, i) => (
                                <div key={i} className={`flex gap-3 ${line.includes('Tarea') ? 'text-emerald-400' : line.includes('ERROR') ? 'text-red-400' : 'text-slate-500'}`}>
                                    <span className="opacity-20 shrink-0 select-none">[{i}]</span>
                                    <span>{line}</span>
                                </div>
                            ))}
                            {log.length === 0 && <div className="text-slate-800 italic animate-pulse">Escuchando eventos de FFmpeg...</div>}
                         </div>
                    </div>

                    {/* Cola Visualizada */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Cola de Espera ({queue.length})</h4>
                            <div className="flex gap-2">
                                <button onClick={() => setShowProfileEditor(true)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white" title="Configurar Perfiles"><Settings2 size={16}/></button>
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {queue.length === 0 ? (
                                <p className="text-center py-8 text-slate-700 text-xs italic">La cola está vacía</p>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950/50 text-slate-500 uppercase font-black text-[9px] tracking-tighter">
                                        <tr><th className="p-3">Video</th><th className="p-3">Estado</th><th className="p-3 text-right">Acción</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {queue.slice(0, 10).map(v => (
                                            <tr key={v.id} className="hover:bg-slate-800/50">
                                                <td className="p-3 text-slate-300 font-medium truncate max-w-[200px]">{v.title}</td>
                                                <td className="p-3"><span className="text-[10px] text-amber-500 font-black uppercase">Pendiente</span></td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => db.request(`action=admin_remove_from_queue&videoId=${v.id}`, {method:'POST'}).then(loadData)} className="p-1 text-slate-600 hover:text-red-400"><Trash2 size={14}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Modal: Fallidos */}
            {showFailedList && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-5 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center">
                            <div>
                                <h4 className="font-black text-white text-lg flex items-center gap-2"><AlertTriangle className="text-red-500"/> Videos Fallidos</h4>
                                <p className="text-xs text-red-500/70 uppercase font-bold tracking-tighter">Tareas interrumpidas o con error de codec</p>
                            </div>
                            <button onClick={() => setShowFailedList(false)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {failedVids.map(v => (
                                <div key={v.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="font-bold text-white text-sm truncate">{v.title}</h5>
                                        <button onClick={() => db.request(`action=admin_remove_from_queue&videoId=${v.id}`, {method:'POST'}).then(loadData)} className="p-1 text-slate-600 hover:text-red-400"><X size={16}/></button>
                                    </div>
                                    <div className="bg-red-500/5 text-red-400 p-2 rounded-lg text-[10px] font-mono border border-red-500/10">
                                        Error: {v.reason || 'Error desconocido de FFmpeg'}
                                    </div>
                                </div>
                            ))}
                            {failedVids.length === 0 && <p className="text-center py-10 text-slate-500 italic">No hay videos con errores.</p>}
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-4">
                            <button onClick={() => handleAction('admin_retry_failed_transcodes')} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-95">REINTENTAR TODOS</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Perfil Editor */}
            {showProfileEditor && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="font-bold text-white flex items-center gap-2"><Settings2 size={18} className="text-amber-400"/> Configurar Extensión</h4>
                            <button onClick={() => setShowProfileEditor(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest">Extensión Destino</label>
                                <input type="text" value={editingProfile.extension} onChange={e => setEditingProfile({...editingProfile, extension: e.target.value.replace('.', '')})} placeholder="mkv, avi, ts..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm uppercase outline-none focus:border-amber-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest">Argumentos FFmpeg</label>
                                <textarea rows={4} value={editingProfile.command_args} onChange={e => setEditingProfile({...editingProfile, command_args: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs leading-relaxed outline-none focus:border-amber-500" />
                                <p className="text-[9px] text-slate-500 mt-2 italic">Define codecs de video/audio y flags adicionales.</p>
                            </div>
                            <button onClick={saveProfile} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest">Guardar Perfil</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
