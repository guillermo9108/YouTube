
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { vectorService } from '../../services/vector';
import { Video, Category } from '../../types';
import { RefreshCw, Search, Shuffle, Folder, Sparkles, Filter, ChevronRight } from 'lucide-react';
import { useLocation } from '../Router';

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [userVector, setUserVector] = useState<number[] | null>(null);
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
                const [act, vRef] = await Promise.all([
                    db.getUserActivity(user.id),
                    db.getUserInterestVector(user.id)
                ]);
                setWatchedIds(act.watched || []);
                setUserVector(vRef);
            }
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id, location.pathname]);

  // LÓGICA DE INDEXACIÓN DISTRIBUIDA
  useEffect(() => {
      if (allVideos.length > 0 && !loading) {
          const videosWithoutVector = allVideos.filter(v => !v.vector).slice(0, 3); // Procesar de 3 en 3 para no saturar
          videosWithoutVector.forEach(async (v) => {
              const textToEncode = `${v.title} ${v.description} ${v.category}`.substring(0, 300);
              const vec = await vectorService.generateEmbedding(textToEncode);
              if (vec) {
                  db.saveVideoVector(v.id, vec).catch(() => {});
                  v.vector = vec; // Actualizar localmente para uso inmediato
              }
          });
      }
  }, [allVideos, loading]);

  const filteredList = useMemo(() => {
      let list = allVideos.filter(v => {
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
          if (!activeCategory) return matchSearch;
          return matchSearch && (v.category === activeCategory || v.parent_category === activeCategory);
      });

      // ALGORITMO DE SUGERENCIAS VECTORIALES
      if (userVector && list.length > 0 && !activeCategory && !searchQuery) {
          list = list.map(v => ({
              ...v,
              _score: v.vector ? vectorService.cosineSimilarity(userVector, v.vector) : 0
          })).sort((a: any, b: any) => b._score - a._score);
      } else {
          list.sort((a,b) => b.createdAt - a.createdAt);
      }

      return list;
  }, [allVideos, activeCategory, searchQuery, userVector]);

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-4 px-2 md:px-0">
      {/* Header & Search */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-2.5 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="¿Qué quieres ver hoy?" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-full pl-11 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                  />
              </div>
              {userVector && !activeCategory && (
                  <div className="hidden sm:flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                      <Sparkles size={14} className="fill-indigo-500"/>
                      <span className="text-[10px] font-black uppercase tracking-widest">Para ti</span>
                  </div>
              )}
          </div>

          {/* Categories Nav Bar */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              <button 
                onClick={() => setActiveCategory(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${!activeCategory ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
              >
                  Todo
              </button>
              {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeCategory === cat.name ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-slate-900 text-slate-400 border-transparent hover:border-slate-700'}`}
                  >
                      {cat.name.replace('_', ' ')}
                  </button>
              ))}
          </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500 pt-2">
          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard 
                key={v.id} 
                video={v} 
                isUnlocked={user?.role === 'ADMIN' || user?.id === v.creatorId} 
                isWatched={watchedIds.includes(v.id)} 
              />
          ))}
      </div>

      {/* Empty State */}
      {filteredList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
              <Filter size={48} className="mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">No hay videos en esta sección</p>
          </div>
      )}

      {/* Load More */}
      {filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
                  <ChevronRight size={16} className="rotate-90"/> Ver más contenido
              </button>
          </div>
      )}
    </div>
  );
}
