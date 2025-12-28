import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { 
    Calculator, Database, TrendingUp, TrendingDown, 
    Users, DollarSign, ArrowUpRight, ArrowDownRight, 
    Calendar, Clock, RefreshCw, BarChart3, PieChart,
    Target, ShieldAlert, Activity, LayoutDashboard
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

export default function AdminAnalytics() {
    const [settings, setSettings] = useState<any>(null);
    const [realStats, setRealStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');

    // --- Simulator State (Strict Mode) ---
    const [sim, setSim] = useState({
        users: 100,
        growth: 15,     // % crecimiento
        churn: 5,       // % abandono (Estricto)
        conversion: 20, // % usuarios que pagan
        avgTicket: 50,  // Cuánto gasta cada usuario pagador
        adminDirectSales: 10, // Ventas propias por 100 usuarios
        fixedCost: 150, // Servidor, dominio, etc
        storageCostGb: 0.10, // Costo por GB
        contentInflow: 50,   // GB de contenido nuevo al mes
        paymentGatewayFee: 4 // % que se queda Tropipay/otros
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, rs] = await Promise.all([
                db.getSystemSettings(),
                db.request<any>('action=get_real_stats')
            ]);
            setSettings(s);
            setRealStats(rs);
            if (rs) {
                setSim(prev => ({ ...prev, users: rs.userCount || 100 }));
            }
        } catch(e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- STRICT PROJECTION ALGORITHM ---
    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let totalStorage = sim.contentInflow;
        let cumulativeNetProfit = 0;

        const platformFee = (settings?.videoCommission || 20) / 100;

        for (let i = 1; i <= steps; i++) {
            // Lógica de Población: Crecimiento neto (Entradas - Salidas)
            const newUsers = currentUsers * (sim.growth / 100);
            const lostUsers = currentUsers * (sim.churn / 100);
            currentUsers = Math.max(0, currentUsers + newUsers - lostUsers);

            // Lógica de Ingresos (Bruto)
            const payingUsers = currentUsers * (sim.conversion / 100);
            const depositVolume = payingUsers * sim.avgTicket;
            
            // Ingresos reales para el Admin (Comisiones + Ventas Directas)
            const adminSalesVolume = (currentUsers / 100) * sim.adminDirectSales * (sim.avgTicket * 1.5);
            const commissionsVolume = (depositVolume * 0.8) * platformFee; // Asumimos que el 80% del saldo se gasta
            
            const grossRevenue = adminSalesVolume + commissionsVolume;
            
            // Deducción de Pasarela (Dinero real que llega al banco)
            const gatewayCost = depositVolume * (sim.paymentGatewayFee / 100);
            
            // Lógica de Costos Operativos
            totalStorage += sim.contentInflow;
            const storageCost = totalStorage * sim.storageCostGb;
            const variableCost = currentUsers * 0.05; // Costo marginal por usuario (soporte, etc)
            const totalMonthlyCost = sim.fixedCost + storageCost + variableCost;

            const netMonthlyProfit = grossRevenue - totalMonthlyCost - gatewayCost;
            cumulativeNetProfit += netMonthlyProfit;

            data.push({
                label: `T+${i}`,
                users: Math.round(currentUsers),
                revenue: Math.round(grossRevenue),
                cost: Math.round(totalMonthlyCost),
                profit: Math.round(netMonthlyProfit),
                isBurn: netMonthlyProfit < 0
            });
        }
        return { data, totalProfit: cumulativeNetProfit };
    }, [sim, settings]);

    // --- Chart Render Helper ---
    const renderChart = (points: any[], dataKey: string, color: string, colorArea: string) => {
        if (!points || points.length < 2) return null;
        const max = Math.max(...points.map(p => Number(p[dataKey] || 0))) * 1.2 || 100;
        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 100 - ((Number(p[dataKey]) / max) * 100);
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${dataKey}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={colorArea} stopOpacity="0.4"/>
                        <stop offset="100%" stopColor={colorArea} stopOpacity="0"/>
                    </linearGradient>
                </defs>
                <path d={`M0,100 ${path.split(' ').map(p => 'L'+p).join(' ')} L100,100 Z`} fill={`url(#grad-${dataKey})`} />
                <polyline points={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500" size={40}/></div>;

    const currentHistory = timeframe === 'DAYS' ? realStats?.history?.daily : realStats?.history?.monthly;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-2 max-w-7xl mx-auto">
            
            {/* Nav / Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
                <div className="flex gap-1 p-1 bg-slate-950 rounded-xl">
                    <button onClick={() => setActiveView('REAL')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Métricas Reales
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Simulador Predictivo
                    </button>
                </div>
                
                {activeView === 'REAL' && (
                    <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                        <button onClick={() => setTimeframe('DAYS')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeframe === 'DAYS' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}>30 Días</button>
                        <button onClick={() => setTimeframe('MONTHS')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeframe === 'MONTHS' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}>12 Meses</button>
                    </div>
                )}
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    {/* Real KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                            <Users className="text-blue-500 mb-2" size={20}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base de Usuarios</div>
                            <div className="text-3xl font-black text-white">{realStats?.userCount}</div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                            <DollarSign className="text-emerald-500 mb-2" size={20}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recaudación Real</div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.systemRevenue.toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                            <Activity className="text-purple-500 mb-2" size={20}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Circulante</div>
                            <div className="text-3xl font-black text-white">{realStats?.totalBalance.toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                            <Target className="text-amber-500 mb-2" size={20}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ARPU Histórico</div>
                            <div className="text-3xl font-black text-amber-400">{(realStats?.systemRevenue / (realStats?.userCount || 1)).toFixed(2)} <span className="text-sm">$</span></div>
                        </div>
                    </div>

                    {/* Historical Chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Histórico de Ingresos</h3>
                                <p className="text-xs text-slate-500">Métricas basadas en transacciones confirmadas del servidor.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative h-72 w-full border-b border-l border-slate-800 bg-slate-950/20 rounded-bl-lg">
                            {(!currentHistory || currentHistory.length === 0) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                                    <BarChart3 size={48} className="mb-2"/>
                                    <span className="text-xs font-bold uppercase tracking-widest">Sin datos suficientes aún</span>
                                </div>
                            ) : (
                                renderChart(currentHistory, 'revenue', '#10b981', '#10b981')
                            )}
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-slate-600 mt-3 uppercase tracking-widest">
                            <span>{timeframe === 'DAYS' ? 'Hace 30 días' : 'Hace 12 meses'}</span>
                            <span>Hoy</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Simulator Sliders */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl h-fit space-y-6">
                            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Calculator size={18} className="text-indigo-400"/>
                                <h3 className="font-black text-white uppercase text-sm tracking-tighter">Parámetros Estrictos</h3>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Crecimiento Mensual</label>
                                        <span className="text-[10px] font-black text-indigo-400">+{sim.growth}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={sim.growth} onChange={e => setSim({...sim, growth: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div className="bg-red-500/5 p-3 rounded-xl border border-red-900/20">
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">Churn Rate (Abandono)</label>
                                        <span className="text-[10px] font-black text-red-400">-{sim.churn}%</span>
                                    </div>
                                    <input type="range" min="0" max="50" value={sim.churn} onChange={e => setSim({...sim, churn: parseInt(e.target.value)})} className="w-full accent-red-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa de Conversión</label>
                                        <span className="text-[10px] font-black text-emerald-400">{sim.conversion}%</span>
                                    </div>
                                    <input type="range" min="1" max="100" value={sim.conversion} onChange={e => setSim({...sim, conversion: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingreso Promedio ($)</label>
                                        <span className="text-[10px] font-black text-white">{sim.avgTicket}$</span>
                                    </div>
                                    <input type="range" min="1" max="500" value={sim.avgTicket} onChange={e => setSim({...sim, avgTicket: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div className="h-px bg-slate-800"></div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Costos Fijos (Server)</label>
                                        <span className="text-[10px] font-black text-red-400">{sim.fixedCost}$</span>
                                    </div>
                                    <input type="range" min="0" max="2000" step="50" value={sim.fixedCost} onChange={e => setSim({...sim, fixedCost: parseInt(e.target.value)})} className="w-full accent-red-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Results */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
                            <div className="relative z-10 flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Proyección Financiera</h3>
                                    <p className="text-xs text-slate-500">Estimación estricta a 12 meses considerando pérdidas por Churn.</p>
                                </div>
                                <div className={`text-right px-4 py-3 rounded-2xl border backdrop-blur-sm ${projection.totalProfit >= 0 ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-red-900/20 border-red-500/20'}`}>
                                    <div className={`text-3xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()}$
                                    </div>
                                    <div className="text-[10px] font-black opacity-60 uppercase tracking-widest">Beneficio Neto Anual</div>
                                </div>
                            </div>

                            <div className="relative h-64 w-full border-b border-l border-slate-800 bg-slate-950/20 rounded-bl-lg">
                                {/* Profit Line Chart */}
                                {renderChart(projection.data, 'profit', '#6366f1', '#6366f1')}
                                
                                {/* 0 Baseline */}
                                <div className="absolute left-0 right-0 border-t border-slate-800 border-dashed top-1/2 pointer-events-none"></div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-800 text-center">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Usuarios (Mes 12)</div>
                                    <div className="text-xl font-black text-white">{projection.data[11].users.toLocaleString()}</div>
                                    <div className="text-[9px] text-slate-600 font-bold">Base proyectada</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Ingresos (Mes 12)</div>
                                    <div className="text-xl font-black text-emerald-400">{projection.data[11].revenue.toLocaleString()}$</div>
                                    <div className="text-[9px] text-slate-600 font-bold">Volumen mensual</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">LTV Estimado</div>
                                    <div className="text-xl font-black text-indigo-400">{(sim.avgTicket * (sim.conversion/100) * (1 / (sim.churn/100 || 1))).toFixed(2)}$</div>
                                    <div className="text-[9px] text-slate-600 font-bold">Valor de vida cliente</div>
                                </div>
                            </div>
                        </div>

                        {/* Critical Warnings */}
                        {projection.data.some(d => d.isBurn) && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                                <ShieldAlert className="text-amber-500 shrink-0" size={24}/>
                                <div>
                                    <h4 className="text-sm font-black text-amber-500 uppercase tracking-tighter">Punto de Pérdida Detectado</h4>
                                    <p className="text-xs text-amber-600/80">Bajo estos parámetros, el costo operativo supera a los ingresos en los primeros meses. Considera subir la Tasa de Conversión o reducir Costos Fijos.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
