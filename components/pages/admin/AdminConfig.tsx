
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../services/db';
import { SystemSettings, CategoryConfig } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Save, DollarSign, Loader2, Trash2, Plus, X, 
    FolderTree, ChevronRight, Hash, 
    Layers, Landmark, LayoutTemplate, ChevronDown, ChevronUp
} from 'lucide-react';

const ConfigSection = ({ title, icon: Icon, children, isOpen, onToggle }: any) => (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden transition-all duration-300 shadow-lg">
        <button 
            onClick={onToggle}
            className="w-full px-5 py-4 flex justify-between items-center bg-slate-900 hover:bg-slate-800/50 transition-colors"
        >
            <div className="flex items-center gap-3 font-black text-white text-sm uppercase tracking-tighter">
                <Icon size={18} className="text-indigo-400" /> {title}
            </div>
            {isOpen ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
        </button>
        {isOpen && <div className="px-5 pb-6 pt-2 border-t border-slate-800/50 space-y-4 animate-in slide-in-from-top-2 fade-in">{children}</div>}
    </div>
);

interface CategoryNodeProps {
    node: CategoryConfig;
    onUpdate: (id: string, updates: Partial<CategoryConfig>) => void;
    onDelete: (id: string) => void;
    onAddChild: (parentId: string) => void;
    level?: number;
}

const CategoryNode: React.FC<CategoryNodeProps> = ({ 
    node, 
    onUpdate, 
    onDelete, 
    onAddChild,
    level = 0 
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showRules, setShowRules] = useState(false);

    return (
        <div className="space-y-2">
            <div className={`bg-slate-950 p-4 rounded-xl border transition-all ${level > 0 ? 'ml-6 border-l-indigo-500 border-slate-800' : 'border-slate-700'}`}>
                {/* Header: Nombre y Precio */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={16}/>
                        </button>
                        <input 
                            type="text" 
                            value={node.name || ''} 
                            placeholder="Nombre de la categoría..."
                            onChange={e => onUpdate(node.id, { name: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none flex-1 focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2">
                            <DollarSign size={14} className="text-amber-500"/>
                            <input 
                                type="number" 
                                value={node.price} 
                                onChange={e => onUpdate(node.id, { price: parseFloat(e.target.value) || 0 })}
                                className="bg-transparent text-sm font-black text-amber-400 outline-none w-16"
                            />
                        </div>
                        
                        <div className="flex gap-1">
                            <button onClick={() => setShowRules(!showRules)} title="Configurar Reglas" className={`p-2 rounded-lg border transition-all ${showRules ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                <Layers size={14}/>
                            </button>
                            <button onClick={() => onAddChild(node.id)} title="Añadir Subcategoría" className="p-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-lg transition-all">
                                <Plus size={14}/>
                            </button>
                            {level > 0 && (
                                <button onClick={() => onDelete(node.id)} title="Eliminar" className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                    <Trash2 size={14}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reglas de Agrupación */}
                {showRules && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-indigo-500/20 space-y-4 animate-in slide-in-from-top-1">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Palabras clave en Carpetas (NAS)</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {(node.folderPatterns || []).map((p, i) => (
                                    <span key={i} className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                                        {p} <button onClick={() => onUpdate(node.id, { folderPatterns: node.folderPatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                    </span>
                                ))}
                            </div>
                            <input 
                                type="text" placeholder="Escribe y pulsa Enter..."
                                onKeyDown={e => { if(e.key === 'Enter') { onUpdate(node.id, { folderPatterns: [...(node.folderPatterns || []), e.currentTarget.value] }); e.currentTarget.value = ''; }}}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Palabras clave en Archivos</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {(node.namePatterns || []).map((p, i) => (
                                    <span key={i} className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                                        {p} <button onClick={() => onUpdate(node.id, { namePatterns: node.namePatterns.filter((_, idx) => idx !== i) })}><X size={10}/></button>
                                    </span>
                                ))}
                            </div>
                            <input 
                                type="text" placeholder="Escribe y pulsa Enter..."
                                onKeyDown={e => { if(e.key === 'Enter') { onUpdate(node.id, { namePatterns: [...(node.namePatterns || []), e.currentTarget.value] }); e.currentTarget.value = ''; }}}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {isExpanded && node.children && node.children.length > 0 && (
                <div className="space-y-2">
                    {node.children.map(child => (
                        <CategoryNode 
                            key={child.id} 
                            node={child} 
                            level={level + 1} 
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onAddChild={onAddChild}
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
            if (!Array.isArray(s.customCategories)) s.customCategories = [];
            setSettings(s);
        } catch(e) {
            toast.error("Error al cargar configuración");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSettings(); }, []);

    const generateUID = () => Math.random().toString(36).substring(2, 11).toUpperCase();

    const updateCategoryTree = useCallback((id: string, updates: Partial<CategoryConfig>) => {
        setSettings(prev => {
            if (!prev) return prev;
            const recursive = (nodes: CategoryConfig[]): CategoryConfig[] => {
                return nodes.map(n => {
                    if (n.id === id) return { ...n, ...updates };
                    if (n.children && n.children.length > 0) {
                        return { ...n, children: recursive(n.children) };
                    }
                    return n;
                });
            };
            return { ...prev, customCategories: recursive(prev.customCategories) };
        });
    }, []);

    const deleteFromTree = useCallback((id: string) => {
        setSettings(prev => {
            if (!prev) return prev;
            const recursive = (nodes: CategoryConfig[]): CategoryConfig[] => {
                return nodes.filter(n => n.id !== id).map(n => {
                    if (n.children && n.children.length > 0) {
                        return { ...n, children: recursive(n.children) };
                    }
                    return n;
                });
            };
            return { ...prev, customCategories: recursive(prev.customCategories) };
        });
    }, []);

    const addChildToTree = useCallback((parentId: string) => {
        setSettings(prev => {
            if (!prev) return prev;
            const newChild: CategoryConfig = {
                id: `SUB_${generateUID()}`,
                name: '',
                price: 1.0,
                folderPatterns: [],
                namePatterns: [],
                autoGroupFolders: true,
                children: []
            };
            
            const recursive = (nodes: CategoryConfig[]): CategoryConfig[] => {
                return nodes.map(n => {
                    if (n.id === parentId) {
                        return { ...n, children: [...(n.children || []), newChild] };
                    }
                    if (n.children && n.children.length > 0) {
                        return { ...n, children: recursive(n.children) };
                    }
                    return n;
                });
            };
            return { ...prev, customCategories: recursive(prev.customCategories) };
        });
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await db.updateSystemSettings(settings);
            toast.success("Configuración guardada");
            await loadSettings();
        } catch(e: any) {
            toast.error("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;
    if (!settings) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-24 px-2">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Administración</h2>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all text-sm"
                >
                    {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>

            <ConfigSection title="Categorías Jerárquicas" icon={FolderTree} isOpen={openSection === 'PRICES'} onToggle={() => setOpenSection(openSection === 'PRICES' ? '' : 'PRICES')}>
                <div className="space-y-4">
                    {settings.customCategories.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs uppercase font-bold tracking-widest">
                            No hay categorías configuradas
                        </div>
                    ) : (
                        settings.customCategories.map((cat: CategoryConfig) => (
                            <CategoryNode 
                                key={cat.id} 
                                node={cat} 
                                onUpdate={updateCategoryTree} 
                                onDelete={deleteFromTree}
                                onAddChild={addChildToTree}
                            />
                        ))
                    )}
                    <button 
                        onClick={() => {
                            const newCat: CategoryConfig = { 
                                id: `ROOT_${generateUID()}`, 
                                name: '', 
                                price: 1.0, 
                                folderPatterns: [], 
                                namePatterns: [], 
                                autoGroupFolders: true, 
                                children: [] 
                            };
                            setSettings({...settings, customCategories: [...settings.customCategories, newCat]});
                        }} 
                        className="w-full mt-4 py-4 border-2 border-dashed border-slate-700 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
                    >
                        <Plus size={18}/> Añadir Categoría Raíz
                    </button>
                </div>
            </ConfigSection>

            <ConfigSection title="Economía & Saldo P2P" icon={Landmark} isOpen={openSection === 'ECONOMY'} onToggle={() => setOpenSection(openSection === 'ECONOMY' ? '' : 'ECONOMY')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Comisión Videos (%)</label>
                        <input type="number" value={settings.videoCommission} onChange={e => setSettings({...settings, videoCommission: parseInt(e.target.value)})} className="w-full bg-transparent text-white font-mono outline-none" />
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Comisión Tienda (%)</label>
                        <input type="number" value={settings.marketCommission} onChange={e => setSettings({...settings, marketCommission: parseInt(e.target.value)})} className="w-full bg-transparent text-white font-mono outline-none" />
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fee Transferencia P2P (%)</label>
                        <input type="number" value={settings.transferFee} onChange={e => setSettings({...settings, transferFee: parseInt(e.target.value)})} className="w-full bg-transparent text-white font-mono outline-none" />
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Conversión Saldo/EUR</label>
                        <input type="number" value={settings.currencyConversion} onChange={e => setSettings({...settings, currencyConversion: parseFloat(e.target.value)})} className="w-full bg-transparent text-white font-mono outline-none" />
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection title="Servidor & Almacenamiento" icon={LayoutTemplate} isOpen={openSection === 'SYSTEM'} onToggle={() => setOpenSection(openSection === 'SYSTEM' ? '' : 'SYSTEM')}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ruta Biblioteca Local (NAS)</label>
                        <input type="text" value={settings.localLibraryPath} onChange={e => setSettings({...settings, localLibraryPath: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-indigo-300 font-mono outline-none focus:border-indigo-500" />
                    </div>
                </div>
            </ConfigSection>
        </div>
    );
}
