import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, Expense, ProductItem, StoreSettings, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';

export const defaultSettings: StoreSettings = {
  businessType: 'barbershop', storeName: 'YUPOS UNIVERSAL', storeAddress: 'Jl. Pemuda No. 12, Kota', storePhone: '0812-3456-7890',
  footer: 'Terima kasih atas kunjungan Anda!\nKritik & saran hubungi WhatsApp: 0812-3456-7890', logoBase64: '',
  shift1Name: 'KASIR PAGI', shift2Name: 'KASIR SORE', shift1Start: '10:00', shift1End: '13:00', shift2Start: '13:00', shift2End: '22:00',
  activeShift: '1', manualOverride: false,
  portalPins: { admin: '2024UDC', expenses: '', inventory: '', staff: '', settings: '', historyDeletePin: '', historyEditPin: '' },
  btAutoPrint: false, ppnEnabled: false, ppnRate: 11,
  categories: BUSINESS_PRESETS.barbershop.defaultCategories, staffRoles: BUSINESS_PRESETS.barbershop.defaultStaffRoles,
  staffList: { 'Capster / Barber': ['Rian', 'Budi', 'Roni'], 'Barber Utama': ['Master Danu'], 'Kasir': ['Siti', 'Dewi'] },
};

export function getMerchantStorageKey(merchantId: string, businessType: BusinessType | string, dataType: 'products' | 'orders' | 'expenses' | 'pettyCash' | 'settings'): string {
  const mId = merchantId || 'merchant_default';
  if (dataType === 'settings') return `yupos_${mId}_settings`;
  return `yupos_${mId}_${businessType}_${dataType}`;
}

export function loadLocalData<T>(key: string, defaultValue: T): T {
  try { const raw = localStorage.getItem(key); if (!raw) return defaultValue; return JSON.parse(raw); }
  catch (err) { console.warn(`Error loading ${key} from localStorage:`, err); return defaultValue; }
}
export function saveLocalData<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (err) { console.warn(`Error saving ${key} to localStorage:`, err); }
}

export function loadMerchantSettings(merchantId: string): StoreSettings {
  const key = getMerchantStorageKey(merchantId, 'default', 'settings');
  let saved = loadLocalData<StoreSettings | null>(key, null);
  if (!saved) saved = loadLocalData<StoreSettings | null>('yupos_settings', null);
  if (!saved) return { ...defaultSettings };
  return { ...defaultSettings, ...saved, shift1Start: saved.shift1Start || '10:00', shift1End: saved.shift1End || '13:00', shift2Start: saved.shift2Start || '13:00', shift2End: saved.shift2End || '22:00' };
}
export function saveMerchantSettings(merchantId: string, settings: StoreSettings): void {
  saveLocalData(getMerchantStorageKey(merchantId, 'default', 'settings'), settings); saveLocalData('yupos_settings', settings);
}

export function loadMerchantProducts(merchantId: string, businessType: BusinessType): ProductItem[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'products'); const raw = localStorage.getItem(key);
  if (raw) { try { return (JSON.parse(raw) as ProductItem[]).map((it) => ({ ...it, businessType, merchantId })); } catch {} }
  if (businessType === 'barbershop') {
    const legacyRaw = localStorage.getItem('yupos_products');
    if (legacyRaw) { try { const tagged = (JSON.parse(legacyRaw) as ProductItem[]).map((it) => ({ ...it, businessType: 'barbershop' as BusinessType, merchantId })); saveMerchantProducts(merchantId, 'barbershop', tagged); return tagged; } catch {} }
  }
  const preset = BUSINESS_PRESETS[businessType] || BUSINESS_PRESETS.barbershop;
  const initialItems = (preset.defaultItems || []).map((it) => ({ ...it, businessType, merchantId })); saveMerchantProducts(merchantId, businessType, initialItems); return initialItems;
}
export function saveMerchantProducts(merchantId: string, businessType: BusinessType, products: ProductItem[]): void {
  saveLocalData(getMerchantStorageKey(merchantId, businessType, 'products'), products);
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

function normalizeOrderIds(orders: Order[], existingIds: Set<string> = new Set()): Order[] {
  const used = new Set<string>(existingIds);
  return orders.map((order) => {
    let id = String(order.id || '').trim();
    const isNewLegacyId = /^ORD-[A-Z0-9]+$/.test(id) && !existingIds.has(id);
    if (!id || isNewLegacyId || used.has(id)) {
      do { id = createCollisionSafeOrderId(); } while (used.has(id));
    }
    used.add(id);
    if (id === order.id) return order;
    order.id = id;
    return order;
  });
}

export function loadMerchantOrders(merchantId: string, businessType: BusinessType): Order[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'orders'); const raw = localStorage.getItem(key);
  if (raw) { try { return normalizeOrderIds(JSON.parse(raw) as Order[]); } catch {} }
  if (businessType === 'barbershop') {
    const legacy = loadLocalData<Order[]>('yupos_orders', []); if (legacy.length > 0) { saveMerchantOrders(merchantId, 'barbershop', legacy); return legacy; }
  }
  return [];
}

