
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { VipPlan, SystemSettings } from '../../../types';
import { 
    Calculator, TrendingUp, Users, DollarSign, 
    RefreshCw, BarChart3, ShieldAlert, Activity, 
    ArrowRightLeft, Scale, PieChart, Landmark, TrendingDown, Wallet, Zap, Loader2, Repeat, Target, UserPlus
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

export default function AdminAnalytics() {
    const [realStats, setRealStats] = useState<any>(null);
    const [vipPlans, setVipPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');

    // --- ANALISTA FINANCIERO: MODELO ECONOMÍA CERRADA RECURRENTE ---
    const [sim, setSim] = useState({
        users: 100,
        newUsersPerMonth: 20,  // Cantidad manual de usuarios nuevos al mes
        growth: 0,             // % Crecimiento (Desactivado por defecto si se usa manual)
        churn: 5,              // % Abandono
        conversion: 20,        // % Usuarios que realizan compras (Planes/Recargas)
        
        // Frecuencia de renovación semanal (Basado en patrón 4,4,3,2,1 / 5 = 2.8)
        avgFrequency: 2.8,     
        
        // Variables de Costos (Fijos Mensuales)
        contentInflow: 1400,   // Inversión en contenido
        opCosts: 200,          // Luz/Servidor/Mantenimiento
        
        // Circularidad P2P
        p2pVolume: 15,         // $ promedio circulado entre usuarios/mes
        p2pCommission: 5,      // % Fee de red (Credita a Admin)
        reinvestmentRate: 70,  // % de saldo que vuelve a circular
        
        // Mix de Planes
        planMix: {} as Record<string, number>
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [rs, settings] = await Promise.all([
                db.request<any>('action=get_real_stats'),
                db.getSystemSettings()
            ]);

            setRealStats(rs);
            const plans = settings.vipPlans || [];
            setVipPlans(plans);

            const initialMix: Record<string, number> = {};
            if (plans.length > 0) {
                const equalShare = Math.floor(100 / plans.length);
                plans.forEach((p, idx) => {
                    initialMix[p.id] = idx === plans.length - 1 ? 100 - (equalShare * (plans.length - 1)) : equalShare;
                });
            }

            if (rs && rs.userCount) {
                setSim(prev => ({ 
                    ...prev, 
                    users: Number(rs.userCount),
                    planMix: Object.keys(prev.planMix).length > 0 ? prev.planMix : initialMix
                }));
            }
        } catch(e) { 
            console.error("Analytics Load Error:", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- CÁLCULO DE RENTABILIDAD RECURRENTE ---
    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;
        const totalFixedCosts = sim.contentInflow + sim.opCosts;

        // ARPU Objetivo definido por la realidad del flujo: $425
        const TARGET_ARPU = 425;

        for (let i = 1; i <= steps; i++) {
            // Crecimiento: Usuarios Nuevos fijos + Crecimiento % - Churn %
            const organicGrowth = currentUsers * (sim.growth / 100);
            const losses = currentUsers * (sim.churn / 100);
            
            currentUsers = Math.max(0, currentUsers + sim.newUsersPerMonth + organicGrowth - losses);

            const activeBuyers = currentUsers * (sim.conversion / 100);
            
            // Ingresos por Volumen de Renovaciones (No por usuarios únicos)
            let avgPlanPrice = 0;
            vipPlans.forEach(p => {
                avgPlanPrice += (Number(p.price) * ((sim.planMix[p.id] || 0) / 100));
            });

            // Fórmula: Ingreso_Mensual = (Precio_Plan * Frecuencia) * Compradores + P2P
            const totalMembershipRev = activeBuyers * (avgPlanPrice * sim.avgFrequency);

            const circulatingVolume = currentUsers * sim.p2pVolume;
            const p2pProfit = circulatingVolume * (sim.p2pCommission / 100) * (sim.reinvestmentRate / 100);

            const grossRevenue = totalMembershipRev + p2pProfit;
            const netMonthlyProfit = grossRevenue - totalFixedCosts;
            
            const profitability = grossRevenue > 0 ? ((grossRevenue - totalFixedCosts) / grossRevenue) * 100 : -100;

            cumulativeNetProfit += netMonthlyProfit;

            data.push({
                label: `Mes ${i}`,
                users: Math.round(currentUsers),
                renewals: Math.round(activeBuyers * sim.avgFrequency),
                revenue: Math.round(grossRevenue),
                profit: Math.round(netMonthlyProfit),
                profitability: parseFloat(profitability.toFixed(2)),
                isBurn: netMonthlyProfit < 0
            });
        }

        const avgProfitability = data.reduce((acc, curr) => acc + curr.profitability, 0) / steps;
        
        // El punto de equilibrio se recalcula basado en el ARPU objetivo de $425
        const breakEvenUsers = Math.ceil(totalFixedCosts / (TARGET_ARPU * (sim.conversion / 100) || 1));

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers, totalFixedCosts, avgProfitability, targetArpu: TARGET_ARPU };
    }, [sim, vipPlans]);

    const handleMixChange = (planId: string, value: number) => {
        setSim(prev => ({
            ...prev,
            planMix: { ...prev.planMix, [planId]: value }
        }));
    };

    const renderChart = (points: any[], dataKey: string, color: string) => {
        if (!points || !Array.isArray(points) || points.length < 2) return (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-700 uppercase font-black tracking-widest italic">
                Datos insuficientes para graficar
            </div>
        );
        const values = points.map(p => Number(p[dataKey] || 0));
        const max = Math.max(...values.map(Math.abs), 10) * 1.2;
        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 100 - ((Number(p[dataKey]) / max) * 100); // Scale 0-100 properly
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-2 max-w-7xl mx-auto">
            
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                <div className="flex gap-1 p-1 bg-slate-950 rounded-xl">
                    <button onClick={() => setActiveView('REAL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Métricas Reales
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Simulador Pro V2 (Recurrente)
                    </button>
                </div>
                <button onClick={loadData} className="p-2 text-slate-500 hover:text-white"><RefreshCw size={16}/></button>
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Users className="text-blue-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Usuarios</div>
                            <div className="text-3xl font-black text-white">{Number(realStats?.userCount || 0)}</div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Landmark className="text-emerald-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Red</div>
                            <div className="text-3xl font-black text-emerald-400">{Number(realStats?.systemRevenue || 0).toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Activity className="text-purple-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Interno</div>
                            <div className="text-3xl font-black text-white">{Number(realStats?.totalBalance || 0).toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <ArrowRightLeft className="text-amber-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ARPU Sistema</div>
                            <div className="text-3xl font-black text-amber-400">{(Number(realStats?.systemRevenue || 0) / (Number(realStats?.userCount) || 1)).toFixed(2)} <span className="text-sm">$</span></div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden relative">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Volumen de Recaudación Real</h3>
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-lg">
                                <button onClick={() => setTimeframe('DAYS')} className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${timeframe === 'DAYS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Días</button>
                                <button onClick={() => setTimeframe('MONTHS')} className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${timeframe === 'MONTHS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Meses</button>
                            </div>
                        </div>
                        <div className="h-64 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50">
                            {renderChart(timeframe === 'DAYS' ? (realStats?.history?.daily || []) : (realStats?.history?.monthly || []), 'revenue', '#10b981')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Control Panel (Simulador Recurrente) */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8">
                            
                            <div className="space-y-6">
                                {/* ADQUISICIÓN DE USUARIOS */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                        <UserPlus size={18} className="text-emerald-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Adquisición de Usuarios</h3>
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nuevos Usuarios / Mes</label>
                                            <span className="text-sm font-black text-white">+{sim.newUsersPerMonth}</span>
                                        </div>
                                        <input type="range" min="0" max="500" step="5" value={sim.newUsersPerMonth} onChange={e => setSim({...sim, newUsersPerMonth: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Churn (Abandono %)</label>
                                            <span className="text-sm font-black text-red-400">{sim.churn}%</span>
                                        </div>
                                        <input type="range" min="0" max="50" step="1" value={sim.churn} onChange={e => setSim({...sim, churn: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>

                                {/* MODELO DE FRECUENCIA */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                        <Repeat size={18} className="text-indigo-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Modelo de Frecuencia</h3>
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Renovaciones / Mes</label>
                                            <span className="text-sm font-black text-white">{sim.avgFrequency}x</span>
                                        </div>
                                        <input type="range" min="1" max="4" step="0.1" value={sim.avgFrequency} onChange={e => setSim({...sim, avgFrequency: parseFloat(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                        <p className="text-[9px] text-slate-600 font-bold uppercase mt-2 italic text-center">Factor de re-compra semanal</p>
                                    </div>
                                </div>

                                {/* COSTOS */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                        <Landmark size={18} className="text-red-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Costos Operativos</h3>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inversión Contenido</label>
                                            <span className="text-sm font-black text-red-400">${sim.contentInflow}</span>
                                        </div>
                                        <input type="range" min="0" max="5000" step="100" value={sim.contentInflow} onChange={e => setSim({...sim, contentInflow: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gastos Infraestructura</label>
                                            <span className="text-sm font-black text-orange-400">${sim.opCosts}</span>
                                        </div>
                                        <input type="range" min="0" max="1000" step="50" value={sim.opCosts} onChange={e => setSim({...sim, opCosts: parseInt(e.target.value)})} className="w-full accent-orange-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest sticky top-0 bg-slate-950 py-1 z-10"><PieChart size={14}/> Mix de Renovaciones</label>
                                    {vipPlans.length === 0 ? (
                                        <p className="text-[9px] text-slate-600 italic uppercase text-center py-4">No hay planes configurados</p>
                                    ) : vipPlans.map(plan => (
                                        <div key={plan.id}>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                <span className="truncate max-w-[120px]">{plan.name} (${plan.price})</span>
                                                <span className="text-white">{sim.planMix[plan.id] || 0}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={sim.planMix[plan.id] || 0} 
                                                onChange={e => handleMixChange(plan.id, parseInt(e.target.value))} 
                                                className={`w-full ${plan.type === 'BALANCE' ? 'accent-emerald-500' : 'accent-indigo-500'} h-1 bg-slate-800 rounded-full appearance-none cursor-pointer`} 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Result Display V2 */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Rentabilidad por Volumen Mensual</h3>
                                    <p className="text-sm text-slate-500">Proyección basada en renovaciones de saldo recurrentes.</p>
                                    <div className="mt-4 flex flex-wrap items-center gap-4">
                                        <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl">
                                            <span className="text-[8px] font-black text-slate-500 uppercase block">Costos Fijos</span>
                                            <span className="text-sm font-bold text-red-400">${projection.totalFixedCosts}</span>
                                        </div>
                                        <div className="bg-slate-950 border border-indigo-500/30 px-4 py-2 rounded-xl">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase block">ARPU Objetivo</span>
                                            <span className="text-sm font-bold text-white">${projection.targetArpu}</span>
                                        </div>
                                        <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2 rounded-xl">
                                            <span className="text-[8px] font-black text-emerald-400 uppercase block flex items-center gap-1"><Target size={10}/> Punto Crítico</span>
                                            <span className="text-sm font-bold text-white">{projection.breakEvenUsers} <span className="text-[10px] text-slate-500">Usuarios</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-right px-8 py-5 rounded-[24px] border backdrop-blur-md shadow-2xl ${projection.avgProfitability >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <div className={`text-4xl font-black ${projection.avgProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.avgProfitability.toFixed(1)}%
                                    </div>
                                    <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">MARGEN OPERATIVO</div>
                                </div>
                            </div>

                            <div className="h-64 w-full bg-slate-950/30 rounded-3xl p-6 border border-slate-800/50">
                                {renderChart(projection.data, 'revenue', '#6366f1')}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-slate-800 text-center">
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Volumen Renovaciones</div>
                                    <div className="text-xl font-black text-white">{projection.data[0]?.renewals} <span className="text-xs opacity-40">M1</span></div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Ingresos M12</div>
                                    <div className="text-xl font-black text-white">${Math.round(projection.data[11]?.revenue).toLocaleString()}</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Base Final</div>
                                    <div className="text-xl font-black text-indigo-400">{projection.data[11]?.users} <span className="text-xs opacity-40">Users</span></div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Utilidad M12</div>
                                    <div className={`text-xl font-black ${projection.data[11]?.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        ${Math.round(projection.data[11]?.profit).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
