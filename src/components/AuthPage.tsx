import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Truck, Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(() => {
    const saved = localStorage.getItem('@alugaobra:company');
    return saved ? JSON.parse(saved) : null;
  });

  React.useEffect(() => {
    // Try to update from Supabase if possible (won't work if RLS is strict, but good to have)
    supabase.from('company_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setCompany(data);
        localStorage.setItem('@alugaobra:company', JSON.stringify(data));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro ou faça login diretamente.');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
        'User already registered': 'Este e-mail já está cadastrado. Tente fazer login.',
        'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
      };
      setError(messages[err.message] || err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 rounded-3xl overflow-hidden shadow-xl shadow-indigo-950/40 bg-white p-1">
            <img src={company?.logo || "/logo.png"} alt={company?.name || "JD Locação"} className="w-full h-full object-cover rounded-2xl" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">{company?.name || 'JD Locação'}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest opacity-80">{company?.slogan || 'Gestão de Locações'}</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Mode toggle */}
          <div className="flex bg-slate-800/60 rounded-xl p-1 mb-8">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'login'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'signup'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Criar conta
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {mode === 'login'
                ? 'Acesse o painel de gestão da sua locadora.'
                : 'Comece a gerenciar sua locadora hoje mesmo.'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-[10px] mt-8 uppercase font-bold tracking-[0.2em] opacity-40">
          © {new Date().getFullYear()} {company?.name || 'JD Locação'} — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
