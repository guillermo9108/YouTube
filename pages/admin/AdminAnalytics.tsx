
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { Calculator } from 'lucide-react';

export default function AdminAnalytics() {
    const [userCount, setUserCount] = useState(20);
    const [settings, setSettings] = useState<any>(null);

    // Simulator State
    const [simGrowthRate, setSimGrowthRate] = useState(10);
    const [simConversionRate, setSimConversionRate] = useState(25);
    const [simAvgDeposit, setSimAvgDeposit] = useState(50);
    const [simStorageCostPerUser, setSimStorageCostPerUser] = useState(0.5);
    const [simFixedCost, setSimFixedCost] = useState(200);
    const [simVelocity, setSimVelocity] = useState(50);

    useEffect(() => {
        db.getAllUsers().then(users => setUserCount(users.length || 20));
        db.getSystemSettings().then(setSettings);
    }, []);

    // --- ADVANCED PROJECTION ALGORITHM ---
    const calculateProjection = () => {
        const months = 12;
        const data = [];
        
        let currentUsers = userCount;
        
        const vidComm = (settings?.videoCommission || 20) / 100;
        const marketComm = (settings?.marketCommission || 25) / 100;
        const avgComm = (vidComm + marketComm) / 2;

        let cumulativeCashProfit = 0;

        for (let i = 0; i < months; i++) {
            currentUsers = currentUsers * (1 + (simGrowthRate / 100));
            const variableCost = currentUsers * simStorageCostPerUser;
            const totalCost = simFixedCost + variableCost;
            const payingUsers = currentUsers * (simConversionRate / 100);
            const monthlyRevenue = payingUsers * simAvgDeposit;
            const totalUserBalanceEstimate = currentUsers * 50; 
            const transactionVolume = totalUserBalanceEstimate * (simVelocity / 100);
            const saldoReclaimed = transactionVolume * avgComm;
            const monthlyProfit = monthlyRevenue - totalCost;
            cumulativeCashProfit += monthlyProfit;

            data.push({
                month: i + 1,
                users: Math.round(currentUsers),
                revenue: Math.round(monthlyRevenue),
                cost: Math.round(totalCost),
                profit: Math.round(monthlyProfit),
                reclaimed: Math.round(saldoReclaimed)
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
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-5">
                    <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2"><Calculator size={18}/> Simulador de Negocio</h3>
                    
                    {[
                        { label: 'Crecimiento Mensual', val: simGrowthRate, set: setSimGrowthRate, max: 50, suffix: '%' },
                        { label: 'Tasa Conversión (Depósitos)', val: simConversionRate, set: setSimConversionRate, max: 100, suffix: '%' },
                        { label: 'Depósito Promedio', val: simAvgDeposit, set: setSimAvgDeposit, max: 200, suffix: '$' },
                        { label: 'Velocidad Economía', val: simVelocity, set: setSimVelocity, max: 100, suffix: '%' },
                    ].map((c, i) => (
                        <div key={i}>
                            <div className="flex justify-between mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">{c.label}</label>
                                <span className="text-xs font-bold text-indigo-400">{c.val}{c.suffix}</span>
                            </div>
                            <input type="range" min="1" max={c.max} value={c.val} onChange={e => c.set(parseInt(e.target.value))} className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                        </div>
                    ))}
                </div>

                {/* Results */}
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg">Proyección a 12 Meses</h3>
                            <p className="text-sm text-slate-400">Escenario basado en parámetros actuales.</p>
                        </div>
                        <div className="text-right bg-emerald-900/20 p-3 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                            <div className="text-3xl font-black text-emerald-400">+{projection.totalProfit.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}</div>
                            <div className="text-xs text-emerald-600 font-bold uppercase">Profit Neto Estimado</div>
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
                        <span>Hoy</span>
                        <span>+6 Meses</span>
                        <span>+1 Año</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800">
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Usuarios Finales</div>
                            <div className="text-xl font-bold text-white">{finalMonth.users.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Ingresos Mes 12</div>
                            <div className="text-xl font-bold text-emerald-400">${finalMonth.revenue.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Costos Mes 12</div>
                            <div className="text-xl font-bold text-red-400">${finalMonth.cost.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
