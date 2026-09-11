import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, Expense, ProductItem, StoreSettings, BusinessType } from '../types';

/**
 * Clean defaults for a newly activated merchant.
 * These are configuration defaults only; no demo products, customers, staff,
 * transactions, expenses, or business records are created automatically.
 */
export const defaultSettings: StoreSettings = {
  businessType: 'custom',
  customBusinessTypeName: '',
  storeName: '',
  storeAddress: '',
  storePhone: '',
  footer: '',
  logoBase64: '',
  shift1Name: '',
  shift2Name: '',
  shift1Start: '10:00',
  shift1End: '13:00',
  shift2Start: '13:00',
  shift2End: '22:00',
  activeShift: '1',
  manualOverride: false,
  portalPins: {
    admin: '',
    expenses: '',
    inventory: '',
    staff: '',
    settings: '',
    historyDeletePin: '',
    historyEditPin: '',
    historyCancelPin: '',
  },
  btAutoPrint: false,
  ppnEnabled: false,
  ppnRate: 11,
  categories: [],
  staffRoles: [],
  staffList: {},
};

function requireMerchantId(merchantId: string): string {
  const id = String(merchantId || '').trim();
  if (!id || id === 'default' || id === 'merchant_default') {
    throw new Error('Merchant authentication is required before accessing merchant data.');
  }
  return id;
}

function isValidMerchantId(merchantId: string): boolean {
  try {
    requireMerchantId(merchantId);
    return true;
  } catch {
    return false;
  }
}

export function getMerchantStorageKey(
  merchantId: string,
  businessType: BusinessType | string,
  dataType: 'products' | 'orders' | 'expenses' | 'pettyCash' | 'settings',
): string {
  const mId = requireMerchantId(merchantId);
  if (dataType === 'settings') return `yupos_${mId}_settings`;
  return `yupos_${mId}_${businessType}_${dataType}`;
}

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

function isLegacyDemoSettings(settings: StoreSettings): boolean {
  if (settings.storeName === 'YUPOS UNIVERSAL') return true;
  if (settings.storePhone === '0812-3456-7890') return true;
  if (settings.footer.includes('0812-3456-7890')) return true;
  if (Object.values(settings.staffList || {}).some((names) =>
    names.some((name) => ['Rian', 'Budi', 'Roni', 'Master Danu', 'Siti', 'Dewi'].includes(name)),
  )) return true;
  return false;
}

export function loadMerchantSettings(merchantId: string): StoreSettings {
  if (!isValidMerchantId(merchantId)) return { ...defaultSettings };
  const key = getMerchantStorageKey(merchantId, 'default', 'settings');
  const saved = loadLocalData<StoreSettings | null>(key, null);
  if (!saved || isLegacyDemoSettings(saved)) {
    if (saved && isLegacyDemoSettings(saved)) saveLocalData(key, defaultSettings);
    return { ...defaultSettings };
  }

  return {
    ...defaultSettings,
    ...saved,
    portalPins: { ...defaultSettings.portalPins, ...(saved.portalPins || {}) },
    categories: Array.isArray(saved.categories) ? saved.categories : [],
    staffRoles: Array.isArray(saved.staffRoles) ? saved.staffRoles : [],
    staffList: saved.staffList && typeof saved.staffList === 'object' ? saved.staffList : {},
    shift1Start: saved.shift1Start || defaultSettings.shift1Start,
    shift1End: saved.shift1End || defaultSettings.shift1End,
    shift2Start: saved.shift2Start || defaultSettings.shift2Start,
    shift2End: saved.shift2End || defaultSettings.shift2End,
  };
}

export function saveMerchantSettings(merchantId: string, settings: StoreSettings): void {
  if (!isValidMerchantId(merchantId)) return;
  saveLocalData(getMerchantStorageKey(merchantId, 'default', 'settings'), settings);
}

