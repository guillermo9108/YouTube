import React, { useState } from 'react';
import { User as UserIcon, Wallet, Store, Settings, Database, TrendingUp, Network, DownloadCloud, Cpu, Brush } from 'lucide-react';

import AdminUsers from './AdminUsers';
import AdminFinance from './AdminFinance';
import AdminMarket from './AdminMarket';
import AdminConfig from './AdminConfig';
import AdminLibrary from './AdminLibrary';
import AdminAnalytics from './AdminAnalytics';
import AdminFtp from './AdminFtp';
import AdminRequests from './AdminRequests';
import AdminLocalFiles from './AdminLocalFiles';
import AdminTranscoder from './AdminTranscoder';

type TabID = 'USERS' | 'FINANCE' | 'MARKET' | 'CONFIG' | 'LIBRARY' | 'CLEANCENTER' | 'FTP' | 'ANALYTICS' | 'REQUESTS' | 'TRANSCODER';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabID>('USERS');

  const tabs: { id: TabID; icon: any; label: string }[] = [
       { id: 'USERS', icon: UserIcon, label: 'Usuarios' },
       { id: 'FINANCE', icon: Wallet, label: 'Finanzas' },
       { id: 'MARKET', icon: Store, label: 'Mercado' },
       { id: 'REQUESTS', icon: DownloadCloud, label: 'Peticiones' },
       { id: 'LIBRARY', icon: Database, label: 'Librería' },
       { id: 'TRANSCODER', icon: Cpu, label: 'Transcoder' },
       { id: 'CLEANCENTER', icon: Brush, label: 'Mantenimiento' },
       { id: 'FTP', icon: Network, label: 'FTP' },
       { id: 'ANALYTICS', icon: TrendingUp, label: 'Análisis' },
       { id: 'CONFIG', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className="space-y-6 pb-24 px-2 md:px-0">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl scrollbar-hide">
           {tabs.map(t => (
               <button 
                  key={t.id} 
                  onClick={() => setActiveTab(t.id)} 
                  className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                   <t.icon size={14}/> {t.label}
               </button>
           ))}
      </div>

      <div className="min-h-[500px] animate-in fade-in slide-in-from-top-2 duration-500">
          {activeTab === 'USERS' && <AdminUsers />}
          {activeTab === 'FINANCE' && <AdminFinance />}
          {activeTab === 'MARKET' && <AdminMarket />}
          {activeTab === 'REQUESTS' && <AdminRequests />}
          {activeTab === 'CONFIG' && <AdminConfig />}
          {activeTab === 'LIBRARY' && <AdminLibrary />}
          {activeTab === 'TRANSCODER' && <AdminTranscoder />}
          {activeTab === 'CLEANCENTER' && <AdminLocalFiles />}
          {activeTab === 'FTP' && <AdminFtp />}
          {activeTab === 'ANALYTICS' && <AdminAnalytics />}
      </div>
    </div>
  );
}
