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

        {/* Customers Grid/Cards Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {loading ? (
            <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 text-sm">
              Nenhum cliente encontrado.
            </div>
          ) : (
            filtered.map(customer => (
              <div key={customer.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-indigo-600 transition-colors uppercase">{customer.name}</h3>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-tighter">
                      Ativo
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <Mail className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <span className="text-sm truncate">{customer.email || 'Sem e-mail'}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <Phone className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <span className="text-sm font-medium">{customer.phone}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Documento</span>
                    <span className="text-sm text-slate-700 font-medium">{customer.document || '---'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-50">
                  <button 
                    onClick={() => handleEdit(customer)} 
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCustomerToDelete(customer.id)} 
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
