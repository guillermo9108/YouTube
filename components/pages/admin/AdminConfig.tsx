
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, Category, VipPlan, FtpSettings } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Save, Tag, Loader2, Trash2, Plus, Sparkles, 
    CreditCard, ChevronRight, DollarSign, Database,
    Clock, Percent, HardDrive, Crown, X, Info, Smartphone, Wallet, Globe,
    Cpu, Settings2, Shield, Activity, Network, ListPlus
} from 'lucide-react';

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [activeSection, setActiveSection] = useState<string | null>('GENERAL');
    const [newLibPath, setNewLibPath] = useState('');

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            // Asegurar integridad de objetos anidados y valores por defecto
            if (!s.categories) s.categories = [];
            if (!s.vipPlans) s.vipPlans = [];
            if (!s.libraryPaths) s.libraryPaths = [];
            if (!s.paymentMethods) s.paymentMethods = {
                tropipay: { enabled: false, instructions: '' },
                card: { enabled: false, instructions: '' },
                mobile: { enabled: false, instructions: '' },
                manual: { enabled: true, instructions: 'Contacta al admin para recargar.' }
            };
            if (!s.ftpSettings) s.ftpSettings = { host: '', port: 21, user: '', pass: '', rootPath: '/' };
            
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
            toast.success("Configuración guardada y aplicada");
            await loadSettings();
        } catch(e: any) { toast.error("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    const updateValue = (key: keyof SystemSettings, val: any) => {
        setSettings(prev => prev ? { ...prev, [key]: val } : null);
    };

    // Función de actualización tipada para evitar TS7053
    const updatePaymentMethod = (
        method: 'tropipay' | 'card' | 'mobile' | 'manual', 
        field: 'enabled' | 'instructions', 
        val: any
    ) => {
        if (!settings) return;
        const currentMethods = { ...(settings.paymentMethods || {}) };
        const methodConfig = { ...(currentMethods[method] || { enabled: false, instructions: '' }) };
        
        // @ts-ignore - Dynamic field update within safe keys
        methodConfig[field] = val;
        currentMethods[method] = methodConfig;
        
        updateValue('paymentMethods', currentMethods);
    };

    const addLibraryPath = () => {
        if (!newLibPath.trim() || !settings) return;
        const paths = [...(settings.libraryPaths || [])];
        if (!paths.includes(newLibPath)) {
            paths.push(newLibPath);
            updateValue('libraryPaths', paths);
            setNewLibPath('');
        }
    };

    const removeLibraryPath = (path: string) => {
        if (!settings) return;
        updateValue('libraryPaths', (settings.libraryPaths || []).filter(p => p !== path));
    };

    const updateFtp = (field: keyof FtpSettings, val: any) => {
        if (!settings) return;
        updateValue('ftpSettings', { ...settings.ftpSettings, [field]: val });
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    const SectionHeader = ({ id, label, icon: Icon, color = "text-indigo-400" }: any) => (
        <button 
            onClick={() => setActiveSection(activeSection === id ? null : id)}
            className={`w-full flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-2xl transition-all ${activeSection === id ? 'ring-2 ring-indigo-500/50 bg-slate-800/40' : 'hover:bg-slate-800/20'}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeSection === id ? 'bg-indigo-600 text-white' : 'bg-slate-800 ' + color}`}>
                    <Icon size={20} />
                </div>
                <span className="font-black text-white uppercase text-[11px] tracking-[0.1em]">{label}</span>
            </div>
            <ChevronRight size={18} className={`text-slate-600 transition-transform duration-300 ${activeSection === id ? 'rotate-90 text-indigo-400' : ''}`} />
        </button>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in pb-32 px-2">
            
            {/* Top Command Bar */}
            <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 sticky top-[72px] z-40 backdrop-blur-md bg-slate-900/90">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20"><Settings2 size={24}/></div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Sistema</h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Core V1.8.2</p>
                    </div>
                </div>
                <button onClick={handleSaveConfig} disabled={saving} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-10 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-indigo-900/20">
                    {saving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Guardar Ajustes
                </button>
            </div>

            {/* SECTION: GENERAL ECONOMY */}
            <SectionHeader id="GENERAL" label="Economía & IA" icon={Shield} color="text-emerald-400" />
            {activeSection === 'GENERAL' && (
                <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Percent size={12}/> Comisión Video</label>
                            <input type="number" value={settings?.videoCommission} onChange={e => updateValue('videoCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold focus:border-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Percent size={12}/> Comisión Market</label>
                            <input type="number" value={settings?.marketCommission} onChange={e => updateValue('marketCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold focus:border-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Percent size={12}/> Tarifa Envío $</label>
                            <input type="number" value={settings?.transferFee} onChange={e => updateValue('transferFee', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold focus:border-indigo-500 outline-none" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-1"><Sparkles size={12}/> Gemini AI API Key</label>
                        <input type="password" value={settings?.geminiKey} onChange={e => updateValue('geminiKey', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:border-indigo-500 outline-none" placeholder="AI Key para metadatos..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Globe size={12}/> Tropipay Client ID</label>
                            <input type="text" value={settings?.tropipayClientId} onChange={e => updateValue('tropipayClientId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:border-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Globe size={12}/> Tropipay Secret</label>
                            <input type="password" value={settings?.tropipayClientSecret} onChange={e => updateValue('tropipayClientSecret', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:border-indigo-500 outline-none" />
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION: STORAGE & VOLUMES */}
            <SectionHeader id="SYSTEM" label="Rutas & Almacenamiento" icon={Database} color="text-blue-400" />
            {activeSection === 'SYSTEM' && (
                <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 space-y-8 animate-in slide-in-from-top-4">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 ml-1"><HardDrive size={14}/> Gestión de Volúmenes (Librería)</label>
                        <div className="space-y-3">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                <span className="text-[9px] font-bold text-slate-600 uppercase">Volumen Principal (Root)</span>
                                <input type="text" value={settings?.localLibraryPath} onChange={e => updateValue('localLibraryPath', e.target.value)} className="w-full bg-transparent text-white font-mono text-xs outline-none" placeholder="/volume1/videos/..." />
                            </div>
                            
                            {(settings?.libraryPaths || []).map(path => (
                                <div key={path} className="flex items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 group">
                                    <Database size={16} className="text-slate-600"/>
                                    <span className="flex-1 text-xs font-mono text-slate-300 truncate">{path}</span>
                                    <button onClick={() => removeLibraryPath(path)} className="p-2 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                </div>
                            ))}

                            <div className="flex gap-2">
                                <input 
                                    type="text" value={newLibPath} onChange={e => setNewLibPath(e.target.value)} 
                                    placeholder="Añadir otro disco (ej: /volumeUSB1/pakete)" 
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500"
                                />
                                <button onClick={addLibraryPath} className="bg-slate-800 text-white p-3 rounded-xl hover:bg-indigo-600 transition-colors"><ListPlus size={20}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Activity size={12}/> FFmpeg Bin</label>
                            <input type="text" value={settings?.ffmpegPath} onChange={e => updateValue('ffmpegPath', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-[10px] outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Activity size={12}/> YT-DLP Bin</label>
                            <input type="text" value={settings?.ytDlpPath} onChange={e => updateValue('ytDlpPath', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-[10px] outline-none" />
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION: FTP SYNC */}
            <SectionHeader id="FTP" label="Sincronización FTP" icon={Network} color="text-amber-400" />
            {activeSection === 'FTP' && (
                <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 space-y-6 animate-in slide-in-from-top-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Host Servidor</label>
                        <input type="text" value={settings?.ftpSettings?.host} onChange={e => updateFtp('host', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none" placeholder="192.168.1.100" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Usuario</label>
                            <input type="text" value={settings?.ftpSettings?.user} onChange={e => updateFtp('user', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Contraseña</label>
                            <input type="password" value={settings?.ftpSettings?.pass} onChange={e => updateFtp('pass', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none" />
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION: CATEGORIES */}
            <SectionHeader id="CATEGORIES" label="Categorías & Precios" icon={Tag} color="text-pink-400" />
            {activeSection === 'CATEGORIES' && (
                <div className="bg-slate-900/50 p-4 rounded-[32px] border border-slate-800 space-y-4 animate-in slide-in-from-top-4">
                    <button onClick={() => {
                        const newCat: Category = { id: 'c_' + Date.now(), name: 'NUEVA', price: 1.0, autoSub: false, sortOrder: 'LATEST' };
                        updateValue('categories', [...(settings?.categories || []), newCat]);
                    }} className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-indigo-400 border border-indigo-500/20 transition-all"><Plus size={16}/> Añadir Categoría</button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {settings?.categories.map(cat => (
                            <div key={cat.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 relative group">
                                <button onClick={() => updateValue('categories', settings.categories.filter(c => c.id !== cat.id))} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={14}/></button>
                                <input value={cat.name} onChange={e => updateValue('categories', settings.categories.map(c => c.id === cat.id ? {...c, name: e.target.value.toUpperCase()} : c))} className="bg-transparent border-b border-white/5 text-white font-black text-xs w-full p-1 outline-none focus:border-indigo-500 transition-all"/>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[8px] text-slate-600 uppercase font-black block mb-1">Precio $</label>
                                        <div className="relative">
                                            <DollarSign size={10} className="absolute left-2 top-2.5 text-emerald-500"/>
                                            <input type="number" step="0.1" value={cat.price} onChange={e => updateValue('categories', settings.categories.map(c => c.id === cat.id ? {...c, price: parseFloat(e.target.value)} : c))} className="w-full bg-slate-900 rounded-lg p-2 pl-6 text-white text-[10px] font-bold outline-none"/>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex items-center gap-2 mt-4">
                                        <input type="checkbox" checked={cat.autoSub} onChange={e => updateValue('categories', settings.categories.map(c => c.id === cat.id ? {...c, autoSub: e.target.checked} : c))} className="accent-indigo-500" />
                                        <span className="text-[8px] text-slate-500 font-black uppercase">Auto-Sub</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION: PAYMENTS GESTION */}
            <SectionHeader id="PAYMENTS" label="Gestión de Cobros" icon={CreditCard} color="text-emerald-400" />
            {activeSection === 'PAYMENTS' && (
                <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 space-y-8 animate-in slide-in-from-top-4">
                    {[
                        { id: 'tropipay', label: 'Tropipay (Auto)', icon: Globe, color: 'text-blue-400' },
                        { id: 'card', label: 'Tarjeta / Zelle (Manual)', icon: CreditCard, color: 'text-emerald-400' },
                        { id: 'mobile', label: 'Saldo Móvil / Transfer', icon: Smartphone, color: 'text-pink-400' },
                        { id: 'manual', label: 'Solicitud Soporte', icon: Wallet, color: 'text-amber-400' }
                    ].map(m => {
                        const methodKey = m.id as 'tropipay' | 'card' | 'mobile' | 'manual';
                        const config = settings?.paymentMethods?.[methodKey] || { enabled: false, instructions: '' };
                        return (
                            <div key={m.id} className="space-y-4 p-5 bg-slate-950 rounded-3xl border border-slate-800 group hover:border-indigo-500/30 transition-all shadow-xl">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl bg-slate-900 ${m.color} shadow-inner`}><m.icon size={20}/></div>
                                        <span className="text-xs font-black text-white uppercase tracking-widest">{m.label}</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={config.enabled} onChange={e => updatePaymentMethod(methodKey, 'enabled', e.target.checked)} className="sr-only peer"/>
                                        <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                    </label>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Información de pago para el usuario:</label>
                                    <textarea 
                                        value={config.instructions} 
                                        onChange={e => updatePaymentMethod(methodKey, 'instructions', e.target.value)}
                                        placeholder={`Ej: Transfiere a la tarjeta 1234-5678...`}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 min-h-[100px] outline-none focus:border-indigo-500 transition-all font-medium leading-relaxed shadow-inner italic"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="p-10 text-center opacity-20 pointer-events-none">
                <Shield size={48} className="mx-auto mb-4"/>
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">StreamPay Core Security</p>
            </div>
        </div>
    );
}
