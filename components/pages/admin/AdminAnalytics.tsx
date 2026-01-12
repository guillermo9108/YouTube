
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { VipPlan } from '../../../types';
import { 
    Calculator, TrendingUp, Users, DollarSign, 
    RefreshCw, BarChart3, Activity, 
    ArrowRightLeft, PieChart, Landmark, TrendingDown, Wallet, Zap, Loader2, Repeat, Target, UserPlus, Calendar, Info, HelpCircle, ArrowUpRight, CheckCircle2,
    // Add missing Crown import
    Crown
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

const InfoHint = ({ title, text, formula }: { title: string, text: string, formula?: string }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-block ml-1.5 align-middle">
            <button 
                onMouseEnter={() => setShow(true)} 
                onMouseLeave={() => setShow(false)}
                onClick={() => setShow(!show)}
                className="text-slate-600 hover:text-indigo-400 transition-colors"
            >
                <HelpCircle size={12} />
            </button>
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
                    <p className="font-black text-indigo-400 uppercase mb-1 tracking-widest border-b border-white/5 pb-1">{title}</p>
                    <p className="leading-relaxed mb-2 font-medium">{text}</p>
                    {formula && (
                        <div className="bg-black/40 p-1.5 rounded-lg border border-white/5 font-mono text-indigo-300/80">
                            Fórmula: {formula}
                        </div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-700"></div>
                </div>
            )}
        </div>
    );
};

