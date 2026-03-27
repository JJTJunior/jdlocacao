import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Search, Filter, Trash2, Edit, Save, Loader2, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';
import { supabase } from '../lib/supabaseClient';

interface EquipmentRow {
  id: string;
  name: string;
  code: string;
  stock_available: number;
  stock_maintenance: number;
  lots?: { lot_number: string; quantity: number }[];
}

interface MaintenanceRow {
  id: string;
  user_id?: string;
  equipment_id: string;
  equipment_name: string;
  lot_number: string;
  quantity: number;
  start_date: string;
  end_date: string | null;
  reason: string;
  cost: number;
  status: 'in_progress' | 'completed';
}

interface MaintenanceProps {
  userId: string;
  initialSearch?: string;
  initialTab?: string;
}

export function Maintenance({ userId, initialSearch = '', initialTab = 'in_progress' }: MaintenanceProps) {
  const { rows: maintenances, loading, insert, update, remove } = useSupabaseTable<MaintenanceRow>('maintenance', userId);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);

  const [statusFilter, setStatusFilter] = useState(initialTab || 'in_progress');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<MaintenanceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = {
    equipment_id: '',
    equipment_name: '',
    lot_number: '',
    quantity: 1,
    start_date: new Date().toISOString(),
    end_date: '',
    reason: '',
    cost: '0',
    status: 'in_progress' as MaintenanceRow['status']
  };

  const [formData, setFormData] = useState(blankForm);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loadEquipments = useCallback(() => {
    if (!userId) return;
    supabase.from('equipments').select('id, name, code, stock_available, stock_maintenance, lots').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setEquipments(data);
      });
  }, [userId]);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  const closeModal = () => {
    setIsModalOpen(false);
    setIsCompleteModalOpen(false);
    setEditingId(null);
    setFormData(blankForm);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleEdit = (m: MaintenanceRow) => {
    setEditingId(m.id);
    setFormData({
      equipment_id: m.equipment_id,
      equipment_name: m.equipment_name,
      lot_number: m.lot_number || '',
      quantity: m.quantity || 1,
      start_date: m.start_date,
      end_date: m.end_date || '',
      reason: m.reason,
      cost: m.cost.toString(),
      status: m.status
    });
    setSearchQuery(m.equipment_name);
    setIsModalOpen(true);
  };

  const handleOpenComplete = (m: MaintenanceRow) => {
    setEditingId(m.id);
    setFormData({
      equipment_id: m.equipment_id,
      equipment_name: m.equipment_name,
      lot_number: m.lot_number || '',
      quantity: m.quantity || 1,
      start_date: m.start_date,
      end_date: m.end_date || new Date().toISOString(),
      reason: m.reason,
      cost: m.cost.toString(),
      status: 'completed'
    });
    setIsCompleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Find equipment name if not set
    let eqName = formData.equipment_name;
    if (!eqName && formData.equipment_id) {
      const eq = equipments.find(e => e.id === formData.equipment_id);
      if (eq) eqName = eq.name;
    }

    if (!formData.equipment_id) {
      alert("Por favor, selecione um equipamento da lista clicando na opção desejada.");
      setSaving(false);
      return;
    }

    const eq = equipments.find(e => e.id === formData.equipment_id);
    if (eq && eq.lots && eq.lots.length > 0 && !formData.lot_number) {
      alert("Por favor, selecione um lote para o equipamento.");
      setSaving(false);
      return;
    }

    const payload = {
      equipment_id: formData.equipment_id,
      equipment_name: eqName,
      lot_number: formData.lot_number,
      quantity: formData.quantity,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      reason: formData.reason,
      cost: Number(formData.cost) || 0,
      status: formData.status
    };

    if (editingId) {
      const oldMaint = maintenances.find(m => m.id === editingId);
      if (oldMaint) {
        // If it was in progress, we need to "undo" its effect on stock first correctly
        if (oldMaint.status === 'in_progress') {
          if (formData.status === 'completed') {
            // Returning to stock: use the ORIGINAL quantity that was taken
            await updateEquipmentStock(oldMaint.equipment_id, oldMaint.quantity, 1, -1, oldMaint.lot_number);
          } else if (formData.equipment_id !== oldMaint.equipment_id || formData.quantity !== oldMaint.quantity || formData.lot_number !== oldMaint.lot_number) {
            // Still in progress but equipment, quantity or lot changed: 
            // 1. Undo old
            await updateEquipmentStock(oldMaint.equipment_id, oldMaint.quantity, 1, -1, oldMaint.lot_number);
            // 2. Apply new
            await updateEquipmentStock(formData.equipment_id, formData.quantity, -1, 1, formData.lot_number);
          }
        }
      }
      await update(editingId, payload);
    } else {
      // New maintenance: remove from available, add to maintenance
      await updateEquipmentStock(formData.equipment_id, formData.quantity, -1, 1, formData.lot_number);
      await insert(payload as any);
    }
    
    setSaving(false);
    closeModal();
  };

  const updateEquipmentStock = async (eqId: string, q: number, deltaAvailable: number, deltaMaintenance: number, lotNumber?: string) => {
    const { data: eq } = await supabase.from('equipments').select('stock_available, stock_maintenance, lots').eq('id', eqId).single();
    if (eq) {
      let updatedLots = eq.lots || [];
      if (lotNumber && updatedLots.length > 0) {
        updatedLots = updatedLots.map((l: any) => {
          if (l.lot_number === lotNumber) {
            return { ...l, quantity: Math.max(0, l.quantity + (deltaAvailable * q)) };
          }
          return l;
        });
      }

      await supabase.from('equipments').update({
        stock_available: (eq.stock_available || 0) + (deltaAvailable * q),
        stock_maintenance: (eq.stock_maintenance || 0) + (deltaMaintenance * q),
        lots: updatedLots
      }).eq('id', eqId);
      // Refresh local list to update the "disp." labels in the search dropdown
      loadEquipments();
    }
  };

  const handleDelete = async (m: MaintenanceRow) => {
    setMaintenanceToDelete(m);
  };

  const confirmDelete = async () => {
    if (!maintenanceToDelete) return;
    const m = maintenanceToDelete;
    
    if (m.status === 'in_progress') {
      // Restore stock
      await updateEquipmentStock(m.equipment_id, m.quantity || 1, 1, -1, m.lot_number);
    }
    await remove(m.id);
    setMaintenanceToDelete(null);
  };

  const filtered = maintenances.filter(m => {
    const matchSearch = m.equipment_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' ? true : m.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const fmtCurrency = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Manutenção</h2>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
            <button 
              onClick={() => setStatusFilter('in_progress')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                statusFilter === 'in_progress' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Em Manutenção
            </button>
            <button 
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                statusFilter === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concluídas
            </button>
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todas
            </button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar equipamento..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => { setFormData(blankForm); setEditingId(null); setSearchQuery(''); setIsModalOpen(true); }} 
          className="bg-[#1e3a5f] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#152a45] transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" /> Registrar Manutenção
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 text-sm">Nenhuma manutenção encontrada</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-lg">{m.equipment_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                      m.status === 'in_progress' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'
                    }`}>
                      <Wrench className="w-2.5 h-2.5" /> {m.status === 'in_progress' ? 'Em andamento' : 'Concluída'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-500 font-medium line-clamp-2 max-w-2xl" title={m.reason}>
                    {m.reason}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5 opacity-80 decoration-slate-300">
                      Lote: <b className="text-slate-600 font-bold uppercase">{m.lot_number || 'S/N'}</b>
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-100">
                      Qtd: <b className="text-slate-600 font-bold">{m.quantity}</b>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5 text-orange-400" /> 
                      Entrada: {new Date(m.start_date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> 
                      {m.status === 'in_progress' ? 'Previsão:' : 'Conclusão:'} {m.end_date ? new Date(m.end_date).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 ml-auto">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Custo</p>
                    <p className="text-2xl font-black text-slate-800">{fmtCurrency(m.cost)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {m.status === 'in_progress' && (
                      <button 
                        onClick={() => handleOpenComplete(m)} 
                        className="px-4 py-1.5 bg-[#ecfdf5] text-[#10b981] border border-[#d1fae5] rounded-lg text-xs font-bold hover:bg-[#d1fae5] transition-all shadow-sm flex items-center gap-1.5" 
                        title="Concluir"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Concluir
                      </button>
                    )}
                    <button onClick={() => handleEdit(m)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(m)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Manutenção' : 'Registrar Manutenção'}>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Equipamento *</label>
            <div className="relative">
              <input
                type="text"
                required={!formData.equipment_id}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent bg-white text-slate-800 shadow-sm"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (formData.equipment_id) {
                    setFormData({ ...formData, equipment_id: '', equipment_name: '' });
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              {isDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {equipments.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(eq => (
                    <div 
                      key={eq.id} 
                      className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                      onClick={() => {
                        setFormData({ ...formData, equipment_id: eq.id, equipment_name: eq.name });
                        setSearchQuery(eq.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{eq.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">Cód: {eq.code || 'N/D'}</p>
                      </div>
                      <span className="bg-[#bbedd3] text-[#1c7b4a] text-xs font-bold px-2.5 py-1 rounded-full">
                        {eq.stock_available} disp.
                      </span>
                    </div>
                  ))}
                  {equipments.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="p-3 text-sm text-slate-500 text-center">Nenhum equipamento encontrado.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {formData.equipment_id && (equipments.find(e => e.id === formData.equipment_id)?.lots?.length || 0) > 0 && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Lote de Origem *</label>
              <div className="relative group">
                <select 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold text-indigo-700 transition-all appearance-none cursor-pointer group-hover:bg-indigo-50/30" 
                  value={formData.lot_number} 
                  onChange={e => setFormData({ ...formData, lot_number: e.target.value })}
                >
                  <option value="" disabled>Selecione o lote...</option>
                  {equipments.find(e => e.id === formData.equipment_id)?.lots?.map(l => (
                    <option key={l.lot_number} value={l.lot_number} disabled={l.quantity === 0}>
                      Lote {l.lot_number} ({l.quantity} disponíveis)
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 group-hover:text-indigo-600 transition-colors">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Quantidade</label>
            <input 
              type="number" 
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent shadow-sm"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              max={formData.lot_number ? equipments.find(e => e.id === formData.equipment_id)?.lots?.find(l => l.lot_number === formData.lot_number)?.quantity : undefined}
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Descrição do problema *</label>
            <textarea 
              required 
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent resize-none shadow-sm"
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Data Entrada</label>
              <input 
                required 
                type="date" 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent text-slate-700 shadow-sm"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Previsão de Saída</label>
              <input 
                type="date" 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent text-slate-700 shadow-sm"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Custo da Manutenção (R$)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8191a0] focus:border-transparent shadow-sm"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="pt-2 flex gap-4 mt-6">
            <button 
              type="button" 
              onClick={closeModal} 
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="flex-1 px-4 py-2.5 bg-[#8b9cb0] hover:bg-[#7a8c9f] text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-70 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCompleteModalOpen} onClose={closeModal} title="Concluir Manutenção">
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 mb-4">
            Confirme os dados para finalizar a manutenção de <strong>{formData.equipment_name}</strong>.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Data de Conclusão *</label>
              <input 
                required 
                type="date" 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-slate-700 shadow-sm"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Custo Final (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-4 mt-6">
            <button 
              type="button" 
              onClick={closeModal} 
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-70 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle className="w-4 h-4" />
              Confirmar Conclusão
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!maintenanceToDelete} onClose={() => setMaintenanceToDelete(null)} title="Excluir Manutenção">
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-800 text-sm">Esta ação é irreversível!</p>
              <p className="text-red-600/80 text-xs">O registro de manutenção será removido e, se estiver "Em andamento", os equipamentos voltarão ao estoque disponível.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setMaintenanceToDelete(null)} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all">Voltar</button>
            <button onClick={confirmDelete} className="px-6 py-2.5 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md shadow-red-100">Excluir Agora</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
