import { Customer } from '../types';
import { db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Generate a unique customer code:
 * 2 first letters of customer name (uppercase) + 4 last digits of phone number
 * Example: 'Budi Santoso', '081234567890' -> 'BU7890'
 */
export function generateCustomerCode(name: string, phone: string): string {
  const trimmedName = name.trim();
  // Extract alphanumeric letters only
  const lettersOnly = trimmedName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const namePrefix = lettersOnly.length >= 2 
    ? lettersOnly.substring(0, 2) 
    : (lettersOnly + 'CU').substring(0, 2);

  // Extract digits only
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  const phoneSuffix = digitsOnly.length >= 4 
    ? digitsOnly.slice(-4) 
    : digitsOnly.padStart(4, '0');

  return `${namePrefix}${phoneSuffix}`;
}

export const initialCustomers: Customer[] = [
  {
    id: 'CUST-001',
    name: 'Budi Santoso',
    phone: '081234567890',
    customerCode: 'BU7890',
    visitCount: 8,
    isMember: true,
    memberSince: '2024-01-15',
    totalSpent: 420000,
    lastVisit: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    notes: 'Pelanggan loyal potong rambut + pomade',
    createdAt: Date.now() - 86400000 * 90,
  },
  {
    id: 'CUST-002',
    name: 'Rian Pratama',
    phone: '085798765432',
    customerCode: 'RI5432',
    visitCount: 3,
    isMember: false,
    totalSpent: 105000,
    lastVisit: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0],
    notes: 'Favorit capster Rian',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'CUST-003',
    name: 'Siti Rahmawati',
    phone: '087811223344',
    customerCode: 'SI3344',
    visitCount: 12,
    isMember: true,
    memberSince: '2023-11-20',
    totalSpent: 780000,
    lastVisit: new Date().toISOString().split('T')[0],
    notes: 'Membership Gold, treatment rutin',
    createdAt: Date.now() - 86400000 * 180,
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
      // Save initial defaults
      localStorage.setItem(key, JSON.stringify(initialCustomers));
      return initialCustomers;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error loading customers from localStorage:', err);
    return initialCustomers;
  }
}

export function saveCustomers(merchantId: string, customers: Customer[]): void {
  try {
    const key = getCustomerStorageKey(merchantId);
    localStorage.setItem(key, JSON.stringify(customers));
  } catch (err) {
    console.warn('Error saving customers to localStorage:', err);
  }
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
  return customers.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });
}

/**
 * Record a customer visit during checkout, updating visitCount, totalSpent, and membership status.
 */
export function recordCustomerVisit(
  customers: Customer[],
  customerData: {
    name: string;
    phone: string;
    customerCode?: string;
    isMember?: boolean;
  },
  transactionAmount: number = 0,
  merchantId: string = 'default'
): Customer[] {
  const code = customerData.customerCode || generateCustomerCode(customerData.name, customerData.phone);
  const existingIdx = customers.findIndex(
    (c) => c.customerCode.toUpperCase() === code.toUpperCase() || c.phone === customerData.phone
  );

  const todayStr = new Date().toISOString().split('T')[0];
  let updatedList: Customer[];

  if (existingIdx > -1) {
    const existing = customers[existingIdx];
    const shouldBeMember = customerData.isMember !== undefined ? (customerData.isMember || existing.isMember) : existing.isMember;
    const updatedCustomer: Customer = {
      ...existing,
      name: customerData.name.trim() || existing.name,
      phone: customerData.phone.trim() || existing.phone,
      customerCode: code,
      visitCount: existing.visitCount + 1,
      isMember: shouldBeMember,
      memberSince: (shouldBeMember && !existing.isMember) ? todayStr : (existing.memberSince || todayStr),
      totalSpent: (existing.totalSpent || 0) + transactionAmount,
      lastVisit: todayStr,
    };
    updatedList = [...customers];
    updatedList[existingIdx] = updatedCustomer;
  } else {
    const newCustomer: Customer = {
      id: 'CUST-' + Date.now().toString(36).toUpperCase(),
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      customerCode: code,
      visitCount: 1,
      isMember: !!customerData.isMember,
      memberSince: customerData.isMember ? todayStr : undefined,
      totalSpent: transactionAmount,
      lastVisit: todayStr,
      createdAt: Date.now(),
    };
    updatedList = [newCustomer, ...customers];
  }

  saveCustomers(merchantId, updatedList);
  syncCustomersToFirebase(merchantId, updatedList);
  return updatedList;
}

