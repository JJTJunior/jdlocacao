export interface Category {
  id: string;
  name: string;
  type: 'equipment' | 'expense' | 'income';
}

export interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  pricePerDay: number;
  pricePerWeek: number;
  pricePerMonth: number;
  stockAvailable: number;
  stockRented: number;
  stockMaintenance: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  document?: string; // CPF/CNPJ
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: 'pending' | 'rented' | 'completed';
  items: { equipmentId: string; equipmentName: string; quantity: number }[];
}
