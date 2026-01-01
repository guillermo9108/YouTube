
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SystemSettings } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Settings, Save, ChevronDown, ChevronUp, Tag, Loader2, 
    Trash2, Plus, X, Sparkles, FolderTree, ArrowRight, 
    DollarSign, Search, Layers, ShieldCheck,
    Percent // Added missing import
} from 'lucide-react';

interface CategoryNode {
    id: string;
    name: string;
    parent: string | null;
    price: number;
    keywords: string;
}

export default function AdminConfig() {
    const toast = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [openSection, setOpenSection] = useState<string>('HIERARCHY');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hierarchy, setHierarchy] = useState<CategoryNode[]>([]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s: any = await db.getSystemSettings();
            setSettings(s);
            const h = JSON.parse(s.categoryHierarchy || '[]');
            setHierarchy(h);
        } catch(e) { toast.error("Error al cargar configuración"); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadSettings(); }, []);

    const handleSaveConfig = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const updated = {
                ...settings,
                categoryHierarchy: JSON.stringify(hierarchy),
                autoGroupFolders: settings.autoGroupFolders ? 1 : 0
            };
            await db.updateSystemSettings(updated);
            toast.success("Jerarquía y configuración sincronizadas");
            await loadSettings();
        } catch(e: any) { toast.error("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    const addCategory = (parentId: string | null = null) => {
        const name = prompt("Nombre de la nueva categoría:");
        if (!name) return;
        const newNode: CategoryNode = {
            id: 'cat_' + Math.random().toString(36).substr(2, 9),
            name: name.toUpperCase(),
            parent: parentId,
            price: 0,
            keywords: name.toLowerCase()
        };
        setHierarchy([...hierarchy, newNode]);
    };

    const updateNode = (id: string, field: keyof CategoryNode, value: any) => {
        setHierarchy(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
    };

    const removeNode = (id: string) => {
        if (!confirm("¿Eliminar categoría y todas sus subcategorías?")) return;
        const toRemoveIds = new Set<string>([id]);
        // Búsqueda recursiva de hijos
        let size;
        do {
            size = toRemoveIds.size;
            hierarchy.forEach(n => { if (n.parent && toRemoveIds.has(n.parent)) toRemoveIds.add(n.id); });
        } while (toRemoveIds.size !== size);
        setHierarchy(prev => prev.filter(n => !toRemoveIds.has(n.id)));
    };

    const renderTree = (parentId: string | null = null, depth = 0) => {
        const nodes = hierarchy.filter(n => n.parent === parentId);
        return nodes.map(node => (
            <div key={node.id} className="mt-2 animate-in slide-in-from-left-2" style={{ marginLeft: `${depth * 20}px` }}>
                <div className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border group transition-all ${depth === 0 ? 'bg-slate-900 border-slate-700' : 'bg-slate-950 border-slate-800'}`}>
                    <FolderTree size={14} className={depth === 0 ? 'text-indigo-400' : 'text-slate-500'} />
                    <input 
                        className="bg-transparent text-sm font-black text-white uppercase outline-none focus:text-indigo-400 w-32" 
                        value={node.name} 
                        onChange={e => updateNode(node.id, 'name', e.target.value.toUpperCase())}
                    />
                    
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                        <DollarSign size={10} className="text-amber-500" />
                        <input 
                            type="number" step="0.1"
                            className="bg-transparent text-[11px] font-bold text-amber-400 w-12 outline-none" 
                            value={node.price} 
                            placeholder="Heredar"
                            onChange={e => updateNode(node.id, 'price', parseFloat(e.target.value))}
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 flex-1 min-w-[120px]">
                        <Search size={10} className="text-slate-500" />
                        <input 
                            className="bg-transparent text-[10px] text-slate-400 w-full outline-none" 
                            value={node.keywords} 
                            placeholder="Keywords (cine, hq...)"
                            onChange={e => updateNode(node.id, 'keywords', e.target.value)}
                        />
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => addCategory(node.id)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-500 rounded" title="Añadir Subcategoría"><Plus size={14}/></button>
                        <button onClick={() => removeNode(node.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded"><Trash2 size={14}/></button>
                    </div>
                </div>
                {renderTree(node.id, depth + 1)}
            </div>
        ));
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500"/></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Motor de Categorías</h2>
                    <p className="text-xs text-slate-500">Configura jerarquías, precios y reglas de herencia.</p>
                </div>
                <button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-3 px-8 rounded-2xl flex items-center gap-2 shadow-2xl active:scale-95 transition-all">
                    {saving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Guardar Cambios
                </button>
            </div>

            {/* Tree Section */}
            <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-white uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                        <Layers size={16} className="text-indigo-400"/> Árbol de Organización
                    </h3>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-slate-300">Auto-Agrupación</span>
                            <div className={`w-10 h-5 rounded-full transition-all relative ${settings?.autoGroupFolders ? 'bg-indigo-600' : 'bg-slate-700'}`} onClick={() => setSettings(p => p ? {...p, autoGroupFolders: !p.autoGroupFolders} : null)}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings?.autoGroupFolders ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </label>
                        <button onClick={() => addCategory(null)} className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 border border-white/10 transition-all">
                            <Plus size={14}/> Nueva Raíz
                        </button>
                    </div>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                    {hierarchy.length === 0 ? (
                        <div className="py-20 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl">
                            <Layers size={48} className="mx-auto mb-4 opacity-20"/>
                            <p className="text-sm">No has definido jerarquías aún.</p>
                        </div>
                    ) : renderTree(null)}
                </div>

                <div className="mt-8 p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
                    <Sparkles className="text-indigo-400 shrink-0" size={20}/>
                    <div className="text-[11px] text-indigo-300 leading-relaxed">
                        <strong>Lógica de Herencia:</strong> El sistema prioriza el precio de la subcategoría. Si es 0 o vacío, hereda el del padre. Las keywords sirven para que el motor de escaneo clasifique automáticamente videos nuevos basados en su ruta física.
                    </div>
                </div>
            </div>

            {/* Legacy/System Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 space-y-4">
                    <h4 className="font-bold text-white text-sm uppercase flex items-center gap-2"><Percent size={16} className="text-emerald-400"/> Comisiones</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Corte Plataforma Videos (%)</label>
                            <input type="number" value={settings?.videoCommission} onChange={e => setSettings(p => p ? {...p, videoCommission: parseInt(e.target.value)} : null)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"/>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 space-y-4">
                    <h4 className="font-bold text-white text-sm uppercase flex items-center gap-2"><ShieldCheck size={16} className="text-purple-400"/> Seguridad</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tamaño Lote Procesamiento</label>
                            <input type="number" value={settings?.batchSize} onChange={e => setSettings(p => p ? {...p, batchSize: parseInt(e.target.value)} : null)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
