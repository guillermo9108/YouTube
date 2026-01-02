
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle 
} from 'lucide-react';
import { useLocation } from '../Router';

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (cat: string | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <button onClick={() => onNavigate(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
            <HomeIcon size={16}/>
        </button>
        {path.map((cat, i) => (
            <React.Fragment key={cat}>
                <ChevronRight size={12} className="text-slate-600 shrink-0"/>
                <button 
                    onClick={() => onNavigate(cat)}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${i === path.length - 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {cat}
                </button>
            </React.Fragment>
        ))}
    </div>
);

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, sets] = await Promise.all([db.getAllVideos(), db.getSystemSettings()]);
            setAllVideos(vids.filter(v => !['PENDING', 'PROCESSING'].includes(v.category)));
            setCategories(sets.categories || []);
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act.watched || []);
            }
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id, location.pathname]);

  // Construir breadcrumbs basado en la jerarquía del video o selección actual
  const breadcrumbPath = useMemo(() => {
      if (!activeCategory) return [];
      
      // Intentamos ver si es una subcategoría de una categoría raíz (usando metadatos de los videos cargados)
      const currentVideoSample = allVideos.find(v => v.category === activeCategory);
      if (currentVideoSample && currentVideoSample.parent_category) {
          return [currentVideoSample.parent_category, activeCategory];
      }
      return [activeCategory];
  }, [activeCategory, allVideos]);

  // Obtener subcategorías si estamos en una categoría raíz que tenga autoSub activo
  const currentSubCategories = useMemo(() => {
      if (!activeCategory) {
          // Si estamos en la raíz, mostrar las categorías de administrador que no tienen padre
          return categories.map(c => ({ name: c.name, id: c.id }));
      }
      
      // Si estamos en una categoría raíz, mostrar las subcategorías encontradas en los videos
      const rootCat = categories.find(c => c.name === activeCategory);
      if (rootCat && rootCat.autoSub) {
          const subs = allVideos
            .filter(v => v.parent_category === activeCategory)
            .map(v => v.category);
          return Array.from(new Set(subs)).map(s => ({ name: s, id: s }));
      }
      return [];
  }, [activeCategory, categories, allVideos]);

  const filteredList = useMemo(() => {
      return allVideos.filter(v => {
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (!activeCategory) return matchSearch;

          // Si seleccionamos una categoría, mostrarla a ella y a todas sus sub-categorías automáticas
          const matchCat = v.category === activeCategory || v.parent_category === activeCategory;

          return matchSearch && matchCat;
      }).sort((a,b) => b.createdAt - a.createdAt);
  }, [allVideos, activeCategory, searchQuery]);

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-8 px-2 md:px-0">
      
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
          <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                  <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" />
              </div>
          </div>
          
          <Breadcrumbs path={breadcrumbPath} onNavigate={setActiveCategory} />

          {currentSubCategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mt-4 pb-2 scrollbar-hide">
                  {currentSubCategories.map(sub => (
                      <button 
                        key={sub.id} 
                        onClick={() => setActiveCategory(sub.name)}
                        className="whitespace-nowrap px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:border-indigo-500/50 transition-all flex items-center gap-2 group"
                      >
                         <Layers size={12} className="text-indigo-400 group-hover:rotate-12 transition-transform" /> {sub.name}
                      </button>
                  ))}
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard 
                key={v.id} 
                video={v} 
                isUnlocked={isAdmin || user?.id === v.creatorId} 
                isWatched={watchedIds.includes(v.id)} 
              />
          ))}
      </div>

      {filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button 
                onClick={() => setVisibleCount(p => p + 12)}
                className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl"
              >
                  Ver más
              </button>
          </div>
      )}

      {filteredList.length === 0 && (
          <div className="text-center py-40">
              <Shuffle className="mx-auto mb-4 text-slate-800" size={64}/>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay contenido</p>
          </div>
      )}
    </div>
  );
}