export function saveMerchantOrders(merchantId: string, businessType: BusinessType, orders: Order[]): void {
  const key = getMerchantStorageKey(merchantId, businessType, 'orders');
  const current = loadLocalData<Order[]>(key, []);
  const existingIds = new Set(current.map((order) => String(order.id || '')));
  const normalized = normalizeOrderIds(orders, existingIds);
  saveLocalData(key, normalized);
}

export function loadMerchantExpenses(merchantId: string, businessType: BusinessType): Expense[] {
  const key = getMerchantStorageKey(merchantId, businessType, 'expenses'); const raw = localStorage.getItem(key);
  if (raw) { try { return JSON.parse(raw); } catch {} }
  if (businessType === 'barbershop') { const legacy = loadLocalData<Expense[]>('yupos_expenses', []); if (legacy.length > 0) { saveMerchantExpenses(merchantId, 'barbershop', legacy); return legacy; } }
  return [];
}
export function saveMerchantExpenses(merchantId: string, businessType: BusinessType, expenses: Expense[]): void {
  saveLocalData(getMerchantStorageKey(merchantId, businessType, 'expenses'), expenses);
}
export function loadMerchantPettyCash(merchantId: string, businessType: BusinessType): number {
  return loadLocalData<number>(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), 0);
}
export function saveMerchantPettyCash(merchantId: string, businessType: BusinessType, amount: number): void {
  saveLocalData(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), amount);
}

export async function syncConfigToFirebase(settings: StoreSettings, merchantId: string = 'default'): Promise<boolean> {
  saveMerchantSettings(merchantId, settings);
  try { await setDoc(doc(db, 'yupos_config', `${merchantId}_settings`), settings, { merge: true }); return true; }
  catch (err) { console.warn('Firebase config sync warning:', err); return false; }
}
export async function syncProductsToFirebase(products: ProductItem[], merchantId: string = 'default', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  saveMerchantProducts(merchantId, businessType, products);
  try { await setDoc(doc(db, 'yupos_catalog', `${merchantId}_${businessType}_products`), { items: products, updatedAt: Date.now() }, { merge: true }); return true; }
  catch (err) { console.warn('Firebase products sync warning:', err); return false; }
}
export async function syncOrdersToFirebase(orders: Order[], merchantId: string = 'default', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  const key = getMerchantStorageKey(merchantId, businessType, 'orders');
  const localCurrent = loadLocalData<Order[]>(key, []);
  const localNormalized = normalizeOrderIds(orders, new Set(localCurrent.map((order) => String(order.id || ''))));
  saveLocalData(key, localNormalized);
  try {
    const ordersRef = doc(db, 'yupos_transactions', `${merchantId}_${businessType}_orders`);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ordersRef);
      const remoteOrders = snapshot.exists() ? ((snapshot.data().list || []) as Order[]) : [];
      const remoteById = new Map<string, Order>(remoteOrders.map((order) => [String(order.id || ''), order]));
      const merged = [...remoteOrders];
      for (const incoming of localNormalized) {
        const id = String(incoming.id || '');
        const remote = remoteById.get(id);
        if (!remote) { merged.push(incoming); continue; }
        if (Number(remote.timestamp) === Number(incoming.timestamp)) {
          const index = merged.findIndex((order) => String(order.id || '') === id);
          if (index >= 0) merged[index] = incoming;
        } else {
          let replacementId = createCollisionSafeOrderId();
          while (remoteById.has(replacementId) || merged.some((order) => String(order.id || '') === replacementId)) replacementId = createCollisionSafeOrderId();
          const replacement = { ...incoming, id: replacementId };
          merged.push(replacement);
          incoming.id = replacementId;
        }
      }
      const finalList = normalizeOrderIds(merged);
      transaction.set(ordersRef, { list: finalList, updatedAt: Date.now() }, { merge: true });
      saveLocalData(key, finalList);
    });
    return true;
  } catch (err) { console.warn('Firebase orders sync warning:', err); return false; }
}
export async function syncExpensesToFirebase(expenses: Expense[], merchantId: string = 'default', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  saveMerchantExpenses(merchantId, businessType, expenses);
  try { await setDoc(doc(db, 'yupos_finances', `${merchantId}_${businessType}_expenses`), { list: expenses, updatedAt: Date.now() }, { merge: true }); return true; }
  catch (err) { console.warn('Firebase expenses sync warning:', err); return false; }
}
export async function syncPettyCashToFirebase(amount: number, merchantId: string = 'default', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  saveMerchantPettyCash(merchantId, businessType, amount);
  try { await setDoc(doc(db, 'yupos_finances', `${merchantId}_${businessType}_pettyCash`), { amount, updatedAt: Date.now() }, { merge: true }); return true; }
  catch (err) { console.warn('Firebase petty cash sync warning:', err); return false; }
}
