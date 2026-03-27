import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';
import { supabase } from '../lib/supabaseClient';

interface Equipment {
  id: string;
  user_id?: string;
  name: string;
  code: string;
  category: string;
  price_per_day: number;
  price_per_week: number;
  price_per_month: number;
  stock_available: number;
  stock_rented: number;
  stock_maintenance: number;
  lots?: { lot_number: string; quantity: number }[];
}

interface EquipmentsProps {
  userId: string;
  initialSearch?: string;
}

export function Equipments({ userId, initialSearch = '' }: EquipmentsProps) {
  const { rows: equipments, loading, insert, update, remove } = useSupabaseTable<Equipment>('equipments', userId);
  const { rows: categories } = useSupabaseTable<any>('categories', userId);

  // Extract equipment categories from DB
  const categoryOptions = categories.filter(c => c.type === 'equipment').map(c => c.name).sort();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = { 
    name: '', 
    code: '', 
    category: '', 
    price_per_day: '', 
    price_per_week: '', 
    price_per_month: '', 
    stock_available: '0', 
    stock_rented: '0', 
    stock_maintenance: '0',
    lots: [] as { lot_number: string; quantity: number }[]
  };
  const [formData, setFormData] = useState(blankForm);

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setFormData(blankForm); };

  const handleEdit = (eq: Equipment) => {
    setEditingId(eq.id);
    setFormData({
      name: eq.name, code: eq.code, category: eq.category,
      price_per_day: eq.price_per_day.toString(), price_per_week: eq.price_per_week.toString(), price_per_month: eq.price_per_month.toString(),
      stock_available: eq.stock_available.toString(), stock_rented: eq.stock_rented.toString(), stock_maintenance: eq.stock_maintenance.toString(),
      lots: eq.lots || [],
    });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (equipmentToDelete) { await remove(equipmentToDelete); setEquipmentToDelete(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (!userId) {
        alert("Erro: Usuário não autenticado.");
        setSaving(false);
        return;
      }
      
      const isCodeFilled = formData.code && formData.code.trim() !== '';
      if (isCodeFilled) {
        let query = supabase.from('equipments').select('id, code').eq('user_id', userId).eq('code', formData.code);
        
        if (editingId) {
          query = query.neq('id', editingId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error("Erro ao buscar equipamentos:", error);
          alert("Ocorreu um erro ao verificar os dados do equipamento.");
          setSaving(false);
          return;
        }

        if (data && data.length > 0) {
          alert('Já existe um equipamento cadastrado com este Código.');
          setSaving(false);
          return;
        }
      }

      const totalFromLots = formData.lots.reduce((acc, lot) => acc + (lot.quantity || 0), 0);

      const payload = {
        name: formData.name, code: formData.code, category: formData.category,
        price_per_day: parseFloat(formData.price_per_day) || 0,
        price_per_week: parseFloat(formData.price_per_week) || 0,
        price_per_month: parseFloat(formData.price_per_month) || 0,
        stock_available: formData.lots.length > 0 ? totalFromLots : (parseInt(formData.stock_available) || 0),
        stock_rented: parseInt(formData.stock_rented) || 0,
        stock_maintenance: parseInt(formData.stock_maintenance) || 0,
        lots: formData.lots
      };
      
      if (editingId) { await update(editingId, payload); }
      else { await insert(payload as any); }
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Erro ao processar as informações.');
    } finally {
      setSaving(false);
    }
  };

  const addLot = () => {
    setFormData({
      ...formData,
      lots: [...formData.lots, { lot_number: '', quantity: 0 }]
    });
  };

  const removeLot = (index: number) => {
    setFormData({
      ...formData,
      lots: formData.lots.filter((_, i) => i !== index)
    });
  };

  const updateLot = (index: number, field: 'lot_number' | 'quantity', value: string) => {
    const newLots = [...formData.lots];
    if (field === 'quantity') {
      newLots[index].quantity = parseInt(value) || 0;
    } else {
      newLots[index].lot_number = value;
    }
    setFormData({ ...formData, lots: newLots });
  };

  const uniqueCategories = Array.from(new Set(equipments.map(e => e.category))).sort();

  const filtered = equipments
    .filter(e => {
      const matchSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Equipamentos</h2>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar equipamento..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full sm:w-48 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="all">Todas as categorias</option>
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-[#1e3a5f] text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[#152a45] transition-colors whitespace-nowrap">
            <Plus className="w-5 h-5" /> Novo Equipamento
          </button>
        </div>
      </div>

      {/* Equipments Grid/Cards Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 text-sm">
            Nenhum equipamento encontrado.
          </div>
        ) : (
          filtered.map(eq => (
            <div key={eq.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-indigo-600 transition-colors">{eq.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Cód: {eq.code}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                    {eq.category}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Disponível</span>
                    <span className="text-sm font-black text-emerald-600">{eq.stock_available}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-100" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Alugado</span>
                    <span className="text-sm font-black text-blue-600">{eq.stock_rented}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-100" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Manut.</span>
                    <span className="text-sm font-black text-orange-600">{eq.stock_maintenance}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 space-y-1 border border-slate-100">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Diária:</span>
                    <span className="text-slate-700 font-bold">R$ {fmt(eq.price_per_day)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Semanal:</span>
                    <span className="text-slate-700 font-bold">R$ {fmt(eq.price_per_week)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Mensal:</span>
                    <span className="text-slate-700 font-bold">R$ {fmt(eq.price_per_month)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-50">
                <button 
                  onClick={() => handleEdit(eq)} 
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setEquipmentToDelete(eq.id)} 
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Equipamento' : 'Novo Equipamento'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Betoneira 400L" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Código *</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="B-1" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="" disabled>Selecione</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                {!categoryOptions.length && <option value={formData.category || 'Geral'}>{formData.category || 'Geral'}</option>}
              </select>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4"><h4 className="text-sm font-bold text-slate-800 mb-3">Preços (R$)</h4>
            <div className="grid grid-cols-3 gap-4">
              {['price_per_day', 'price_per_week', 'price_per_month'].map((field, i) => (
                <div key={field}><label className="block text-sm font-medium text-slate-700 mb-1">{['Diária', 'Semanal', 'Mensal'][i]} *</label><input required type="number" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={(formData as any)[field]} onChange={e => setFormData({ ...formData, [field]: e.target.value })} placeholder="0.00" /></div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-slate-800">Lotes e Quantidades</h4>
              <button 
                type="button" 
                onClick={addLot}
                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-100 font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Lote
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {formData.lots.map((lot, index) => (
                <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="Nº do Lote" 
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={lot.lot_number}
                      onChange={e => updateLot(index, 'lot_number', e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <input 
                      type="number" 
                      placeholder="Qtd" 
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={lot.quantity || ''}
                      onChange={e => updateLot(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeLot(index)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {formData.lots.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Nenhum lote cadastrado. Informe a quantidade total abaixo ou adicione lotes.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4"><h4 className="text-sm font-bold text-slate-800 mb-3">Estoque</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disponível *</label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.lots.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  value={formData.lots.length > 0 ? formData.lots.reduce((acc, l) => acc + (l.quantity || 0), 0) : formData.stock_available} 
                  onChange={e => setFormData({ ...formData, stock_available: e.target.value })} 
                  placeholder="0" 
                  readOnly={formData.lots.length > 0}
                />
                {formData.lots.length > 0 && <p className="text-[10px] text-indigo-500 mt-1 font-medium">Calculado via lotes</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alugado *</label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  value={formData.stock_rented} 
                  onChange={e => setFormData({ ...formData, stock_rented: e.target.value })} 
                  placeholder="0" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manutenção *</label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  value={formData.stock_maintenance} 
                  onChange={e => setFormData({ ...formData, stock_maintenance: e.target.value })} 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#152a45] font-medium flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editingId ? 'Salvar Alterações' : 'Salvar Equipamento'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!equipmentToDelete} onClose={() => setEquipmentToDelete(null)} title="Confirmar Exclusão">
        <div className="space-y-4">
          <p className="text-slate-700">Tem certeza que deseja excluir este equipamento?</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setEquipmentToDelete(null)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
