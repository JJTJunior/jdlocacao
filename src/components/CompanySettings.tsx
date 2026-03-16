import React, { useState, useEffect } from 'react';
import { Building2, Upload, Trash2, Phone, Mail, MapPin, Globe, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface CompanyData {
  logo: string | null;
  name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  website: string;
  slogan: string;
}

const blank: CompanyData = { logo: null, name: '', cnpj: '', phone: '', whatsapp: '', email: '', address: '', city: '', state: '', cep: '', website: '', slogan: '' };

interface CompanySettingsProps {
  userId: string;
  onCompanyUpdate?: (data: CompanyData) => void;
}

export function CompanySettings({ userId, onCompanyUpdate }: CompanySettingsProps) {
  const [formData, setFormData] = useState<CompanyData>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('company_settings').select('*').eq('user_id', userId).maybeSingle();
      if (data) {
        const c: CompanyData = { logo: data.logo, name: data.name, cnpj: data.cnpj, phone: data.phone, whatsapp: data.whatsapp, email: data.email, address: data.address, city: data.city, state: data.state, cep: data.cep, website: data.website, slogan: data.slogan };
        setFormData(c);
        // Also update localStorage for Sidebar/App compatibility
        localStorage.setItem('@alugaobra:company', JSON.stringify(c));
        window.dispatchEvent(new Event('company-updated'));
      }
      setLoading(false);
    };
    if (userId) load();
  }, [userId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) setFormData(prev => ({ ...prev, address: data.logradouro ? `${data.logradouro}, ${data.bairro}` : prev.address, city: data.localidade || prev.city, state: data.uf || prev.state }));
      } catch {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { user_id: userId, logo: formData.logo, name: formData.name, cnpj: formData.cnpj, phone: formData.phone, whatsapp: formData.whatsapp, email: formData.email, address: formData.address, city: formData.city, state: formData.state, cep: formData.cep, website: formData.website, slogan: formData.slogan, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('company_settings').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      await supabase.from('company_settings').update(payload).eq('user_id', userId);
    } else {
      await supabase.from('company_settings').insert(payload);
    }
    // Keep localStorage in sync for header/sidebar display
    localStorage.setItem('@alugaobra:company', JSON.stringify(formData));
    window.dispatchEvent(new Event('company-updated'));
    onCompanyUpdate?.(formData);
    setSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-800 text-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0"><Building2 className="w-6 h-6" /></div>
          <div><h2 className="text-xl font-bold text-slate-800">Dados da Empresa</h2><p className="text-sm text-slate-500">Informações sincronizadas em todos os dispositivos</p></div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Logo da Empresa</label>
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center flex-shrink-0">
                {formData.logo ? <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" /> : <Building2 className="w-10 h-10 text-slate-300" />}
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />Enviar logo
                  <input type="file" className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} />
                </label>
                <p className="text-xs text-slate-500">PNG, JPG ou SVG — recomendado 200×200px</p>
                {formData.logo && <button type="button" onClick={() => setFormData(prev => ({ ...prev, logo: null }))} className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1"><Trash2 className="w-3 h-3" />Remover logo</button>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa *</label><input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome da sua empresa" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label><div className="relative"><Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 0000-0000" /></div></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label><div className="relative"><Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(00) 9 0000-0000" /></div></div>
          </div>

          <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label><div className="relative"><Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="email" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com.br" /></div></div>

          <div><label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label><div className="relative"><MapPin className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, número, bairro" /></div></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Estado (UF)</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} placeholder="UF" maxLength={2} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CEP</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.cep} onChange={e => setFormData({ ...formData, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" /></div>
          </div>

          <div><label className="block text-sm font-medium text-slate-700 mb-1">Site</label><div className="relative"><Globe className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="www.empresa.com.br" /></div></div>

          <div><label className="block text-sm font-medium text-slate-700 mb-1">Slogan / Observações</label><textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]" value={formData.slogan} onChange={e => setFormData({ ...formData, slogan: e.target.value })} placeholder="Ex: Qualidade e confiança em locação de equipamentos" /></div>

          <div className="pt-4 flex items-center justify-end gap-4">
            {showSuccess && <div className="flex items-center gap-2 text-emerald-600 font-medium"><CheckCircle2 className="w-5 h-5" />Dados salvos!</div>}
            <button type="submit" disabled={saving} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium transition-colors flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar dados
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
