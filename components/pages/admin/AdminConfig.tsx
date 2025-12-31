
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, VideoCategory, VipPlan, CategoryConfig } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Settings, Save, Percent, ChevronDown, ChevronUp, DownloadCloud, Tag, 
    DollarSign, Loader2, Crown, Trash2, Plus, CreditCard, X, Sparkles, 
    Globe, Cpu, FileText, FolderTree, Edit3, ChevronRight, Hash, Layers
} from 'lucide-react';
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

// Componente Recursivo para Gestionar Árbol de Categorías
// Fix: Define CategoryNodeProps interface to solve TypeScript prop validation issues
interface CategoryNodeProps {
    node: CategoryConfig;
    onUpdate: (id: string, updates: Partial<CategoryConfig>) => void;
    onDelete: (id: string) => void;
    level?: number;
}

// Fix: Explicitly type as React.FC to correctly handle the reserved 'key' prop during recursive rendering
const CategoryNode: React.FC<CategoryNodeProps> = ({ 
    node, 
    onUpdate, 
    onDelete, 
    level = 0 
}) => {
    const [isExpanded, setIsExpanded] = useState(level < 1);
    const [showRules, setShowRules] = useState(false);

    const addChild = () => {
        const newChild: CategoryConfig = {
            id: `SUB_${Date.now()}`,
            name: 'Nueva Subcategoría',
            price: node.price,
            folderPatterns: [],
            namePatterns: [],
            children: []
        };
        onUpdate(node.id, { children: [...(node.children || []), newChild] });
        setIsExpanded(true);
    };

    return (
        <div className="space-y-2">
            <div className={`flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 group hover:border-slate-600 transition-all ${level > 0 ? 'ml-6' : ''}`}>
                <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 text-slate-500 hover:text-white transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight size={14}/>
                </button>
                
                <input 
                    type="text" 
                    value={node.name} 
                    onChange={e => onUpdate(node.id, { name: e.target.value })}
                    className="bg-transparent border-b border-transparent focus:border-indigo-500 text-sm font-bold text-white outline-none px-1 w-40"
                />

                <div className="h-4 w-px bg-slate-800 mx-2"></div>

                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                    <DollarSign size={10} className="text-amber-500"/>
                    <input 
                        type="number" 
                        value={node.price} 
                        onChange={e => onUpdate(node.id, { price: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent text-xs font-black text-amber-400 outline-none w-12 text-center"
                    />
                </div>

                <div className="flex-1"></div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setShowRules(!showRules)} className={`p-1.5 rounded-lg border transition-all ${showRules ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`} title="Reglas de Agrupación">
                        <Layers size={14}/>
                    </button>
                    <button onClick={addChild} className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition-all" title="Añadir Subcategoría">
                        <Plus size={14}/>
                    </button>
                    {!Object.values(VideoCategory).includes(node.id as any) && (
                        <button onClick={() => onDelete(node.id)} className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-500 rounded-lg transition-all">
                            <Trash2 size={14}/>
                        </button>
                    )}
                </div>
            </div>

            {showRules && (
                <div className={`p-4 bg-slate-900/50 rounded-xl border border-indigo-500/20 space-y-4 animate-in slide-in-from-top-1 ${level > 0 ? 'ml-12' : 'ml-6'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><FolderTree size={10}/> Agrupar por Carpeta (Keywords)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {node.folderPatterns.map((p, i) => (
                                    <span key={i} className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-md border border-indigo-500/20 flex items-center gap-1">
                                        {p} <button onClick={() => onUpdate(node.id, { folderPatterns: node.folderPatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                    </span>
                                ))}
                            </div>
                            <input 
                                type="text" 
                                placeholder="Añadir palabra clave..." 
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                            onUpdate(node.id, { folderPatterns: [...node.folderPatterns, val] });
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={10}/> Agrupar por Nombre (Keywords)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {node.namePatterns.map((p, i) => (
                                    <span key={i} className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-1 rounded-md border border-purple-500/20 flex items-center gap-1">
                                        {p} <button onClick={() => onUpdate(node.id, { namePatterns: node.namePatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                    </span>
                                ))}
                            </div>
                            <input 
                                type="text" 
                                placeholder="Ej: 4K, Trailer..." 
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                            onUpdate(node.id, { namePatterns: [...node.namePatterns, val] });
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            />
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-500 italic">Los videos que coincidan con estas palabras clave en su ruta o nombre se asignarán automáticamente a <strong>{node.name}</strong>.</p>
                </div>
            )}

            {isExpanded && node.children && node.children.length > 0 && (
                <div className="border-l border-slate-800 ml-4 pl-2 space-y-2">
                    {node.children.map(child => (
                        <CategoryNode 
                            key={child.id} 
                            node={child} 
                            level={level + 1} 
                            onUpdate={(id, updates) => {
                                const newChildren = node.children!.map(c => {
                                    if (c.id === id) return { ...c, ...updates };
                                    // Búsqueda profunda en hijos
                                    if (c.children) {
                                        const recursiveUpdate = (nodes: CategoryConfig[]): CategoryConfig[] => {
                                            return nodes.map(n => {
                                                if (n.id === id) return { ...n, ...updates };
                                                if (n.children) return { ...n, children: recursiveUpdate(n.children) };
                                                return n;
                                            });
                                        };
                                        return { ...c, children: recursiveUpdate(c.children) };
                                    }
                                    return c;
                                });
                                onUpdate(node.id, { children: newChildren });
                            }}
                            onDelete={(id) => {
                                const recursiveDelete = (nodes: CategoryConfig[]): CategoryConfig[] => {
                                    return nodes.filter(n => n.id !== id).map(n => {
                                        if (n.children) return { ...n, children: recursiveDelete(n.children) };
                                        return n;
                                    });
                                };
                                onUpdate(node.id, { children: recursiveDelete(node.children!) });
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [openSection, setOpenSection] = useState<string>('PRICES');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            
            // Migración de datos viejos a jerárquicos si es necesario
            let cats = s.customCategories;
            if (!Array.isArray(cats) || (cats.length > 0 && typeof cats[0] === 'string')) {
                const standard = Object.values(VideoCategory).filter(v => !['PENDING', 'PROCESSING', 'FAILED_METADATA'].includes(v));
                const custom = Array.isArray(cats) ? cats : [];
                const merged = Array.from(new Set([...standard, ...custom]));
                
                cats = merged.map(name => ({
                    id: name,
                    name: name.replace('_', ' '),
                    price: s.categoryPrices?.[name] || 1.00,
                    folderPatterns: [name],
                    namePatterns: [],
                    children: []
                }));
            }
            
            setSettings({ ...s, customCategories: cats });
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
            const cleanSettings = {
                ...settings,
                videoCommission: Number(settings.videoCommission),
                marketCommission: Number(settings.marketCommission),
                batchSize: Number(settings.batchSize),
                maxDuration: Number(settings.maxDuration),
                maxResolution: Number(settings.maxResolution),
                currencyConversion: Number(settings.currencyConversion)
            };
            await db.updateSystemSettings(cleanSettings);
            toast.success("Configuración guardada");
            await loadSettings();
        } catch(e: any) {
            toast.error("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateRootCategory = (id: string, updates: Partial<CategoryConfig>) => {
        setSettings(prev => {
            if (!prev) return null;
            const newCats = prev.customCategories.map((c: any) => c.id === id ? { ...c, ...updates } : c);
            return { ...prev, customCategories: newCats };
        });
    };

    const deleteRootCategory = (id: string) => {
        setSettings(prev => {
            if (!prev) return null;
            return { ...prev, customCategories: prev.customCategories.filter((c: any) => c.id !== id) };
        });
    };

    const addRootCategory = () => {
        const newCat: CategoryConfig = {
            id: `CAT_${Date.now()}`,
            name: 'Nueva Categoría',
            price: 1.0,
            folderPatterns: [],
            namePatterns: [],
            children: []
        };
        setSettings(prev => prev ? { ...prev, customCategories: [...prev.customCategories, newCat] } : null);
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;
    if (!settings) return <div className="p-10 text-center text-red-400">Error.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Configuración del Sistema</h2>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all">
                    {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                    {saving ? 'Guardando...' : 'Guardar Todo'}
                </button>
            </div>

            <ConfigSection 
                title="Categorías & Agrupación Inteligente" 
                icon={FolderTree} 
                isOpen={openSection === 'PRICES'} 
                onToggle={() => setOpenSection(openSection === 'PRICES' ? '' : 'PRICES')}
            >
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 mb-6">
                    <p className="text-xs text-slate-400 mb-4 flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400"/>
                        Define aquí tu árbol de contenido. El sistema usará los "Keywords" para mover automáticamente los videos a su categoría correspondiente durante el escaneo.
                    </p>
                    
                    <div className="space-y-3">
                        {settings.customCategories.map((cat: CategoryConfig) => (
                            <CategoryNode 
                                key={cat.id} 
                                node={cat} 
                                onUpdate={updateRootCategory} 
                                onDelete={deleteRootCategory}
                            />
                        ))}
                    </div>

                    <button onClick={addRootCategory} className="w-full mt-4 py-3 border border-dashed border-slate-700 text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest">
                        <Plus size={16}/> Añadir Categoría Principal
                    </button>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Sistema & Horarios" 
                icon={Settings} 
                isOpen={openSection === 'SYSTEM'} 
                onToggle={() => setOpenSection(openSection === 'SYSTEM' ? '' : 'SYSTEM')}
            >
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800 mb-4">
                    <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2"><FileText size={16} className="text-indigo-400"/> Registro de Logs</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Errores y eventos en debug_log.txt</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={settings.enableDebugLog ?? true} onChange={e => setSettings((p: any) => p ? {...p, enableDebugLog: e.target.checked} : null)} className="sr-only peer"/>
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Inicio Descarga</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings((p: any) => p ? {...p, downloadStartTime: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Fin Descarga</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings((p: any) => p ? {...p, downloadEndTime: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Ruta yt-dlp <InfoTooltip text="Ruta absoluta" example="/usr/local/bin/yt-dlp" /></label>
                        <input type="text" value={settings.ytDlpPath || ''} onChange={e => setSettings((p: any) => p ? {...p, ytDlpPath: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs outline-none focus:border-indigo-500" placeholder="yt-dlp"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Ruta FFmpeg <InfoTooltip text="NAS conversion path" example="/usr/bin/ffmpeg" /></label>
                        <input type="text" value={settings.ffmpegPath || ''} onChange={e => setSettings((p: any) => p ? {...p, ffmpegPath: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs outline-none focus:border-indigo-500" placeholder="ffmpeg"/>
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Conversión Automática (FFmpeg)" 
                icon={Cpu} 
                isOpen={openSection === 'TRANSCODE'} 
                onToggle={() => setOpenSection(openSection === 'TRANSCODE' ? '' : 'TRANSCODE')}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <div>
                            <h4 className="font-bold text-white text-sm">Procesamiento Automático</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Convierte automáticamente videos incompatibles</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.autoTranscode || false} onChange={e => setSettings((p: any) => p ? {...p, autoTranscode: e.target.checked} : null)} className="sr-only peer"/>
                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {settings.autoTranscode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1"><Cpu size={12}/> Preset FFmpeg</label>
                                <select value={settings.transcodePreset || 'superfast'} onChange={e => setSettings((p: any) => p ? {...p, transcodePreset: e.target.value} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm">
                                    <option value="ultrafast">Ultrafast (CPU bajo)</option>
                                    <option value="superfast">Superfast (Equilibrado)</option>
                                    <option value="fast">Fast</option>
                                    <option value="medium">Medium</option>
                                </select>
                            </div>
                            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-3 text-[10px] text-indigo-300 leading-relaxed">
                                <Sparkles size={14} className="mb-1"/>
                                <strong>FastStart:</strong> Los metadatos se mueven al inicio para habilitar reproducción instantánea.
                            </div>
                        </div>
                    )}
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Integraciones API & IA" 
                icon={DownloadCloud} 
                isOpen={openSection === 'API'} 
                onToggle={() => setOpenSection(openSection === 'API' ? '' : 'API')}
            >
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2 text-indigo-400"><Sparkles size={12}/> Gemini API Key</label>
                    <input type="password" value={settings.geminiKey || ''} onChange={e => setSettings((p: any) => p ? {...p, geminiKey: e.target.value} : null)} className="w-full bg-slate-950 border border-indigo-500/50 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 placeholder-slate-700" placeholder="AIza..."/>
                </div>

                <div className="bg-slate-950 border border-indigo-900/30 p-4 rounded-lg my-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Globe size={12}/> HTTP Proxy</label>
                    <input type="text" value={settings.proxyUrl || ''} onChange={e => setSettings((p: any) => p ? {...p, proxyUrl: e.target.value} : null)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 font-mono text-xs" placeholder="http://user:pass@host:port"/>
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
                        <input type="number" value={settings.videoCommission ?? 20} onChange={e => setSettings((p: any) => p ? {...p, videoCommission: parseInt(e.target.value) || 0} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Tienda (%)</label>
                        <input type="number" value={settings.marketCommission ?? 25} onChange={e => setSettings((p: any) => p ? {...p, marketCommission: parseInt(e.target.value) || 0} : null)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                </div>
            </ConfigSection>
        </div>
    );
}
