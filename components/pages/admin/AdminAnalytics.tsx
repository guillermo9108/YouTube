
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { VipPlan, SystemSettings } from '../../../types';
import { 
    Calculator, TrendingUp, RefreshCw, Activity, Crown, 
    Calendar, HelpCircle, Clock, AlertTriangle, Zap, Settings
} from 'lucide-react';
import { useNavigate } from '../../Router';

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
    const navigate = useNavigate();
    const [realStats, setRealStats] = useState<any>(null);
    const [allVipPlans, setAllVipPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');
    
    const [dateRange, setDateRange] = useState({
        from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    const [sim, setSim] = useState({
        users: 100,
        newUsersPerMonth: 30,
        churn: 5,
        growth: 0,
        fixedCosts: 1500,
        avgTicket: 150,
        planMix: {} as Record<string, number> 
    });

    // Filtro ultra-robusto para planes de Acceso Total (Heurística para planes sin campo "type")
    const accessPlans = useMemo(() => {
        if (!allVipPlans || !Array.isArray(allVipPlans)) return [];
        return allVipPlans.filter(p => {
            const pType = String(p.type || '').toUpperCase().trim();
            // Caso 1: Tiene el tipo explícito
            if (pType === 'ACCESS') return true;
            // Caso 2: Es un plan antiguo sin "type" pero con "durationDays" (es de acceso)
            if (!p.type && p.durationDays && Number(p.durationDays) > 0) return true;
            return false;
        });
    }, [allVipPlans]);

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
            
            let plans: VipPlan[] = [];
            const rawVip: any = settings?.vipPlans;
            if (Array.isArray(rawVip)) {
                plans = rawVip;
            } else if (typeof rawVip === 'string' && rawVip.trim().length > 2) {
                try { plans = JSON.parse(rawVip); } catch(e) { plans = []; }
            }

            setAllVipPlans(plans);

            // Inicializar el Mix de Ventas para el simulador usando la misma lógica heurística
            const initialMix: Record<string, number> = {};
            const accessOnly = plans.filter(p => {
                const pType = String(p.type || '').toUpperCase().trim();
                return pType === 'ACCESS' || (!p.type && p.durationDays && Number(p.durationDays) > 0);
            });
            
            accessOnly.forEach(p => { 
                initialMix[p.id] = rs?.planMix?.[p.name] || 0; 
            });

            setSim(prev => ({ 
                ...prev, 
                users: rs?.userCount || prev.users,
                avgTicket: rs?.averages?.arpu || prev.avgTicket,
                planMix: initialMix
            }));
        } catch(e) { 
            console.error("Analytics Load Error:", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, [dateRange]);

    const updateTicketFromMix = (newMix: Record<string, number>) => {
        let totalVal = 0;
        let totalQty = 0;
        accessPlans.forEach(p => {
            const qty = Number(newMix[p.id]) || 0;
            totalVal += (qty * p.price);
            totalQty += qty;
        });
        const calculatedTicket = totalQty > 0 ? totalVal / totalQty : 0;
        setSim(prev => ({ ...prev, planMix: newMix, avgTicket: parseFloat(calculatedTicket.toFixed(1)) }));
    };

    const updateMixFromTicket = (targetTicket: number) => {
        if (accessPlans.length === 0) return;

        const newMix: Record<string, number> = {};
        const totalSalesTarget = 100;
        const sortedPlans = [...accessPlans].sort((a, b) => a.price - b.price);
        const above = sortedPlans.filter(p => p.price >= targetTicket);
        const below = sortedPlans.filter(p => p.price < targetTicket).reverse();

        if (above.length > 0 && below.length > 0) {
            const pHigh = above[0];
            const pLow = below[0];
            const weightHigh = (targetTicket - pLow.price) / (pHigh.price - pLow.price);
            sortedPlans.forEach(p => {
                if (p.id === pHigh.id) newMix[p.id] = Math.round(totalSalesTarget * weightHigh);
                else if (p.id === pLow.id) newMix[p.id] = Math.round(totalSalesTarget * (1 - weightHigh));
                else newMix[p.id] = 0;
            });
        } else {
            const closest = sortedPlans.sort((a, b) => Math.abs(a.price - targetTicket) - Math.abs(b.price - targetTicket))[0];
            sortedPlans.forEach(p => {
                newMix[p.id] = (p.id === closest.id) ? totalSalesTarget : 0;
            });
        }
        setSim(prev => ({ ...prev, avgTicket: targetTicket, planMix: newMix }));
    };

    const syncRealMix = () => {
        if (!realStats) return;
        const realMix: Record<string, number> = {};
        accessPlans.forEach(p => { realMix[p.id] = realStats.planMix?.[p.name] || 0; });
        updateTicketFromMix(realMix);
    };

    const projection = useMemo(() => {
        let currentMonthlyRevenue = 0;
        let totalSalesInMix = 0;
        
        Object.entries(sim.planMix).forEach(([id, qty]) => {
            const plan = accessPlans.find(p => p.id === id);
            if (plan) {
                currentMonthlyRevenue += (Number(plan.price) * Number(qty));
                totalSalesInMix += Number(qty);
            }
        });

        if (totalSalesInMix === 0 && sim.avgTicket > 0) {
            currentMonthlyRevenue = sim.avgTicket * 10;
            totalSalesInMix = 10;
        }

        const breakEvenSales = currentMonthlyRevenue > 0 ? Math.ceil(sim.fixedCosts / (currentMonthlyRevenue / totalSalesInMix)) : 0;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;

        for (let i = 1; i <= 12; i++) {
            const losses = currentUsers * (sim.churn / 100);
            const growth = currentUsers * (sim.growth / 100) + sim.newUsersPerMonth;
            currentUsers = Math.max(0, currentUsers + growth - losses);
            
            const monthlyGross = currentMonthlyRevenue; 
            const netMonthlyProfit = monthlyGross - sim.fixedCosts;
            cumulativeNetProfit += netMonthlyProfit;
            data.push({ label: `M${i}`, revenue: Math.round(monthlyGross), profit: Math.round(netMonthlyProfit) });
        }
        
        return { 
            data, 
            totalProfit: cumulativeNetProfit, 
            breakEvenSales, 
            currentMonthlyRevenue,
            totalSalesInMix,
            netResult: currentMonthlyRevenue - sim.fixedCosts
        };
    }, [sim, accessPlans]);

    const renderChart = (points: any[], dataKey: string, color: string) => {
        if (!points || points.length < 2) return (
            <div className="flex items-center justify-center h-full text-slate-700 uppercase text-[10px] font-black tracking-widest">
                Datos insuficientes para graficar
            </div>
        );
        const values = points.map(p => Number(p[dataKey] || 0));
        const max = Math.max(...values, 100) * 1.2;
        const min = Math.min(...values, 0) * 1.2;
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

    const minPlanPrice = accessPlans.length > 0 ? Math.min(...accessPlans.map(p => p.price)) : 1;
    const maxPlanPrice = accessPlans.length > 0 ? Math.max(...accessPlans.map(p => p.price)) : 5000;

    if (loading) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-1">
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-[32px] shadow-xl gap-2">
                <div className="flex p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveView('REAL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Activity size={14}/> Historial Real
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Calculator size={14}/> Simulador de Metas
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
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Recaudación Periodo</div>
                            <div className="text-3xl font-black text-emerald-400">{(realStats?.totalRevenue || 0).toFixed(0)} $</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Ticket Medio Real</div>
                            <div className="text-3xl font-black text-white">{(realStats?.averages?.arpu || 0)} $</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Pagadores</div>
                            <div className="text-3xl font-black text-indigo-400">{(realStats?.activeUsers || 0)}</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Ventas Totales</div>
                            <div className="text-3xl font-black text-white">{(realStats?.averages?.totalTx || 0)}</div>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-10 shadow-2xl h-[400px] flex flex-col">
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Ingresos por Día ($)</h3>
                        <div className="flex-1 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50 relative">
                            {renderChart(realStats?.history?.daily || [], 'revenue', '#10b981')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-6 md:p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-3">
                                        <Crown size={18} className="text-amber-400"/>
                                        <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Mix de Membresías</h3>
                                    </div>
                                    <button onClick={syncRealMix} className="text-[8px] font-black text-indigo-400 hover:text-white uppercase flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 transition-all">
                                        <RefreshCw size={10}/> Sincronizar
                                    </button>
                                </div>
                                
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {accessPlans.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center gap-4 bg-slate-950/50 rounded-3xl border border-white/5 p-6">
                                            <Zap className="text-slate-700 animate-pulse" size={48}/>
                                            <p className="text-[10px] text-slate-500 italic uppercase tracking-widest leading-relaxed">No hay planes de "Acceso Total" definidos.</p>
                                            <button onClick={() => navigate('/admin/config')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-indigo-500 transition-all">
                                                <Settings size={12}/> Ir a Config
                                            </button>
                                        </div>
                                    ) : accessPlans.map(plan => (
                                        <div key={plan.id} className="bg-slate-950 p-4 rounded-3xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><Clock size={14}/></div>
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-black text-white truncate uppercase">{plan.name}</div>
                                                        <div className="text-[8px] font-bold text-slate-500 uppercase">${plan.price}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-600 uppercase">Vol:</span>
                                                    <input 
                                                        type="number" min="0" 
                                                        value={sim.planMix[plan.id] || 0}
                                                        onChange={e => {
                                                            const newMix = { ...sim.planMix, [plan.id]: parseInt(e.target.value) || 0 };
                                                            updateTicketFromMix(newMix);
                                                        }}
                                                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-xs font-black text-white text-center outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-6 pt-4 border-t border-slate-800">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase">Gastos Fijos Mensuales</label>
                                        <span className="text-sm font-black text-red-400">${sim.fixedCosts}</span>
                                    </div>
                                    <input type="range" min="100" max="10000" step="100" value={sim.fixedCosts} onChange={e => setSim({...sim, fixedCosts: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                                
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <div className="flex items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Objetivo</label>
                                            <InfoHint title="Ajuste de Mix" text="Cambia el ticket promedio y el sistema ajustará automáticamente las cantidades de cada plan para reflejar ese promedio de compra." />
                                        </div>
                                        <span className="text-sm font-black text-amber-400">${sim.avgTicket}</span>
                                    </div>
                                    <input 
                                        type="range" min={minPlanPrice} max={maxPlanPrice} step="1" 
                                        value={sim.avgTicket} 
                                        onChange={e => updateMixFromTicket(parseFloat(e.target.value))} 
                                        className="w-full accent-amber-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px]">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 relative z-10">
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Proyección de Rentabilidad</h3>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="bg-slate-950 px-5 py-3 rounded-3xl border border-white/5">
                                            <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Ingreso Mensual Est.</div>
                                            <div className="text-xl font-black text-emerald-400">${projection.currentMonthlyRevenue.toLocaleString()}</div>
                                        </div>
                                        <div className={`px-5 py-3 rounded-3xl border ${projection.netResult >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                            <div className="text-[9px] font-black uppercase mb-1 opacity-60">Pérdida/Ganancia</div>
                                            <div className={`text-xl font-black ${projection.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {projection.netResult >= 0 ? '+' : ''}{projection.netResult.toLocaleString()} $
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-5xl font-black ${projection.netResult >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{projection.breakEvenSales}</div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase mt-2">Ventas p/ Punto Equilibrio</div>
                                </div>
                            </div>
                            
                            <div className="flex-1 w-full bg-slate-950/30 rounded-[32px] p-8 border border-slate-800/50 mb-8 relative">
                                {projection.netResult < 0 && (
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase animate-pulse">
                                        <AlertTriangle size={14}/> Riesgo Operativo
                                    </div>
                                )}
                                {renderChart(projection.data, 'profit', (projection.netResult >= 0) ? '#10b981' : '#f43f5e')}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-800/50">
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Volumen Simulador</div>
                                    <div className="text-xl font-black text-white">{projection.totalSalesInMix}</div>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5">
                                    <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Ticket Promedio</div>
                                    <div className="text-xl font-black text-amber-400">${sim.avgTicket}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