function isLegacyDemoProduct(item: ProductItem): boolean {
  return /^(barber|salon|fnb|ret|ld|ws|cst)-/i.test(String(item.id || '').trim());
}

/**
 * A merchant starts with an empty catalog. Never seed from BUSINESS_PRESETS.
 * Known legacy demo catalog IDs are removed once from local storage so older
 * test/demo sessions also become clean without touching unrelated merchant data.
 */
export function loadMerchantProducts(merchantId: string, businessType: BusinessType): ProductItem[] {
  if (!isValidMerchantId(merchantId)) return [];
  const key = getMerchantStorageKey(merchantId, businessType, 'products');
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ProductItem[];
    const cleaned = parsed.filter((item) => !isLegacyDemoProduct(item));
    if (cleaned.length !== parsed.length) saveLocalData(key, cleaned);
    return cleaned.map((item) => ({ ...item, businessType, merchantId }));
  } catch {
    return [];
  }
}

export function saveMerchantProducts(
  merchantId: string,
  businessType: BusinessType,
  products: ProductItem[],
): void {
  if (!isValidMerchantId(merchantId)) return;
  const id = requireMerchantId(merchantId);
  const sanitized = products.map((product) => ({ ...product, merchantId: id, businessType }));
  saveLocalData(getMerchantStorageKey(id, businessType, 'products'), sanitized);
}

function createCollisionSafeOrderId(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `ORD-${date}-${time}-${randomPart}`;
}

/**
 * Preserve existing order IDs. Generate an ID only when it is missing or
 * duplicated inside the incoming list. The previous implementation treated
 * every existing ID as a collision and could create a new ID on each save,
 * which caused the same payment to appear multiple times after repeated syncs.
 */
function normalizeOrderIds(orders: Order[]): Order[] {
  const used = new Set<string>();
  return orders.map((order) => {
    let id = String(order.id || '').trim();
    if (!id || used.has(id)) {
      do {
        id = createCollisionSafeOrderId();
      } while (used.has(id));
    }
    used.add(id);
    return id === order.id ? order : { ...order, id };
  });
}

/**
 * Conservative duplicate detector for legacy data already written before the
 * persistence fix. It intentionally requires the same timestamp, total,
 * customer/payment identity and line items, so two genuine sales with merely
 * the same amount are not merged.
 */
function orderFingerprint(order: Order): string {
  return JSON.stringify({
    timestamp: Number(order.timestamp || 0),
    date: order.date || '',
    time: order.time || '',
    total: Number(order.total || 0),
    customer: order.customer || '',
    customerCode: order.customerCode || '',
    payment: order.payment || '',
    items: order.items || [],
  });
}

function dedupeOrders(orders: Order[]): Order[] {
  const seen = new Set<string>();
  const result: Order[] = [];
  for (const order of orders) {
    const fingerprint = orderFingerprint(order);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    result.push(order);
  }
  return result;
}

export function loadMerchantOrders(merchantId: string, businessType: BusinessType): Order[] {
  if (!isValidMerchantId(merchantId)) return [];
  const key = getMerchantStorageKey(merchantId, businessType, 'orders');
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Order[];
    const deduped = dedupeOrders(parsed);
    const normalized = normalizeOrderIds(deduped).map((order) => ({ ...order, merchantId, businessType }));
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) saveLocalData(key, normalized);
    return normalized;
  } catch {
    return [];
  }
}

export function saveMerchantOrders(merchantId: string, businessType: BusinessType, orders: Order[]): void {
  if (!isValidMerchantId(merchantId)) return;
  const id = requireMerchantId(merchantId);
  const key = getMerchantStorageKey(id, businessType, 'orders');
  const sanitized = orders.map((order) => ({ ...order, merchantId: id, businessType }));
  const normalized = normalizeOrderIds(dedupeOrders(sanitized));
  saveLocalData(key, normalized);
}

