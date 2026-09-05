import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, Expense, ProductItem, StoreSettings, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';

export const defaultSettings: StoreSettings = {
  businessType: 'barbershop',
  storeName: 'YUPOS UNIVERSAL',
  storeAddress: 'Jl. Pemuda No. 12, Kota',
  storePhone: '0812-3456-7890',
  footer: 'Terima kasih atas kunjungan Anda!\nKritik & saran hubungi WhatsApp: 0812-3456-7890',
  logoBase64: '',
  shift1Name: 'KASIR PAGI',
  shift2Name: 'KASIR SORE',
  shift1Start: '10:00',
  shift1End: '13:00',
  shift2Start: '13:00',
  shift2End: '22:00',
  activeShift: '1',
  manualOverride: false,
  portalPins: {
    admin: '2024UDC',
    expenses: '',
    inventory: '',
    staff: '',
    settings: '',
    historyDeletePin: '',
    historyEditPin: '',
  },
  btAutoPrint: false,
  ppnEnabled: false,
  ppnRate: 11,
  categories: BUSINESS_PRESETS.barbershop.defaultCategories,
  staffRoles: BUSINESS_PRESETS.barbershop.defaultStaffRoles,
  staffList: {
    'Capster / Barber': ['Rian', 'Budi', 'Roni'],
    'Barber Utama': ['Master Danu'],
    'Kasir': ['Siti', 'Dewi'],
  },
};

// Helper to construct isolated keys per merchant and business type
export function getMerchantStorageKey(
  merchantId: string,
  businessType: BusinessType | string,
  dataType: 'products' | 'orders' | 'expenses' | 'pettyCash' | 'settings'
): string {
  const mId = merchantId || 'merchant_default';
  if (dataType === 'settings') {
    return `yupos_${mId}_settings`;
  }
  return `yupos_${mId}_${businessType}_${dataType}`;
}

// Local storage basic helpers
export function loadLocalData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Error loading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

