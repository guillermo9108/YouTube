
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { VipPlan } from '../../../types';
import { 
    Calculator, TrendingUp, Users, DollarSign, 
    RefreshCw, BarChart3, ShieldAlert, Activity, 
    ArrowRightLeft, Scale, PieChart, Landmark, TrendingDown, Wallet, Zap, Loader2, Repeat, Target, UserPlus, Calendar, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

export default function AdminAnalytics() {
    const [realStats, setRealStats] = useState<any>(null);
    const [vipPlans, setVipPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');
    
    // Filtros de fecha reales
    const [dateRange, setDateRange] = useState({
        from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    // --- MOTOR DE SIMULACIÓN RECURRENTE V2 ---
    const [sim, setSim] = useState({
        users: 100,
        newUsersPerMonth: 25,
        growth: 2,             
        churn: 5,              
        conversion: 20,        
        avgFrequency: 2.5,     
        contentInflow: 1200,   
        opCosts: 150,          
        p2pVolume: 10,         
        p2pCommission: 5,      
        reinvestmentRate: 85,  
        planMix: {} as Record<string, number>
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const fromTs = Math.floor(new Date(dateRange.from).getTime() / 1000);
            const toTs = Math.floor(new Date(dateRange.to).getTime() / 1000);

            const [rs, settings] = await Promise.all([
                db.request<any>(`action=get_real_stats&from=${fromTs}&to=${toTs}`),
                db.getSystemSettings()
            ]);

            setRealStats(rs);
            const plans = settings.vipPlans || [];
            setVipPlans(plans);

            // Sincronizar mezcla de planes por defecto
            if (plans.length > 0 && Object.keys(sim.planMix).length === 0) {
                const equalShare = Math.floor(100 / plans.length);
                const initialMix: Record<string, number> = {};
                plans.forEach((p, idx) => {
                    initialMix[p.id] = idx === plans.length - 1 ? 100 - (equalShare * (plans.length - 1)) : equalShare;
                });
                setSim(prev => ({ ...prev, planMix: initialMix }));
            }

            // Inyectar datos reales en simulador (Modo Híbrido)
            if (rs && rs.userCount) {
                setSim(prev => ({ 
                    ...prev, 
                    users: Number(rs.userCount),
                    conversion: rs.averages?.activeUsers30d > 0 ? Math.min(100, Math.round((rs.averages.activeUsers30d / rs.userCount) * 100)) : prev.conversion,
                    avgFrequency: rs.averages?.avgTxPerUser || prev.avgFrequency
                }));
            }
        } catch(e) { 
            console.error("Analytics Load Error:", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, [dateRange]);

    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;
        const totalFixedCosts = sim.contentInflow + sim.opCosts;

        for (let i = 1; i <= steps; i++) {
            const losses = currentUsers * (sim.churn / 100);
            const growth = currentUsers * (sim.growth / 100) + sim.newUsersPerMonth;
            currentUsers = Math.max(0, currentUsers + growth - losses);

            const activeBuyers = currentUsers * (sim.conversion / 100);
            
            let avgPlanPrice = 0;
            vipPlans.forEach(p => {
                avgPlanPrice += (Number(p.price) * ((sim.planMix[p.id] || 0) / 100));
            });

            // Ingresos recurrentes por frecuencia de recarga
            const totalMembershipRev = activeBuyers * (avgPlanPrice * sim.avgFrequency);
            const circulatingVolume = currentUsers * sim.p2pVolume;
            const p2pProfit = circulatingVolume * (sim.p2pCommission / 100) * (sim.reinvestmentRate / 100);

            const grossRevenue = totalMembershipRev + p2pProfit;
            const netMonthlyProfit = grossRevenue - totalFixedCosts;
            const profitability = grossRevenue > 0 ? (netMonthlyProfit / grossRevenue) * 100 : -100;

            cumulativeNetProfit += netMonthlyProfit;

            data.push({
                label: `M${i}`,
                users: Math.round(currentUsers),
                revenue: Math.round(grossRevenue),
                profit: Math.round(netMonthlyProfit),
                profitability: parseFloat(profitability.toFixed(1))
            });
        }

        const breakEvenUsers = Math.ceil(totalFixedCosts / (((sim.conversion/100) * projectionAvgPlanPrice(vipPlans, sim.planMix) * sim.avgFrequency) || 1));

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers, totalFixedCosts };
    }, [sim, vipPlans]);

    function projectionAvgPlanPrice(plans: VipPlan[], mix: Record<string, number>) {
        return plans.reduce((acc, p) => acc + (Number(p.price) * ((mix[p.id] || 0) / 100)), 0);
    }

    const renderChart = (points: any[], dataKey: string, color: string, showGradient = true) => {
        if (!points || points.length < 2) return null;
        const values = points.map(p => Number(p[dataKey] || 0));
        const max = Math.max(...values) * 1.1 || 100;
        const min = Math.min(...values, 0);
        const range = max - min;

        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 100 - (((Number(p[dataKey]) - min) / range) * 100);
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {showGradient && (
                    <defs>
                        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                )}
                {showGradient && <path d={`M0,100 L${path} L100,100 Z`} fill={`url(#grad-${dataKey})`} />}
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-24">
            
            {/* Header de Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-3xl shadow-xl gap-2">
                <div className="flex p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveView('REAL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Activity size={16}/> Realidad
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Calculator size={16}/> Simulador Pro
                    </button>
                </div>
                
                {activeView === 'REAL' && (
                    <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                        <Calendar size={14} className="text-slate-600 ml-3"/>
                        <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent text-[10px] font-black text-white outline-none uppercase" />
                        <span className="text-slate-700">/</span>
                        <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent text-[10px] font-black text-white outline-none uppercase" />
                    </div>
                )}
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    {/* KPIs de Realidad */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Users size={80}/></div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Usuarios Activos</div>
                            <div className="text-3xl font-black text-white">{realStats?.averages?.activeUsers30d || 0}</div>
                            <div className="text-[9px] text-indigo-400 font-bold mt-1 uppercase">De {realStats?.userCount} totales</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Landmark size={80}/></div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ingresos (Fees)</div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.systemRevenue?.toFixed(0)} $</div>
                            <div className="text-[9px] text-emerald-600 font-bold mt-1 uppercase">Acumulado Histórico</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><ArrowRightLeft size={80}/></div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Frecuencia Uso</div>
                            <div className="text-3xl font-black text-white">{realStats?.averages?.avgTxPerUser}x</div>
                            <div className="text-[9px] text-slate-600 font-bold mt-1 uppercase">Transacciones / Mes</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Zap size={80}/></div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ARPU Real</div>
                            <div className="text-3xl font-black text-amber-400">{realStats?.averages?.arpu} $</div>
                            <div className="text-[9px] text-amber-600 font-bold mt-1 uppercase">Valor medio cliente</div>
                        </div>
                    </div>

                    {/* Gráfico de Tendencia Real */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-10 shadow-2xl overflow-hidden flex flex-col h-[450px]">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Historial de Recaudación</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ingresos netos por comisiones del sistema</p>
                            </div>
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                                <button onClick={() => setTimeframe('DAYS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeframe === 'DAYS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Días</button>
                                <button onClick={() => setTimeframe('MONTHS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeframe === 'MONTHS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Meses</button>
                            </div>
                        </div>
                        <div className="flex-1 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50 relative">
                            {renderChart(timeframe === 'DAYS' ? (realStats?.history?.daily || []) : (realStats?.history?.monthly || []), 'revenue', '#10b981')}
                            
                            {/* Ejes visuales */}
                            <div className="absolute bottom-4 left-6 right-6 flex justify-between text-[8px] font-black text-slate-700 uppercase">
                                <span>{timeframe === 'DAYS' ? 'Periodo 30d' : 'Anual'}</span>
                                <span>HOY</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Simulador: Controles Columna Izquierda */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8 h-full overflow-y-auto max-h-[80vh] custom-scrollbar">
                            
                            {/* SECCIÓN CRECIMIENTO */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                    <UserPlus size={18} className="text-emerald-400"/>
                                    <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Motor de Adquisición</h3>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nuevos Usuarios / Mes</label>
                                        <span className="text-sm font-black text-white">+{sim.newUsersPerMonth}</span>
                                    </div>
                                    <input type="range" min="0" max="1000" step="10" value={sim.newUsersPerMonth} onChange={e => setSim({...sim, newUsersPerMonth: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Churn Rate (%)</label>
                                        <span className="text-sm font-black text-red-400">-{sim.churn}%</span>
                                    </div>
                                    <input type="range" min="0" max="30" step="1" value={sim.churn} onChange={e => setSim({...sim, churn: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>

                            {/* SECCIÓN ACTIVIDAD RECURRENTE */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                    <Repeat size={18} className="text-indigo-400"/>
                                    <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Actividad Recurrente</h3>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa Conversión VIP (%)</label>
                                        <span className="text-sm font-black text-white">{sim.conversion}%</span>
                                    </div>
                                    <input type="range" min="1" max="100" step="1" value={sim.conversion} onChange={e => setSim({...sim, conversion: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Renovaciones / Mes</label>
                                        <span className="text-sm font-black text-indigo-400">{sim.avgFrequency}x</span>
                                    </div>
                                    <input type="range" min="1" max="10" step="0.5" value={sim.avgFrequency} onChange={e => setSim({...sim, avgFrequency: parseFloat(e.target.value)})} className="w-full accent-indigo-400 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>

                            {/* SECCIÓN COSTOS */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                                    <TrendingDown size={18} className="text-red-400"/>
                                    <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Estructura de Gastos</h3>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contenido Nuevo / Mes</label>
                                        <span className="text-sm font-black text-red-400">${sim.contentInflow}</span>
                                    </div>
                                    <input type="range" min="0" max="10000" step="250" value={sim.contentInflow} onChange={e => setSim({...sim, contentInflow: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Simulador: Resultados Columna Derecha */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[600px]">
                            <div className="relative z-10">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Proyección de Flujo Neto</h3>
                                        <p className="text-sm text-slate-500">Simulación a 12 meses basada en recurrencia de saldo.</p>
                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-indigo-500/20">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase block">Punto de Equilibrio</span>
                                                <span className="text-sm font-bold text-white">{projection.breakEvenUsers} <span className="text-[10px] text-slate-500">Usuarios</span></span>
                                            </div>
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-red-500/20">
                                                <span className="text-[8px] font-black text-red-400 uppercase block">Costos Fijos Totales</span>
                                                <span className="text-sm font-bold text-white">${projection.totalFixedCosts}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-4xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()} $
                                        </div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">UTILIDAD PROYECTADA (AÑO 1)</div>
                                    </div>
                                </div>

                                <div className="h-64 w-full bg-slate-950/30 rounded-[32px] p-8 border border-slate-800/50 mb-12 relative">
                                    {renderChart(projection.data, 'profit', projection.totalProfit >= 0 ? '#10b981' : '#f43f5e')}
                                    
                                    {/* Guía de los meses */}
                                    <div className="absolute -bottom-6 left-8 right-8 flex justify-between text-[8px] font-black text-slate-600 uppercase">
                                        {projection.data.map((d, i) => <span key={i}>{d.label}</span>)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-slate-800/50 pt-8">
                                    <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                        <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Cierre Usuarios</div>
                                        <div className="text-xl font-black text-white">{projection.data[11].users}</div>
                                    </div>
                                    <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                        <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Ingreso M12</div>
                                        <div className="text-xl font-black text-white">${projection.data[11].revenue}</div>
                                    </div>
                                    <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                        <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Margen Final</div>
                                        <div className={`text-xl font-black ${projection.data[11].profitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{projection.data[11].profitability}%</div>
                                    </div>
                                    <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                        <div className="text-[9px] font-black text-slate-600 uppercase mb-1">ARPU Target</div>
                                        <div className="text-xl font-black text-amber-400">${(projection.data[11].revenue / projection.data[11].users).toFixed(2)}</div>
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