export function loadMerchantExpenses(merchantId: string, businessType: BusinessType): Expense[] {
  if (!isValidMerchantId(merchantId)) return [];
  const key = getMerchantStorageKey(merchantId, businessType, 'expenses');
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Expense[]).map((expense) => ({
      ...expense,
      merchantId,
      businessType,
    }));
  } catch {
    return [];
  }
}

export function saveMerchantExpenses(merchantId: string, businessType: BusinessType, expenses: Expense[]): void {
  if (!isValidMerchantId(merchantId)) return;
  const id = requireMerchantId(merchantId);
  const sanitized = expenses.map((expense) => ({ ...expense, merchantId: id, businessType }));
  saveLocalData(getMerchantStorageKey(id, businessType, 'expenses'), sanitized);
}

export function loadMerchantPettyCash(merchantId: string, businessType: BusinessType): number {
  if (!isValidMerchantId(merchantId)) return 0;
  return loadLocalData<number>(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), 0);
}

export function saveMerchantPettyCash(merchantId: string, businessType: BusinessType, amount: number): void {
  if (!isValidMerchantId(merchantId)) return;
  const id = requireMerchantId(merchantId);
  saveLocalData(getMerchantStorageKey(id, businessType, 'pettyCash'), amount);
}

export async function syncConfigToFirebase(settings: StoreSettings, merchantId: string = ''): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    saveMerchantSettings(id, settings);
    await setDoc(
      doc(db, 'yupos_config', id, 'settings', 'data'),
      { ...settings, merchantId: id },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('Firebase config sync warning:', err);
    return false;
  }
}

export async function syncProductsToFirebase(
  products: ProductItem[],
  merchantId: string = '',
  businessType: BusinessType = 'barbershop',
): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    saveMerchantProducts(id, businessType, products);
    const sanitized = products.map((product) => ({ ...product, merchantId: id, businessType }));
    await setDoc(
      doc(db, 'yupos_catalog', id, businessType, 'products'),
      { items: sanitized, merchantId: id, businessType, updatedAt: Date.now() },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('Firebase products sync warning:', err);
    return false;
  }
}

/**
 * Firebase order storage is authoritative for the exact current list sent by
 * the app. This is intentionally a replacement, not a merge: a record removed
 * with the permanent-delete action must not be resurrected from Firestore.
 */
export async function syncOrdersToFirebase(
  orders: Order[],
  merchantId: string = '',
  businessType: BusinessType = 'barbershop',
): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    const key = getMerchantStorageKey(id, businessType, 'orders');
    const sanitized = orders.map((order) => ({ ...order, merchantId: id, businessType }));
    const normalized = normalizeOrderIds(dedupeOrders(sanitized));
    saveLocalData(key, normalized);

    const ordersRef = doc(db, 'yupos_transactions', id, businessType, 'orders');
    await setDoc(
      ordersRef,
      { list: normalized, merchantId: id, businessType, updatedAt: Date.now() },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('Firebase orders sync warning:', err);
    return false;
  }
}

export async function syncExpensesToFirebase(
  expenses: Expense[],
  merchantId: string = '',
  businessType: BusinessType = 'barbershop',
): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    saveMerchantExpenses(id, businessType, expenses);
    const sanitized = expenses.map((expense) => ({ ...expense, merchantId: id, businessType }));
    await setDoc(
      doc(db, 'yupos_finances', id, businessType, 'expenses'),
      { list: sanitized, merchantId: id, businessType, updatedAt: Date.now() },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('Firebase expenses sync warning:', err);
    return false;
  }
}

export async function syncPettyCashToFirebase(
  amount: number,
  merchantId: string = '',
  businessType: BusinessType = 'barbershop',
): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    saveMerchantPettyCash(id, businessType, amount);
    await setDoc(
      doc(db, 'yupos_finances', id, businessType, 'pettyCash'),
      { amount, merchantId: id, businessType, updatedAt: Date.now() },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('Firebase petty cash sync warning:', err);
    return false;
  }
}
