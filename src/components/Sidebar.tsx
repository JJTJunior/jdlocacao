import { useState, useEffect } from 'react';
import {
  Package,
  FileText,
  Truck,
  Users,
  DollarSign,
  BarChart,
  LayoutDashboard,
  Tags,
  X,
  FolderOpen,
  Building2,
  Wrench
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'equipamentos', label: 'Equipamentos', icon: Package },
    { id: 'pedidos', label: 'Aluguéis', icon: FileText },
    { id: 'manutencao', label: 'Manutenção', icon: Wrench },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'categorias', label: 'Categorias', icon: Tags },
    { id: 'empresa', label: 'Minha Empresa', icon: Building2 },
  ];

  const [company, setCompany] = useState<any>(() => {
    const saved = localStorage.getItem('@alugaobra:company');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem('@alugaobra:company');
      setCompany(saved ? JSON.parse(saved) : null);
    };
    window.addEventListener('company-updated', handleUpdate);
    return () => window.removeEventListener('company-updated', handleUpdate);
  }, []);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex justify-between items-center border-b border-slate-800 mb-2">
          <div className="flex items-center gap-3">
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="w-11 h-11 rounded-xl object-cover bg-white p-0.5 shadow-sm" />
            ) : (
              <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <Truck className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-base font-bold text-white leading-tight truncate max-w-[120px]">
                {company?.name || 'AlugaObra'}
              </span>
              <span className="text-xs text-slate-400 font-medium truncate max-w-[120px]">
                {company?.slogan || 'Gestão de Locações'}
              </span>
            </div>
          </div>
          <button 
            className="md:hidden p-2 -mr-2 hover:bg-slate-800 rounded-lg transition-colors self-start"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive 
                        ? 'bg-[#1e3a5f] text-white shadow-md' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'text-blue-400 scale-110' : 'group-hover:scale-110'
                    }`} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          &copy; {new Date().getFullYear()} {company?.name || 'AlugaObra'}
        </div>
      </div>
    </>
  );
}