export default function AdminAnalytics() {
    const [realStats, setRealStats] = useState<any>(null);
    const [vipPlans, setVipPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');
    
    const [dateRange, setDateRange] = useState({
        from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    const [sim, setSim] = useState({
        users: 100,
        newUsersPerMonth: 25,
        growth: 2,             
        churn: 5,              
        conversion: 20,        
        avgFrequency: 1.5,     
        contentInflow: 1200,   
        opCosts: 150,
        avgTicket: 5.0,
        planMix: {} as Record<string, number> // Cantidad estimada por ID de plan
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
            const activePlans = settings.vipPlans || [];
            setVipPlans(activePlans);

            if (rs) {
                // Sincronizar mix de planes reales (mapeo por nombre a ID)
                const realMix: Record<string, number> = {};
                activePlans.forEach(p => {
                    realMix[p.id] = rs.planDistribution?.[p.name] || 0;
                });

                setSim(prev => ({ 
                    ...prev, 
                    users: rs.userCount || prev.users,
                    conversion: rs.averages?.conversion || prev.conversion,
                    avgFrequency: rs.averages?.frequency || prev.avgFrequency,
                    avgTicket: rs.averages?.arpu || prev.avgTicket,
                    planMix: realMix
                }));
            }
        } catch(e) { console.error("Error loading analytics:", e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, [dateRange]);

    // Función: De Mix de Planes -> Ticket Promedio
    const updateTicketFromMix = (newMix: Record<string, number>) => {
        let totalVal = 0;
        let totalQty = 0;
        vipPlans.forEach(p => {
            const qty = newMix[p.id] || 0;
            totalVal += (qty * p.price);
            totalQty += qty;
        });
        const calculatedTicket = totalQty > 0 ? totalVal / totalQty : 0;
        setSim(prev => ({ ...prev, planMix: newMix, avgTicket: parseFloat(calculatedTicket.toFixed(2)) }));
    };

    // Función: De Ticket Slider -> Mix Aleatorio Proporcional
    const updateMixFromTicket = (targetTicket: number) => {
        const newMix = { ...sim.planMix };
        // Fix: Explicitly type reduce callback parameters to avoid 'unknown' inference
        const totalVentas = Object.values(newMix).reduce((a: number, b: number) => a + b, 0) || 10;
        
        // Algoritmo simple: Intentamos ajustar los pesos para que el promedio se acerque al target
        vipPlans.forEach(p => {
            // Si el precio del plan es cercano al ticket, le damos más peso
            const diff = Math.abs(p.price - targetTicket);
            const weight = diff === 0 ? 10 : (1 / diff) * 10;
            // Fix: totalVentas is now correctly inferred as a number
            newMix[p.id] = Math.round((weight / 10) * totalVentas);
        });

        setSim(prev => ({ ...prev, avgTicket: targetTicket, planMix: newMix }));
    };

    const syncRealMix = () => {
        if (!realStats) return;
        const realMix: Record<string, number> = {};
        vipPlans.forEach(p => {
            realMix[p.id] = realStats.planDistribution?.[p.name] || 0;
        });
        updateTicketFromMix(realMix);
    };

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
            const grossRevenue = activeBuyers * (sim.avgTicket * sim.avgFrequency);
            
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

        const revenuePerUser = (sim.conversion/100) * sim.avgTicket * sim.avgFrequency;
        const breakEvenUsers = Math.ceil(totalFixedCosts / (revenuePerUser || 1));

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers, totalFixedCosts };
    }, [sim]);

    const renderChart = (points: any[], dataKey: string, color: string) => {
        if (!points || points.length < 2) return null;
        const values = points.map(p => Number(p[dataKey] || 0));
        const max = Math.max(...values) * 1.1 || 100;
        const min = Math.min(...values, 0);
        const range = max - min;

        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 100 - (((Number(p[dataKey]) - min) / (range || 1)) * 100);
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M0,100 L${path} L100,100 Z`} fill={`url(#grad-${dataKey})`} />
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-24">
            
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-3xl shadow-xl gap-2">
                <div className="flex p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveView('REAL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Activity size={16}/> Realidad
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Calculator size={16}/> Simulador
                    </button>
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <Calendar size={14} className="text-slate-600 ml-3"/>
                    <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent text-[10px] font-black text-white outline-none uppercase" />
                    <span className="text-slate-700">/</span>
                    <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent text-[10px] font-black text-white outline-none uppercase" />
                </div>
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5"><Users size={80}/></div>
                            <div className="flex items-center gap-1 mb-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Activos en periodo</div>
                                <InfoHint title="Compradores" text="Usuarios únicos que pagaron VIP o comisiones." />
                            </div>
                            <div className="text-3xl font-black text-white">{realStats?.activeUsers || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5"><Landmark size={80}/></div>
                            <div className="flex items-center gap-1 mb-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos Totales</div>
                                <InfoHint title="Bruto" text="Comisiones de video/tienda + Ventas VIP." />
                            </div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.totalRevenue?.toFixed(0)} $</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5"><Repeat size={80}/></div>
                            <div className="flex items-center gap-1 mb-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Frecuencia</div>
                                <InfoHint title="Compras/User" text="Promedio de transacciones por cada usuario pagador." />
                            </div>
                            <div className="text-3xl font-black text-white">{realStats?.averages?.frequency}x</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-5"><Zap size={80}/></div>
                            <div className="flex items-center gap-1 mb-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket Medio</div>
                                <InfoHint title="AOV" text="Valor promedio de cada decisión de pago." />
                            </div>
                            <div className="text-3xl font-black text-amber-400">{realStats?.averages?.arpu} $</div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-10 shadow-2xl overflow-hidden flex flex-col h-[400px]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Historial Real</h3>
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                                <button onClick={() => setTimeframe('DAYS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeframe === 'DAYS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Días</button>
                                <button onClick={() => setTimeframe('MONTHS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeframe === 'MONTHS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Meses</button>
                            </div>
                        </div>
                        <div className="flex-1 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50 relative">
                            {renderChart(timeframe === 'DAYS' ? (realStats?.history?.daily || []) : (realStats?.history?.monthly || []), 'revenue', '#10b981')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
                    
                    {/* Controles del Simulador */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8">
                            
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-3">
                                        <Crown size={18} className="text-amber-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Mix de Membresías</h3>
                                    </div>
                                    <button onClick={syncRealMix} className="text-[8px] font-black text-indigo-400 hover:text-white uppercase flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 transition-all">
                                        <RefreshCw size={10}/> Cargar Historial Real
                                    </button>
                                </div>
                                
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {vipPlans.map(plan => (
                                        <div key={plan.id} className="bg-slate-950 p-3 rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="min-w-0">
                                                    <div className="text-[10px] font-black text-white truncate uppercase">{plan.name}</div>
                                                    <div className="text-[8px] font-bold text-slate-500">{plan.price} $</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold text-indigo-400">Qty:</span>
                                                    <input 
                                                        type="number" min="0" max="5000"
                                                        value={sim.planMix[plan.id] || 0}
                                                        onChange={e => {
                                                            const newMix = { ...sim.planMix, [plan.id]: parseInt(e.target.value) || 0 };
                                                            updateTicketFromMix(newMix);
                                                        }}
                                                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-xs font-black text-white outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500/40" style={{ width: `${Math.min(100, (sim.planMix[plan.id] || 0) * 2)}%`}}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6 pt-4 border-t border-slate-800">
                                <div className="flex items-center gap-3">
                                    <TrendingUp size={18} className="text-emerald-400"/>
                                    <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Crecimiento Mensual</h3>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase">Nuevos Usuarios</label>
                                        <span className="text-sm font-black text-white">+{sim.newUsersPerMonth}</span>
                                    </div>
                                    <input type="range" min="0" max="1000" step="10" value={sim.newUsersPerMonth} onChange={e => setSim({...sim, newUsersPerMonth: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <div className="flex items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Promedio</label>
                                            <InfoHint title="AOV Estimado" text="Si mueves este slider, el mix de planes de arriba se re-ajustará solo." />
                                        </div>
                                        <span className="text-sm font-black text-amber-400">${sim.avgTicket}</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="500" step="0.5" 
                                        value={sim.avgTicket} 
                                        onChange={e => updateMixFromTicket(parseFloat(e.target.value))} 
                                        className="w-full accent-amber-500 h-1 bg-slate-800 rounded-full appearance-none" 
                                    />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Resultados Visuales */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px]">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Proyección de Flujo Neto</h3>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-indigo-500/20">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase">Punto de Equilibrio</span>
                                            </div>
                                            <span className="text-sm font-bold text-white">{projection.breakEvenUsers} <span className="text-[10px] text-slate-500 uppercase">Usuarios Pagadores</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-4xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()} $
                                    </div>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <div className="text-[10px] font-black text-slate-500 uppercase">Utilidad Proyectada (Mes 12)</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 w-full bg-slate-950/30 rounded-[32px] p-8 border border-slate-800/50 mb-8 relative">
                                {renderChart(projection.data, 'profit', projection.totalProfit >= 0 ? '#10b981' : '#f43f5e')}
                                <div className="absolute bottom-4 left-8 right-8 flex justify-between text-[8px] font-black text-slate-600 uppercase">
                                    {projection.data.map((d, i) => <span key={i}>{d.label}</span>)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-800/50">
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Usuarios M12</div>
                                    <div className="text-xl font-black text-white">{projection.data[11].users}</div>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Ingreso M12</div>
                                    <div className="text-xl font-black text-white">${projection.data[11].revenue}</div>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Margen</div>
                                    <div className={`text-xl font-black ${projection.data[11].profitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{projection.data[11].profitability}%</div>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">ARPU Final</div>
                                    <div className="text-xl font-black text-amber-400">${(projection.data[11].revenue / projection.data[11].users).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
