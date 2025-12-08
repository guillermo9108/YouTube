
import React, { useState } from 'react';
import { User as UserIcon, Wallet, Store, Settings, Database, Wrench, TrendingUp } from 'lucide-react';

// Sub Components
import AdminUsers from './admin/AdminUsers';
import AdminFinance from './admin/AdminFinance';
import AdminMarket from './admin/AdminMarket';
import AdminConfig from './admin/AdminConfig';
import AdminLibrary from './admin/AdminLibrary';
import AdminMaintenance from './admin/AdminMaintenance';
import AdminAnalytics from './admin/AdminAnalytics';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'USERS' | 'FINANCE' | 'MARKET' | 'CONFIG' | 'LIBRARY' | 'MAINTENANCE' | 'ANALYTICS'>('USERS');

  return (
    <div className="space-y-6 pb-24 px-2 md:px-0">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl scrollbar-hide">
           {['USERS', 'FINANCE', 'MARKET', 'CONFIG', 'LIBRARY', 'MAINTENANCE', 'ANALYTICS'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                   {t === 'USERS' && <UserIcon size={16}/>}
                   {t === 'FINANCE' && <Wallet size={16}/>}
                   {t === 'MARKET' && <Store size={16}/>}
                   {t === 'CONFIG' && <Settings size={16}/>}
                   {t === 'LIBRARY' && <Database size={16}/>}
                   {t === 'MAINTENANCE' && <Wrench size={16}/>}
                   {t === 'ANALYTICS' && <TrendingUp size={16}/>}
                   {t}
               </button>
           ))}
      </div>

      <div className="min-h-[500px]">
          {activeTab === 'USERS' && <AdminUsers />}
          {activeTab === 'FINANCE' && <AdminFinance />}
          {activeTab === 'MARKET' && <AdminMarket />}
          {activeTab === 'CONFIG' && <AdminConfig />}
          {activeTab === 'LIBRARY' && <AdminLibrary />}
          {activeTab === 'MAINTENANCE' && <AdminMaintenance />}
          {activeTab === 'ANALYTICS' && <AdminAnalytics />}
      </div>
    </div>
  );
}
