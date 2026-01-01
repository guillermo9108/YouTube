
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, VipPlan } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Settings, Save, ChevronDown, ChevronUp, Tag, Loader2, 
    Trash2, Plus, X, Sparkles, FolderTree, ArrowRight, 
    DollarSign, Search, Layers, ShieldCheck, Percent, Cpu, Globe, CreditCard,
    Type, Edit3, Palette
} from 'lucide-react';
import { InfoTooltip } from './components/InfoTooltip';

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
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
            toast.success("Configuración del sistema actualizada");
            await loadSettings();
        } catch(e: any) { toast.error("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    const updateValue = (key: keyof SystemSettings, val: any) => {
        setSettings(prev => prev ? { ...prev, [key]: val } : null);
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Panel de Control</h2>
                    <p className="text-xs text-slate-500">Configuración global del ecosistema StreamPay.</p>
                </div>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-3 px-8 rounded-2xl flex items-center gap-2 shadow-2xl active:scale-95 transition-all">
                    {saving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Guardar Cambios
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Motor de IA & Media */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-400"/> Inteligencia & Media
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Google Gemini API Key <InfoTooltip text="Requerido para el Concierge IA y generación de metadatos."/></label>
                            <input type="password" value={settings?.geminiKey || ''} onChange={e => updateValue('geminiKey', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono" placeholder="AIza..."/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Ruta FFmpeg <InfoTooltip text="Ruta absoluta al binario en el servidor."/></label>
                            <input type="text" value={settings?.ffmpegPath || ''} onChange={e => updateValue('ffmpegPath', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono" placeholder="/usr/bin/ffmpeg"/>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={!!settings?.autoTranscode} onChange={e => updateValue('autoTranscode', e.target.checked)} className="w-4 h-4 accent-indigo-500"/>
                            <span className="text-xs font-bold text-slate-300">Transcodificación Automática</span>
                        </label>
                    </div>
                </div>

                {/* Personalización y Pagos Manuales */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                        <Palette size={16} className="text-pink-400"/> Personalización & Pagos
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Instrucciones de Pago Manual <InfoTooltip text="Este texto se mostrará a los usuarios cuando quieran recargar saldo."/></label>
                            <textarea value={settings?.paymentInstructions || ''} onChange={e => updateValue('paymentInstructions', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs min-h-[100px]" placeholder="Ej: Envía transferencia a la tarjeta XXXX y adjunta comprobante..."/>
                        </div>
                    </div>
                </div>

                {/* Pasarela Tropipay */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                        <CreditCard size={16} className="text-blue-400"/> Pagos Automatizados (Tropipay)
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tropipay Client ID</label>
                            <input type="text" value={settings?.tropipayClientId || ''} onChange={e => updateValue('tropipayClientId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tropipay Secret</label>
                            <input type="password" value={settings?.tropipayClientSecret || ''} onChange={e => updateValue('tropipayClientSecret', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Conversión CUP/Saldo por 1 EUR <InfoTooltip text="Ej: Si pones 300, el usuario paga 1 EUR y recibe 300 Saldo."/></label>
                            <input type="number" value={settings?.currencyConversion || 300} onChange={e => updateValue('currencyConversion', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold"/>
                        </div>
                    </div>
                </div>

                {/* Comisiones & Red */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                        <Landmark size={16} className="text-emerald-400"/> Economía de Red
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Comisión Video (%)</label>
                                <input type="number" value={settings?.videoCommission || 20} onChange={e => updateValue('videoCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Comisión Tienda (%)</label>
                                <input type="number" value={settings?.marketCommission || 25} onChange={e => updateValue('marketCommission', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tarifa Transferencia P2P (%) <InfoTooltip text="Costo por enviar saldo entre usuarios."/></label>
                            <input type="number" value={settings?.transferFee || 5} onChange={e => updateValue('transferFee', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"/>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

const Landmark = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 20 7 4 7 12 2"></polygon></svg>
);
