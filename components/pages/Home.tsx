
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { vectorService } from '../../services/vector';
import { Video, Category } from '../../types';
import { RefreshCw, Search, Shuffle, Folder, Sparkles } from 'lucide-react';
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
      if (userVector) {
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
    <div className="pb-20 space-y-8 px-2 md:px-0">
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5 flex items-center justify-between">
          <div className="relative flex-1 mr-4">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por IA..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" />
          </div>
          {userVector && <div className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20"><Sparkles size={14}/><span className="text-[10px] font-black uppercase">Sugerencias Pro</span></div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard 
                key={v.id} 
                video={v} 
                isUnlocked={user?.role === 'ADMIN' || user?.id === v.creatorId} 
                isWatched={watchedIds.includes(v.id)} 
              />
          ))}
      </div>

      {filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">Ver más</button>
          </div>
      )}
    </div>
  );
}
