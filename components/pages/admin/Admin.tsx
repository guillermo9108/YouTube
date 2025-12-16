
import React, { useState } from 'react';
import { User as UserIcon, Wallet, Store, Settings, Database, Wrench, TrendingUp, Network, DownloadCloud } from 'lucide-react';

// Sub Components
import AdminUsers from './AdminUsers';
import AdminFinance from './AdminFinance';
import AdminMarket from './AdminMarket';
import AdminConfig from './AdminConfig';
import AdminLibrary from './AdminLibrary';
import AdminMaintenance from './AdminMaintenance';
import AdminAnalytics from './AdminAnalytics';
import AdminFtp from './AdminFtp';
import AdminRequests from './AdminRequests';

// Define explicit type for Tabs to avoid "string is not assignable to type..." errors
type TabID = 'USERS' | 'FINANCE' | 'MARKET' | 'CONFIG' | 'LIBRARY' | 'FTP' | 'MAINTENANCE' | 'ANALYTICS' | 'REQUESTS';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabID>('USERS');

  const tabs: { id: TabID; icon: any; label: string }[] = [
       { id: 'USERS', icon: UserIcon, label: 'Users' },
       { id: 'FINANCE', icon: Wallet, label: 'Finance' },
       { id: 'MARKET', icon: Store, label: 'Market' },
       { id: 'REQUESTS', icon: DownloadCloud, label: 'Requests' },
       { id: 'LIBRARY', icon: Database, label: 'Library' },
       { id: 'FTP', icon: Network, label: 'FTP' },
       { id: 'ANALYTICS', icon: TrendingUp, label: 'Stats' },
       { id: 'CONFIG', icon: Settings, label: 'Config' },
       { id: 'MAINTENANCE', icon: Wrench, label: 'Tools' },
  ];

  return (
    <div className="space-y-6 pb-24 px-2 md:px-0">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl scrollbar-hide">
           {tabs.map(t => (
               <button 
                  key={t.id} 
                  onClick={() => setActiveTab(t.id)} 
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                   <t.icon size={16}/> {t.label}
               </button>
           ))}
      </div>

      <div className="min-h-[500px]">
          {activeTab === 'USERS' && <AdminUsers />}
          {activeTab === 'FINANCE' && <AdminFinance />}
          {activeTab === 'MARKET' && <AdminMarket />}
          {activeTab === 'REQUESTS' && <AdminRequests />}
          {activeTab === 'CONFIG' && <AdminConfig />}
          {activeTab === 'LIBRARY' && <AdminLibrary />}
          {activeTab === 'FTP' && <AdminFtp />}
          {activeTab === 'MAINTENANCE' && <AdminMaintenance />}
          {activeTab === 'ANALYTICS' && <AdminAnalytics />}
      </div>
    </div>
  );
}
