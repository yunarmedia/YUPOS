import { Customer, MembershipRewardType, MembershipVisit } from '../types';
import { db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

export function generateCustomerCode(name: string, phone: string): string {
  const lettersOnly = name.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
  const namePrefix = lettersOnly.length >= 2 ? lettersOnly.substring(0, 2) : (lettersOnly + 'CU').substring(0, 2);
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  const phoneSuffix = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly.padStart(4, '0');
  return `${namePrefix}${phoneSuffix}`;
}

export const initialCustomers: Customer[] = [
  {
    id: 'CUST-001', name: 'Budi Santoso', phone: '081234567890', customerCode: 'BU7890', visitCount: 8,
    isMember: true, memberSince: '2024-01-15', totalSpent: 420000,
    lastVisit: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    notes: 'Pelanggan loyal potong rambut + pomade', createdAt: Date.now() - 86400000 * 90, membershipVisits: [],
  },
  {
    id: 'CUST-002', name: 'Rian Pratama', phone: '085798765432', customerCode: 'RI5432', visitCount: 3,
    isMember: false, totalSpent: 105000,
    lastVisit: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0],
    notes: 'Favorit capster Rian', createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'CUST-003', name: 'Siti Rahmawati', phone: '087811223344', customerCode: 'SI3344', visitCount: 12,
    isMember: true, memberSince: '2023-11-20', totalSpent: 780000,
    lastVisit: new Date().toISOString().split('T')[0], notes: 'Membership Gold, treatment rutin',
    createdAt: Date.now() - 86400000 * 180, membershipVisits: [],
  },
];

export function getCustomerStorageKey(merchantId: string): string {
  return `yupos_${merchantId || 'default'}_customers`;
}

export function loadCustomers(merchantId: string): Customer[] {
  try {
    const key = getCustomerStorageKey(merchantId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(initialCustomers));
      return initialCustomers;
    }
    const parsed = JSON.parse(raw) as Customer[];
    return parsed.map((customer) => ({
      ...customer,
      membershipVisits: Array.isArray(customer.membershipVisits) ? customer.membershipVisits : [],
      membershipRedemptions: Array.isArray(customer.membershipRedemptions) ? customer.membershipRedemptions : [],
    }));
  } catch (err) {
    console.warn('Error loading customers from localStorage:', err);
    return initialCustomers;
  }
}

export function saveCustomers(merchantId: string, customers: Customer[]): void {
  try { localStorage.setItem(getCustomerStorageKey(merchantId), JSON.stringify(customers)); }
  catch (err) { console.warn('Error saving customers to localStorage:', err); }
}

export async function syncCustomersToFirebase(merchantId: string, customers: Customer[]): Promise<boolean> {
  saveCustomers(merchantId, customers);
  try {
    const custRef = doc(db, 'yupos_crm', `${merchantId || 'default'}_customers`);
    await setDoc(custRef, { list: customers, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase customers sync warning:', err);
    return false;
  }
}

export function searchCustomerList(customers: Customer[], query: string): Customer[] {
  if (!query || !query.trim()) return customers;
  const q = query.trim().toLowerCase();
  return customers.filter((c) => c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || c.phone.includes(q));
}

export interface CustomerVisitMeta {
  orderId?: string;
  services?: string[];
  staff?: string[];
  date?: string;
  time?: string;
}

export function recordCustomerVisit(
  customers: Customer[],
  customerData: { name: string; phone: string; customerCode?: string; isMember?: boolean },
  transactionAmount: number = 0,
  merchantId: string = 'default',
  visitMeta: CustomerVisitMeta = {}
): Customer[] {
  const code = customerData.customerCode || generateCustomerCode(customerData.name, customerData.phone);
  const existingIdx = customers.findIndex((c) => c.customerCode.toUpperCase() === code.toUpperCase() || c.phone === customerData.phone);
  const now = new Date();
  const todayStr = visitMeta.date || now.toISOString().split('T')[0];
  const timeStr = visitMeta.time || now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const visit: MembershipVisit = {
    id: `VIS-${Date.now().toString(36).toUpperCase()}`,
    date: todayStr,
    time: timeStr,
    amount: transactionAmount,
    orderId: visitMeta.orderId,
    services: visitMeta.services || [],
    staff: visitMeta.staff || [],
  };

  let updatedList: Customer[];
  if (existingIdx > -1) {
    const existing = customers[existingIdx];
    const shouldBeMember = customerData.isMember !== undefined ? (customerData.isMember || existing.isMember) : existing.isMember;
    updatedList = [...customers];
    updatedList[existingIdx] = {
      ...existing,
      name: customerData.name.trim() || existing.name,
      phone: customerData.phone.trim() || existing.phone,
      customerCode: code,
      visitCount: existing.visitCount + 1,
      isMember: shouldBeMember,
      memberSince: shouldBeMember && !existing.isMember ? todayStr : (existing.memberSince || todayStr),
      totalSpent: (existing.totalSpent || 0) + transactionAmount,
      lastVisit: todayStr,
      membershipVisits: shouldBeMember ? [...(existing.membershipVisits || []), visit] : (existing.membershipVisits || []),
    };
  } else {
    const isMember = !!customerData.isMember;
    const newCustomer: Customer = {
      id: 'CUST-' + Date.now().toString(36).toUpperCase(), name: customerData.name.trim(), phone: customerData.phone.trim(),
      customerCode: code, visitCount: 1, isMember, memberSince: isMember ? todayStr : undefined,
      totalSpent: transactionAmount, lastVisit: todayStr, createdAt: Date.now(),
      membershipVisits: isMember ? [visit] : [], membershipRedemptions: [],
    };
    updatedList = [newCustomer, ...customers];
  }

  saveCustomers(merchantId, updatedList);
  void syncCustomersToFirebase(merchantId, updatedList);
  return updatedList;
}

export function claimMembershipReward(
  customers: Customer[], customerId: string, reward: MembershipRewardType, merchantId: string
): { customers: Customer[]; success: boolean; message: string } {
  const index = customers.findIndex((c) => c.id === customerId);
  if (index < 0) return { customers, success: false, message: 'Customer tidak ditemukan.' };
  const customer = customers[index];
  const visits = customer.visitCount || 0;
  if (!customer.isMember) return { customers, success: false, message: 'Customer belum terdaftar sebagai member.' };
  if (reward === 'discount50' && visits < 5) return { customers, success: false, message: 'Diskon 50% baru dapat diklaim setelah 5 kunjungan.' };
  if (reward === 'freeHaircut' && visits < 10) return { customers, success: false, message: 'Cukur gratis baru dapat diklaim setelah 10 kunjungan.' };

  const updatedCustomer: Customer = {
    ...customer,
    visitCount: 0,
    membershipVisits: [],
    membershipRedemptions: [...(customer.membershipRedemptions || []), {
      id: `REWARD-${Date.now().toString(36).toUpperCase()}`,
      type: reward,
      date: new Date().toISOString().split('T')[0],
      visitCount: visits,
    }],
  };
  const updated = [...customers];
  updated[index] = updatedCustomer;
  saveCustomers(merchantId, updated);
  void syncCustomersToFirebase(merchantId, updated);
  return {
    customers: updated,
    success: true,
    message: reward === 'discount50'
      ? 'Diskon 50% berhasil diklaim. Stempel membership kembali ke 0.'
      : 'Cukur gratis berhasil diklaim. Stempel membership kembali ke 0.',
  };
}
