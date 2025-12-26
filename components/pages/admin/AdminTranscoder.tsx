import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, Filter, History, AlertCircle, Activity, Box, Radio, Trash2, Settings2, Plus, X, ChevronRight, FileVideo } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [activeProcesses, setActiveProcesses] = useState<{id: string, title: string}[]>([]);
    const [queue, setQueue] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    
    // Editor State
    const [editingProfile, setEditingProfile] = useState({ extension: '', command_args: '-c:v libx264 -preset superfast -crf 23 -c:a aac', description: '' });

    const loopActive = useRef(false);
    const stopRequested = useRef(false);
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('sp_tr_filters');
        return saved ? JSON.parse(saved) : { days: 0, onlyNonMp4: true, onlyIncompatible: true };
    });

    const loadData = async () => {
        try {
            const all = await db.getAllVideos();
            const waitingVids = all.filter((v: any) => v.transcode_status === 'WAITING');
            setQueue(waitingVids);
            
            const statsObj = {
                waiting: waitingVids.length,
                processing: all.filter((v: any) => v.transcode_status === 'PROCESSING').length,
                failed: all.filter((v: any) => v.transcode_status === 'FAILED').length,
                done: all.filter((v: any) => v.transcode_status === 'DONE').length
            };
            setStats(statsObj);
            
            // Get detailed active processes info
            const localStats: any = await db.request('action=admin_get_local_stats');
            setActiveProcesses(localStats.active_processes || []);

            // Profiles
            const profileData: any = await db.request('action=admin_get_transcode_profiles');
            setProfiles(profileData || []);

            const settings = await db.getSystemSettings();
            setIsRunning(!!settings.is_transcoder_active);
        } catch (e) {}
    };

    useEffect(() => { 
        loadData(); 
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

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
        try {
            const res = await db.request<{affected: number}>(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode: 'EXECUTE' })
            });
            toast.success(`${res.affected} en cola.`);
            setScanResult(null);
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const startMotor = async () => {
        try {
            await db.updateSystemSettings({ is_transcoder_active: true });
            setIsRunning(true);
            addToLog("Encendiendo motor asíncrono...");
        } catch (e: any) { toast.error(e.message); }
    };

    const stopMotor = async () => {
        try {
            await db.request(`action=admin_stop_transcoder`);
            setIsRunning(false);
            toast.success("Motor detenido.");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const removeFromQueue = async (vidId: string) => {
        try {
            await db.request(`action=admin_remove_from_queue&videoId=${vidId}`, { method: 'POST' });
            toast.success("Video removido de la cola");
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
            toast.success("Perfil guardado");
            setShowProfileEditor(false);
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const deleteProfile = async (ext: string) => {
        if(!confirm("¿Eliminar perfil?")) return;
        try {
            await db.request(`action=admin_delete_transcode_profile&extension=${ext}`, { method: 'POST' });
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto pb-24 px-2">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Lateral: Filtros y Perfiles */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Filtros */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Filter size={18} className="text-indigo-400"/> Segmentación de Cola
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-xs text-slate-400">Solo no-MP4</span>
                                    <input type="checkbox" checked={filters.onlyNonMp4} onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                </label>
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-xs text-slate-400">Incompatibles</span>
                                    <input type="checkbox" checked={filters.onlyIncompatible} onChange={e => setFilters({...filters, onlyIncompatible: e.target.checked})} className="accent-indigo-600 w-4 h-4"/>
                                </label>
                            </div>
                            <button onClick={handlePreScan} disabled={isScanning} className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-500/20 transition-all">
                                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <Layers size={14}/>} Escanear Biblioteca
                            </button>
                            {scanResult !== null && (
                                <button onClick={handleAddFilteredToQueue} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg shadow-emerald-900/20">Agregar {scanResult} a la cola</button>
                            )}
                        </div>
                    </div>

                    {/* Perfiles FFmpeg */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Settings2 size={18} className="text-amber-400"/> Perfiles FFmpeg
                            </h3>
                            <button onClick={() => { setEditingProfile({extension:'', command_args: '-c:v libx264 -preset superfast -crf 23 -c:a aac', description:''}); setShowProfileEditor(true); }} className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all">
                                <Plus size={16}/>
                            </button>
                        </div>
                        
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {profiles.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-4">Sin perfiles. Se usará MP4 estándar.</p>}
                            {profiles.map(p => (
                                <div key={p.extension} className="bg-slate-950 border border-slate-800 p-3 rounded-xl group relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-black text-white uppercase bg-slate-800 px-2 py-0.5 rounded">.{p.extension}</span>
                                        <button onClick={() => deleteProfile(p.extension)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                    </div>
                                    <div className="text-[9px] font-mono text-slate-500 truncate">{p.command_args}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Central: Cola y Actividad */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* Monitor de Motor */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-2xl transition-all ${isRunning ? 'bg-indigo-600 shadow-lg shadow-indigo-900/40 animate-pulse' : 'bg-slate-800'}`}>
                                    <Cpu size={32} className={isRunning ? 'text-white' : 'text-slate-500'} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase">Estatus del Motor</h3>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isRunning ? 'Lanzando procesos asíncronos' : 'En espera'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={isRunning ? stopMotor : startMotor} className={`px-8 py-3 rounded-xl font-black text-sm flex items-center gap-3 shadow-xl transition-all active:scale-95 ${isRunning ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                                {isRunning ? <><Pause size={18}/> DETENER</> : <><Play size={18} fill="currentColor"/> INICIAR MOTOR</>}
                            </button>
                        </div>
                    </div>

                    {/* Procesos en Tiempo Real */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity size={14} className="text-emerald-400"/> Ejecutando Ahora
                            </h4>
                            <div className="space-y-3">
                                {activeProcesses.length === 0 ? (
                                    <div className="text-center py-6 text-slate-700 italic text-xs">Sin procesos FFmpeg activos</div>
                                ) : activeProcesses.map(p => (
                                    <div key={p.id} className="bg-slate-950 border border-emerald-500/20 p-3 rounded-xl animate-in fade-in">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                                            <span className="text-xs font-bold text-white truncate">{p.title}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 animate-progress-indeterminate"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Radio size={14} className="text-amber-400"/> Cola de Espera ({queue.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {queue.length === 0 && <p className="text-center py-8 text-slate-700 text-xs italic">La cola está vacía</p>}
                                {queue.map(v => (
                                    <div key={v.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 group">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileVideo size={14} className="text-slate-500 shrink-0"/>
                                            <span className="text-[11px] text-slate-300 truncate font-medium">{v.title}</span>
                                        </div>
                                        <button onClick={() => removeFromQueue(v.id)} className="text-slate-600 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Log de Consola */}
                    <div className="bg-black rounded-2xl p-5 border border-slate-800 shadow-2xl">
                         <div className="flex items-center gap-2 text-slate-600 mb-3 border-b border-slate-900 pb-2">
                             <Terminal size={14}/>
                             <span className="text-[10px] font-black uppercase tracking-widest">Registros de Transmisión</span>
                         </div>
                         <div className="font-mono text-[10px] h-32 overflow-y-auto space-y-1.5 scrollbar-hide">
                            {log.map((line, i) => (
                                <div key={i} className={`flex gap-3 ${line.includes('Tarea') ? 'text-emerald-500/80' : 'text-slate-500'}`}>
                                    <span className="opacity-20 shrink-0">#</span>
                                    <span>{line}</span>
                                </div>
                            ))}
                            {log.length === 0 && <div className="text-slate-800 italic animate-pulse">Sincronizando con el servidor...</div>}
                         </div>
                    </div>

                </div>
            </div>

            {/* Modal: Perfil Editor */}
            {showProfileEditor && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="font-bold text-white flex items-center gap-2"><Settings2 size={18} className="text-amber-400"/> Configurar Extensión</h4>
                            <button onClick={() => setShowProfileEditor(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Punto de Extensión</label>
                                <input type="text" value={editingProfile.extension} onChange={e => setEditingProfile({...editingProfile, extension: e.target.value.replace('.', '')})} placeholder="mkv, avi, ts..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm uppercase" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Código FFmpeg (Argumentos)</label>
                                <textarea rows={4} value={editingProfile.command_args} onChange={e => setEditingProfile({...editingProfile, command_args: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs leading-relaxed" />
                                <p className="text-[9px] text-slate-500 mt-2 italic">Solo argumentos entre -i [input] y [output].</p>
                            </div>
                            <button onClick={saveProfile} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest">Guardar Perfil</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
