
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, SystemSettings } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder 
} from 'lucide-react';
import { useLocation } from '../Router';
import AIConcierge from '../AIConcierge';

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, sets] = await Promise.all([db.getAllVideos(), db.getSystemSettings()]);
            setAllVideos(vids.filter(v => !['PENDING', 'PROCESSING'].includes(v.category)));
            setCategories(sets.categories || []);
            setSettings(sets);
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act.watched || []);
            }
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id, location.pathname]);

  const filteredList = useMemo(() => {
      let list = allVideos.filter(v => {
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (!activeCategory) return matchSearch;
          return matchSearch && (v.category === activeCategory || v.parent_category === activeCategory);
      });
      return list.sort((a,b) => b.createdAt - a.createdAt);
  }, [allVideos, activeCategory, searchQuery]);

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-8 px-2 md:px-0">
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 border-b border-white/5">
          <div className="relative mb-4">
              <Search className="absolute left-4 top-3 text-slate-500" size={18} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contenido..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all" />
          </div>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
             <button onClick={() => setActiveCategory(null)} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${!activeCategory ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Todos</button>
             {categories.map(c => (
                 <button key={c.id} onClick={() => setActiveCategory(c.name)} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${activeCategory === c.name ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{c.name}</button>
             ))}
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in">
          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard 
                key={v.id} 
                video={v} 
                isUnlocked={user?.role === 'ADMIN' || user?.id === v.creatorId} 
                isWatched={watchedIds.includes(v.id)} 
              />
          ))}
      </div>

      {filteredList.length === 0 && (
          <div className="text-center py-40 opacity-30 italic uppercase font-black text-xs tracking-widest">Sin contenido disponible</div>
      )}

      {settings?.geminiKey && <AIConcierge videos={allVideos} />}
    </div>
  );
}
