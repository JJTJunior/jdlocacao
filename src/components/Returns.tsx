import React, { useState, useEffect } from 'react';
import { RotateCcw, Calendar, AlertCircle, Loader2, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatSafeDate, getLocalDateISO } from '../lib/dateUtils';

interface ReturnsProps {
  userId: string;
  initialFilter?: 'today' | 'next3' | 'late';
  onBack?: () => void;
}

export function Returns({ userId, initialFilter = 'today', onBack }: ReturnsProps) {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'next3' | 'late'>(initialFilter);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const loadReturns = async () => {
      setLoading(true);
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const threeDaysStr = new Date(now.getTime() + 3 * 86400000).toLocaleDateString('en-CA');

      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'rented');

      if (data) {
        let filtered = data;
        if (filter === 'today') {
          filtered = data.filter(o => getLocalDateISO(o.end_date) === todayStr);
        } else if (filter === 'next3') {
          filtered = data.filter(o => {
            const iso = getLocalDateISO(o.end_date);
            return iso && iso > todayStr && iso <= threeDaysStr;
          });
        } else if (filter === 'late') {
          filtered = data.filter(o => {
            const iso = getLocalDateISO(o.end_date);
            return iso && iso < todayStr;
          });
        }
        setOrders(filtered.sort((a, b) => (a.end_date || '').localeCompare(b.end_date || '')));
      }
      setLoading(false);
    };

    loadReturns();
  }, [userId, filter]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white rounded-lg border border-slate-200 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-slate-800" />
            <h2 className="text-xl font-bold text-slate-800">Controle de Devoluções</h2>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setFilter('today')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'today' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Para Hoje
        </button>
        <button 
          onClick={() => setFilter('next3')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'next3' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Próximos 3 Dias
        </button>
        <button 
          onClick={() => setFilter('late')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'late' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Atrasados
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">Buscando devoluções...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-800 font-bold mb-1">Nenhuma devolução encontrada</h3>
            <p className="text-slate-500 text-sm">Não há registros para o filtro selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium border-b border-slate-200">Cliente</th>
                  <th className="px-6 py-4 font-medium border-b border-slate-200">Equipamentos</th>
                  <th className="px-6 py-4 font-medium border-b border-slate-200 text-center">Data Prevista</th>
                  <th className="px-6 py-4 font-medium border-b border-slate-200 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{o.customer_name}</div>
                      <div className="text-xs text-slate-400">ID: {o.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-md truncate" title={o.items.map((it: any) => `${it.quantity}x ${it.equipmentName}`).join(', ')}>
                        {o.items.map((it: any) => `${it.quantity}x ${it.equipmentName}`).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        filter === 'late' ? 'bg-red-50 text-red-700' : 
                        filter === 'today' ? 'bg-blue-50 text-blue-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {filter === 'late' && <AlertCircle className="w-3.5 h-3.5" />}
                        {formatSafeDate(o.end_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-900">
                      {fmt(Number(o.total_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
