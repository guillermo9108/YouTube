
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { 
    Calculator, TrendingUp, Users, DollarSign, 
    RefreshCw, BarChart3, ShieldAlert, Activity, 
    ArrowRightLeft, Scale, PieChart, Landmark
} from 'lucide-react';

type Granularity = 'DAYS' | 'MONTHS';

export default function AdminAnalytics() {
    const [realStats, setRealStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Granularity>('DAYS');
    const [activeView, setActiveView] = useState<'REAL' | 'SIMULATOR'>('REAL');

    // --- ANALISTA FINANCIERO: MODELO ECONOMÍA CERRADA ---
    const [sim, setSim] = useState({
        users: 100,
        growth: 12,            // % Crecimiento neto mensual
        churn: 5,              // % Abandono (Estricto)
        conversion: 20,        // % Usuarios que pagan membresía
        
        // Variables Prompt Experto (Fijos Mensuales)
        contentInflow: 1400,   // $300*4 semanas + margen
        opCosts: 200,          // Luz/Servidor Local
        
        // Circularidad P2P
        p2pVolume: 15,         // $ promedio circulado entre usuarios/mes
        p2pCommission: 5,      // % Fee de red (Credita a Admin)
        reinvestmentRate: 70,  // % de saldo que vuelve a circular (Money Velocity)
        
        // Mix de Membresías (%)
        mix7d: 50,  // Precio: 5$
        mix14d: 30, // Precio: 9$
        mix31d: 20  // Precio: 18$
    });

    const PRICES = { d7: 5, d14: 9, d31: 18 };

    const loadData = async () => {
        setLoading(true);
        try {
            const rs = await db.request<any>('action=get_real_stats');
            setRealStats(rs);
            if (rs) setSim(prev => ({ ...prev, users: rs.userCount || 100 }));
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    // --- CÁLCULO DE PUNTO DE EQUILIBRIO (BREAK-EVEN) ---
    const projection = useMemo(() => {
        const steps = 12;
        const data = [];
        let currentUsers = sim.users;
        let cumulativeNetProfit = 0;
        const totalFixedCosts = sim.contentInflow + sim.opCosts; // $1,600

        for (let i = 1; i <= steps; i++) {
            // 1. Dinámica de Población
            const netMonthlyGrowth = (sim.growth - sim.churn) / 100;
            currentUsers = Math.max(0, currentUsers * (1 + netMonthlyGrowth));

            // 2. Ingresos por Membresías (Entrada Dinero Real)
            const payingUsers = currentUsers * (sim.conversion / 100);
            const rev7d = (payingUsers * (sim.mix7d / 100)) * PRICES.d7;
            const rev14d = (payingUsers * (sim.mix14d / 100)) * PRICES.d14;
            const rev31d = (payingUsers * (sim.mix31d / 100)) * PRICES.d31;
            const totalMembershipRev = rev7d + rev14d + rev31d;

            // 3. Ingresos por Economía Circular (P2P Network Fee)
            // Volume * Fee * % de saldo circulante
            const circulatingVolume = currentUsers * sim.p2pVolume;
            const p2pProfit = circulatingVolume * (sim.p2pCommission / 100) * (sim.reinvestmentRate / 100);

            // 4. Beneficio Neto Mensual
            const grossRevenue = totalMembershipRev + p2pProfit;
            const netMonthlyProfit = grossRevenue - totalFixedCosts;
            cumulativeNetProfit += netMonthlyProfit;

            data.push({
                label: `Mes ${i}`,
                users: Math.round(currentUsers),
                revenue: Math.round(grossRevenue),
                profit: Math.round(netMonthlyProfit),
                isBurn: netMonthlyProfit < 0
            });
        }

        // Break-even logic
        const arpuMem = ((sim.mix7d/100)*PRICES.d7 + (sim.mix14d/100)*PRICES.d14 + (sim.mix31d/100)*PRICES.d31) * (sim.conversion/100);
        const arpuP2P = sim.p2pVolume * (sim.p2pCommission/100) * (sim.reinvestmentRate/100);
        const breakEvenUsers = Math.ceil(totalFixedCosts / (arpuMem + arpuP2P));

        return { data, totalProfit: cumulativeNetProfit, breakEvenUsers, totalFixedCosts };
    }, [sim]);

    const renderChart = (points: any[], dataKey: string, color: string) => {
        if (!points || points.length < 2) return null;
        const values = points.map(p => Number(p[dataKey] || 0));
        const max = Math.max(...values.map(Math.abs), 100) * 1.2;
        const path = points.map((p, i) => {
            const x = (i / (points.length - 1)) * 100;
            const y = 50 - ((p[dataKey] / max) * 50);
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 px-2 max-w-7xl mx-auto">
            
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                <div className="flex gap-1 p-1 bg-slate-950 rounded-xl">
                    <button onClick={() => setActiveView('REAL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'REAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Métricas Reales
                    </button>
                    <button onClick={() => setActiveView('SIMULATOR')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        Simulador Pro
                    </button>
                </div>
            </div>

            {activeView === 'REAL' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Users className="text-blue-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Usuarios</div>
                            <div className="text-3xl font-black text-white">{realStats?.userCount}</div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Landmark className="text-emerald-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Red</div>
                            <div className="text-3xl font-black text-emerald-400">{realStats?.systemRevenue.toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <Activity className="text-purple-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Interno</div>
                            <div className="text-3xl font-black text-white">{realStats?.totalBalance.toFixed(0)} <span className="text-sm">$</span></div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl">
                            <ArrowRightLeft className="text-amber-500 mb-2" size={24}/>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ARPU Sistema</div>
                            <div className="text-3xl font-black text-amber-400">{(realStats?.systemRevenue / (realStats?.userCount || 1)).toFixed(2)} <span className="text-sm">$</span></div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden relative">
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Volumen de Recaudación Real</h3>
                        <div className="h-64 w-full bg-slate-950/20 rounded-3xl p-6 border border-slate-800/50">
                            {renderChart(timeframe === 'DAYS' ? realStats?.history?.daily : realStats?.history?.monthly, 'revenue', '#10b981')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Control Panel */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl space-y-8">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                                <Calculator size={22} className="text-indigo-400"/>
                                <h3 className="font-black text-white uppercase text-xs tracking-widest">Parámetros de Red</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gastos Operativos (Contenido + Luz)</label>
                                        <span className="text-sm font-black text-red-400">${sim.contentInflow + sim.opCosts}</span>
                                    </div>
                                    <input type="range" min="200" max="5000" step="100" value={sim.contentInflow + sim.opCosts} onChange={e => setSim({...sim, contentInflow: parseInt(e.target.value) - 200})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">Base: $1400 contenido + $200 luz</p>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Volumen Transaccional P2P</label>
                                        <span className="text-sm font-black text-indigo-400">${sim.p2pVolume}/usu</span>
                                    </div>
                                    <input type="range" min="0" max="100" step="5" value={sim.p2pVolume} onChange={e => setSim({...sim, p2pVolume: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                </div>

                                <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest"><PieChart size={14}/> Mix de Membresías</label>
                                    {[
                                        { label: '7 Días ($5)', key: 'mix7d', color: 'accent-emerald-500' },
                                        { label: '14 Días ($9)', key: 'mix14d', color: 'accent-blue-500' },
                                        { label: '31 Días ($18)', key: 'mix31d', color: 'accent-purple-500' }
                                    ].map(m => (
                                        <div key={m.key}>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                <span>{m.label}</span>
                                                <span className="text-white">{(sim as any)[m.key]}%</span>
                                            </div>
                                            <input type="range" min="0" max="100" value={(sim as any)[m.key]} onChange={e => setSim({...sim, [m.key]: parseInt(e.target.value)})} className={`w-full ${m.color} h-1 bg-slate-800 rounded-full appearance-none cursor-pointer`} />
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa de Reinversión de Saldo</label>
                                        <span className="text-sm font-black text-emerald-400">{sim.reinvestmentRate}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={sim.reinvestmentRate} onChange={e => setSim({...sim, reinvestmentRate: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">Saldo que vuelve a circular vs estancado</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Result Display */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Proyección de Economía Cerrada</h3>
                                    <p className="text-sm text-slate-500">Estimación de rentabilidad neta tras absorber gastos de $1,600.</p>
                                </div>
                                <div className={`text-right px-8 py-5 rounded-[24px] border backdrop-blur-md shadow-2xl ${projection.totalProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <div className={`text-4xl font-black ${projection.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projection.totalProfit >= 0 ? '+' : ''}{Math.round(projection.totalProfit).toLocaleString()}$
                                    </div>
                                    <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">EBITDA ANUAL PROYECTADO</div>
                                </div>
                            </div>

                            <div className="h-64 w-full bg-slate-950/30 rounded-3xl p-6 border border-slate-800/50">
                                {renderChart(projection.data, 'profit', '#6366f1')}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-slate-800 text-center">
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Punto de Equilibrio</div>
                                    <div className="text-xl font-black text-white">{projection.breakEvenUsers} <span className="text-[10px] text-indigo-400">Usu</span></div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Meta Supervivencia</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Revenue M12</div>
                                    <div className="text-xl font-black text-emerald-400">${Math.round(projection.data[11].revenue)}</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Ingresos Totales</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Leakage Rate</div>
                                    <div className="text-xl font-black text-red-400">{100 - sim.reinvestmentRate}%</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Saldo Estancado</div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Población M12</div>
                                    <div className="text-xl font-black text-white">{projection.data[11].users.toLocaleString()}</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Red Proyectada</div>
                                </div>
                            </div>
                        </div>

                        {projection.breakEvenUsers > sim.users * 3 && (
                            <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-[32px] flex items-center gap-6 animate-pulse shadow-xl shadow-red-950/20">
                                <ShieldAlert className="text-red-500 shrink-0" size={40}/>
                                <div>
                                    <h4 className="text-sm font-black text-red-500 uppercase tracking-widest">Meta de Supervivencia Alta</h4>
                                    <p className="text-xs text-red-400/80 leading-relaxed">Con los costos operativos de $1,600, el sistema necesita triplicar la base de usuarios o incentivar más el volumen P2P para no agotar el capital de inyección semanal.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
