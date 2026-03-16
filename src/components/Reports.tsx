import React, { useState, useEffect, useRef } from 'react';
import { Download, Calendar, TrendingUp, Package, Users, DollarSign, Loader2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabaseClient';

interface ReportsProps {
  userId?: string;
}

export function Reports({ userId }: ReportsProps) {
  const [period, setPeriod] = useState('current_month');
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeRentals: 0,
    newCustomers: 0,
    revenueGrowth: 0,
    rentalsGrowth: 0,
    customersGrowth: 0,
    revenueData: [] as any[],
    categoryData: [] as any[],
    topEquipments: [] as any[]
  });

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      setLoading(true);
      const now = new Date();
      
      // Determine date ranges based on selected period
      let startDateStr = '';
      let previousStartDateStr = '';
      let previousEndDateStr = '';
      const endDateStr = now.toISOString().split('T')[0];

      if (period === 'current_month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = d.toISOString().split('T')[0];
        
        const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousStartDateStr = pd.toISOString().split('T')[0];
        previousEndDateStr = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      } else if (period === 'last_3_months') {
        const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startDateStr = d.toISOString().split('T')[0];
        
        const pd = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        previousStartDateStr = pd.toISOString().split('T')[0];
        previousEndDateStr = new Date(now.getFullYear(), now.getMonth() - 2, 0).toISOString().split('T')[0];
      } else if (period === 'last_6_months') {
        const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        startDateStr = d.toISOString().split('T')[0];

        const pd = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        previousStartDateStr = pd.toISOString().split('T')[0];
        previousEndDateStr = new Date(now.getFullYear(), now.getMonth() - 5, 0).toISOString().split('T')[0];
      } else if (period === 'current_year') {
        const d = new Date(now.getFullYear(), 0, 1);
        startDateStr = d.toISOString().split('T')[0];
        
        const pd = new Date(now.getFullYear() - 1, 0, 1);
        previousStartDateStr = pd.toISOString().split('T')[0];
        previousEndDateStr = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
      } else if (period === 'last_year') {
        const d = new Date(now.getFullYear() - 1, 0, 1);
        startDateStr = d.toISOString().split('T')[0];
        const nextD = new Date(now.getFullYear(), 0, 1);
        const actualEndDate = new Date(nextD.getTime() - 86400000);
        const fixedEndDateStr = actualEndDate.toISOString().split('T')[0];
        
        const pd = new Date(now.getFullYear() - 2, 0, 1);
        previousStartDateStr = pd.toISOString().split('T')[0];
        previousEndDateStr = new Date(now.getFullYear() - 2, 11, 31).toISOString().split('T')[0];
      }

      // Fetch all required data
      const [
        { data: transactions },
        { data: orders },
        { data: customers },
        { data: equipments },
        { data: maintenances }
      ] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId),
        supabase.from('customers').select('*').eq('user_id', userId),
        supabase.from('equipments').select('*').eq('user_id', userId),
        supabase.from('maintenance').select('*').eq('user_id', userId)
      ]);

      const trList = transactions || [];
      const ordList = (orders || []).filter((o: any) => o.status !== 'cancelled');
      const custList = customers || [];
      const eqList = equipments || [];
      const maintList = maintenances || [];

      const combinedTrans = [
        ...trList,
        ...maintList.filter((m: any) => m.cost > 0).map((m: any) => ({
          date: m.start_date,
          type: 'expense',
          amount: m.cost
        }))
      ];

      // Filter by period
      const currentTransactions = combinedTrans.filter(t => t.date >= startDateStr && t.date <= (period === 'last_year' ? `${now.getFullYear()-1}-12-31` : endDateStr));
      const previousTransactions = combinedTrans.filter(t => t.date >= previousStartDateStr && t.date <= previousEndDateStr);
      
      const currentOrders = ordList.filter(o => o.start_date >= startDateStr && o.start_date <= (period === 'last_year' ? `${now.getFullYear()-1}-12-31` : endDateStr));
      const previousOrders = ordList.filter(o => o.start_date >= previousStartDateStr && o.start_date <= previousEndDateStr);

      const currentCustomers = custList.filter(c => c.created_at >= startDateStr && c.created_at <= (period === 'last_year' ? `${now.getFullYear()-1}-12-31T23:59:59` : new Date().toISOString()));
      const previousCustomers = custList.filter(c => c.created_at >= previousStartDateStr && c.created_at <= previousEndDateStr + 'T23:59:59');

      // KPIs
      const curRevenue = currentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const prevRevenue = previousTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const revenueGrowth = prevRevenue === 0 ? 100 : ((curRevenue - prevRevenue) / prevRevenue) * 100;

      const activeRentals = currentOrders.length;
      const prevRentals = previousOrders.length;
      const rentalsGrowth = prevRentals === 0 ? 100 : ((activeRentals - prevRentals) / prevRentals) * 100;

      const newCustomers = currentCustomers.length;
      const prevNewCustomers = previousCustomers.length;
      const customersGrowth = prevNewCustomers === 0 ? 100 : ((newCustomers - prevNewCustomers) / prevNewCustomers) * 100;

      // Charts
      let revData = [];
      if (period === 'last_6_months' || period === 'current_year' || period === 'last_year') {
        const monthsCount = period === 'last_6_months' ? 6 : 12;
        const startMonthIndex = period === 'last_6_months' ? now.getMonth() - 5 : 0;
        const yearBase = period === 'last_year' ? now.getFullYear() - 1 : now.getFullYear();

        revData = Array.from({ length: monthsCount }, (_, i) => {
          const d = new Date(yearBase, startMonthIndex + i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const name = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3)}/${String(d.getFullYear()).slice(-2)}`;
          const m = combinedTrans.filter(t => t.date.startsWith(key));
          return {
            month: name,
            receitas: m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            despesas: m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
          };
        });
      } else {
        // Daily breakdown for shorter periods
        // Simplification: aggregate by week or just show overall sums, let's just group by month still if span is 3 months
        revData = Array.from({ length: 3 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const name = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3)}/${String(d.getFullYear()).slice(-2)}`;
          const m = trList.filter(t => t.date.startsWith(key));
          return {
            month: name,
            receitas: m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            despesas: m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
          };
        });
      }

      // Categories and Equipments
      const catCount: Record<string, number> = {};
      const eqCount: Record<string, { totalRentals: number, revenue: number }> = {};

      currentOrders.forEach(o => {
        if (!o.items) return;
        o.items.forEach((item: any) => {
          // Find eq
          const eq = eqList.find(e => e.id === item.equipmentId);
          if (eq) {
            // Cat
            catCount[eq.category] = (catCount[eq.category] || 0) + item.quantity;
            // Eq
            if (!eqCount[eq.id]) eqCount[eq.id] = { totalRentals: 0, revenue: 0 };
            eqCount[eq.id].totalRentals += item.quantity;
            // Approximate value per item = (total_amount / order_items_count) ... this is tricky.
            // A simple approximation: item price * quantity * days
            const days = Math.ceil((new Date(o.end_date).getTime() - new Date(o.start_date).getTime()) / (1000 * 3600 * 24)) || 1;
            eqCount[eq.id].revenue += Number(item.price) * item.quantity * days;
          }
        });
      });

      const categoryData = Object.keys(catCount).map(k => ({
        name: k || 'Geral',
        locacoes: catCount[k]
      })).sort((a, b) => b.locacoes - a.locacoes).slice(0, 5);

      const topEquipments = eqList
        .filter(eq => eqCount[eq.id])
        .map(eq => ({
          id: eq.id,
          name: eq.name,
          category: eq.category || 'Geral',
          totalRentals: eqCount[eq.id].totalRentals,
          revenue: eqCount[eq.id].revenue
        }))
        .sort((a, b) => b.totalRentals - a.totalRentals)
        .slice(0, 5);

      setStats({
        totalRevenue: curRevenue,
        activeRentals,
        newCustomers,
        revenueGrowth,
        rentalsGrowth,
        customersGrowth,
        revenueData: revData,
        categoryData,
        topEquipments
      });

      setLoading(false);
    };

    loadData();
  }, [userId, period]);

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`relatorio-alugaobra-${period}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtGrowth = (v: number) => {
    if (!isFinite(v) || isNaN(v)) return '0%';
    const prefix = v > 0 ? '+' : '';
    return `${prefix}${v.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Relatórios e Análises</h2>
        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="w-5 h-5 text-slate-500" />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <option value="current_month">Mês Atual</option>
              <option value="last_3_months">Últimos 3 Meses</option>
              <option value="last_6_months">Últimos 6 Meses</option>
              <option value="current_year">Ano Atual</option>
              <option value="last_year">Ano Passado</option>
            </select>
          </div>
          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 bg-slate-50 p-4 -m-4 rounded-xl">
        {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Receita Total ({period.replace(/_/g, ' ')})</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{fmtCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {stats.revenueGrowth >= 0 ? (
               <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : (
               <TrendingUp className="w-4 h-4 text-red-500 mr-1 rotate-180" />
            )}
            <span className={`${stats.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>{fmtGrowth(stats.revenueGrowth)}</span>
            <span className="text-slate-500 ml-2">vs. período anterior</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Pedidos no Período</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.activeRentals}</p>
            </div>
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {stats.rentalsGrowth >= 0 ? (
               <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : (
               <TrendingUp className="w-4 h-4 text-red-500 mr-1 rotate-180" />
            )}
            <span className={`${stats.rentalsGrowth >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>{fmtGrowth(stats.rentalsGrowth)}</span>
            <span className="text-slate-500 ml-2">vs. período anterior</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Novos Clientes</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.newCustomers}</p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
           {stats.customersGrowth >= 0 ? (
               <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : (
               <TrendingUp className="w-4 h-4 text-red-500 mr-1 rotate-180" />
            )}
            <span className={`${stats.customersGrowth >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>{fmtGrowth(stats.customersGrowth)}</span>
            <span className="text-slate-500 ml-2">vs. período anterior</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Receitas vs Despesas ({period.replace(/_/g, ' ')})</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => `R$${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [fmtCurrency(value), undefined]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Pedidos por Categoria de Eq.</h3>
          <div className="h-80">
            {stats.categoryData.length === 0 ? (
               <div className="h-full flex items-center justify-center text-sm text-slate-400">Nenhum dado no período</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.categoryData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 500, fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="locacoes" name="Qtd. Locados" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Equipments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Equipamentos Mais Alugados no Período</h3>
        </div>
        <div className="overflow-x-auto">
          {stats.topEquipments.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">Nenhum dado no período</div>
          ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Equipamento</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium text-center">Locações no Período</th>
                <th className="px-6 py-4 font-medium text-right">Potencial Gerado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.topEquipments.map((equipment) => (
                <tr key={equipment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {equipment.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    {equipment.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700 font-medium">
                    {equipment.totalRentals}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-medium">
                    {fmtCurrency(equipment.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
