
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { User, SystemSettings } from '../../../types';
import { Calculator, Database, RefreshCw } from 'lucide-react';

export default function AdminAnalytics() {
    const [settings, setSettings] = useState<any>(null);
    const [useRealData, setUseRealData] = useState(false);
    const [realStats, setRealStats] = useState<any>(null);

    // Simulator State
    const [simUserCount, setSimUserCount] = useState(20);
    const [simGrowthRate, setSimGrowthRate] = useState(10);
    const [simConversionRate, setSimConversionRate] = useState(25);
    const [simAvgDeposit, setSimAvgDeposit] = useState(50);
    const [simAdminSales, setSimAdminSales] = useState(5); // Videos sold per month by admin
    const [simAvgAdminPrice, setSimAvgAdminPrice] = useState(50); // Avg price of admin videos
    
    const [simStorageCostPerUser, setSimStorageCostPerUser] = useState(0.5);
    const [simFixedCost, setSimFixedCost] = useState(200);

    useEffect(() => {
        db.getSystemSettings().then((s: SystemSettings) => setSettings(s));
        loadRealStats();
    }, []);

    const loadRealStats = async () => {
        try {
            const data = await db.getRealStats();
            setRealStats(data);
        } catch(e) { console.error(e); }
    };

    // Toggle Effect
    useEffect(() => {
        if (useRealData && realStats) {
            setSimUserCount(realStats.userCount || 20);
            // Estimate conversion? Hard to know without deeper analytics, keep default or estimate based on active users
            // Estimate admin sales?
            setSimAdminSales(realStats.adminVideoSales || 5);
            setSimAvgDeposit(realStats.avgDeposit || 50);
        }
    }, [useRealData, realStats]);

    // --- ADVANCED PROJECTION ALGORITHM ---
    const calculateProjection = () => {
        const months = 12;
        const data = [];
        
        let currentUsers = simUserCount;
        
        const vidComm = (settings?.videoCommission || 20) / 100;
        const marketComm = (settings?.marketCommission || 25) / 100;
        const avgComm = (vidComm + marketComm) / 2;

        let cumulativeCashProfit = 0;

        for (let i = 0; i < months; i++) {
            currentUsers = currentUsers * (1 + (simGrowthRate / 100));
            
            // Costs
            const variableCost = currentUsers * simStorageCostPerUser;
            const totalCost = simFixedCost + variableCost;
            
            // Revenue Streams
            
            // 1. Deposits/VIP (Platform Cash In)
            const payingUsers = currentUsers * (simConversionRate / 100);
            const depositRevenue = payingUsers * simAvgDeposit;
            
            // 2. Admin Direct Sales (100% to Admin minus generic fee concept, but actually 100% is profit usually)
            // Let's say Admin sells X videos per 100 users
            const adminSalesVolume = (currentUsers / 100) * simAdminSales * simAvgAdminPrice;
            
            // 3. Commissions from User-to-User sales
            // Estimate total transaction volume based on users
            const userTxVolume = currentUsers * 20; // Random factor: 20$ tx per user avg
            const commissionRevenue = userTxVolume * avgComm;

            // Total Revenue
            // Note: Deposit Revenue is "Cash In". Sales/Commissions are internal movements of that cash.
            // Real Profit = (New Cash In) - Expenses.
            // OR Real Profit = (Admin Sales + Commissions) - Expenses (if we treat User Balance as Liability).
            // For this simulator, we treat "Net Revenue" as Admin Income (Direct Sales + Commissions + VIP Fees).
            
            // Let's approximate: Admin Income = Admin Sales + Commissions + (VIP Plan Sales - handled in deposits usually but lets count them separately if we could)
            // Simplified: Revenue = Admin Direct Sales + Commissions.
            const totalRevenue = adminSalesVolume + commissionRevenue;
            
            const monthlyProfit = totalRevenue - totalCost;
            cumulativeCashProfit += monthlyProfit;

            data.push({
                month: i + 1,
                users: Math.round(currentUsers),
                revenue: Math.round(totalRevenue),
                cost: Math.round(totalCost),
                profit: Math.round(monthlyProfit),
                deposits: Math.round(depositRevenue)
            });
        }

        return { data, totalProfit: cumulativeCashProfit };
    };

    const projection = calculateProjection();
    const finalMonth = projection.data[11];

    // SVG Helper
    const getPath = (key: 'revenue' | 'cost') => {
        const maxVal = Math.max(...projection.data.map(d => Math.max(d.revenue, d.cost) * 1.1));
        if (maxVal === 0) return "";
        return projection.data.map((d, i) => {
            const x = (i / 11) * 100;
            const y = 100 - ((d[key] / maxVal) * 100);
            return `${x},${y}`;
        }).join(' ');
    };

    const revenuePoints = getPath('revenue');
    const costPoints = getPath('cost');

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="font-bold text-white flex items-center gap-2"><Calculator size={18}/> Simulador</h3>
                        <button 
                            onClick={() => setUseRealData(!useRealData)} 
                            className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${useRealData ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                            <Database size={12}/> {useRealData ? 'Datos Reales' : 'Manual'}
                        </button>
                    </div>
                    
                    {/* Basic Params */}
                    <div className="space-y-4">
                        {[
                            { label: 'Usuarios Iniciales', val: simUserCount, set: setSimUserCount, max: 10000, suffix: '', step: 10 },
                            { label: 'Crecimiento Mensual', val: simGrowthRate, set: setSimGrowthRate, max: 50, suffix: '%' },
                            { label: 'Tasa Conversión (Pagos)', val: simConversionRate, set: setSimConversionRate, max: 100, suffix: '%' },
                        ].map((c, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{c.label}</label>
                                    <span className="text-xs font-bold text-indigo-400">{c.val}{c.suffix}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max={c.max} 
                                    step={c.step || 1}
                                    value={c.val} 
                                    onChange={e => c.set(parseInt(e.target.value))} 
                                    className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="h-px bg-slate-800 my-4"></div>
                    
                    {/* Admin Specifics */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-white uppercase mb-2">Ingresos Administrador</h4>
                        {[
                            { label: 'Ventas Admin / 100 usuarios', val: simAdminSales, set: setSimAdminSales, max: 50, suffix: ' videos' },
                            { label: 'Precio Promedio Video', val: simAvgAdminPrice, set: setSimAvgAdminPrice, max: 500, suffix: '$' },
                        ].map((c, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">{c.label}</label>
                                    <span className="text-[10px] font-bold text-emerald-400">{c.val}{c.suffix}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max={c.max} 
                                    value={c.val} 
                                    onChange={e => c.set(parseInt(e.target.value))} 
                                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg">Proyección a 12 Meses</h3>
                            <p className="text-sm text-slate-400">
                                {useRealData ? 'Basado en métricas actuales de la plataforma.' : 'Basado en parámetros manuales.'}
                            </p>
                        </div>
                        <div className="text-right bg-emerald-900/20 p-3 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                            <div className="text-3xl font-black text-emerald-400">+{projection.totalProfit.toLocaleString('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0})}</div>
                            <div className="text-xs text-emerald-600 font-bold uppercase">Profit Neto Acumulado</div>
                        </div>
                    </div>

                    {/* Advanced SVG Chart */}
                    <div className="relative h-64 w-full border-b border-l border-slate-700 bg-slate-950/30 rounded-lg overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="gradRevenue" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/>
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                                </linearGradient>
                                <linearGradient id="gradCost" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4"/>
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
                                </linearGradient>
                            </defs>

                            {/* Grid */}
                            {[25, 50, 75].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#334155" strokeWidth="0.2" strokeDasharray="2"/>)}
                            
                            {/* Revenue Area */}
                            <path d={`M0,100 ${revenuePoints.split(' ').map(p => 'L'+p).join(' ')} L100,100 Z`} fill="url(#gradRevenue)" />
                            <polyline points={revenuePoints} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
                            
                            {/* Cost Area */}
                            <path d={`M0,100 ${costPoints.split(' ').map(p => 'L'+p).join(' ')} L100,100 Z`} fill="url(#gradCost)" />
                            <polyline points={costPoints} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4" vectorEffect="non-scaling-stroke"/>
                        </svg>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 uppercase font-bold">
                        <span>Mes 1</span>
                        <span>Mes 6</span>
                        <span>Mes 12</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800 text-center md:text-left">
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Usuarios (Mes 12)</div>
                            <div className="text-xl font-bold text-white">{finalMonth.users.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Ingresos (Mes 12)</div>
                            <div className="text-xl font-bold text-emerald-400">${finalMonth.revenue.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Flujo Caja (Depositos)</div>
                            <div className="text-xl font-bold text-blue-400">${finalMonth.deposits.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}