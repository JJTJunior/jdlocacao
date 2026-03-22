/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Menu, Truck, LogOut, Bell, ChevronDown, ChevronLeft } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Equipments } from './components/Equipments';
import { Categories } from './components/Categories';
import { Orders } from './components/Orders';
import { Customers } from './components/Customers';
import { Finance } from './components/Finance';

import { Reports } from './components/Reports';
import { CompanySettings } from './components/CompanySettings';
import { Maintenance } from './components/Maintenance';
import { Returns } from './components/Returns';

function getInitials(email: string) {
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  categorias: 'Cadastro de Categorias',
  equipamentos: 'Equipamentos',
  pedidos: 'Aluguéis',
  manutencao: 'Manutenção',
  clientes: 'Clientes',
  financeiro: 'Controle Financeiro',

  relatorios: 'Relatórios',
  empresa: 'Minha Empresa',
  devolucoes: 'Controle de Devoluções',
};

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [returnsFilter, setReturnsFilter] = useState<'today' | 'next3' | 'late'>('today');
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSubTab, setInitialSubTab] = useState('');

  const [company, setCompany] = useState<any>(() => {
    const saved = localStorage.getItem('@alugaobra:company');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem('@alugaobra:company');
      setCompany(saved ? JSON.parse(saved) : null);
    };
    window.addEventListener('company-updated', handleUpdate);
    return () => window.removeEventListener('company-updated', handleUpdate);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserMenuOpen(false);
  };

  const userId = session?.user?.id ?? '';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':    return <Dashboard userId={userId} onNavigate={(tab, search, subTab) => { 
        if (tab === 'devolucoes' && search) setReturnsFilter(search as any);
        setInitialSearch(search || '');
        setInitialSubTab(subTab || '');
        setActiveTab(tab); 
      }} />;
      case 'categorias':   return <Categories userId={userId} />;
      case 'equipamentos': return <Equipments userId={userId} initialSearch={initialSearch} />;
      case 'pedidos':      return <Orders userId={userId} initialSearch={initialSearch} initialTab={initialSubTab} />;
      case 'manutencao':   return <Maintenance userId={userId} initialSearch={initialSearch} initialTab={initialSubTab} />;
      case 'clientes':     return <Customers userId={userId} initialSearch={initialSearch} />;
      case 'financeiro':   return <Finance userId={userId} />;

      case 'relatorios':   return <Reports userId={userId} />;
      case 'empresa':      return <CompanySettings userId={userId} />;
      case 'devolucoes':   return <Returns userId={userId} initialFilter={returnsFilter} onBack={() => setActiveTab('dashboard')} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
            <h2 className="text-2xl font-bold mb-2">Em Desenvolvimento</h2>
            <p>Esta funcionalidade estará disponível em breve.</p>
          </div>
        );
    }
  };

  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Truck className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  const userEmail = session.user?.email || '';
  const initials = getInitials(userEmail);
  const pageTitle = PAGE_TITLES[activeTab] || 'AlugaObra';

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { 
          setInitialSearch('');
          setInitialSubTab('');
          setActiveTab(tab); 
          setIsMobileMenuOpen(false); 
        }}
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">

        {/* Desktop TopBar */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 z-10 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="mr-2 p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500 transition-colors"
                title="Voltar para o Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="w-10 h-10 rounded-xl object-cover bg-slate-50 border border-slate-100 p-0.5" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-base font-semibold text-slate-800 leading-tight">{pageTitle}</h1>
              <p className="text-xs text-slate-400 font-medium">
                {company?.name || 'AlugaObra'}{company?.slogan ? ` · ${company.slogan}` : ' · Gestão de Locações'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"><Bell className="w-5 h-5" /></button>
            <div className="relative">
              <button onClick={() => setUserMenuOpen(v => !v)} className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-slate-700 leading-tight max-w-[160px] truncate" title={userEmail}>{userEmail}</p>
                  <p className="text-xs text-slate-400">Administrador</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100"><p className="text-xs text-slate-500">Logado como</p><p className="text-sm font-medium text-slate-800 truncate" title={userEmail}>{userEmail}</p></div>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"><LogOut className="w-4 h-4" />Sair</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between z-20 shadow-md flex-shrink-0">
          <div className="flex items-center gap-3">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="p-2 -ml-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                title="Voltar"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {company?.logo
              ? <img src={company.logo} alt={company.name} className="w-10 h-10 rounded-xl object-cover bg-white p-0.5 shadow-sm" />
              : <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><Truck className="w-6 h-6 text-white" /></div>}
            <div className="flex flex-col">
              <span className="text-base font-bold text-white leading-tight truncate max-w-[150px]">{company?.name || 'AlugaObra'}</span>
              <span className="text-[10px] text-slate-400 font-medium leading-tight">{company?.slogan || 'Gestão de Locações'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleLogout} title="Sair" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 hover:bg-slate-800 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
