import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Save, Loader2, Search, ChevronDown, Check, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';
import { supabase } from '../lib/supabaseClient';

interface Transaction {
  id: string;
  user_id?: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  status: 'paid' | 'pending';
  isMaintenance?: boolean;
}

interface MaintenanceRow {
  id: string;
  user_id?: string;
  equipment_name: string;
  start_date: string;
  reason: string;
  cost: number;
}

interface Category {
  id: string;
  name: string;
  type: 'equipment' | 'expense' | 'income';
}

interface FinanceProps {
  userId: string;
}

export function Finance({ userId }: FinanceProps) {
  const { rows: transactions, loading: loadingTrans, insert, update, remove } = useSupabaseTable<Transaction>('transactions', userId);
  const { rows: maintenances, loading: loadingMaint } = useSupabaseTable<MaintenanceRow>('maintenance', userId);
  
  const loading = loadingTrans || loadingMaint;

  const combinedTransactions: Transaction[] = [
    ...transactions,
    ...maintenances.filter(m => m.cost > 0).map(m => ({
      id: `maint_${m.id}`,
      user_id: m.user_id,
      date: m.start_date,
      description: `Manutenção: ${m.equipment_name} (${m.reason})`,
      category: 'Manutenção',
      type: 'expense' as const,
      amount: m.cost,
      status: 'paid' as const,
      isMaintenance: true
    }))
  ];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = { date: new Date().toISOString().split('T')[0], description: '', category: '', amount: '', status: 'paid' as Transaction['status'] };
  const [formData, setFormData] = useState(blankForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  const loadCategories = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('categories').select('*').eq('user_id', userId);
    if (data) setCategories(data);
  }, [userId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);
  const handleOpenModal = (type: 'income' | 'expense') => {
    setModalType(type); setEditingId(null);
    setFormData({ ...blankForm, date: new Date().toISOString().split('T')[0] });
    setCategorySearch('');
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleEdit = (t: Transaction) => {
    setModalType(t.type); setEditingId(t.id);
    setFormData({ date: t.date, description: t.description, category: t.category, amount: t.amount.toString(), status: t.status });
    setCategorySearch(t.category);
    setIsModalOpen(true);
  };

  const closeModal = () => { 
    setIsModalOpen(false); 
    setEditingId(null); 
    setFormData(blankForm);
    setCategorySearch('');
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { date: formData.date, description: formData.description, category: formData.category, type: modalType, amount: Number(formData.amount), status: formData.status };
    if (editingId) { await update(editingId, payload); }
    else { await insert(payload as any); }
    setSaving(false);
    closeModal();
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const now = new Date();
  const monthTrans = combinedTransactions.filter(t => { const d = t.date.slice(0,7); return d === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`; });
  const yearTrans = combinedTransactions.filter(t => t.date.startsWith(`${now.getFullYear()}`));

  const monthIncome = monthTrans.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const yearIncome = yearTrans.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const yearExpense = yearTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    const name = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.','').slice(0,3)}/${String(d.getFullYear()).slice(-2)}`;
    const m = combinedTransactions.filter(t => t.date.startsWith(key));
    return { name, receita: m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), despesa: m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) };
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Financeiro</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#10b981] text-white p-5 rounded-xl shadow-sm"><div className="flex items-center gap-2 mb-2 text-sm font-medium opacity-90"><TrendingUp className="w-4 h-4" />Receita do Mês</div><div className="text-2xl font-bold">{fmt(monthIncome)}</div></div>
        <div className="bg-[#ef4444] text-white p-5 rounded-xl shadow-sm"><div className="flex items-center gap-2 mb-2 text-sm font-medium opacity-90"><TrendingDown className="w-4 h-4" />Despesa do Mês</div><div className="text-2xl font-bold">{fmt(monthExpense)}</div></div>
        <div className="bg-[#1e3a5f] text-white p-5 rounded-xl shadow-sm"><div className="flex items-center gap-2 mb-2 text-sm font-medium opacity-90"><TrendingUp className="w-4 h-4" />Receita do Ano</div><div className="text-2xl font-bold">{fmt(yearIncome)}</div></div>
        <div className="bg-[#f0fdf4] text-[#15803d] p-5 rounded-xl shadow-sm border border-[#bbf7d0]"><div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-500"><DollarSign className="w-4 h-4" />Saldo do Ano</div><div className="text-2xl font-bold">{fmt(yearIncome - yearExpense)}</div></div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-6">Receita vs Despesa — Últimos 6 Meses</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => `R$${v / 1000}k`} dx={-10} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }} />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-slate-800 whitespace-nowrap">Transações Registradas</h3>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={categoryFilter} 
                onChange={e => setCategoryFilter(e.target.value)}
                className="pl-8 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white cursor-pointer hover:bg-slate-50 transition-colors appearance-none"
              >
                <option value="all">Todas Categorias</option>
                {Array.from(new Set(combinedTransactions.map(t => t.category))).sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={monthFilter} 
                onChange={e => setMonthFilter(e.target.value)}
                className="pl-8 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white cursor-pointer hover:bg-slate-50 transition-colors appearance-none"
              >
                <option value="all">Todo o Período</option>
                {Array.from(new Set(combinedTransactions.map(t => t.date.slice(0, 7))))
                  .sort((a, b) => b.localeCompare(a))
                  .map(month => {
                    const [year, mo] = month.split('-');
                    const date = new Date(parseInt(year), parseInt(mo) - 1);
                    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    return (
                      <option key={month} value={month}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => handleOpenModal('expense')} className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#152a45] transition-colors"><Plus className="w-4 h-4" />Nova Despesa</button>
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : combinedTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Nenhuma transação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><th className="px-6 py-4 font-medium">Data</th><th className="px-6 py-4 font-medium">Descrição</th><th className="px-6 py-4 font-medium">Categoria</th><th className="px-6 py-4 font-medium">Valor</th><th className="px-6 py-4 font-medium text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {[...combinedTransactions]
                  .filter(t => categoryFilter === 'all' || t.category === categoryFilter)
                  .filter(t => monthFilter === 'all' || t.date.startsWith(monthFilter))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-sm text-slate-900 truncate max-w-[200px]" title={t.description}>{t.description}</div><div className="text-xs text-slate-500">{t.type === 'income' ? 'Receita' : 'Despesa'}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{t.category}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {fmt(Number(t.amount))}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!t.isMaintenance && t.category !== 'Aluguel' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(t)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50"><Save className="w-4 h-4" /></button>
                          <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Automático</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? (modalType === 'income' ? 'Editar Receita' : 'Editar Despesa') : (modalType === 'income' ? 'Nova Receita' : 'Nova Despesa')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-500 mb-1">Descrição *</label><input required type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Locação de Betoneira" /></div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Categoria *</label>
            <div className="relative">
              <div className="relative">
                <input 
                  required 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 pr-10" 
                  value={categorySearch} 
                  onChange={e => {
                    setCategorySearch(e.target.value);
                    setFormData({ ...formData, category: e.target.value });
                    setIsDropdownOpen(true);
                  }} 
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Ex: Locação" 
                />
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 sticky top-0 bg-white border-b border-slate-50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border-none rounded-lg text-xs focus:ring-1 focus:ring-indigo-100 placeholder:text-slate-400"
                        placeholder="Pesquisar categoria..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  <div className="py-1">
                    {categories
                      .filter(c => c.type === modalType)
                      .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .length > 0 ? (
                      categories
                        .filter(c => c.type === modalType)
                        .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50/80 transition-all flex items-center justify-between group"
                            onClick={() => {
                              setFormData({ ...formData, category: cat.name });
                              setCategorySearch(cat.name);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span className="text-sm text-slate-700 font-medium group-hover:text-indigo-600 transition-colors">
                              {cat.name}
                            </span>
                            {formData.category === cat.name && (
                              <Check className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                          </button>
                        ))
                    ) : (
                      <div className="px-4 py-3 text-center">
                        <p className="text-xs text-slate-400 font-medium italic">Nenhuma categoria encontrada</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-500 mb-1">Valor (R$) *</label><input required type="number" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0" /></div>
            <div><label className="block text-sm font-medium text-slate-500 mb-1">Data *</label><input required type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
          </div>
          <div className="pt-4 mt-2 border-t border-slate-200 flex gap-4">
            <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#8b9bb4] hover:bg-[#7a8aa3] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
