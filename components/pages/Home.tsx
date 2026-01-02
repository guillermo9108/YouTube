
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder 
} from 'lucide-react';
import { useLocation } from '../Router';
import AIConcierge from '../AIConcierge';

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

interface SubCategoryCardProps {
    name: string;
    videos: Video[];
    onClick: () => void;
}

const SubCategoryCard: React.FC<SubCategoryCardProps> = ({ name, videos, onClick }) => {
    const randomThumb = useMemo(() => {
        if (videos.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * videos.length);
        return videos[randomIndex].thumbnailUrl;
    }, [videos]);

    return (
        <div className="flex flex-col gap-3 group">
            <button 
                onClick={onClick}
                className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 ring-1 ring-white/5"
            >
                {randomThumb ? (
                    <img 
                        src={randomThumb} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700" 
                        alt={name} 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <Folder size={48} />
                    </div>
                )}
                
                {/* Overlay oscuro para texto */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                
                {/* Badge de Colección */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-indigo-600 px-2 py-1 rounded-md shadow-lg border border-white/10">
                    <Layers size={10} className="text-white"/>
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter">COLECCIÓN</span>
                </div>

                {/* Info inferior */}
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-base font-black text-white uppercase tracking-tighter leading-tight drop-shadow-md group-hover:text-indigo-300 transition-colors truncate">
                        {name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{videos.length} Elementos</span>
                    </div>
                </div>
            </button>

            {/* Simular fila de metadatos de VideoCard para consistencia */}
            <div className="flex gap-3 px-1 md:px-0">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                    <Folder size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white uppercase tracking-tighter truncate">{name}</div>
                    <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Carpeta de Contenido</div>
                </div>
            </div>
        </div>
    );
};

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

  const breadcrumbPath = useMemo(() => {
      if (!activeCategory) return [];
      const currentVideoSample = allVideos.find(v => v.category === activeCategory);
      if (currentVideoSample && currentVideoSample.parent_category) {
          return [currentVideoSample.parent_category, activeCategory];
      }
      return [activeCategory];
  }, [activeCategory, allVideos]);

  const currentSubCategories = useMemo(() => {
      if (!activeCategory) {
          return categories.map(c => ({ 
              name: c.name, 
              id: c.id, 
              videos: allVideos.filter(v => v.category === c.name || v.parent_category === c.name)
          })).filter(c => c.videos.length > 0);
      }
      
      const rootCat = categories.find(c => c.name === activeCategory);
      if (rootCat && rootCat.autoSub) {
          const subs = Array.from(new Set(
              allVideos
                .filter(v => v.parent_category === activeCategory)
                .map(v => v.category)
          ));

          return subs.map(s => ({
              name: s,
              id: s,
              videos: allVideos.filter(v => v.category === s && v.parent_category === activeCategory)
          }));
      }
      return [];
  }, [activeCategory, categories, allVideos]);

  const filteredList = useMemo(() => {
      let list = allVideos.filter(v => {
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (!activeCategory) return matchSearch;
          const matchCat = v.category === activeCategory || v.parent_category === activeCategory;
          return matchSearch && matchCat;
      });

      const currentCatSettings = categories.find(c => c.name === activeCategory || c.name === list[0]?.parent_category);
      const sortMode = currentCatSettings?.sortOrder || 'LATEST';

      switch (sortMode) {
          case 'ALPHA':
              list.sort((a, b) => a.title.localeCompare(b.title));
              break;
          case 'RANDOM':
              list.sort(() => (Math.random() - 0.5)); 
              break;
          case 'LATEST':
          default:
              list.sort((a,b) => b.createdAt - a.createdAt);
              break;
      }

      return list;
  }, [allVideos, activeCategory, searchQuery, categories]);

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
      </div>

      {/* Grid unificado: Colecciones y Videos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          
          {/* Renderizar Subcategorías/Carpetas primero en el mismo grid */}
          {currentSubCategories.map(sub => (
              <SubCategoryCard 
                  key={sub.id} 
                  name={sub.name} 
                  videos={sub.videos} 
                  onClick={() => setActiveCategory(sub.name)} 
              />
          ))}

          {/* Renderizar Videos después */}
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

      {filteredList.length === 0 && currentSubCategories.length === 0 && (
          <div className="text-center py-40">
              <Shuffle className="mx-auto mb-4 text-slate-800" size={64}/>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay contenido</p>
          </div>
      )}

      <AIConcierge videos={allVideos} />
    </div>
  );
}
