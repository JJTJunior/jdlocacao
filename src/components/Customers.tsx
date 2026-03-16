import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Mail, Phone, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';

interface Customer {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
}

interface CustomersProps {
  userId: string;
  initialSearch?: string;
}

export function Customers({ userId, initialSearch = '' }: CustomersProps) {
  const { rows: customers, loading, insert, update, remove } = useSupabaseTable<Customer>('customers', userId);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = { name: '', email: '', phone: '', document: '', cep: '', address: '', number: '', neighborhood: '', city: '' };
  const [formData, setFormData] = useState(blankForm);

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setFormData(blankForm); };

  const handleEdit = (c: Customer) => {
    setEditingId(c.id);
    setFormData({ name: c.name, email: c.email || '', phone: c.phone, document: c.document || '', cep: c.cep || '', address: c.address || '', number: c.number || '', neighborhood: c.neighborhood || '', city: c.city || '' });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (customerToDelete) { await remove(customerToDelete); setCustomerToDelete(null); }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) setFormData(prev => ({ ...prev, address: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade || '' }));
      } catch {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      await update(editingId, formData);
    } else {
      await insert(formData as any);
    }
    setSaving(false);
    closeModal();
  };

  const filtered = customers
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.document && c.document.includes(searchTerm)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Cadastro de Clientes</h2>
        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" /> Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar clientes por nome ou documento..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Nome / Razão Social</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Documento</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : filtered.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{customer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{customer.email || '-'}</div>
                      <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{customer.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">{customer.document || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(customer)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setCustomerToDelete(customer.id)} className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Cliente' : 'Novo Cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Construtora Silva" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label><input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CPF / CNPJ</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.document} onChange={e => setFormData({ ...formData, document: e.target.value })} placeholder="000.000.000-00" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CEP</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.cep} onChange={e => setFormData({ ...formData, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, Avenida..." /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Número</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} placeholder="123" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.neighborhood} onChange={e => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Centro" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="São Paulo" /></div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} title="Confirmar Exclusão">
        <div className="space-y-4">
          <p className="text-slate-700">Tem certeza que deseja excluir este cliente?</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setCustomerToDelete(null)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
