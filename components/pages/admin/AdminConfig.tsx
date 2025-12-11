
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, VideoCategory, VipPlan } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { Settings, Save, Percent, ChevronDown, ChevronUp, DownloadCloud, Tag, DollarSign, Loader2, Crown, Trash2, Plus, CreditCard } from 'lucide-react';
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

    useEffect(() => {
        db.getSystemSettings().then((s: SystemSettings) => {
            setSettings(s);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleSaveConfig = async () => {
        if (!settings) return;
        try {
            await db.updateSystemSettings(settings);
            toast.success("Configuración guardada");
        } catch(e: any) {
            toast.error("Error al guardar");
        }
    };

    const updateCategoryPrice = (cat: string, price: number) => {
        if (!settings) return;
        setSettings({
            ...settings,
            categoryPrices: {
                ...(settings.categoryPrices || {}), 
                [cat]: price
            }
        });
    };

    const addVipPlan = () => {
        if (!settings) return;
        const newPlan: VipPlan = {
            id: 'v_' + Date.now(),
            name: 'Nuevo Plan',
            price: 100,
            type: 'ACCESS',
            durationDays: 30,
            description: ''
        };
        setSettings({...settings, vipPlans: [...(settings.vipPlans || []), newPlan]});
    };

    const removeVipPlan = (id: string) => {
        if (!settings) return;
        setSettings({...settings, vipPlans: (settings.vipPlans || []).filter(p => p.id !== id)});
    };

    const updateVipPlan = (id: string, field: keyof VipPlan, value: any) => {
        if (!settings) return;
        setSettings({
            ...settings,
            vipPlans: (settings.vipPlans || []).map(p => p.id === id ? {...p, [field]: value} : p)
        });
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;
    if (!settings) return <div className="p-10 text-center text-red-400">Error cargando configuración.</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Configuración del Sistema</h2>
                <button onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all">
                    <Save size={18}/> Guardar Todo
                </button>
            </div>

            <ConfigSection 
                title="Sistema & Horarios" 
                icon={Settings} 
                isOpen={openSection === 'SYSTEM'} 
                onToggle={() => setOpenSection(openSection === 'SYSTEM' ? '' : 'SYSTEM')}
            >
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Inicio Descarga</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings({...settings, downloadStartTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Fin Descarga</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings({...settings, downloadEndTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Ruta yt-dlp <InfoTooltip text="Ruta absoluta al binario en servidor" example="/usr/local/bin/yt-dlp" /></label>
                    <input type="text" value={settings.ytDlpPath || ''} onChange={e => setSettings({...settings, ytDlpPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs outline-none focus:border-indigo-500"/>
                </div>
            </ConfigSection>

            {/* VIP PLANS EDITOR */}
            <ConfigSection 
                title="Planes VIP & Recargas" 
                icon={Crown} 
                isOpen={openSection === 'VIP'} 
                onToggle={() => setOpenSection(openSection === 'VIP' ? '' : 'VIP')}
            >
                <div className="space-y-4">
                    {settings.vipPlans && settings.vipPlans.map((plan) => (
                        <div key={plan.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                            <button onClick={() => removeVipPlan(plan.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Nombre</label>
                                    <input type="text" value={plan.name} onChange={e => updateVipPlan(plan.id, 'name', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-sm text-white"/>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Precio (CUP)</label>
                                    <input type="number" value={plan.price} onChange={e => updateVipPlan(plan.id, 'price', parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-sm text-emerald-400 font-bold"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Tipo</label>
                                    <select value={plan.type} onChange={e => updateVipPlan(plan.id, 'type', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-sm text-white">
                                        <option value="ACCESS">Acceso Total</option>
                                        <option value="BALANCE">Recarga Saldo</option>
                                    </select>
                                </div>
                                {plan.type === 'ACCESS' ? (
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Días de Duración</label>
                                        <input type="number" value={plan.durationDays} onChange={e => updateVipPlan(plan.id, 'durationDays', parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-sm text-white"/>
                                    </div>
                                ) : (
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">% Bono Extra</label>
                                        <input type="number" value={plan.bonusPercent} onChange={e => updateVipPlan(plan.id, 'bonusPercent', parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-sm text-white"/>
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500">Descripción</label>
                                <input type="text" value={plan.description} onChange={e => updateVipPlan(plan.id, 'description', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300"/>
                            </div>
                        </div>
                    ))}
                    
                    <button onClick={addVipPlan} className="w-full py-2 border border-dashed border-slate-700 text-slate-400 rounded-xl hover:bg-slate-800 hover:text-white flex items-center justify-center gap-2 text-sm font-bold">
                        <Plus size={16}/> Agregar Plan
                    </button>
                </div>
            </ConfigSection>

            {/* PAYMENT INSTRUCTIONS & GATEWAYS */}
            <ConfigSection 
                title="Pagos & Gateways" 
                icon={CreditCard} 
                isOpen={openSection === 'PAYMENT'} 
                onToggle={() => setOpenSection(openSection === 'PAYMENT' ? '' : 'PAYMENT')}
            >
                <div className="space-y-6">
                    {/* Tropipay Config */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2 text-indigo-300">Integración Tropipay</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client ID</label>
                                <input type="text" value={settings.tropipayClientId || ''} onChange={e => setSettings({...settings, tropipayClientId: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Secret</label>
                                <input type="password" value={settings.tropipayClientSecret || ''} onChange={e => setSettings({...settings, tropipayClientSecret: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tasa Cambio (CUP &rarr; 1 EUR)</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-400">1 EUR = </span>
                                    <input type="number" min="1" value={settings.currencyConversion || 1} onChange={e => setSettings({...settings, currencyConversion: parseFloat(e.target.value)})} className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none text-center font-bold"/>
                                    <span className="text-sm text-slate-400">Saldo/CUP</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Si tus planes valen 1000 y la tasa es 300, el usuario pagará 3.33 EUR en Tropipay.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                            Escribe aquí las instrucciones MANUALES para usuarios que no usen la pasarela automática (ej: Transferencia QR).
                        </p>
                        <textarea 
                            rows={4} 
                            value={settings.paymentInstructions || ''} 
                            onChange={e => setSettings({...settings, paymentInstructions: e.target.value})} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white focus:border-indigo-500 outline-none leading-relaxed font-mono"
                            placeholder="Ejemplo:
1. Envía el pago a Tropipay: user@example.com
2. Usa QvaPay: https://qvapay.com/pay/me"
                        />
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Precios Automáticos por Categoría" 
                icon={Tag} 
                isOpen={openSection === 'PRICES'} 
                onToggle={() => setOpenSection(openSection === 'PRICES' ? '' : 'PRICES')}
            >
                <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 mb-2">
                    Estos precios se aplicarán automáticamente a los videos durante el <strong>Paso 3: Organización Inteligente</strong> basándose en su categoría detectada.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.values(VideoCategory) as string[]).map(cat => (
                        <div key={cat} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
                                {cat.replace('_', ' ')}
                            </span>
                            <div className="relative w-24">
                                <DollarSign size={12} className="absolute left-2 top-2.5 text-slate-500"/>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={settings.categoryPrices?.[cat] || 0}
                                    onChange={(e) => updateCategoryPrice(cat, parseFloat(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-sm text-amber-400 font-bold outline-none focus:border-indigo-500 text-right"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Economía & Comisiones" 
                icon={Percent} 
                isOpen={openSection === 'ECONOMY'} 
                onToggle={() => setOpenSection(openSection === 'ECONOMY' ? '' : 'ECONOMY')}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Videos (%)</label>
                        <div className="relative">
                            <input type="number" value={settings.videoCommission ?? 20} onChange={e => setSettings({...settings, videoCommission: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 pr-8"/>
                            <span className="absolute right-3 top-2.5 text-slate-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Retenido por el sistema en cada venta de video.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Marketplace (%)</label>
                        <div className="relative">
                            <input type="number" value={settings.marketCommission ?? 25} onChange={e => setSettings({...settings, marketCommission: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 pr-8"/>
                            <span className="absolute right-3 top-2.5 text-slate-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Retenido en ventas de productos físicos.</p>
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Integraciones API" 
                icon={DownloadCloud} 
                isOpen={openSection === 'API'} 
                onToggle={() => setOpenSection(openSection === 'API' ? '' : 'API')}
            >
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Pexels API Key <InfoTooltip text="Para búsqueda de stock videos" /></label>
                    <input type="password" value={settings.pexelsKey || ''} onChange={e => setSettings({...settings, pexelsKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Pixabay API Key <InfoTooltip text="Alternativa stock gratuita" /></label>
                    <input type="password" value={settings.pixabayKey || ''} onChange={e => setSettings({...settings, pixabayKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">YouTube (yt-dlp)</label>
                    <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-lg border border-slate-700">
                        <input 
                            type="checkbox" 
                            checked={settings.enableYoutube || false} 
                            onChange={e => setSettings({...settings, enableYoutube: e.target.checked})} 
                            className="accent-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300">Habilitar descargas de YouTube</span>
                    </div>
                </div>
            </ConfigSection>
        </div>
    );
}
