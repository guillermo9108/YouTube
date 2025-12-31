
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, VideoCategory, VipPlan, CategoryConfig } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Settings, Save, Percent, ChevronDown, ChevronUp, DownloadCloud, Tag, 
    DollarSign, Loader2, Crown, Trash2, Plus, CreditCard, X, Sparkles, 
    Globe, Cpu, FileText, FolderTree, Edit3, ChevronRight, Hash, Layers,
    ArrowRightLeft, Landmark, FolderInput, LayoutTemplate
} from 'lucide-react';
import { InfoTooltip } from './components/InfoTooltip';

const ConfigSection = ({ title, icon: Icon, children, isOpen, onToggle }: any) => (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden transition-all duration-300">
        <button 
            onClick={onToggle}
            className="w-full px-4 md:px-6 py-4 flex justify-between items-center bg-slate-900 hover:bg-slate-800/50 transition-colors"
        >
            <div className="flex items-center gap-3 font-bold text-white text-sm md:text-base">
                <Icon size={20} className="text-indigo-400" /> {title}
            </div>
            {isOpen ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
        </button>
        {isOpen && <div className="px-4 md:px-6 pb-6 pt-2 border-t border-slate-800/50 space-y-4 animate-in slide-in-from-top-2 fade-in">{children}</div>}
    </div>
);

interface CategoryNodeProps {
    node: CategoryConfig;
    onUpdate: (id: string, updates: Partial<CategoryConfig>) => void;
    onDelete: (id: string) => void;
    level?: number;
}

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
            parentFolderPatterns: [],
            namePatterns: [],
            children: []
        };
        onUpdate(node.id, { children: [...(node.children || []), newChild] });
        setIsExpanded(true);
    };

    return (
        <div className="space-y-2">
            <div className={`bg-slate-950 p-3 rounded-xl border border-slate-800 group hover:border-slate-600 transition-all ${level > 0 ? 'ml-4 md:ml-8' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 text-slate-500 hover:text-white transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={14}/>
                        </button>
                        <input 
                            type="text" 
                            value={node.name} 
                            onChange={e => onUpdate(node.id, { name: e.target.value })}
                            className="bg-transparent border-b border-transparent focus:border-indigo-500 text-sm font-bold text-white outline-none px-1 flex-1"
                            placeholder="Nombre..."
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                            <DollarSign size={10} className="text-amber-500"/>
                            <input 
                                type="number" 
                                value={node.price} 
                                onChange={e => onUpdate(node.id, { price: parseFloat(e.target.value) || 0 })}
                                className="bg-transparent text-xs font-black text-amber-400 outline-none w-14 text-center"
                            />
                        </div>

                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowRules(!showRules)} className={`p-2 rounded-lg border transition-all ${showRules ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                <Layers size={14}/>
                            </button>
                            <button onClick={addChild} className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition-all">
                                <Plus size={14}/>
                            </button>
                            {level > 0 && (
                                <button onClick={() => onDelete(node.id)} className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-500 rounded-lg transition-all">
                                    <Trash2 size={14}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {showRules && (
                    <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-indigo-500/20 space-y-4 animate-in slide-in-from-top-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Carpeta Padre */}
                            <div>
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FolderInput size={10}/> Carpeta Contenedora</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(node.parentFolderPatterns || []).map((p, i) => (
                                        <span key={i} className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-md border border-indigo-500/20 flex items-center gap-1">
                                            {p} <button onClick={() => onUpdate(node.id, { parentFolderPatterns: node.parentFolderPatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Nombre exacto..." 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val) {
                                                onUpdate(node.id, { parentFolderPatterns: [...(node.parentFolderPatterns || []), val] });
                                                e.currentTarget.value = '';
                                            }
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                                />
                            </div>
                            {/* Carpeta Ruta */}
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><FolderTree size={10}/> Ruta (Keywords)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {node.folderPatterns.map((p, i) => (
                                        <span key={i} className="bg-slate-500/10 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-500/20 flex items-center gap-1">
                                            {p} <button onClick={() => onUpdate(node.id, { folderPatterns: node.folderPatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Keywords ruta..." 
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
                            {/* Nombre Archivo */}
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={10}/> Archivo (Keywords)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {node.namePatterns.map((p, i) => (
                                        <span key={i} className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-1 rounded-md border border-purple-500/20 flex items-center gap-1">
                                            {p} <button onClick={() => onUpdate(node.id, { namePatterns: node.namePatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Keywords nombre..." 
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
                        <p className="text-[9px] text-slate-500 italic">Detección prioritaria: Carpeta Contenedora > Ruta > Nombre.</p>
                    </div>
                )}
            </div>

            {isExpanded && node.children && node.children.length > 0 && (
                <div className="border-l border-slate-800 ml-4 pl-2 space-y-2">
                    {node.children.map(child => (
                        <CategoryNode 
                            key={child.id} 
                            node={child} 
                            level={level + 1} 
                            onUpdate={(id, updates) => {
                                const recursiveUpdate = (nodes: CategoryConfig[]): CategoryConfig[] => {
                                    return nodes.map(n => {
                                        if (n.id === id) return { ...n, ...updates };
                                        if (n.children) return { ...n, children: recursiveUpdate(n.children) };
                                        return n;
                                    });
                                };
                                onUpdate(node.id, { children: recursiveUpdate(node.children!) });
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
                    parentFolderPatterns: [],
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
                transferFee: Number(settings.transferFee || 5),
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

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;
    if (!settings) return <div className="p-10 text-center text-red-400">Error.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-24 px-2">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Configuración StreamPay</h2>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
                    {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                    {saving ? '...' : 'Guardar'}
                </button>
            </div>

            <ConfigSection 
                title="Categorías & Organización Móvil" 
                icon={FolderTree} 
                isOpen={openSection === 'PRICES'} 
                onToggle={() => setOpenSection(openSection === 'PRICES' ? '' : 'PRICES')}
            >
                <div className="space-y-3">
                    {settings.customCategories.map((cat: CategoryConfig) => (
                        <CategoryNode 
                            key={cat.id} 
                            node={cat} 
                            onUpdate={(id, updates) => {
                                const newCats = settings.customCategories.map((c: any) => c.id === id ? { ...c, ...updates } : c);
                                setSettings({...settings, customCategories: newCats});
                            }} 
                            onDelete={(id) => {
                                const newCats = settings.customCategories.filter((c: any) => c.id !== id);
                                setSettings({...settings, customCategories: newCats});
                            }}
                        />
                    ))}
                    <button onClick={() => {
                        const newCat: CategoryConfig = { id: `CAT_${Date.now()}`, name: 'Nueva Categoría', price: 1.0, folderPatterns: [], parentFolderPatterns: [], namePatterns: [], children: [] };
                        setSettings({...settings, customCategories: [...settings.customCategories, newCat]});
                    }} className="w-full mt-4 py-3 border border-dashed border-slate-700 text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest">
                        <Plus size={16}/> Añadir Categoría Principal
                    </button>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Economía & Saldo P2P" 
                icon={Landmark} 
                isOpen={openSection === 'ECONOMY'} 
                onToggle={() => setOpenSection(openSection === 'ECONOMY' ? '' : 'ECONOMY')}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Videos (%)</label>
                        <input type="number" value={settings.videoCommission} onChange={e => setSettings({...settings, videoCommission: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Tienda (%)</label>
                        <input type="number" value={settings.marketCommission} onChange={e => setSettings({...settings, marketCommission: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><ArrowRightLeft size={12}/> Tasa Transferencia (%)</label>
                        <input type="number" value={settings.transferFee} onChange={e => setSettings({...settings, transferFee: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none"/>
                    </div>
                </div>
                <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Globe size={12}/> Conversión (Saldo por 1 EUR)</label>
                    <input type="number" value={settings.currencyConversion} onChange={e => setSettings({...settings, currencyConversion: parseFloat(e.target.value) || 1})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none" placeholder="300.00"/>
                </div>
            </ConfigSection>

            <ConfigSection 
                title="Paquete Mapper & Rutas" 
                icon={LayoutTemplate} 
                isOpen={openSection === 'MAPPER'} 
                onToggle={() => setOpenSection(openSection === 'MAPPER' ? '' : 'MAPPER')}
            >
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-4">Define mapeos específicos para rutas de discos externos o paquetes.</p>
                <textarea 
                    value={typeof settings.paqueteMapper === 'string' ? settings.paqueteMapper : JSON.stringify(settings.paqueteMapper || {}, null, 2)} 
                    onChange={e => {
                        try { setSettings({...settings, paqueteMapper: JSON.parse(e.target.value)}); } 
                        catch(err) { setSettings({...settings, paqueteMapper: e.target.value}); }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-indigo-300 h-32 outline-none focus:border-indigo-500"
                    placeholder='{ "CINE": "/path/to/movies" }'
                />
            </ConfigSection>

            <ConfigSection 
                title="Sistema & Local Library" 
                icon={Settings} 
                isOpen={openSection === 'SYSTEM'} 
                onToggle={() => setOpenSection(openSection === 'SYSTEM' ? '' : 'SYSTEM')}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta Biblioteca Local</label>
                        <input type="text" value={settings.localLibraryPath} onChange={e => setSettings({...settings, localLibraryPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-mono" placeholder="/volume1/videos"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta FFmpeg</label>
                        <input type="text" value={settings.ffmpegPath} onChange={e => setSettings({...settings, ffmpegPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-mono" placeholder="/usr/bin/ffmpeg"/>
                    </div>
                </div>
            </ConfigSection>
        </div>
    );
}
