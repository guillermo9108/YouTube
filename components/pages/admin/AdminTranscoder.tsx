
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../../services/db';
import { 
    Cpu, RefreshCw, Play, CheckCircle2, Terminal, Layers, Clock, Zap, Pause, 
    Filter, History, AlertCircle, Activity, Box, Radio, Trash2, Settings2, 
    Plus, X, ChevronRight, FileVideo, AlertTriangle, RotateCcw, ShieldAlert, 
    FileText, ScrollText, Copy, FastForward, Save, PlusCircle, Loader2, Gauge, HardDrive
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Video } from '../../../types';

export default function AdminTranscoder() {
    const toast = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ waiting: 0, processing: 0, failed: 0, done: 0 });
    const [allVideos, setAllVideos] = useState<Video[]>([]);
    const [activeProcesses, setActiveProcesses] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [showFailedList, setShowFailedList] = useState(false);
    
    const [technicalLog, setTechnicalLog] = useState<string | null>(null);

    const [editingProfile, setEditingProfile] = useState({ 
        extension: '', 
        command_args: '-c:v libx264 -preset ultrafast -crf 28 -vsync 1 -c:a copy', 
        description: '' 
    });

    const [filters, setFilters] = useState({ 
        onlyNonMp4: true, 
        onlyIncompatible: false 
    });

    const loadData = async () => {
        try {
            const all = await db.getAllVideos();
            setAllVideos(all);
            const waitingVids = all.filter((v: any) => v.transcode_status === 'WAITING');
            const failedOnes = all.filter((v: any) => v.transcode_status === 'FAILED');
            const processingOnes = all.filter((v: any) => v.transcode_status === 'PROCESSING');
            
            setStats({
                waiting: waitingVids.length,
                processing: processingOnes.length,
                failed: failedOnes.length,
                done: all.filter((v: any) => v.transcode_status === 'DONE').length
            });
            
            const lStats: any = await db.request('action=admin_get_local_stats');
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
        const interval = setInterval(loadData, 4000);
        return () => clearInterval(interval);
    }, []);

    const failedVideos = useMemo(() => allVideos.filter(v => v.transcode_status === 'FAILED'), [allVideos]);

    const handleScanFilter = async (mode: 'PREVIEW' | 'EXECUTE') => {
        setIsScanning(true);
        try {
            const res: any = await db.request(`action=admin_transcode_scan_filters`, {
                method: 'POST',
                body: JSON.stringify({ ...filters, mode })
            });
            if (mode === 'PREVIEW') {
                setScanResult(res.count);
                toast.info(`${res.count} videos detectados`);
            } else {
                toast.success("Cola actualizada correctamente");
                setScanResult(null);
                loadData();
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleAction = async (action: string) => {
        try {
            await db.request(`action=${action}`, { method: 'POST' });
            toast.success("Operación completada");
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const handleSaveProfile = async (customExt?: string, customArgs?: string) => {
        const ext = customExt || editingProfile.extension;
        const args = customArgs || editingProfile.command_args;
        if (!ext || !args) return;
        
        try {
            await db.request('action=admin_save_transcode_profile', {
                method: 'POST',
                body: JSON.stringify({ 
                    extension: ext, 
                    command_args: args, 
                    description: editingProfile.description || 'Optimizado para Synology'
                })
            });
            toast.success(`Perfil .${ext} guardado`);
            setShowProfileEditor(false);
            setEditingProfile({ extension: '', command_args: '', description: '' });
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    // Added handleDeleteProfile to fix the error in the component
    const handleDeleteProfile = async (extension: string) => {
        if (!confirm(`¿Eliminar perfil para .${extension}?`)) return;
        try {
            await db.request('action=admin_delete_transcode_profile', {
                method: 'POST',
                body: JSON.stringify({ extension })
            });
            toast.success(`Perfil .${extension} eliminado`);
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const applyHardwarePreset = (level: 1 | 2 | 3) => {
        const extensions = ['mkv', 'avi', 'ts', 'mov', 'flv'];
        let args = '';
        
        switch(level) {
            case 1: args = '-c copy'; break;
            case 2: args = '-c:v libx264 -preset ultrafast -crf 28 -c:a aac'; break;
            case 3: args = '-vf "scale=-1:720" -c:v libx264 -preset ultrafast -crf 30 -c:a aac'; break;
        }

        extensions.forEach(ext => handleSaveProfile(ext, args));
        toast.success("Nivel de Optimización Aplicado a todos los formatos");
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto pb-24 px-2">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <Box size={18} className="text-slate-500"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Cola</span>
                    </div>
                    <div className="text-2xl font-black text-white">{stats.waiting}</div>
                </div>
                <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <Activity size={18} className="text-emerald-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Activos</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{activeProcesses.length}</div>
                </div>
                <div className="bg-slate-900 border border-red-500/30 p-4 rounded-2xl shadow-lg cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setShowFailedList(true)}>
                    <div className="flex justify-between items-center mb-2">
                        <AlertTriangle size={18} className="text-red-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fallidos</span>
                    </div>
                    <div className="text-2xl font-black text-red-500">{stats.failed}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <CheckCircle2 size={18} className="text-blue-400"/>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Listos</span>
                    </div>
                    <div className="text-2xl font-black text-blue-400">{stats.done}</div>
                </div>
            </div>

            {/* PANEL DE OPTIMIZACIÓN HARDWARE ANTIGUO */}
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none rotate-12"><Gauge size={200}/></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Gauge size={28}/></div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Perfiles de Supervivencia</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Optimización Automática para Synology DDR2 / CPU Legacy</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => applyHardwarePreset(1)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-emerald-500/50 transition-all group">
                            <div className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">Nivel 1: Stream Copy</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Cambia el contenedor sin recodificar. Carga CPU cercana a 0%.</p>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded">CPU: BAJA</span>
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded">RAM: BAJA</span>
                            </div>
                        </button>

                        <button onClick={() => applyHardwarePreset(2)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-amber-500/50 transition-all group">
                            <div className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">Nivel 2: Ultrafast Light</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Conversión rápida (Preset Ultrafast + CRF 28). Recomendado.</p>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded">CPU: MEDIA</span>
                                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded">RAM: MEDIA</span>
                            </div>
                        </button>

                        <button onClick={() => applyHardwarePreset(3)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-red-500/50 transition-all group">
                            <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Nivel 3: 720p Scaler</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Reduce resolución para hardware muy viejo. Máxima fluidez.</p>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">CPU: ALTA</span>
                                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">RAM: MEDIA</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-tr transition-opacity duration-1000 ${isRunning ? 'from-indigo-600/20 to-emerald-600/10 opacity-100' : 'opacity-0'}`}></div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                                <Cpu size={20} className={isRunning ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}/>
                                Motor Activo
                            </h3>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={isRunning ? () => handleAction('admin_stop_transcoder') : () => handleAction('admin_transcode_batch')} 
                                    className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${isRunning ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'}`}
                                >
                                    {isRunning ? <><Pause size={18}/> DETENER MOTOR</> : <><Play size={18} fill="currentColor"/> ARRANCAR MOTOR</>}
                                </button>
                                <button onClick={() => db.request('action=admin_get_transcode_log').then(setTechnicalLog)} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase text-slate-400 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 flex items-center justify-center gap-2">
                                    <ScrollText size={14}/> Log FFmpeg
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 text-xs uppercase flex items-center gap-2">
                            <Filter size={14} className="text-indigo-400"/> Gestor de Tareas
                        </h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                                <input type="checkbox" checked={filters.onlyNonMp4} onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})} className="accent-indigo-500 w-4 h-4"/>
                                <span className="text-[11px] text-slate-300 font-bold uppercase">Solo extensiones No-MP4</span>
                            </label>
                            
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button onClick={() => handleScanFilter('PREVIEW')} disabled={isScanning} className="bg-slate-800 text-slate-300 py-2.5 rounded-lg text-[10px] font-black uppercase">Simular</button>
                                <button onClick={() => handleScanFilter('EXECUTE')} disabled={isScanning || scanResult === 0} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 py-2.5 rounded-lg text-[10px] font-black uppercase">Llenar Cola</button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2"><Settings2 size={14} className="text-purple-400"/> Mapeo de Comandos</h3>
                            <button onClick={() => setShowProfileEditor(true)} className="p-1 text-indigo-400 hover:text-white"><PlusCircle size={18}/></button>
                         </div>
                         <div className="space-y-2">
                            {profiles.map(p => (
                                <div key={p.extension} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 group">
                                    <div>
                                        <span className="text-xs font-black text-indigo-400 uppercase">.{p.extension}</span>
                                        <div className="text-[9px] text-slate-500 truncate max-w-[140px] font-mono">{p.command_args}</div>
                                    </div>
                                    <button onClick={() => handleDeleteProfile(p.extension)} className="p-1.5 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[400px]">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity size={16} className="text-emerald-400"/> Procesos en curso
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeProcesses.length === 0 ? (
                                <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                                    <RefreshCw size={32} className="mx-auto mb-2 text-slate-700 opacity-20"/>
                                    <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Sin actividad intensiva</p>
                                </div>
                            ) : activeProcesses.map(p => (
                                <div key={p.id} className="bg-slate-950 border border-indigo-500/20 p-5 rounded-2xl shadow-inner relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[11px] font-black text-white truncate block">{p.title}</span>
                                            <span className="text-[9px] font-mono text-slate-500 uppercase">{p.id}</span>
                                        </div>
                                        <span className="text-xs font-black text-indigo-400 font-mono">{p.progress}%</span>
                                    </div>
                                    
                                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                                            style={{ width: `${p.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-black rounded-2xl p-5 border border-slate-800 shadow-2xl h-64 flex flex-col">
                         <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-2 text-slate-500">
                                 <Terminal size={14}/>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Evento de Sistema</span>
                             </div>
                             <button onClick={() => handleAction('admin_clear_logs')} className="text-[9px] text-slate-600 hover:text-white uppercase font-bold">Limpiar</button>
                         </div>
                         <div className="font-mono text-[10px] flex-1 overflow-y-auto space-y-1 custom-scrollbar text-slate-500">
                            {log.map((line, i) => (
                                <div key={i} className={`flex gap-3 ${line.includes('ERROR') ? 'text-red-500' : (line.includes('Iniciada') ? 'text-indigo-400' : 'text-slate-600')}`}>
                                    <span className="opacity-20 shrink-0">[{i}]</span>
                                    <span>{line}</span>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </div>

            {/* Modal: Perfil Editor */}
            {showProfileEditor && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-black text-white uppercase text-sm">Comando por Extensión</h4>
                            <button onClick={() => setShowProfileEditor(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Extensión (ej: mkv)</label>
                                <input type="text" value={editingProfile.extension} onChange={e => setEditingProfile({...editingProfile, extension: e.target.value.toLowerCase()})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-indigo-500" placeholder="ts" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Argumentos FFmpeg</label>
                                <textarea rows={4} value={editingProfile.command_args} onChange={e => setEditingProfile({...editingProfile, command_args: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-indigo-500" placeholder="-c:v libx264 ..." />
                            </div>
                            <button onClick={() => handleSaveProfile()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all">GUARDAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
