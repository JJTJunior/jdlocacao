import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';

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
    setSaving(false);
    closeModal();
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Equipamento</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Estoque</th>
                <th className="px-6 py-4 font-medium">Preços</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : filtered.map(eq => (
                <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-slate-900">{eq.name}</div><div className="text-sm text-slate-500">Código: {eq.code}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{eq.category}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="flex gap-2 text-xs"><span className="text-green-600 font-medium">{eq.stock_available} disp.</span><span className="text-blue-600 font-medium">{eq.stock_rented} alug.</span><span className="text-orange-600 font-medium">{eq.stock_maintenance} man.</span></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700"><div>Diária: R$ {fmt(eq.price_per_day)}</div><div>Semanal: R$ {fmt(eq.price_per_week)}</div><div>Mensal: R$ {fmt(eq.price_per_month)}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(eq)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setEquipmentToDelete(eq.id)} className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum equipamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
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
