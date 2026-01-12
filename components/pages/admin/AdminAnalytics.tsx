
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { VipPlan } from '../../../types';
import { 
    Calculator, TrendingUp, Users, DollarSign, 
    RefreshCw, Activity, Crown, Repeat, Zap, 
    Calendar, HelpCircle, ArrowRight, Coins, Clock, ArrowUpRight
} from 'lucide-react';

const InfoHint = ({ title, text, formula }: { title: string, text: string, formula?: string }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-block ml-1.5 align-middle">
            <button 
                onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
                className="text-slate-600 hover:text-indigo-400 transition-colors"
            >
                <HelpCircle size={12} />
            </button>
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
                    <p className="font-black text-indigo-400 uppercase mb-1 tracking-widest border-b border-white/5 pb-1">{title}</p>
                    <p className="leading-relaxed mb-2 font-medium">{text}</p>
                    {formula && (
                        <div className="bg-black/40 p-1.5 rounded-lg border border-white/5 font-mono text-indigo-300/80">Fórmula: {formula}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function AdminAnalytics() {
    const [realStats, setRealStats] = useState<any>(null);
    const [vipPlans, setVipPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');
    
    const [dateRange, setDateRange] = useState({
        from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    // Estado del Simulador Pro V4
    const [sim, setSim] = useState({
        users: 100,
        newUsersPerMonth: 30,
        churn: 5,
        // Added missing 'growth' property to fix type error in projection calculation
        growth: 0,
        conversion: 20,
        avgFrequency: 1.2,
        fixedCosts: 1500, // Gasto de 1500 pesos mencionado por el usuario
        avgTicket: 200,
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
            const plans = settings.vipPlans || [];
            setVipPlans(plans);

            if (rs) {
                // Inyectar realidad al simulador
                const realMix: Record<string, number> = {};
                plans.forEach(p => { realMix[p.id] = rs.planMix?.[p.name] || 0; });

                setSim(prev => ({ 
                    ...prev, 
                    users: rs.userCount || prev.users,
                    conversion: rs.averages?.conversion || prev.conversion,
                    avgTicket: rs.averages?.arpu || prev.avgTicket,
                    planMix: realMix
                }));
            }
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, [dateRange]);

    // Función: Actualizar Ticket desde el Mix de Membresías
    const updateTicketFromMix = (newMix: Record<string, number>) => {
        let totalVal = 0;
        let totalQty = 0;
        vipPlans.forEach(p => {
            const qty = newMix[p.id] || 0;
            totalVal += (qty * p.price);
            totalQty += qty;
        });
        const calculatedTicket = totalQty > 0 ? totalVal / totalQty : 0;
        setSim(prev => ({ ...prev, planMix: newMix, avgTicket: parseFloat(calculatedTicket.toFixed(1)) }));
    };

    // Función: Redistribuir Mix basado en un Ticket Promedio Target (Ajuste Proporcional)
    const updateMixFromTicket = (targetTicket: number) => {
        const newMix = { ...sim.planMix };
        const totalVentasActuales = Object.values(newMix).reduce((a: number, b: number) => a + b, 0) || 20;
        
        // Algoritmo: Priorizar planes con precios más cercanos al target
        vipPlans.forEach(p => {
            const diff = Math.abs(p.price - targetTicket);
            const weight = diff === 0 ? 10 : (1 / diff) * 10;
            newMix[p.id] = Math.round((weight / 10) * totalVentasActuales);
        });

        setSim(prev => ({ ...prev, avgTicket: targetTicket, planMix: newMix }));
    };

    const syncRealMix = () => {
        if (!realStats) return;
        const realMix: Record<string, number> = {};
        vipPlans.forEach(p => { realMix[p.id] = realStats.planMix?.[p.name] || 0; });
        updateTicketFromMix(realMix);
    };

    // Motor de Proyección Financiera
    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;

        for (let i = 1; i <= steps; i++) {
            // Fix: ensure arithmetic operands are correctly typed numbers
            const losses = currentUsers * (sim.churn / 100);
            const growth = currentUsers * (sim.growth / 100 || 0) + sim.newUsersPerMonth;
            currentUsers = Math.max(0, currentUsers + growth - losses);

            const activeBuyers = currentUsers * (sim.conversion / 100);
            const grossRevenue = activeBuyers * (sim.avgTicket * sim.avgFrequency);
            const netMonthlyProfit = grossRevenue - sim.fixedCosts;
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
        const breakEvenUsers = Math.ceil(sim.fixedCosts / (revenuePerUser || 1));

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers };
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
                <defs><linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
                <path d={`M0,100 L${path} L100,100 Z`} fill={`url(#grad-${dataKey})`} />
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-1">
            
            {/* Header Control */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-[32px] shadow-xl gap-2">
                <div className="flex p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveView('REAL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Activity size={14}/> Historial
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Calculator size={14}/> Simulador
                    </button>
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <Calendar size={12} className="text-slate-600 ml-3"/>
                    <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent text-[9px] font-black text-white outline-none uppercase" />
                    <span className="text-slate-700">/</span>
                    <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent text-[9px] font-black text-white outline-none uppercase" />
                </div>
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Recaudado Brutal</div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.totalRevenue?.toFixed(0)} $</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Ticket Promedio</div>
                            <div className="text-3xl font-black text-white">{realStats?.averages?.arpu} $</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Pagadores Únicos</div>
                            <div className="text-3xl font-black text-indigo-400">{realStats?.activeUsers}</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Conversión</div>
                            <div className="text-3xl font-black text-white">{realStats?.averages?.conversion}%</div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-10 shadow-2xl h-[400px] flex flex-col">
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Ingresos Reales por Día</h3>
                        <div className="flex-1 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50 relative">
                            {renderChart(realStats?.history?.daily || [], 'revenue', '#10b981')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
                    
                    {/* Panel de Control: Mix de Membresías */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-6 md:p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8 h-full">
                            
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-3">
                                        <Crown size={18} className="text-amber-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Mix de Ventas</h3>
                                    </div>
                                    <button onClick={syncRealMix} className="text-[8px] font-black text-indigo-400 hover:text-white uppercase flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 transition-all">
                                        <RefreshCw size={10}/> Cargar Real
                                    </button>
                                </div>
                                
                                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {vipPlans.map(plan => {
                                        const isBalance = plan.type === 'BALANCE';
                                        return (
                                            <div key={plan.id} className="bg-slate-950 p-4 rounded-3xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-2 rounded-xl ${isBalance ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {isBalance ? <Coins size={14}/> : <Clock size={14}/>}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] font-black text-white truncate uppercase">{plan.name}</div>
                                                            <div className="text-[8px] font-bold text-slate-500 uppercase">{plan.price} Pesos</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-600 uppercase">Estimadas:</span>
                                                        <input 
                                                            type="number" min="0" max="5000"
                                                            value={sim.planMix[plan.id] || 0}
                                                            onChange={e => {
                                                                const newMix = { ...sim.planMix, [plan.id]: parseInt(e.target.value) || 0 };
                                                                updateTicketFromMix(newMix);
                                                            }}
                                                            className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-xs font-black text-indigo-400 outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                                {isBalance && plan.bonusPercent! > 0 && (
                                                    <div className="text-[7px] font-black text-emerald-500 uppercase ml-10">Bono Activo: +{plan.bonusPercent}%</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-6 pt-4 border-t border-slate-800">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <div className="flex items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Gastos Mensuales</label>
                                            <InfoHint title="Costos Fijos" text="Suma de servidores, dominios, licencias y personal que debes cubrir cada mes." />
                                        </div>
                                        <span className="text-sm font-black text-red-400">{sim.fixedCosts} $</span>
                                    </div>
                                    <input type="range" min="100" max="10000" step="100" value={sim.fixedCosts} onChange={e => setSim({...sim, fixedCosts: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <div className="flex items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Medio Target</label>
                                            <InfoHint title="Valor de Compra" text="Si modificas esto, el sistema ajustará automáticamente cuántas membresías de cada tipo necesitas vender." formula="Ingresos / Ventas Totales" />
                                        </div>
                                        <span className="text-sm font-black text-amber-400">${sim.avgTicket}</span>
                                    </div>
                                    <input 
                                        type="range" min="10" max="2000" step="10" 
                                        value={sim.avgTicket} 
                                        onChange={e => updateMixFromTicket(parseFloat(e.target.value))} 
                                        className="w-full accent-amber-500 h-1 bg-slate-800 rounded-full appearance-none" 
                                    />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Resultados Visuales Proyectados */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px]">
                            
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Utilidad Neta Proyectada</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Simulación basada en Mix de Membresías vs Gastos</p>
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-indigo-500/20">
                                            <div className="text-[8px] font-black text-indigo-400 uppercase mb-0.5">Ventas Necesarias (Break-Even)</div>
                                            <span className="text-sm font-bold text-white">{projection.breakEvenUsers} <span className="text-[10px] text-slate-500 uppercase">Ventas/Mes</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-5xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()} $
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase mt-2">Utilidad Estimada Año 1</div>
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
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Gasto Anual</div>
                                    <div className="text-xl font-black text-red-500">${sim.fixedCosts * 12}</div>
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
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Carga Saldo (Mix)</div>
                                    <div className="text-xl font-black text-indigo-400">
                                        {/* Fix for Error: Operator '+' cannot be applied to types 'number' and 'unknown'. */}
                                        {/* Cast 'qty' to number explicitly */}
                                        {Object.entries(sim.planMix).filter(([id]) => vipPlans.find(p => p.id === id)?.type === 'BALANCE').reduce((acc, [_, qty]) => acc + (qty as number), 0)}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
            `}</style>
        </div>
    );
}
