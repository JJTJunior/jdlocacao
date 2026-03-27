import React, { useState } from 'react';
import { Plus, Search, Truck, ArrowLeftRight, MapPin, Edit, Trash2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';

interface Delivery {
  id: string;
  user_id?: string;
  order_id: string;
  customer_name: string;
  address: string;
  date: string;
  type: 'delivery' | 'return';
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
}

interface DeliveriesProps {
  userId: string;
}

export function Deliveries({ userId }: DeliveriesProps) {
  const { rows: deliveries, loading, insert, update, remove } = useSupabaseTable<Delivery>('deliveries', userId);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = { order_id: '', customer_name: '', address: '', date: new Date().toISOString().split('T')[0], type: 'delivery' as Delivery['type'], status: 'pending' as Delivery['status'] };
  const [formData, setFormData] = useState(blankForm);

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setFormData(blankForm); };

  const handleEdit = (d: Delivery) => {
    setEditingId(d.id);
    setFormData({ order_id: d.order_id, customer_name: d.customer_name, address: d.address, date: d.date, type: d.type, status: d.status });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editingId) { await update(editingId, formData); }
    else { await insert(formData as any); }
    setSaving(false);
    closeModal();
  };

  const filtered = deliveries.filter(d =>
    d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.order_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Delivery['status']) => {
    const map: Record<string, [string, string]> = {
      completed: ['bg-green-100 text-green-800', 'Concluído'],
      in_transit: ['bg-blue-100 text-blue-800', 'Em Trânsito'],
      pending: ['bg-yellow-100 text-yellow-800', 'Pendente'],
      cancelled: ['bg-red-100 text-red-800', 'Cancelado'],
    };
    const [cls, label] = map[status] || ['bg-slate-100 text-slate-800', status];
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Entrega e Devolução</h2>
        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" /> Novo Agendamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Agendado', value: deliveries.length, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'Pendentes', value: deliveries.filter(d => d.status === 'pending').length, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Em Trânsito', value: deliveries.filter(d => d.status === 'in_transit').length, color: 'bg-blue-100 text-blue-600' },
          { label: 'Concluídos', value: deliveries.filter(d => d.status === 'completed').length, color: 'bg-green-100 text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color}`}><Truck className="w-6 h-6" /></div>
            <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-800">{value}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por pedido ou cliente..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead><tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider"><th className="px-6 py-4 font-medium">Tipo</th><th className="px-6 py-4 font-medium">Pedido / Cliente</th><th className="px-6 py-4 font-medium">Endereço</th><th className="px-6 py-4 font-medium">Data</th><th className="px-6 py-4 font-medium">Status</th><th className="px-6 py-4 font-medium text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : filtered.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      {d.type === 'delivery' ? <><Truck className="w-4 h-4 text-indigo-500" />Entrega</> : <><ArrowLeftRight className="w-4 h-4 text-orange-500" />Devolução</>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-indigo-600">{d.order_id}</div><div className="text-sm text-slate-600">{d.customer_name}</div></td>
                  <td className="px-6 py-4"><div className="flex items-start gap-2 text-sm text-slate-600 max-w-xs"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /><span className="truncate">{d.address}</span></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">{new Date(d.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(d.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(d)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => remove(d.id)} className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum agendamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Agendamento' : 'Novo Agendamento'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label><select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as Delivery['type'] })}><option value="delivery">Entrega</option><option value="return">Devolução</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">ID do Pedido</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.order_id} onChange={e => setFormData({ ...formData, order_id: e.target.value })} placeholder="Ex: ORD-1024" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cliente</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} placeholder="Ex: Construtora Silva" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, Número, Bairro, Cidade" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Data</label><input required type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label><select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Delivery['status'] })}><option value="pending">Pendente</option><option value="in_transit">Em Trânsito</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editingId ? 'Salvar Alterações' : 'Salvar Agendamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
