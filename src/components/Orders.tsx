import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Filter, Eye, Printer, Edit, Trash2, X, Loader2, Calendar, DollarSign, User, Clock, FileText, CheckCircle2, ChevronDown, Phone, Save } from 'lucide-react';
import { Modal } from './Modal';
import { useSupabaseTable } from '../lib/useSupabaseTable';
import { supabase } from '../lib/supabaseClient';

interface OrderItem { equipmentId: string; equipmentName: string; quantity: number; price?: number; lotNumber?: string; }
interface EquipmentRow { id: string; name: string; price_per_week: number; price_per_day: number; price_per_month: number; stock_available: number; stock_rented: number; lots?: { lot_number: string; quantity: number }[]; }
interface CustomerRow { id: string; name: string; phone: string; document: string; }

interface OrderRow {
  id: string;
  user_id?: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  contract_number?: string;
  payment_method?: string;
  observations?: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: 'pending' | 'rented' | 'completed';
  items: OrderItem[];
}

interface OrdersProps { 
  userId: string; 
  initialSearch?: string;
  initialTab?: string;
}

export function Orders({ userId, initialSearch = '', initialTab = 'ativos' }: OrdersProps) {
  const { rows: orders, loading, insert, update, remove } = useSupabaseTable<OrderRow>('orders', userId);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('equipments').select('id, name, price_per_week, price_per_day, price_per_month, stock_available, stock_rented, lots').eq('user_id', userId).then(({ data }) => data && setEquipments(data));
    supabase.from('customers').select('id, name, phone, document').eq('user_id', userId).then(({ data }) => data && setCustomers(data));
  }, [userId]);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState(initialTab || 'ativos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderRow | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal States
  const [customerSearchTab, setCustomerSearchTab] = useState<'name' | 'phone' | 'document'>('name');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const blankForm = { 
    customer_id: '', 
    customer_name: '', 
    customer_phone: '',
    contract_number: '',
    payment_method: 'Dinheiro',
    observations: '',
    start_date: new Date().toISOString().split('T')[0], 
    end_date: '', 
    total_amount: 0, 
    status: 'rented' as OrderRow['status'], 
    items: [] as (OrderItem & { price: number })[] 
  };
  const [formData, setFormData] = useState(blankForm);
  const [formError, setFormError] = useState<string | null>(null);


  const registerRevenue = async (order: OrderRow) => {
    const description = `Locação: ${order.customer_name} (Contrato: ${order.contract_number || 'S/N'})`;
    const payload = {
      user_id: userId,
      date: order.status === 'completed' ? (order.end_date || new Date().toISOString().split('T')[0]) : order.start_date,
      description,
      category: 'Aluguel',
      type: 'income',
      amount: Number(order.total_amount),
      status: 'paid'
    };

    // Try to find existing transaction for this contract
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .ilike('description', `%${order.contract_number}%`)
      .maybeSingle();

    let error;
    if (existing) {
      const { error: updError } = await supabase.from('transactions').update(payload).eq('id', existing.id);
      error = updError;
    } else {
      const { error: insError } = await supabase.from('transactions').insert(payload);
      error = insError;
    }

    if (error) {
      console.error('Error registering revenue:', error);
      alert('Erro ao registrar receita no financeiro. Verifique o financeiro.');
    }
  };

  const updateEquipmentStock = async (eqId: string, q: number, deltaAvailable: number, deltaRented: number, lotNumber?: string) => {
    const { data: eq } = await supabase.from('equipments').select('stock_available, stock_rented, lots').eq('id', eqId).single();
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
        stock_rented: (eq.stock_rented || 0) + (deltaRented * q),
        lots: updatedLots
      }).eq('id', eqId);
      
      // Refresh local list
      supabase.from('equipments').select('id, name, price_per_week, price_per_day, price_per_month, stock_available, stock_rented, lots').eq('user_id', userId).then(({ data }) => data && setEquipments(data));
    }
  };

  const handleDeleteConfirm = async () => {
    if (orderToDelete) { 
      const order = orders.find(o => o.id === orderToDelete);
      if (order) {
        if (order.status === 'rented') {
          // Restore stock
          for (const item of (order.items || [])) {
            await updateEquipmentStock(item.equipmentId, item.quantity, 1, -1, item.lotNumber);
          }
        }
        
        // Remove associated transactions from finance (search by contract number in description)
        if (order.contract_number) {
          const { data: transToDelete } = await supabase
            .from('transactions')
            .select('id')
            .ilike('description', `%${order.contract_number}%`);
            
          if (transToDelete && transToDelete.length > 0) {
            for (const t of transToDelete) {
              await supabase.from('transactions').delete().eq('id', t.id);
            }
          }
        }
      }
      await remove(orderToDelete); 
      setOrderToDelete(null); 
    }
  };

  const handleAddItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { equipmentId: '', equipmentName: '', quantity: 1, price: 0, lotNumber: '' }] }));

  const handleRemoveItem = (i: number) => setFormData(prev => { const items = [...prev.items]; items.splice(i, 1); return { ...prev, items }; });

  const handleItemChange = (idx: number, field: string, value: any) => {
    setFormData(prev => {
      const items = [...prev.items];
      if (field === 'equipmentId') {
        const eq = equipments.find(e => e.id === value);
        if (eq) {
          const days = prev.end_date && prev.start_date 
            ? Math.max(1, Math.ceil((new Date(prev.end_date + 'T12:00:00').getTime() - new Date(prev.start_date + 'T12:00:00').getTime()) / 86400000))
            : 1;
          
          const flatPrice = calculateProratedPrice(eq, days);

          items[idx] = { 
            ...items[idx], 
            equipmentId: eq.id, 
            equipmentName: eq.name, 
            price: Math.round(flatPrice * 100) / 100, 
            lotNumber: eq.lots && eq.lots.length > 0 ? eq.lots[0].lot_number : '' 
          };
        }
      } else {
        items[idx] = { ...items[idx], [field]: value };
      }
      return { ...prev, items };
    });
  };
  // Helper to calculate prorated price based on duration
  const calculateProratedPrice = useCallback((eq: EquipmentRow, days: number) => {
    const pDay = Number(eq.price_per_day) || 0;
    const pWeek = Number(eq.price_per_week) || 0;
    const pMonth = Number(eq.price_per_month) || 0;

    if (days >= 30 && pMonth > 0) {
      const months = Math.floor(days / 30);
      const remDays = days % 30;
      return (months * pMonth) + (remDays * (pMonth / 30));
    }
    if (days >= 7 && pWeek > 0) {
      const weeks = Math.floor(days / 7);
      const remDays = days % 7;
      return (weeks * pWeek) + (remDays * pDay);
    }
    return days * pDay;
  }, []);

  // Update item prices only when dates change OR equipment changes
  // This logic picks the best rate from the equipment's registration
  const refreshItemPrices = useCallback((items: any[], startDate: string, endDate: string) => {
    if (!startDate || !endDate) return items;
    const days = Math.max(1, Math.ceil((new Date(endDate + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000));
    
    return items.map(item => {
      const eq = equipments.find(e => e.id === item.equipmentId);
      if (!eq) return item;

      const flatPrice = calculateProratedPrice(eq, days);
      return { ...item, price: Math.round(flatPrice * 100) / 100 };
    });
  }, [equipments, calculateProratedPrice]);

  // When dates change, automatically refresh prices based on best rate
  useEffect(() => {
    if (formData.start_date && formData.end_date && formData.items.length > 0) {
      const updatedItems = refreshItemPrices(formData.items, formData.start_date, formData.end_date);
      // Only update if prices actually changed to avoid infinite loop
      const hasChanged = JSON.stringify(updatedItems.map(i => i.price)) !== JSON.stringify(formData.items.map(i => i.price));
      if (hasChanged) {
        setFormData(prev => ({ ...prev, items: updatedItems }));
      }
    }
  }, [formData.start_date, formData.end_date, refreshItemPrices]);

  // Final total calculation
  useEffect(() => {
    if (formData.start_date && formData.end_date && formData.items.length > 0) {
      const total = formData.items.reduce((s, item) => s + (Number(item.price) * item.quantity), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      if (formData.total_amount !== roundedTotal) {
        setFormData(prev => ({ ...prev, total_amount: roundedTotal }));
      }
    }
  }, [formData.items]);

  const handleEdit = (order: OrderRow) => {
    setFormError(null);
    setEditingId(order.id);
    setFormData({
      customer_id: order.customer_id, 
      customer_name: order.customer_name,
      customer_phone: order.customer_phone || '',
      contract_number: order.contract_number || '',
      payment_method: order.payment_method || 'Dinheiro',
      observations: order.observations || '',
      start_date: order.start_date, 
      end_date: order.end_date,
      total_amount: Number(order.total_amount), 
      status: order.status,
      items: (order.items || []).map(item => {
        const unitPrice = item.price || equipments.find(e => e.id === item.equipmentId)?.price_per_week || 0;
        return { ...item, price: unitPrice, lotNumber: item.lotNumber || '' };
      })
    });
    setCustomerSearchQuery(order.customer_name);
    setIsModalOpen(true);
  };

  const closeModal = () => { 
    setIsModalOpen(false); 
    setEditingId(null); 
    setFormData(blankForm);
    setFormError(null);
    setCustomerSearchQuery('');
    setCustomerSearchTab('name');
    setShowCustomerDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id) return;
    setSaving(true);
    
    // Generate contract number if missing
    const finalContract = formData.contract_number || `LOC-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Validation: Check stock availability
    if (formData.status === 'rented') {
      for (const item of formData.items) {
        const eq = equipments.find(e => e.id === item.equipmentId);
        if (eq) {
          // Calculate what's already rented by this specific order if editing
          const currentlyRentedByThisOrder = editingId 
            ? (orders.find(o => o.id === editingId)?.items.find(i => i.equipmentId === item.equipmentId)?.quantity || 0)
            : 0;
          
          if (item.quantity > (eq.stock_available + currentlyRentedByThisOrder)) {
            setFormError(`Estoque insuficiente para ${item.equipmentName}. Disponível: ${eq.stock_available + currentlyRentedByThisOrder}`);
            setSaving(false);
            return;
          }

          // Lot validation
          if (eq.lots && eq.lots.length > 0) {
            if (!item.lotNumber) {
              setFormError(`Por favor, selecione um lote para ${item.equipmentName}`);
              setSaving(false);
              return;
            }
            const lot = eq.lots.find(l => l.lot_number === item.lotNumber);
            const currentlyRentedFromThisLot = editingId 
              ? (orders.find(o => o.id === editingId)?.items.find(i => i.equipmentId === item.equipmentId && i.lotNumber === item.lotNumber)?.quantity || 0)
              : 0;

            if (lot && item.quantity > (lot.quantity + currentlyRentedFromThisLot)) {
              setFormError(`Estoque insuficiente no lote ${item.lotNumber} para ${item.equipmentName}. Disponível no lote: ${lot.quantity + currentlyRentedFromThisLot}`);
              setSaving(false);
              return;
            }
          }
        }
      }
    }

    setFormError(null);
    const payload = {
      customer_id: formData.customer_id, 
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      contract_number: finalContract,
      payment_method: formData.payment_method,
      observations: formData.observations,
      start_date: formData.start_date, 
      end_date: formData.end_date,
      total_amount: formData.total_amount, 
      status: formData.status,
      items: formData.items.map(({ equipmentId, equipmentName, quantity, price, lotNumber }) => ({ equipmentId, equipmentName, quantity, price, lotNumber }))
    };
    const { data, error } = editingId 
      ? await update(editingId, payload) 
      : await insert(payload as any);

    if (error) {
       console.error('Error saving order:', error);
       alert(`Erro ao salvar aluguel: ${error.message || 'Verifique se as colunas no banco de dados foram criadas.'}`);
       setSaving(false);
       return;
    }
    if (!editingId && formData.status === 'rented') {
      // New rental: take from available, add to rented
      for (const item of formData.items) {
        await updateEquipmentStock(item.equipmentId, item.quantity, -1, 1, item.lotNumber);
      }
      // Register revenue immediately
      await registerRevenue({ ...payload, id: 'temp' } as any);
    } else if (editingId) {
      const oldOrder = orders.find(o => o.id === editingId);
      if (oldOrder) {
        // If status changed to completed, add back to specific lots
        if (oldOrder.status === 'rented' && formData.status === 'completed') {
          for (const item of oldOrder.items) {
            await updateEquipmentStock(item.equipmentId, item.quantity, 1, -1, item.lotNumber);
          }
          await registerRevenue({ ...oldOrder, ...payload });
        } 
        // If status was not rented and now it is, subtract from specific lots
        else if (oldOrder.status !== 'rented' && formData.status === 'rented') {
          for (const item of formData.items) {
            await updateEquipmentStock(item.equipmentId, item.quantity, -1, 1, item.lotNumber);
          }
          await registerRevenue({ ...oldOrder, ...payload });
        }
        // If it was already rented but items/quantities/lots changed, we need to balance the diff
        else if (oldOrder.status === 'rented' && formData.status === 'rented') {
          // Simplest way: restore all old stock, then substract all new stock
          for (const item of oldOrder.items) {
            await updateEquipmentStock(item.equipmentId, item.quantity, 1, -1, item.lotNumber);
          }
          for (const item of formData.items) {
            await updateEquipmentStock(item.equipmentId, item.quantity, -1, 1, item.lotNumber);
          }
          await registerRevenue({ ...oldOrder, ...payload });
        }
      }
    }

    setSaving(false);
    closeModal();
  };

  const handlePrint = async (order: OrderRow) => {
    const pw = window.open('', '_blank');
    if (!pw) { alert('Por favor, permita popups para imprimir.'); return; }

    try {
      console.log('Printing order:', order.id);
      // Fetch company settings and full customer data for the receipt
      const { data: company, error: compErr } = await supabase.from('company_settings').select('*').eq('user_id', userId).maybeSingle();
      if (compErr) console.error('Error fetching company:', compErr);
      
      const { data: customer, error: custErr } = await supabase.from('customers').select('*').eq('id', order.customer_id).maybeSingle();
      if (custErr) console.error('Error fetching customer:', custErr);
      
      console.log('Data fetched:', { company: !!company, customer: !!customer });

    const fmtDate = (s: string) => { 
      if (!s) return '-';
      const [y, m, d] = s.split('-'); 
      return `${d}/${m}/${y}`; 
    };
    const fmtR = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const companyName = company?.name || 'JD LOCAÇÃO';
    const companyAddress = company ? `${company.address || ''}, ${company.city || ''} - ${company.state || ''}` : 'Jaboatão, PE';
    const companyEmail = company?.email || 'jdlocacao2014@outlook.com';
    const companyLogo = company?.logo || '';
    
    // Calculate rental duration in days
    const days = Math.max(1, Math.ceil((new Date(order.end_date).getTime() - new Date(order.start_date).getTime()) / 86400000));
    const periodLabel = days === 1 ? '1 dia' : `${days} dias`;

    const copy = (title: string, copyNumber: string) => `
      <div class="receipt-copy">
        <div class="receipt-header">
          <div class="company-brand">
            ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : '<div class="logo-placeholder"></div>'}
            <div class="company-info">
              <h1 class="company-name">${companyName}</h1>
              <p class="company-meta">${companyAddress}</p>
              <p class="company-meta">${companyEmail}</p>
            </div>
          </div>
          <div class="receipt-id">
            <span class="copy-tag">${copyNumber}</span>
            <div class="id-info">
              <h2 class="id-label">Recibo Nº ${order.contract_number || 'S/N'}</h2>
              <p class="issue-date">Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div class="customer-section">
          <h3 class="section-title">DADOS DO CLIENTE</h3>
          <div class="data-grid">
            <div class="data-group">
              <span class="data-label">Nome:</span>
              <span class="data-value">${order.customer_name}</span>
            </div>
            <div class="data-group">
              <span class="data-label">CPF/CNPJ:</span>
              <span class="data-value">${customer?.document || '-'}</span>
            </div>
            <div class="data-group">
              <span class="data-label">Telefone:</span>
              <span class="data-value">${order.customer_phone || customer?.phone || '-'}</span>
            </div>
            <div class="data-group">
              <span class="data-label">Endereço:</span>
              <span class="data-value">${customer ? `${customer.address || ''} ${customer.number || ''} ${customer.neighborhood || ''}, ${customer.city || ''}` : '-'}</span>
            </div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-label">Data de Saída</span>
            <span class="stat-value">${fmtDate(order.start_date)}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Devolução Prevista</span>
            <span class="stat-value">${fmtDate(order.end_date)}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Forma de Pagamento</span>
            <span class="stat-value">${order.payment_method || 'dinheiro'}</span>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th class="center">Qtd</th>
              <th class="center">Período</th>
              <th class="right">Unit.</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map((i: any) => {
              // Fallback to equipment price if not saved in item
              const unitPrice = i.price || equipments.find(e => e.id === i.equipmentId)?.price_per_week || 0;
              const lineTotal = unitPrice * i.quantity * days;
              return `
                <tr>
                  <td>${i.equipmentName}</td>
                  <td class="center">${i.quantity}</td>
                  <td class="center">${periodLabel}</td>
                  <td class="right">${fmtR(unitPrice)}</td>
                  <td class="right">${fmtR(lineTotal)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="total-row">
          <div class="total-box">
            <span class="total-label">TOTAL:</span>
            <span class="total-value">${fmtR(order.total_amount)}</span>
          </div>
        </div>

        ${order.observations ? `
          <div class="observations-section">
            <h3 class="section-title">OBSERVAÇÕES</h3>
            <div class="observations-box">
              <p>${order.observations.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        ` : ''}

        <div class="signatures">
          <div class="sig-block">
            <div class="sig-line"></div>
            <p class="sig-label">Assinatura do Cliente</p>
            <p class="sig-name">${order.customer_name}</p>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <p class="sig-label">Assinatura da Empresa</p>
            <p class="sig-name">${companyName}</p>
          </div>
        </div>
      </div>
    `;

    pw.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo ${order.contract_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background: #fff; }
          
          .receipt-copy { max-width: 800px; margin: 0 auto; padding: 20px 0; }
          
          .receipt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
          .company-brand { display: flex; align-items: center; gap: 15px; }
          .logo { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; }
          .logo-placeholder { width: 50px; height: 50px; background: #f1f5f9; border-radius: 8px; }
          .company-name { font-size: 20px; font-weight: 800; color: #0f172a; }
          .company-meta { font-size: 11px; color: #64748b; margin-top: 1px; }
          
          .receipt-id { text-align: right; }
          .copy-tag { background: #1e3a5f; color: white; padding: 4px 12px; rounded-full; font-size: 11px; font-weight: 800; border-radius: 99px; text-transform: uppercase; display: inline-block; margin-bottom: 8px; }
          .id-label { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
          .issue-date { font-size: 11px; color: #94a3b8; }
          
          .customer-section { background: #f8fafc; border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid #f1f5f9; }
          .section-title { font-size: 10px; font-weight: 800; color: #94a3b8; margin-bottom: 12px; letter-spacing: 0.1em; }
          .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; }
          .data-group { display: flex; gap: 8px; font-size: 13px; }
          .data-label { font-weight: 600; color: #64748b; }
          .data-value { font-weight: 700; color: #334155; }
          
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .stat-box { background: #eff6ff; border-radius: 12px; padding: 15px; text-align: center; border: 1px solid #dbeafe; }
          .stat-label { font-size: 11px; color: #3b82f6; font-weight: 700; margin-bottom: 5px; display: block; }
          .stat-value { font-size: 15px; color: #1e293b; font-weight: 900; }
          
          .items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; font-size: 13px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
          .items-table th { background: #1e3a5f; color: white; font-weight: 800; text-transform: uppercase; font-size: 11px; padding: 12px 15px; }
          .items-table td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
          .items-table tr:last-child td { border-bottom: none; }
          .center { text-align: center; }
          .right { text-align: right; }
          
          .total-row { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .total-box { background: #1e3a5f; color: white; padding: 15px 30px; border-radius: 8px; display: flex; align-items: center; gap: 40px; box-shadow: 0 4px 12px rgba(30, 58, 95, 0.2); }
          .total-label { font-size: 16px; font-weight: 900; letter-spacing: 0.1em; }
          .total-value { font-size: 20px; font-weight: 900; }
          
          .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 20px; }
          .sig-block { flex: 1; text-align: center; }
          .sig-line { border-top: 1.5px solid #334155; margin-bottom: 8px; }
          .sig-label { font-size: 11px; color: #64748b; font-weight: 700; }
          .sig-name { font-size: 12px; color: #0f172a; font-weight: 800; margin-top: 2px; }

          .observations-section { margin-bottom: 25px; }
          .observations-box { background: #fff; border: 1.5px dashed #e2e8f0; border-radius: 12px; padding: 15px; font-size: 13px; color: #475569; min-height: 60px; line-height: 1.6; }
          
          .divider { margin: 40px 0; border-top: 2px dashed #cbd5e1; position: relative; }
          .divider::after { content: '✂ Destacar aqui ✂'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 0 20px; color: #94a3b8; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            .divider { display: none; }
            .receipt-copy { 
              page-break-after: always; 
              break-after: page; 
              margin: 0 !important;
              padding: 0 !important;
            }
            .receipt-copy:last-child { 
              page-break-after: auto; 
              break-after: auto; 
            }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        ${copy('1ª Via - Cliente', '1ª Via - Cliente')}
        <div class="divider"></div>
        ${copy('2ª Via - Empresa', '2ª Via - Empresa')}
        <script>
          window.onload = () => {
            const images = document.getElementsByTagName('img');
            const totalImages = images.length;
            let loadedImages = 0;

            if (totalImages === 0) {
              setTimeout(() => { window.print(); }, 500);
              return;
            }

            const checkAllLoaded = () => {
              loadedImages++;
              if (loadedImages === totalImages) {
                setTimeout(() => { window.print(); }, 500);
              }
            };

            for (let i = 0; i < totalImages; i++) {
              if (images[i].complete) {
                checkAllLoaded();
              } else {
                images[i].onload = checkAllLoaded;
                images[i].onerror = checkAllLoaded;
              }
            }
          }
        </script>
      </body>
      </html>
    `);
    pw.document.close();
    } catch (err) {
      console.error('Fatal error in handlePrint:', err);
      alert('Erro ao gerar impressão. Verifique o console ou as configurações do navegador.');
    }
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (o.contract_number && o.contract_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       o.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchTab = true;
    if (activeTab === 'ativos') matchTab = o.status === 'rented';
    else if (activeTab === 'concluidos') matchTab = o.status === 'completed';
    else if (activeTab === 'pendentes') matchTab = o.status === 'pending';
    
    return matchSearch && matchTab;
  });

  const filteredCustomers = customers.filter(c => {
    if (!customerSearchQuery) return false;
    const q = customerSearchQuery.toLowerCase();
    if (customerSearchTab === 'name') return c.name.toLowerCase().includes(q);
    if (customerSearchTab === 'phone') return (c.phone || '').includes(q);
    if (customerSearchTab === 'document') return (c.document || '').includes(q);
    return false;
  });

  const statusColor: Record<string, string> = { 
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    rented: 'bg-green-100 text-green-700 border-green-200', 
    completed: 'bg-slate-100 text-slate-700 border-slate-200' 
  };

  const statusLabel: Record<string, string> = { 
    pending: 'Pendente', 
    rented: 'Ativo', 
    completed: 'Concluído' 
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Aluguéis</h2>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
            <button 
              onClick={() => setActiveTab('ativos')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ativos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ativos
            </button>
            <button 
              onClick={() => setActiveTab('concluidos')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'concluidos' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concluídos
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todos
            </button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => { setFormData(blankForm); setIsModalOpen(true); }}
          className="bg-[#1e3a5f] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#152a45] transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo Aluguel
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 text-sm">Nenhum aluguel encontrado</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {[...filtered].sort((a, b) => b.start_date.localeCompare(a.start_date)).map(order => (
            <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-lg">{order.customer_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${statusColor[order.status]}`}>
                      <Clock className="w-2.5 h-2.5" /> {statusLabel[order.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1">Contrato: <b className="text-slate-600 font-bold uppercase">{order.contract_number || 'S/N'}</b></span>
                    <span className="flex items-center gap-1">{order.customer_phone || 'Sem telefone'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(order.items || []).map((item, idx) => (
                      <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md border border-indigo-100">
                        {item.equipmentName} × {item.quantity}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-400" /> Saída: {new Date(order.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Devolução: {new Date(order.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-100 italic capitalize">
                      <DollarSign className="w-3 h-3" /> {order.payment_method || 'dinheiro'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 ml-auto">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valor do Aluguel</p>
                    <p className="text-2xl font-black text-slate-800">R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(order)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePrint(order)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Imprimir">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={async () => {
                          if (order.status !== 'completed') {
                            await update(order.id, { status: 'completed' });
                            // Update stock
                            for (const item of (order.items || [])) {
                              await updateEquipmentStock(item.equipmentId, item.quantity, 1, -1, item.lotNumber);
                            }
                            // Register revenue
                            await registerRevenue(order);
                          }
                      }}
                      disabled={order.status === 'completed'}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                        order.status === 'completed' 
                          ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                          : 'bg-[#ecfdf5] text-[#10b981] border-[#d1fae5] hover:bg-[#d1fae5]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Devolver
                    </button>
                    <button 
                       onClick={() => setOrderToDelete(order.id)}
                       className="px-4 py-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all shadow-sm"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW Aluguéis Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Aluguel' : 'Novo Aluguel'}>
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[85vh] overflow-y-auto px-1">
          {formError && (
             <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-1">
               {formError}
             </div>
          )}
          {/* Cliente Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Cliente *</label>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
               {(['name', 'phone', 'document'] as const).map(tab => (
                 <button
                   key={tab}
                   type="button"
                   onClick={() => setCustomerSearchTab(tab)}
                   className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                     customerSearchTab === tab ? 'bg-[#1e3a5f] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                   }`}
                 >
                   {tab === 'name' ? 'Nome' : tab === 'phone' ? 'Telefone' : 'CPF/CNPJ'}
                 </button>
               ))}
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300 transition-all"
                placeholder={`Buscar por ${customerSearchTab === 'name' ? 'nome' : customerSearchTab === 'phone' ? 'telefone' : 'documento'}...`}
                value={customerSearchQuery}
                onChange={e => {
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                  if (!e.target.value) setFormData(f => ({ ...f, customer_id: '', customer_name: '', customer_phone: '' }));
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              
              {showCustomerDropdown && customerSearchQuery && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex flex-col gap-0.5"
                        onClick={() => {
                          setFormData({ ...formData, customer_id: c.id, customer_name: c.name, customer_phone: c.phone || '' });
                          setCustomerSearchQuery(c.name);
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <span className="text-sm font-bold text-slate-700">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {c.phone ? `📞 ${c.phone}` : ''} {c.document ? ` | 📄 ${c.document}` : ''}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum cliente encontrado</div>
                  )}
                </div>
              )}
            </div>

            {!formData.customer_id && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-orange-600 animate-pulse">
                <span>⚠ Selecione um cliente para continuar o preenchimento</span>
              </div>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Data de Saída *</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input required type="date" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-all appearance-none" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Devolução Prevista *</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input required type="date" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-all appearance-none" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
            </div>
          </div>

          {/* Equipamentos Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Equipamentos *</label>
              <button type="button" onClick={handleAddItem} className="text-xs text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            
            <div className={`rounded-2xl border-2 border-dashed transition-all ${formData.items.length === 0 ? 'border-slate-100 p-8' : 'border-slate-50 p-2 space-y-2'}`}>
              {formData.items.length === 0 ? (
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-slate-300">Clique em "Adicionar" para incluir equipamentos</p>
                </div>
              ) : (
                formData.items.map((item, i) => (
                  <div key={i} className="flex flex-col gap-4 bg-white p-6 rounded-2xl border-2 border-slate-100 group hover:border-indigo-200 transition-all relative shadow-sm">
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(i)} 
                      className="absolute right-4 top-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Equipamento */}
                    <div className="w-full">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Equipamento</label>
                      <div className="relative">
                        <select 
                          required 
                          className="w-full block pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 appearance-none transition-all cursor-pointer" 
                          value={item.equipmentId} 
                          onChange={e => handleItemChange(i, 'equipmentId', e.target.value)}
                        >
                          <option value="" disabled>Selecione um equipamento...</option>
                          {equipments.map(eq => (
                            <option key={eq.id} value={eq.id} disabled={eq.stock_available === 0}>
                              {eq.name} ({eq.stock_available} em estoque)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Lote */}
                      <div className="w-full">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Lote</label>
                        <div className="relative">
                          <select 
                            required 
                            className={`w-full block pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold appearance-none transition-all cursor-pointer ${!item.equipmentId ? 'opacity-50 grayscale' : 'text-indigo-600'}`} 
                            value={item.lotNumber} 
                            disabled={!item.equipmentId}
                            onChange={e => handleItemChange(i, 'lotNumber', e.target.value)}
                          >
                            <option value="" disabled>Lote / Unidade</option>
                            {item.equipmentId && equipments.find(e => e.id === item.equipmentId)?.lots?.map(l => (
                              <option key={l.lot_number} value={l.lot_number} disabled={l.quantity === 0}>
                                {l.lot_number} ({l.quantity} disp.)
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Quantidade */}
                      <div className="w-full">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Quantidade</label>
                        <input 
                          required 
                          type="number" 
                          min="1" 
                          className="w-full block px-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-black text-center text-slate-800 transition-all" 
                          value={item.quantity} 
                          onChange={e => handleItemChange(i, 'quantity', parseInt(e.target.value) || 1)} 
                        />
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="pt-4 border-t-2 border-slate-50 mt-2">
                       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Valor do Item (Período)</label>
                            <div className="flex items-center gap-2">
                               <div className="flex items-center gap-1.5 bg-indigo-50 text-[10px] text-indigo-600 px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm border border-indigo-100">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formData.start_date && formData.end_date 
                                    ? `${Math.max(1, Math.ceil((new Date(formData.end_date + 'T12:00:00').getTime() - new Date(formData.start_date + 'T12:00:00').getTime()) / 86400000))} dias`
                                    : 'Aguardando datas...'}
                               </div>
                            </div>
                          </div>
                          
                          <div className="relative w-full sm:w-56">
                            <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Total</span>
                               <span className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-indigo-400 font-bold">R$</span>
                               <input 
                                required 
                                type="number" 
                                step="0.01"
                                className="w-full block pl-24 pr-4 py-3 bg-white border-2 border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base font-black text-indigo-600 text-right transition-all shadow-inner" 
                                value={item.price} 
                                onChange={e => handleItemChange(i, 'price', parseFloat(e.target.value) || 0)} 
                              />
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detalhes Financeiros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Forma de Pagamento</label>
              <div className="relative">
                <select 
                  className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 appearance-none transition-all" 
                  value={formData.payment_method} 
                  onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Boleto">Boleto</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Valor do Aluguel (R$)</label>
              <input 
                type="number" 
                readOnly
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-bold"
                value={formData.total_amount} 
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Observações</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-all resize-none"
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Alguma observação importante sobre este aluguel?"
            />
          </div>

          {/* Footer Modal */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={closeModal} className="flex-1 py-3 px-4 border border-slate-200 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all order-2 sm:order-1">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving || !formData.customer_id} 
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 order-1 sm:order-2 ${
                saving || !formData.customer_id ? 'bg-slate-300 cursor-not-allowed' : 'bg-[#1e3a5f] hover:bg-[#152a45] active:scale-95'
              }`}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Aluguel
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Excluir Aluguel">
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-800 text-sm">Esta ação é irreversível!</p>
              <p className="text-red-600/80 text-xs">O aluguel será removido permanentemente do sistema e os equipamentos voltarão ao estoque.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setOrderToDelete(null)} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all">Voltar</button>
            <button onClick={handleDeleteConfirm} className="px-6 py-2.5 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md shadow-red-100">Excluir Agora</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
