
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, Category, VipPlan } from '../../../types';
import { useToast } from '../../../context/ToastContext';
// Added Globe to imports to fix error on line 149
import { 
    Save, Tag, Loader2, Trash2, Plus, Sparkles, 
    CreditCard, ChevronRight, FolderTree, DollarSign, Database,
    Clock, Percent, HardDrive, Crown, Coins, FolderPlus, X, Info, Smartphone, Wallet, Globe
} from 'lucide-react';

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    const [activeSection, setActiveSection] = useState<string | null>('CATEGORIES');
    const [newVolumePath, setNewVolumePath] = useState('');

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            if (!s.categories) s.categories = [];
            if (!s.vipPlans) s.vipPlans = [];
            if (!s.libraryPaths) s.libraryPaths = [];
            if (!s.paymentMethods) s.paymentMethods = {
                tropipay: { enabled: false, instructions: '' },
                card: { enabled: false, instructions: '' },
                mobile: { enabled: false, instructions: '' },
                manual: { enabled: true, instructions: 'Escribe a soporte para recargar.' }
            };
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
            toast.success("Ajustes sincronizados");
            await loadSettings();
        } catch(e: any) { toast.error("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    const updateValue = (key: keyof SystemSettings, val: any) => {
        setSettings(prev => prev ? { ...prev, [key]: val } : null);
    };

    const updatePaymentMethod = (method: 'tropipay' | 'card' | 'mobile' | 'manual', field: 'enabled' | 'instructions', val: any) => {
        if (!settings) return;
        const currentMethods = settings.paymentMethods || {};
        const methodConfig = currentMethods[method] || { enabled: false, instructions: '' };
        
        updateValue('paymentMethods', {
            ...currentMethods,
            [method]: { ...methodConfig, [field]: val }
        });
    };

    const addCategory = () => {
        const newCat: Category = { id: 'c_' + Date.now(), name: 'NUEVA', price: 1.0, autoSub: false, sortOrder: 'LATEST' };
        updateValue('categories', [...(settings?.categories || []), newCat]);
    };

    const addVipPlan = () => {
        const newPlan: VipPlan = { id: 'p_' + Date.now(), name: 'NUEVO', price: 10, type: 'ACCESS', durationDays: 30 };
        updateValue('vipPlans', [...(settings?.vipPlans || []), newPlan]);
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
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Ajustes Globales</h2>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 active:scale-95 transition-all">
                    {saving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Guardar Cambios
                </button>
            </div>

            <SectionHeader id="CATEGORIES" label="Categorías & Precios" icon={Tag} />
            {activeSection === 'CATEGORIES' && (
                <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 space-y-4">
                    <button onClick={addCategory} className="w-full bg-slate-800 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase text-indigo-400"><Plus size={16}/> Añadir Categoría</button>
                    {settings?.categories.map(cat => (
                        <div key={cat.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                            <input value={cat.name} onChange={e => updateValue('categories', settings.categories.map(c => c.id === cat.id ? {...c, name: e.target.value.toUpperCase()} : c))} className="bg-transparent border-b border-slate-800 text-white font-bold w-full p-1"/>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[9px] text-slate-500 uppercase font-black">Precio $</label>
                                    <input type="number" step="0.1" value={cat.price} onChange={e => updateValue('categories', settings.categories.map(c => c.id === cat.id ? {...c, price: parseFloat(e.target.value)} : c))} className="w-full bg-slate-900 rounded p-2 text-white text-xs"/>
                                </div>
                                <button onClick={() => updateValue('categories', settings.categories.filter(c => c.id !== cat.id))} className="text-red-500 self-end p-2"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <SectionHeader id="VIP" label="Membresías & Recargas" icon={Crown} />
            {activeSection === 'VIP' && (
                <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 space-y-4">
                    <button onClick={addVipPlan} className="w-full bg-slate-800 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase text-amber-400"><Plus size={16}/> Nuevo Plan</button>
                    {settings?.vipPlans?.map(plan => (
                        <div key={plan.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex gap-2">
                                <input value={plan.name} onChange={e => updateValue('vipPlans', settings.vipPlans!.map(p => p.id === plan.id ? {...p, name: e.target.value} : p))} className="bg-transparent border-b border-slate-800 text-white font-bold flex-1"/>
                                <select value={plan.type} onChange={e => updateValue('vipPlans', settings.vipPlans!.map(p => p.id === plan.id ? {...p, type: e.target.value} : p))} className="bg-slate-800 text-[10px] text-white p-1 rounded">
                                    <option value="ACCESS">Acceso VIP</option>
                                    <option value="BALANCE">Recarga Saldo</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" value={plan.price} onChange={e => updateValue('vipPlans', settings.vipPlans!.map(p => p.id === plan.id ? {...p, price: parseFloat(e.target.value)} : p))} className="w-full bg-slate-900 rounded p-2 text-white text-xs" placeholder="Precio"/>
                                <button onClick={() => updateValue('vipPlans', settings.vipPlans!.filter(p => p.id !== plan.id))} className="text-red-500 p-2"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <SectionHeader id="PAYMENTS" label="Gestión de Cobros" icon={CreditCard} />
            {activeSection === 'PAYMENTS' && (
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-8">
                    {[
                        { id: 'tropipay', label: 'Tropipay (Auto)', icon: Globe },
                        { id: 'card', label: 'Tarjeta (Manual)', icon: CreditCard },
                        { id: 'mobile', label: 'Saldo Móvil', icon: Smartphone },
                        { id: 'manual', label: 'Solicitud Manual', icon: Wallet }
                    ].map(m => {
                        const config = settings?.paymentMethods?.[m.id as any] || { enabled: false, instructions: '' };
                        return (
                            <div key={m.id} className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <m.icon size={18} className="text-indigo-400"/>
                                        <span className="text-sm font-black text-white uppercase">{m.label}</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={config.enabled} onChange={e => updatePaymentMethod(m.id as any, 'enabled', e.target.checked)} className="sr-only peer"/>
                                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                <textarea 
                                    value={config.instructions} 
                                    onChange={e => updatePaymentMethod(m.id as any, 'instructions', e.target.value)}
                                    placeholder={`Instrucciones de pago para ${m.label}...`}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 min-h-[80px] outline-none focus:border-indigo-500"
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
