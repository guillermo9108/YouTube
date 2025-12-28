import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, VideoCategory, VipPlan } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { Settings, Save, Percent, ChevronDown, ChevronUp, DownloadCloud, Tag, DollarSign, Loader2, Crown, Trash2, Plus, CreditCard, X, Sparkles, Globe, Cpu, FileText, FolderPlus, MapPin } from 'lucide-react';
import { InfoTooltip } from './components/InfoTooltip';

const ConfigSection = ({ title, icon: Icon, children, isOpen, onToggle }: any) => (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden transition-all duration-300">
        <button 
            onClick={onToggle}
            className="w-full px-6 py-4 flex justify-between items-center bg-slate-900 hover:bg-slate-800/50 transition-colors"
        >
            <div className="flex items-center gap-3 font-bold text-white">
                <Icon size={20} className="text-indigo-400" /> {title}
            </div>
            {isOpen ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
        </button>
        {isOpen && <div className="px-6 pb-6 pt-2 border-t border-slate-800/50 space-y-4 animate-in slide-in-from-top-2 fade-in">{children}</div>}
    </div>
);

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [openSection, setOpenSection] = useState<string>('SYSTEM');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newPath, setNewPath] = useState('');

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            if (Array.isArray(s.categoryPrices) || !s.categoryPrices) s.categoryPrices = {};
            if (!s.libraryPaths) s.libraryPaths = s.localLibraryPath ? [s.localLibraryPath] : [];
            setSettings(s);
        } catch(e) {
            toast.error("Error al cargar configuración");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSettings(); }, []);

    const handleSaveConfig = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await db.updateSystemSettings(settings);
            toast.success("Configuración guardada exitosamente");
            await loadSettings();
        } catch(e: any) {
            toast.error("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const addPath = () => {
        if (!newPath.trim()) return;
        setSettings(prev => prev ? {
            ...prev,
            libraryPaths: Array.from(new Set([...(prev.libraryPaths || []), newPath.trim()]))
        } : null);
        setNewPath('');
    };

    const removePath = (p: string) => {
        setSettings(prev => prev ? {
            ...prev,
            libraryPaths: (prev.libraryPaths || []).filter(x => x !== p)
        } : null);
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;
    if (!settings) return <div className="p-10 text-center text-red-400">Error cargando configuración.</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Configuración del Sistema</h2>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                    {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Guardar Todo
                </button>
            </div>

            <ConfigSection title="Servidor & Librería" icon={MapPin} isOpen={openSection === 'LIBRARY'} onToggle={() => setOpenSection('LIBRARY')}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">Rutas de Análisis <InfoTooltip text="Rutas absolutas donde el servidor buscará videos (NAS, HDDs)"/></label>
                        <div className="space-y-2 mb-3">
                            {(settings.libraryPaths || []).map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 group">
                                    <span className="text-xs font-mono text-indigo-300 truncate flex-1">{p}</span>
                                    <button onClick={() => removePath(p)} className="p-1 text-slate-600 hover:text-red-500"><X size={16}/></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={newPath} onChange={e => setNewPath(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-500 outline-none" placeholder="/mnt/nas/peliculas"/>
                            <button onClick={addPath} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl"><FolderPlus size={18}/></button>
                        </div>
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection title="General" icon={Settings} isOpen={openSection === 'SYSTEM'} onToggle={() => setOpenSection('SYSTEM')}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Inicio Descarga</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings(p => p ? {...p, downloadStartTime: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Fin Descarga</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings(p => p ? {...p, downloadEndTime: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">yt-dlp Path</label>
                        <input type="text" value={settings.ytDlpPath || ''} onChange={e => setSettings(p => p ? {...p, ytDlpPath: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ffmpeg Path</label>
                        <input type="text" value={settings.ffmpegPath || ''} onChange={e => setSettings(p => p ? {...p, ffmpegPath: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs"/>
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection title="Planes VIP" icon={Crown} isOpen={openSection === 'VIP'} onToggle={() => setOpenSection('VIP')}>
                 <div className="space-y-4">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest bg-slate-950 p-3 rounded-lg border border-slate-800">Nota: Los usuarios VIP desbloquean gratuitamente todo el contenido subido por administradores.</p>
                    {/* ... Resto de lógica de planes se mantiene similar ... */}
                 </div>
            </ConfigSection>
        </div>
    );
}