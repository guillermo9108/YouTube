
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
    const [isProcessingSingle, setIsProcessingSingle] = useState(false);
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
        command_args: '-c:v libx264 -preset ultrafast -profile:v baseline -level 3.0 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -b:v 1500k -threads 1 -strict experimental -c:a aac -ac 2 -ar 44100 -ab 128k', 
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
            setStats({
                waiting: all.filter((v: any) => v.transcode_status === 'WAITING').length,
                processing: all.filter((v: any) => v.transcode_status === 'PROCESSING').length,
                failed: all.filter((v: any) => v.transcode_status === 'FAILED').length,
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
        const interval = setInterval(loadData, 5000);
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
                toast.success("Cola actualizada");
                setScanResult(null);
                loadData();
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsScanning(false); }
    };

    const handleProcessSingle = async () => {
        if (isProcessingSingle) return;
        setIsProcessingSingle(true);
        try {
            toast.info("Iniciando conversión FFmpeg...");
            await db.request('action=admin_process_next_transcode', { method: 'POST' });
            toast.success("Tarea completada con éxito");
            loadData();
        } catch (e: any) {
            toast.error("Fallo FFmpeg: Verifique el Log detallado.");
        } finally {
            setIsProcessingSingle(false);
        }
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
                    description: editingProfile.description || 'Optimizado para Synology 2.7.1 (Extreme Compatibility)'
                })
            });
            toast.success(`Perfil .${ext} guardado`);
            setShowProfileEditor(false);
            setEditingProfile({ extension: '', command_args: '', description: '' });
            loadData();
        } catch (e: any) { toast.error(e.message); }
    };

    const applyHardwarePreset = (level: 1 | 2 | 3) => {
        const extensions = ['mkv', 'avi', 'ts', 'mov', 'flv'];
        let args = '';
        
        switch(level) {
            case 1: args = '-c copy'; break;
            case 2: args = '-c:v libx264 -preset ultrafast -profile:v baseline -level 3.0 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -b:v 1500k -threads 1 -strict experimental -c:a aac -ac 2 -ar 44100'; break;
            case 3: args = '-vf "scale=trunc(iw/2)*2:720,setsar=1" -c:v libx264 -preset ultrafast -profile:v baseline -level 3.0 -pix_fmt yuv420p -b:v 1000k -threads 1 -strict experimental -c:a aac -ac 2 -ar 44100'; break;
        }

        extensions.forEach(ext => handleSaveProfile(ext, args));
        toast.success("Presets v2.7.1 (Baseline Mode) aplicados");
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

            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none rotate-12"><Gauge size={200}/></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Gauge size={28}/></div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Perfiles Synology v2.7.1</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">H.264 Baseline & hilos bloqueados para estabilidad</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => applyHardwarePreset(1)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-emerald-500/50 transition-all group">
                            <div className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">Copia Directa</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Re-empaquetado MP4 sin carga de CPU. Rápido y seguro.</p>
                        </button>
                        <button onClick={() => applyHardwarePreset(2)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-amber-500/50 transition-all group">
                            <div className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">Compatibilidad Ultimate</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Baseline Profile + PixFmt Fix. Evita fallos de encoder al abrir stream.</p>
                        </button>
                        <button onClick={() => applyHardwarePreset(3)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-red-500/50 transition-all group">
                            <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Bajo Recurso 720p</div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Reduce bitrate y escala a 720p para aliviar CPU del NAS.</p>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                                <Cpu size={20} className={isRunning ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}/>
                                Motor Manual
                            </h3>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleProcessSingle} 
                                    disabled={isProcessingSingle || stats.waiting === 0}
                                    className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 bg-emerald-600 text-white disabled:opacity-50`}
                                >
                                    {isProcessingSingle ? <RefreshCw className="animate-spin" size={18}/> : <Play size={18} fill="currentColor"/>}
                                    PROCESAR 1 TAREA
                                </button>
                                <button 
                                    onClick={() => handleAction('admin_transcode_batch')} 
                                    className="w-full py-3 rounded-2xl text-[10px] font-black uppercase text-white bg-indigo-600 border border-indigo-500 flex items-center justify-center gap-2 shadow-lg"
                                >
                                    ACTIVAR AUTO-BATCH
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <h3 className="font-bold text-white mb-4 text-xs uppercase flex items-center gap-2">
                            <Filter size={14} className="text-indigo-400"/> Gestor Tareas
                        </h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                                <input type="checkbox" checked={filters.onlyNonMp4} onChange={e => setFilters({...filters, onlyNonMp4: e.target.checked})} className="accent-indigo-500 w-4 h-4"/>
                                <span className="text-[11px] text-slate-300 font-bold uppercase">No-MP4</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button onClick={() => handleScanFilter('PREVIEW')} disabled={isScanning} className="bg-slate-800 text-slate-300 py-2.5 rounded-lg text-[10px] font-black uppercase">Escanear</button>
                                <button onClick={() => handleScanFilter('EXECUTE')} disabled={isScanning || scanResult === 0} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 py-2.5 rounded-lg text-[10px] font-black uppercase">Encolar</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-black rounded-2xl p-5 border border-slate-800 shadow-2xl h-80 flex flex-col">
                         <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-2 text-slate-500">
                                 <Terminal size={14}/>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Salida FFmpeg (Debug)</span>
                             </div>
                             <button onClick={() => handleAction('admin_clear_logs')} className="text-[9px] text-slate-600 hover:text-white uppercase font-bold">Limpiar</button>
                         </div>
                         <div className="font-mono text-[10px] flex-1 overflow-y-auto space-y-1 custom-scrollbar text-slate-500">
                            {log.map((line, i) => (
                                <div key={i} className={`flex gap-3 ${line.includes('ERROR') || line.includes('fail') || line.includes('Opening encoder') ? 'text-red-500' : 'text-slate-600'}`}>
                                    <span className="opacity-20 shrink-0">[{i}]</span>
                                    <span className="break-all">{line}</span>
                                </div>
                            ))}
                            {log.length === 0 && <p className="italic opacity-30">Listo para convertir...</p>}
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
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Argumentos FFmpeg (v2.7.1)</label>
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
