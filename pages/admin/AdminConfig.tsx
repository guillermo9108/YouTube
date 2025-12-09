
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { SystemSettings, VideoCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Settings, Save, Percent, ChevronDown, ChevronUp, DownloadCloud, Tag, DollarSign } from 'lucide-react';
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

    useEffect(() => {
        db.getSystemSettings().then(setSettings);
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
                ...settings.categoryPrices,
                [cat]: price
            }
        });
    };

    if (!settings) return null;

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

            {/* NEW SECTION: CATEGORY PRICES */}
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
                    {Object.values(VideoCategory).map(cat => (
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
                            <input type="number" value={settings.videoCommission} onChange={e => setSettings({...settings, videoCommission: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 pr-8"/>
                            <span className="absolute right-3 top-2.5 text-slate-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Retenido por el sistema en cada venta de video.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Marketplace (%)</label>
                        <div className="relative">
                            <input type="number" value={settings.marketCommission} onChange={e => setSettings({...settings, marketCommission: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 pr-8"/>
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

                <div className="flex items-center gap-3 py-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <input type="checkbox" checked={settings.enableYoutube} onChange={e => setSettings({...settings, enableYoutube: e.target.checked})} className="accent-indigo-500 w-5 h-5"/>
                    <span className="text-sm text-slate-300 font-bold">Habilitar Descargas de YouTube</span>
                </div>
            </ConfigSection>
        </div>
    );
}