export function saveLocalData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error saving ${key} to localStorage:`, err);
  }
}

// Load merchant-specific settings
export function loadMerchantSettings(merchantId: string): StoreSettings {
  const key = getMerchantStorageKey(merchantId, 'default', 'settings');
  // Check if merchant-specific settings exist
  let saved = loadLocalData<StoreSettings | null>(key, null);
  if (!saved) {
    // Check legacy global settings
    saved = loadLocalData<StoreSettings | null>('yupos_settings', null);
  }
  if (!saved) {
    return { ...defaultSettings };
  }
  return {
    ...defaultSettings,
    ...saved,
    // Ensure shift hours exist
    shift1Start: saved.shift1Start || '10:00',
    shift1End: saved.shift1End || '13:00',
    shift2Start: saved.shift2Start || '13:00',
    shift2End: saved.shift2End || '22:00',
  };
}

// Save merchant-specific settings
export function saveMerchantSettings(merchantId: string, settings: StoreSettings): void {
  const key = getMerchantStorageKey(merchantId, 'default', 'settings');
  saveLocalData(key, settings);
  // Keep legacy key updated as fallback
  saveLocalData('yupos_settings', settings);
}

// Load merchant-specific & business-type-specific products
export function loadMerchantProducts(
  merchantId: string,
  businessType: BusinessType
): ProductItem[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'products');
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const items = JSON.parse(raw) as ProductItem[];
      return items.map((it) => ({ ...it, businessType, merchantId }));
    } catch {
      // ignore
    }
  }

  // If first time for barbershop, check if legacy products exist
  if (businessType === 'barbershop') {
    const legacyRaw = localStorage.getItem('yupos_products');
    if (legacyRaw) {
      try {
        const legacyItems = JSON.parse(legacyRaw) as ProductItem[];
        const tagged = legacyItems.map((it) => ({ ...it, businessType: 'barbershop' as BusinessType, merchantId }));
        saveMerchantProducts(merchantId, 'barbershop', tagged);
        return tagged;
      } catch {
        // ignore
      }
    }
  }

  // Fallback to preset default items for the chosen business type
  const preset = BUSINESS_PRESETS[businessType] || BUSINESS_PRESETS.barbershop;
  const initialItems = (preset.defaultItems || []).map((it) => ({
    ...it,
    businessType,
    merchantId,
  }));
  saveMerchantProducts(merchantId, businessType, initialItems);
  return initialItems;
}

// Save merchant-specific & business-type-specific products
export function saveMerchantProducts(
  merchantId: string,
  businessType: BusinessType,
  products: ProductItem[]
): void {
  const key = getMerchantStorageKey(merchantId, businessType, 'products');
  saveLocalData(key, products);
}

// Load merchant-specific & business-type-specific orders
export function loadMerchantOrders(
  merchantId: string,
  businessType: BusinessType
): Order[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'orders');
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  // Check legacy orders if barbershop
  if (businessType === 'barbershop') {
    const legacy = loadLocalData<Order[]>('yupos_orders', []);
    if (legacy.length > 0) {
      saveMerchantOrders(merchantId, 'barbershop', legacy);
      return legacy;
    }
  }

  return [];
}

// Save merchant-specific & business-type-specific orders
export function saveMerchantOrders(
  merchantId: string,
  businessType: BusinessType,
  orders: Order[]
): void {
  const key = getMerchantStorageKey(merchantId, businessType, 'orders');
  saveLocalData(key, orders);
}

// Load merchant-specific & business-type-specific expenses
export function loadMerchantExpenses(
  merchantId: string,
  businessType: BusinessType
): Expense[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'expenses');
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  if (businessType === 'barbershop') {
    const legacy = loadLocalData<Expense[]>('yupos_expenses', []);
    if (legacy.length > 0) {
      saveMerchantExpenses(merchantId, 'barbershop', legacy);
      return legacy;
    }
  }

  return [];
}

// Save merchant-specific & business-type-specific expenses
export function saveMerchantExpenses(
  merchantId: string,
  businessType: BusinessType,
  expenses: Expense[]
): void {
  const key = getMerchantStorageKey(merchantId, businessType, 'expenses');
  saveLocalData(key, expenses);
}

// Petty Cash
export function loadMerchantPettyCash(
  merchantId: string,
  businessType: BusinessType
): number {
  const key = getMerchantStorageKey(merchantId, businessType, 'pettyCash');
  return loadLocalData<number>(key, 0);
}

export function saveMerchantPettyCash(
  merchantId: string,
  businessType: BusinessType,
  amount: number
): void {
  const key = getMerchantStorageKey(merchantId, businessType, 'pettyCash');
  saveLocalData(key, amount);
}

// Sync to Firebase with Merchant & BusinessType namespacing
export async function syncConfigToFirebase(
  settings: StoreSettings,
  merchantId: string = 'default'
): Promise<boolean> {
  saveMerchantSettings(merchantId, settings);
  try {
    const configRef = doc(db, 'yupos_config', `${merchantId}_settings`);
    await setDoc(configRef, settings, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase config sync warning:', err);
    return false;
  }
}

export async function syncProductsToFirebase(
  products: ProductItem[],
  merchantId: string = 'default',
  businessType: BusinessType = 'barbershop'
): Promise<boolean> {
  saveMerchantProducts(merchantId, businessType, products);
  try {
    const prodRef = doc(db, 'yupos_catalog', `${merchantId}_${businessType}_products`);
    await setDoc(prodRef, { items: products, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase products sync warning:', err);
    return false;
  }
}

export async function syncOrdersToFirebase(
  orders: Order[],
  merchantId: string = 'default',
  businessType: BusinessType = 'barbershop'
): Promise<boolean> {
  saveMerchantOrders(merchantId, businessType, orders);
  try {
    const ordersRef = doc(db, 'yupos_transactions', `${merchantId}_${businessType}_orders`);
    await setDoc(ordersRef, { list: orders, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase orders sync warning:', err);
    return false;
  }
}

export async function syncExpensesToFirebase(
  expenses: Expense[],
  merchantId: string = 'default',
  businessType: BusinessType = 'barbershop'
): Promise<boolean> {
  saveMerchantExpenses(merchantId, businessType, expenses);
  try {
    const expensesRef = doc(db, 'yupos_finances', `${merchantId}_${businessType}_expenses`);
    await setDoc(expensesRef, { list: expenses, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase expenses sync warning:', err);
    return false;
  }
}

export async function syncPettyCashToFirebase(
  amount: number,
  merchantId: string = 'default',
  businessType: BusinessType = 'barbershop'
): Promise<boolean> {
  saveMerchantPettyCash(merchantId, businessType, amount);
  try {
    const pettyRef = doc(db, 'yupos_finances', `${merchantId}_${businessType}_pettyCash`);
    await setDoc(pettyRef, { amount, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firebase petty cash sync warning:', err);
    return false;
  }
}
