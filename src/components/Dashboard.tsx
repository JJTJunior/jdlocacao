import React, { useState, useEffect } from 'react';
import { Package, Users, ClipboardList, Wrench, TrendingUp, TrendingDown, DollarSign, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { formatSafeDate } from '../lib/dateUtils';

interface DashboardProps {
  userId?: string;
  onNavigate?: (tab: string, search?: string, subTab?: string) => void;
}

export function Dashboard({ userId, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    equipments: 0,
    customers: 0,
    activeRentals: 0,
    maintenance: 0,
    monthRevenue: 0,
    monthForecast: 0,
    nextMonthRevenue: 0,
    monthExpense: 0,
    yearBalance: 0,
    chartData: [] as any[],
    recentOrders: [] as any[],
    returnsToday: 0,
    returnsNext3Days: 0,
    returnsLate: 0,
    returnsThisWeek: [] as any[],
    returnsNextWeek: [] as any[],
    returnsFuture: [] as any[],
    equipmentStock: [] as any[]
  });

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      setLoading(true);
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const currentYear = `${now.getFullYear()}`;
      const todayStr = now.toLocaleDateString('en-CA');
      const threeDaysStr = new Date(now.getTime() + 3 * 86400000).toLocaleDateString('en-CA');
      const sevenDaysStr = new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-CA');
      const fourteenDaysStr = new Date(now.getTime() + 14 * 86400000).toLocaleDateString('en-CA');

      // 1. Equipments
      const { data: equipments } = await supabase.from('equipments').select('*').eq('user_id', userId);
      // 2. Customers
      const { count: customersCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      // 3. Orders
      const { data: orders } = await supabase.from('orders').select('*').eq('user_id', userId);
      // 4. Transactions
      const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId);
      // 5. Maintenances
      const { data: maintenances } = await supabase.from('maintenance').select('*').eq('user_id', userId);

      const eqList = equipments || [];
      const ordList = orders || [];
      const trList = transactions || [];
      const maintList = maintenances || [];

      console.log('Dashboard Data Load:', {
        equipments: eqList.length,
        orders: ordList.length,
        rentedOrders: ordList.filter(o => o.status === 'rented').length,
        transactions: trList.length
      });

      const combinedTrans = [
        ...trList,
        ...maintList.filter((m: any) => m.cost > 0).map((m: any) => ({
          date: m.start_date,
          type: 'expense',
          amount: m.cost
        }))
      ];

      // Calculate stats
      const totalEquipments = eqList.reduce((sum, eq) => sum + ((eq.stock_available || 0) + (eq.stock_rented || 0) + (eq.stock_maintenance || 0)), 0);
      const totalRented = ordList.filter(o => o.status === 'rented').length;
      const totalMaintenance = eqList.reduce((sum, eq) => sum + (eq.stock_maintenance || 0), 0);

      // Legacy fallback: orders that are completed but don't have a tracking transaction
      const legacyOrders = ordList.filter(o => 
        o.status === 'completed' && 
        !trList.some(t => t.category === 'Aluguel' && t.description.includes(`(Contrato: ${o.contract_number || 'S/N'})`))
      );

      // Paid Transactions for Current Month
      const monthRevPaid = trList
        .filter(t => t.type === 'income' && t.status === 'paid' && t.date && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Pending Transactions for Current Month (Forecast)
      const monthRevPending = trList
        .filter(t => t.type === 'income' && t.status === 'pending' && t.date && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const monthRev = monthRevPaid +
        legacyOrders.filter(o => o.end_date && o.end_date.startsWith(currentMonth))
        .reduce((sum, o) => sum + Number(o.total_amount), 0);
      
      const monthExp = [
        ...trList.filter(t => t.type === 'expense' && t.status === 'paid' && t.date && t.date.startsWith(currentMonth)),
        ...maintList.filter((m: any) => m.status === 'completed' && m.cost > 0 && (m.end_date || m.start_date).startsWith(currentMonth))
      ].reduce((sum, item) => sum + Number(item.amount || item.cost), 0);
      
      // Next Month Forecast: Anything scheduled or rented orders returning next month
      const nextMonthRentalsRev = ordList
        .filter(o => o.status === 'rented' && o.end_date && o.end_date.startsWith(nextMonthStr))
        .reduce((sum, o) => sum + Number(o.total_amount), 0);
        
      const nextMonthScheduledRev = trList
        .filter(t => t.type === 'income' && t.date && t.date.startsWith(nextMonthStr))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      console.log('Finance debug:', {
        currentMonth,
        nextMonthStr,
        monthRevPaid,
        monthRevPending,
        nextMonthRentalsRev,
        nextMonthScheduledRev
      });
      const nextMonthRev = nextMonthRentalsRev + nextMonthScheduledRev;
      
      const yearInc = trList
        .filter(t => t.type === 'income' && (t.status === 'paid' || t.status === 'pending') && t.date && t.date.startsWith(currentYear))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0) + 
        legacyOrders.filter(o => o.end_date && o.end_date.startsWith(currentYear))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const yearExp = [
        ...trList.filter(t => t.type === 'expense' && t.status === 'paid' && t.date && t.date.startsWith(currentYear)),
        ...maintList.filter((m: any) => m.status === 'completed' && m.cost > 0 && (m.end_date || m.start_date).startsWith(currentYear)).map(m => ({ amount: m.cost }))
      ].reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Chart Data (Concluded only)
      const cData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const name = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3)}/${String(d.getFullYear()).slice(-2)}`;
        
        const income = trList
          .filter(t => t.type === 'income' && t.status === 'paid' && t.date && t.date.startsWith(key))
          .reduce((s, t) => s + Number(t.amount), 0) + 
          legacyOrders.filter(o => o.end_date && o.end_date.startsWith(key))
          .reduce((s, o) => s + Number(o.total_amount), 0);

        const expense = [
          ...trList.filter(t => t.type === 'expense' && t.status === 'paid' && t.date && t.date.startsWith(key)),
          ...maintList.filter((m: any) => m.status === 'completed' && m.cost > 0 && (m.end_date || m.start_date).startsWith(key)).map(m => ({ amount: m.cost }))
        ].reduce((s, t) => s + Number(t.amount), 0);

        return { name, Receita: income, Despesa: expense };
      });

      // Returns
      const rentedOrders = ordList.filter(o => o.status === 'rented');
      const returnsToday = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) === todayStr).length;
      const returnsNext3Days = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) > todayStr && o.end_date.slice(0, 10) <= threeDaysStr).length;
      const returnsLate = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) < todayStr).length;
      const returnsThisWeekList = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) >= todayStr && o.end_date.slice(0, 10) <= sevenDaysStr);
      const returnsNextWeekList = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) > sevenDaysStr && o.end_date.slice(0, 10) <= fourteenDaysStr);
      const returnsFutureList = rentedOrders.filter(o => o.end_date && o.end_date.slice(0, 10) > fourteenDaysStr);

      // Equipment Stock
      const stock = eqList.map(eq => {
        return {
          name: eq.name,
          category: eq.category,
          disp: eq.stock_available || 0,
          alug: eq.stock_rented || 0,
          maint: eq.stock_maintenance || 0
        };
      }).slice(0, 4); // Show top 4

      setStats({
        equipments: totalEquipments,
        customers: customersCount || 0,
        activeRentals: totalRented,
        maintenance: totalMaintenance,
        monthRevenue: monthRev,
        monthForecast: monthRevPending,
        nextMonthRevenue: nextMonthRev,
        monthExpense: monthExp,
        yearBalance: yearInc - yearExp,
        chartData: cData,
        recentOrders: ordList.sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 5),
        returnsToday,
        returnsNext3Days,
        returnsLate,
        returnsThisWeek: returnsThisWeekList.sort((a,b) => a.end_date.localeCompare(b.end_date)),
        returnsNextWeek: returnsNextWeekList.sort((a,b) => a.end_date.localeCompare(b.end_date)),
        returnsFuture: returnsFutureList.sort((a,b) => a.end_date.localeCompare(b.end_date)),
        equipmentStock: stock
      });

      setLoading(false);
    };

    loadData();
  }, [userId]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const todayStr = new Date().toLocaleDateString('en-CA');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
      </div>

      {/* Row 1: 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate?.('equipamentos')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
        >
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors"><Package className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{stats.equipments}</p><p className="text-xs text-slate-500">Equipamentos</p></div>
        </div>
        <div 
          onClick={() => onNavigate?.('clientes')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors"><Users className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{stats.customers}</p><p className="text-xs text-slate-500">Clientes</p></div>
        </div>
        <div 
          onClick={() => onNavigate?.('pedidos')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors"><ClipboardList className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{stats.activeRentals}</p><p className="text-xs text-slate-500">Aluguéis Ativos</p></div>
        </div>
        <div 
          onClick={() => onNavigate?.('manutencao')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-red-200 transition-all group"
        >
          <div className="p-3 rounded-lg bg-red-50 text-red-600 group-hover:bg-red-100 transition-colors"><Wrench className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{stats.maintenance}</p><p className="text-xs text-slate-500">Em Manutenção</p></div>
        </div>
      </div>

      {/* Row 2: Finance metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate?.('financeiro')}
          className="bg-emerald-600 rounded-xl shadow-sm border border-emerald-700 p-4 text-white cursor-pointer hover:bg-emerald-700 hover:shadow-md hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium">Receita Realizada (Mês)</span></div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold mb-1">{fmt(stats.monthRevenue)}</p>
            {stats.monthForecast > 0 && (
              <p className="text-[10px] opacity-75 font-medium italic">+ {fmt(stats.monthForecast)} a receber</p>
            )}
          </div>
        </div>
        
        <div 
          onClick={() => onNavigate?.('pedidos')}
          className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-100 p-4 text-emerald-800 cursor-pointer hover:bg-emerald-100 hover:shadow-md hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium text-emerald-700">Previsão Receita Próx. Mês</span></div>
          <p className="text-2xl font-bold mb-1 text-emerald-700">{fmt(stats.nextMonthRevenue)}</p>
        </div>

        <div 
          onClick={() => onNavigate?.('financeiro')}
          className="bg-red-500 rounded-xl shadow-sm border border-red-600 p-4 text-white cursor-pointer hover:bg-red-600 hover:shadow-md hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium">Despesa Mês</span></div>
          <p className="text-2xl font-bold mb-1">{fmt(stats.monthExpense)}</p>
        </div>

        <div 
          onClick={() => onNavigate?.('financeiro')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md hover:border-indigo-200 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-2 mb-2 text-slate-500"><DollarSign className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium">Saldo Ano</span></div>
          <p className={`text-2xl font-bold mb-1 ${stats.yearBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(stats.yearBalance)}</p>
        </div>
      </div>

      {/* Row 3: Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-slate-800">Receita vs Despesa — Últimos 6 Meses</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={true} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={true} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(value) => `R$${value/1000}k`} />
              <Tooltip formatter={(value: number) => fmt(value)} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4: Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div 
          onClick={() => onNavigate?.('pedidos')}
          className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 text-white col-span-1 cursor-pointer hover:bg-slate-700 hover:shadow-md hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-2 mb-4 text-slate-300">
            <TrendingUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Receita Total de Pedidos</span>
          </div>
          <p className="text-3xl font-bold mb-1">{fmt(stats.recentOrders.reduce((sum, o) => sum + Number(o.total_amount), 0))}</p>
          <p className="text-xs text-slate-400">{stats.recentOrders.length} últimos aluguéis registrados</p>
        </div>

        <div 
          onClick={() => onNavigate?.('pedidos')}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 col-span-2 flex flex-col cursor-pointer hover:shadow-md hover:border-indigo-200 hover:scale-[1.01] transition-all group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Aluguéis Recentes</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            {stats.recentOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 py-10">
                Nenhum aluguel registrado
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium">
                    <th className="pb-2">Cliente</th>
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Valor</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentOrders.map(o => (
                    <tr 
                      key={o.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('pedidos', o.customer_name, 'all');
                      }}
                    >
                      <td className="py-2 text-slate-800">{o.customer_name}</td>
                      <td className="py-2 text-slate-600">{formatSafeDate(o.start_date)}</td>
                      <td className="py-2 text-slate-800 font-medium">{fmt(Number(o.total_amount))}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          o.status === 'rented' ? 'bg-blue-100 text-blue-800' :
                          o.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {o.status === 'rented' ? 'Locado' : o.status === 'completed' ? 'Concluído' : 'Aguardando'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Controle de Devoluções */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Controle de Devoluções (Aluguéis Ativos)</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div 
            onClick={() => onNavigate?.('devolucoes', 'today')}
            className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors group"
          >
            <p className="text-2xl font-bold text-blue-600 group-hover:scale-110 transition-transform">{stats.returnsToday}</p>
            <p className="text-xs text-blue-500 font-medium">Para hoje</p>
          </div>
          <div 
            onClick={() => onNavigate?.('devolucoes', 'next3')}
            className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-100 transition-colors group"
          >
            <p className="text-2xl font-bold text-amber-600 group-hover:scale-110 transition-transform">{stats.returnsNext3Days}</p>
            <p className="text-xs text-amber-500 font-medium">Próximos 3 dias</p>
          </div>
          <div 
            onClick={() => onNavigate?.('devolucoes', 'late')}
            className="bg-red-50 border border-red-100 rounded-lg p-4 text-center cursor-pointer hover:bg-red-100 transition-colors group"
          >
            <p className="text-2xl font-bold text-red-600 group-hover:scale-110 transition-transform">{stats.returnsLate}</p>
            <p className="text-xs text-red-500 font-medium">Atrasados</p>
          </div>
        </div>

        {/* New Section: This Week Returns */}
        <div className="mt-6 border-t border-slate-50 pt-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Devoluções Previstas para esta Semana</h4>
          {stats.returnsThisWeek.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">Nenhuma devolução prevista para esta semana.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Equipamentos</th>
                    <th className="pb-2 font-medium">Data Prevista</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.returnsThisWeek.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 text-slate-700 font-medium">{o.customer_name}</td>
                      <td className="py-2.5 text-slate-500">
                        {o.items.map((it: any) => `${it.quantity}x ${it.equipmentName}`).join(', ')}
                      </td>
                      <td className={`py-2.5 font-medium ${o.end_date === todayStr ? 'text-blue-600' : 'text-slate-600'}`}>
                        {formatSafeDate(o.end_date)}
                        {o.end_date === todayStr && <span className="ml-2 text-[10px] bg-blue-100 px-1.5 py-0.5 rounded-full">Hoje</span>}
                      </td>
                      <td className="py-2.5 text-slate-700 font-bold text-right">{fmt(Number(o.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* New Section: Next Week Returns */}
        <div className="mt-6 border-t border-slate-50 pt-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Devoluções da Próxima Semana</h4>
          {stats.returnsNextWeek.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">Nenhuma devolução prevista para a próxima semana.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Equipamentos</th>
                    <th className="pb-2 font-medium">Data Prevista</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.returnsNextWeek.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 text-slate-700 font-medium">{o.customer_name}</td>
                      <td className="py-2.5 text-slate-500">
                        {o.items.map((it: any) => `${it.quantity}x ${it.equipmentName}`).join(', ')}
                      </td>
                      <td className="py-2.5 text-slate-600">{formatSafeDate(o.end_date)}</td>
                      <td className="py-2.5 text-slate-700 font-bold text-right">{fmt(Number(o.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section: Future Returns */}
        <div className="mt-6 border-t border-slate-50 pt-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Outras Devoluções (Após 14 dias)</h4>
          {stats.returnsFuture.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">Nenhuma outra devolução prevista.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Equipamentos</th>
                    <th className="pb-2 font-medium">Data Prevista</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.returnsFuture.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 text-slate-700 font-medium">{o.customer_name}</td>
                      <td className="py-2.5 text-slate-500">
                        {o.items.map((it: any) => `${it.quantity}x ${it.equipmentName}`).join(', ')}
                      </td>
                      <td className="py-2.5 text-slate-600">{formatSafeDate(o.end_date)}</td>
                      <td className="py-2.5 text-slate-700 font-bold text-right">{fmt(Number(o.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row 6: Estoque de Equipamentos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-800">Estoque de Equipamentos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.equipmentStock.length === 0 ? (
            <div className="col-span-full text-center text-sm text-slate-400 py-4">Nenhum equipamento cadastrado</div>
          ) : stats.equipmentStock.map((item, i) => (
            <div 
              key={i} 
              className="border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
              onClick={() => onNavigate?.('equipamentos', item.name)}
            >
              <p className="text-sm font-medium text-slate-800 truncate" title={item.name}>{item.name}</p>
              <p className="text-xs text-slate-400 mb-3">{item.category}</p>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                  {Math.max(0, item.disp)} disp.
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                  {Math.max(0, item.alug)} alug.
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100">
                  {Math.max(0, item.maint)} manut.
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
