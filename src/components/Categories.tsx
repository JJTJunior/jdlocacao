import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';

interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: 'equipment' | 'expense';
}

interface CategoriesProps {
  userId: string;
}

export function Categories({ userId }: CategoriesProps) {
  const { rows: categories, loading, insert, update, remove } = useSupabaseTable<Category>('categories', userId);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'equipment' | 'expense'>('equipment');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({ name: '', type: 'equipment' as Category['type'] });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', type: activeTab });
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({ name: cat.name, type: cat.type });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (categoryToDelete) {
      await remove(categoryToDelete);
      setCategoryToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      await update(editingId, { name: formData.name, type: formData.type });
    } else {
      await insert({ name: formData.name, type: formData.type } as any);
    }
    setSaving(false);
    closeModal();
  };

  const filteredCategories = categories
    .filter(c => c.type === activeTab && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Cadastro de Categorias</h2>
        <button
          onClick={() => { setFormData({ name: '', type: activeTab }); setIsModalOpen(true); }}
          className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Nova Categoria
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(['equipment', 'expense'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab
                ? tab === 'equipment' ? 'border-indigo-600 text-indigo-600'
                  : 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab === 'equipment' && <Package className="w-4 h-4" />}
            {tab === 'expense' && <TrendingDown className="w-4 h-4" />}
            {tab === 'equipment' ? 'Equipamentos' : 'Despesas'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar categorias..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Nome da Categoria</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : filteredCategories.map(category => (
                <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{category.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(category)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setCategoryToDelete(category.id)} className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCategories.length === 0 && (
                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">Nenhuma categoria encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 text-sm text-slate-500 bg-slate-50">
          Mostrando {filteredCategories.length} categorias
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as Category['type'] })}>
              <option value="equipment">Equipamento</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Categoria</label>
            <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Concretagem" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!categoryToDelete} onClose={() => setCategoryToDelete(null)} title="Confirmar Exclusão">
        <div className="space-y-4">
          <p className="text-slate-700">Tem certeza que deseja excluir esta categoria? Esta ação não poderá ser desfeita.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setCategoryToDelete(null)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
