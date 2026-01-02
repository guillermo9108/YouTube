
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, Category } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Save, Tag, Loader2, Trash2, Plus, Sparkles, 
    CreditCard, Globe, Palette, ChevronRight, 
    FolderTree, DollarSign, Settings2, Info, RefreshCw, Database,
    Clock, Percent, HardDrive, ShieldCheck, Zap
} from 'lucide-react';
import { InfoTooltip } from './components/InfoTooltip';

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    const [activeSection, setActiveSection] = useState<string | null>('CATEGORIES');

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            if (!s.categories) s.categories = [];
            setSettings(s);
        } catch(e) { toast.error("Error al cargar configuración"); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadSettings(); }, []);

    const handleSaveConfig = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await db.updateSystemSettings(settings);
            toast.success("Sistema Sincronizado");
            await loadSettings();
        } catch(e: any) { toast.error("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    const handleRepairDb = async () => {
        setSyncing(true);
        try {
            await db.adminRepairDb();
            toast.success("Estructura de Base de Datos Reparada");
        } catch(e: any) { 
            toast.error("Fallo al sincronizar: " + e.message);
        } finally { 
            setSyncing(false); 
        }
    };

    const updateValue = (key: keyof SystemSettings, val: any) => {
        setSettings(prev => prev ? { ...prev, [key]: val } : null);
    };

    const addCategory = () => {
        const newCat: Category = { id: 'c_' + Date.now(), name: 'NUEVA CATEGORÍA', price: 1.00, autoSub: false };
        updateValue('categories', [...(settings?.categories || []), newCat]);
    };

    const updateCategory = (id: string, field: keyof Category, val: any) => {
        const next = settings?.categories.map(c => c.id === id ? { ...c, [field]: val } : c) || [];
        updateValue('categories', next);
    };

    const removeCategory = (id: string) => {
        updateValue('categories', settings?.categories.filter(c => c.id !== id) || []);
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    const SectionHeader = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveSection(activeSection === id ? null : id)}
            className={`w-full flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-2xl transition-all ${activeSection === id ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-black' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeSection === id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon size={20} />
                </div>
                <span className="font-black text-white uppercase text-xs tracking-widest">{label}</span>
            </div>
            <ChevronRight size={20} className={`text-slate-600 transition-transform ${activeSection === id ? 'rotate-90' : ''}`} />
        </button>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in pb-32 px-2">
            
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Ajustes Globales</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configuración del Servidor & Ecosistema</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleRepairDb} disabled={syncing} className="flex-1 md:flex-none p-4 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-2xl transition-all active:scale-95" title="Sincronizar DB">
                        {syncing ? <RefreshCw size={20} className="animate-spin"/> : <Database size={20}/>}
                    </button>
                    <button onClick={handleSaveConfig} disabled={saving} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all">
                        {saving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Guardar
                    </button>
                </div>
            </div>

            {/* 1. GESTOR DE CATEGORÍAS */}
            <div className="space-y-3">
                <SectionHeader id="CATEGORIES" label="Categorías & Precios" icon={Tag} />
                {activeSection === 'CATEGORIES' && (
                    <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 space-y-4 animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Info size={12}/> Gestiona tu catálogo</span>
                            <button onClick={addCategory} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl flex items-center gap-1 text-[10px] font-black uppercase shadow-lg active:scale-90 transition-all">
                                <Plus size={16}/> Nueva
                            </button>
                        </div>

                        <div className="space-y-3">
                            {settings?.categories.map((cat) => (
                                <div key={cat.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 group">
                                    <div className="flex justify-between gap-2">
                                        <input 
                                            type="text" 
                                            value={cat.name} 
                                            onChange={e => updateCategory(cat.id, 'name', e.target.value.toUpperCase())}
                                            className="bg-transparent border-b border-slate-800 focus:border-indigo-500 text-white font-black text-sm outline-none flex-1 py-1"
                                        />
                                        <button onClick={() => removeCategory(cat.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-600 uppercase flex items-center gap-1"><DollarSign size={10}/> Precio Base</label>
                                            <input 
                                                type="number" 
                                                value={cat.price} 
                                                step="0.1"
                                                onChange={e => updateCategory(cat.id, 'price', parseFloat(e.target.value))}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-600 uppercase flex items-center gap-1"><FolderTree size={10}/> Modo Carpeta</label>
                                            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <input 
                                                    type="checkbox" 
                                                    checked={cat.autoSub} 
                                                    onChange={e => updateCategory(cat.id, 'autoSub', e.target.checked)}
                                                    className="accent-indigo-500 w-4 h-4"
                                                />
                                                <span className="text-[9px] font-black text-slate-400 uppercase">Sub-Auto</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. ECONOMÍA & COMISIONES */}
            <div className="space-y-3">
                <SectionHeader id="FINANCE" label="Economía del Sistema" icon={Percent} />
                {activeSection === 'FINANCE' && (
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Comisión Video (%)</label>
                                <input type="number" value={settings?.videoCommission || 20} onChange={e => updateValue('videoCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Comisión Tienda (%)</label>
                                <input type="number" value={settings?.marketCommission || 25} onChange={e => updateValue('marketCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Tarifa Transferencia P2P (%)</label>
                            <input type="number" step="0.1" value={settings?.transferFee || 5.0} onChange={e => updateValue('transferFee', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. LÍMITES & AUTOMATIZACIÓN */}
            <div className="space-y-3">
                <SectionHeader id="AUTOMATION" label="Límites & Escaneo" icon={HardDrive} />
                {activeSection === 'AUTOMATION' && (
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Ruta Librería NAS/Local</label>
                            <input type="text" value={settings?.localLibraryPath || ''} onChange={e => updateValue('localLibraryPath', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono" placeholder="/volume1/videos/..."/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Lote Escaneo (Paso 2)</label>
                                <input type="number" value={settings?.batchSize || 2} onChange={e => updateValue('batchSize', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Resolución Máx</label>
                                <select value={settings?.maxResolution || 1080} onChange={e => updateValue('maxResolution', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold">
                                    <option value={720}>720p</option>
                                    <option value={1080}>1080p</option>
                                    <option value={2160}>4K</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Inicio Descargas</label>
                                <input type="time" value={settings?.downloadStartTime || '01:00'} onChange={e => updateValue('downloadStartTime', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Fin Descargas</label>
                                <input type="time" value={settings?.downloadEndTime || '06:00'} onChange={e => updateValue('downloadEndTime', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"/>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. INTELIGENCIA IA */}
            <div className="space-y-3">
                <SectionHeader id="AI" label="Inteligencia & Media" icon={Sparkles} />
                {activeSection === 'AI' && (
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Google Gemini API Key</label>
                            <input type="password" value={settings?.geminiKey || ''} onChange={e => updateValue('geminiKey', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xs font-mono" placeholder="AIza..."/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Ruta FFmpeg</label>
                            <input type="text" value={settings?.ffmpegPath || ''} onChange={e => updateValue('ffmpegPath', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xs font-mono"/>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. PAGOS & PASARELA */}
            <div className="space-y-3">
                <SectionHeader id="PAYMENTS" label="Pagos (Tropipay)" icon={CreditCard} />
                {activeSection === 'PAYMENTS' && (
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Tropipay Client ID</label>
                                <input type="text" value={settings?.tropipayClientId || ''} onChange={e => updateValue('tropipayClientId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xs font-mono"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Tropipay Secret</label>
                                <input type="password" value={settings?.tropipayClientSecret || ''} onChange={e => updateValue('tropipayClientSecret', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xs font-mono"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Conversión Saldo / 1 EUR</label>
                                <input type="number" value={settings?.currencyConversion || 300} onChange={e => updateValue('currencyConversion', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-black text-lg"/>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
