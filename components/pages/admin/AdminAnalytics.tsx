import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { 
    Calculator, Database, TrendingUp, TrendingDown, 
    Users, DollarSign, ArrowUpRight, ArrowDownRight, 
    Calendar, Clock, RefreshCw, BarChart3, PieChart,
    Target, ShieldAlert, Activity, LayoutDashboard,
    Zap, Receipt, Landmark, ArrowRightLeft, Scale
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

export default function AdminAnalytics() {
    const [settings, setSettings] = useState<any>(null);
    const [realStats, setRealStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');

    // --- EXPERT FINANCIAL SIMULATOR STATE ---
    const [sim, setSim] = useState({
        users: 100,
        growth: 12,           // % Crecimiento mensual
        churn: 8,             // % Abandono (Estricto)
        conversion: 25,       // % Usuarios que compran algo al mes
        
        // Operativa (Basado en Prompt Experto)
        opCosts: 1600,        // Contenido ($300*4) + Luz ($200) + Margen
        p2pVolumePerUser: 15, // Cuánto saldo intercambian los usuarios entre sí mensualmente
        p2pCommission: 20,    // % que retiene la plataforma por venta entre usuarios
        
        // Mix de Membresías (Distribución de ventas)
        mix7d: 50,            // % usuarios prefieren 7 días
        mix14d: 30,           // % usuarios prefieren 14 días
        mix31d: 20,           // % usuarios prefieren 31 días
        
        // Economía Cerrada
        reinvestmentRate: 70, // % del saldo que vuelve a circular
        gatewayFee: 4         // % costo entrada capital real
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

    // --- CLOSED ECONOMY MATHEMATICAL ENGINE ---
    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;

        // Precios estimados de membresías basados en mercado (en Saldo)
        const price7d = 5;
        const price14d = 8;
        const price31d = 15;

        for (let i = 1; i <= steps; i++) {
            // 1. Dinámica de Población
            const netGrowth = (sim.growth - sim.churn) / 100;
            currentUsers = Math.max(0, currentUsers * (1 + netGrowth));

            // 2. Ingresos por Membresías (Entrada de Capital)
            const payingUsers = currentUsers * (sim.conversion / 100);
            const rev7d = (payingUsers * (sim.mix7d / 100)) * price7d;
            const rev14d = (payingUsers * (sim.mix14d / 100)) * price14d;
            const rev31d = (payingUsers * (sim.mix31d / 100)) * price31d;
            const totalMembershipRev = rev7d + rev14d + rev31d;

            // 3. Ingresos P2P (Comisiones por circulación de saldo)
            // Volumen P2P total = (Usuarios activos * Volumen/Usuario)
            const totalP2PVolume = currentUsers * sim.p2pVolumePerUser;
            const p2pCommissionRev = totalP2PVolume * (sim.p2pCommission / 100);

            // 4. Lógica de "Saldo Estancado" (Economy Leakage)
            // Solo una parte del capital circulante genera comisiones recurrentes
            const circulatingRevenue = p2pCommissionRev * (sim.reinvestmentRate / 100);

            // 5. Egresos Reales (Cash-Out y Operativos)
            const gatewayCost = totalMembershipRev * (sim.gatewayFee / 100);
            const totalOutflow = sim.opCosts + gatewayCost;

            const grossRevenue = totalMembershipRev + circulatingRevenue;
            const netMonthlyProfit = grossRevenue - totalOutflow;
            
            cumulativeNetProfit += netMonthlyProfit;

            data.push({
                label: i === 1 ? 'Ene' : i === 2 ? 'Feb' : i === 3 ? 'Mar' : i === 4 ? 'Abr' : i === 5 ? 'May' : i === 6 ? 'Jun' : i === 7 ? 'Jul' : i === 8 ? 'Ago' : i === 9 ? 'Sep' : i === 10 ? 'Oct' : i === 11 ? 'Nov' : 'Dic',
                users: Math.round(currentUsers),
                revenue: Math.round(grossRevenue),
                cost: Math.round(totalOutflow),
                profit: Math.round(netMonthlyProfit),
                isBurn: netMonthlyProfit < 0
            });
        }

        // Punto de Equilibrio (Break-even): Usuarios necesarios para profit = 0
        // Formula simplificada: OpCosts / (ARPU_Suscrip + ARPU_P2P)
        const arpuSuscrip = ((sim.mix7d/100)*price7d + (sim.mix14d/100)*price14d + (sim.mix31d/100)*price31d) * (sim.conversion/100);
        const arpuP2P = sim.p2pVolumePerUser * (sim.p2pCommission/100);
        const breakEvenUsers = sim.opCosts / (arpuSuscrip + arpuP2P);

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers: Math.round(breakEvenUsers) };
    }, [sim]);

    const renderChart = (points: any[], dataKey: string, color: string, colorArea: string) => {
        if (!points || points.length < 2) return null;
        const values = points.map(p => Number(p[dataKey] || 0));
        const minVal = Math.min(...values, 0);
        const maxVal = Math.max(...values, 100);
        const range = maxVal - minVal;

        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 100 - (((Number(p[dataKey]) - minVal) / (range || 1)) * 100);
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
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500" size={40}/></div>;

    const currentHistory = timeframe === 'DAYS' ? realStats?.history?.daily : realStats?.history?.monthly;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-2 max-w-7xl mx-auto">
            
            {/* Header / Mode Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-2 rounded-3xl border border-slate-800 backdrop-blur-xl sticky top-2 z-40 shadow-2xl">
                <div className="flex gap-1 p-1 bg-slate-950 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveView('REAL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Métricas Reales
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Simulador Financiero
                    </button>
                </div>
                
                {activeView === 'REAL' && (
                    <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                        <button onClick={() => setTimeframe('DAYS')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeframe === 'DAYS' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}>Días</button>
                        <button onClick={() => setTimeframe('MONTHS')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeframe === 'MONTHS' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}>Meses</button>
                    </div>
                )}
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    {/* Real Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
                            <Users className="text-blue-500 mb-3" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Población Activa</div>
                            <div className="text-3xl font-black text-white">{realStats?.userCount}</div>
                        </div>
                        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
                            <Landmark className="text-emerald-500 mb-3" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Recaudado</div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.systemRevenue.toFixed(0)} <span className="text-sm font-bold">$</span></div>
                        </div>
                        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
                            <Activity className="text-purple-500 mb-3" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo en Billeteras</div>
                            <div className="text-3xl font-black text-white">{realStats?.totalBalance.toFixed(0)} <span className="text-sm font-bold">$</span></div>
                        </div>
                        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
                            <ArrowRightLeft className="text-amber-500 mb-3" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ARPU de Red</div>
                            <div className="text-3xl font-black text-amber-400">{(realStats?.systemRevenue / (realStats?.userCount || 1)).toFixed(2)} <span className="text-sm font-bold">$</span></div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Rendimiento Histórico</h3>
                                <p className="text-sm text-slate-500">Volumen de ingresos operativos del sistema.</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                                <TrendingUp className="text-emerald-500" size={16}/>
                                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Revenue Real</span>
                            </div>
                        </div>

                        <div className="relative h-80 w-full border-b border-l border-slate-800 bg-slate-950/30 rounded-bl-3xl p-4">
                            {(!currentHistory || currentHistory.length === 0) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20">
                                    <BarChart3 size={64} className="mb-4 text-indigo-500"/>
                                    <span className="text-xs font-bold uppercase tracking-widest">Aún no hay suficientes datos históricos</span>
                                </div>
                            ) : (
                                renderChart(currentHistory, 'revenue', '#10b981', '#10b981')
                            )}
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-600 mt-6 uppercase tracking-widest px-2">
                            <span>{timeframe === 'DAYS' ? 'Incio de Ciclo' : 'Incio de Año'}</span>
                            <span className="text-indigo-400">Hoy</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Simulator Inputs */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-xl h-fit space-y-8">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                                <Calculator size={22} className="text-indigo-400"/>
                                <h3 className="font-black text-white uppercase text-sm tracking-widest">Lógica de Negocio</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastos Operativos (Contenido + Luz)</label>
                                        <span className="text-xs font-black text-red-400">${sim.opCosts}</span>
                                    </div>
                                    <input type="range" min="200" max="5000" step="100" value={sim.opCosts} onChange={e => setSim({...sim, opCosts: parseInt(e.target.value)})} className="w-full accent-red-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    <p className="text-[9px] text-slate-600 mt-1 uppercase italic font-bold">Base: $1,400 contenido + $200 luz</p>
                                </div>

                                <div className="bg-indigo-500/5 p-4 rounded-3xl border border-indigo-500/20">
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Volumen Transaccional P2P</label>
                                        <span className="text-xs font-black text-white">${sim.p2pVolumePerUser}/usu</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={sim.p2pVolumePerUser} onChange={e => setSim({...sim, p2pVolumePerUser: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold">Compra/Venta entre usuarios</p>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mix de Membresías (Distribución)</label>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Paquete 7 Días', key: 'mix7d', color: 'accent-emerald-500' },
                                            { label: 'Paquete 14 Días', key: 'mix14d', color: 'accent-blue-500' },
                                            { label: 'Paquete 31 Días', key: 'mix31d', color: 'accent-purple-500' }
                                        ].map(item => (
                                            <div key={item.key}>
                                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                                    <span className="text-slate-300">{item.label}</span>
                                                    <span className="text-white">{(sim as any)[item.key]}%</span>
                                                </div>
                                                <input type="range" min="0" max="100" value={(sim as any)[item.key]} onChange={e => setSim({...sim, [item.key]: parseInt(e.target.value)})} className={`w-full ${item.color} h-1 bg-slate-800 rounded-full appearance-none cursor-pointer`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-800"></div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasa de Reinversión de Saldo</label>
                                        <span className="text-xs font-black text-emerald-400">{sim.reinvestmentRate}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={sim.reinvestmentRate} onChange={e => setSim({...sim, reinvestmentRate: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulator Results */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Proyección de Economía Cerrada</h3>
                                    <p className="text-sm text-slate-500">Fórmula: [Revenue Suscrip. + (P2P Vol. * Fee * %Reinversión)] - OpCosts</p>
                                </div>
                                <div className={`text-right px-8 py-5 rounded-3xl border backdrop-blur-md shadow-2xl ${projection.totalProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <div className={`text-4xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()}$
                                    </div>
                                    <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">EBITDA ANUAL ESTIMADO</div>
                                </div>
                            </div>

                            <div className="relative h-72 w-full border-b border-l border-slate-800 bg-slate-950/20 rounded-bl-3xl">
                                {renderChart(projection.data, 'profit', '#6366f1', '#6366f1')}
                                <div className="absolute left-0 right-0 border-t border-slate-800 border-dashed top-1/2 pointer-events-none"></div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-slate-800 text-center">
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Punto de Equilibrio</div>
                                    <div className="text-xl font-black text-white">{projection.breakEvenUsers} <span className="text-[10px] text-indigo-400">Usuarios</span></div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase">Meta de supervivencia</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Ingresos P2P (M12)</div>
                                    <div className="text-xl font-black text-emerald-400">{Math.round(projection.data[11].users * sim.p2pVolumePerUser * (sim.p2pCommission/100))}$</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase">Solo por comisiones</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Membresías (M12)</div>
                                    <div className="text-xl font-black text-white">{Math.round(projection.data[11].revenue)}$</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase">Entrada Capital Nuevo</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Leakage (Fuga)</div>
                                    <div className="text-xl font-black text-red-400">{100 - sim.reinvestmentRate}%</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase">Saldo estancado</div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Warning */}
                        {projection.breakEvenUsers > sim.users * 2 && (
                            <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl flex items-center gap-5 animate-pulse shadow-xl shadow-red-950/20">
                                <ShieldAlert className="text-red-500 shrink-0" size={32}/>
                                <div>
                                    <h4 className="text-sm font-black text-red-500 uppercase tracking-tighter">Inviabilidad del Modelo Actual</h4>
                                    <p className="text-xs text-red-400/80 leading-relaxed">El volumen de transacciones P2P y la tasa de conversión no alcanzan para pagar los $1,600 de costos operativos. Necesitas triplicar tu base de usuarios o subir la comisión por venta.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
