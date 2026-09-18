import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { Order, Expense, ProductItem, StoreSettings, BusinessType } from '../types';
import { auth, db } from '../config/firebase';

export const defaultSettings: StoreSettings = {
  businessType: 'custom', customBusinessTypeName: '', storeName: '', storeAddress: '', storePhone: '', footer: '', logoBase64: '',
  shift1Name: '', shift2Name: '', shift1Start: '10:00', shift1End: '13:00', shift2Start: '13:00', shift2End: '22:00', activeShift: '1', manualOverride: false,
  portalPins: { admin: '', expenses: '', inventory: '', staff: '', settings: '', historyDeletePin: '', historyEditPin: '', historyCancelPin: '' },
  btAutoPrint: false, ppnEnabled: false, ppnRate: 11, categories: [], staffRoles: [], staffList: {},
};

function requireMerchantId(merchantId: string): string {
  const id = String(merchantId || '').trim();
  if (!id || id === 'default' || id === 'merchant_default') throw new Error('Merchant authentication is required before accessing merchant data.');
  const authUid = auth.currentUser?.uid?.trim();
  if (!authUid || authUid !== id) throw new Error('Merchant identity does not match the authenticated Firebase user.');
  return id;
}

function sanitizeFirestoreData<T>(value: T): T {
  if (value === undefined) return undefined as T;
  if (Array.isArray(value)) return value.map(item => sanitizeFirestoreData(item)).filter(item => item !== undefined) as T;
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) output[key] = sanitizeFirestoreData(item);
    }
    return output as T;
  }
  return value;
}

function mergeSettings(saved: StoreSettings): StoreSettings {
  return { ...defaultSettings, ...saved, portalPins: { ...defaultSettings.portalPins, ...(saved.portalPins || {}) }, categories: Array.isArray(saved.categories) ? saved.categories : [], staffRoles: Array.isArray(saved.staffRoles) ? saved.staffRoles : [], staffList: saved.staffList && typeof saved.staffList === 'object' ? saved.staffList : {} };
}

const syncQueues = new Map<string, Promise<boolean>>();

function enqueueSync(key: string, operation: () => Promise<boolean>): Promise<boolean> {
  const previous = syncQueues.get(key) || Promise.resolve(true);
  const next = previous.catch(() => false).then(operation);
  syncQueues.set(key, next);
  void next.finally(() => {
    if (syncQueues.get(key) === next) syncQueues.delete(key);
  });
  return next;
}

export function getMerchantStorageKey(merchantId: string, businessType: BusinessType | string, dataType: 'products' | 'orders' | 'expenses' | 'pettyCash' | 'settings'): string {
  const id = String(merchantId || '').trim();
  if (!id || id === 'default' || id === 'merchant_default') throw new Error('Invalid merchant storage key.');
  return dataType === 'settings' ? `yupos_${id}_settings` : `yupos_${id}_${businessType}_${dataType}`;
}

export function loadLocalData<T>(key: string, defaultValue: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : defaultValue; } catch { return defaultValue; } }
export function saveLocalData<T>(key: string, value: T): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn(`Local cache write failed for ${key}:`, err); } }

export async function hydrateMerchantDataFromFirebase(merchantId: string, businessType: BusinessType): Promise<boolean> {
  try {
    const id = requireMerchantId(merchantId);
    const settingsSnap = await getDoc(doc(db, 'yupos_config', id, 'settings', 'data'));
    const cloudSettings = settingsSnap.exists() ? mergeSettings(settingsSnap.data() as StoreSettings) : null;
    const resolvedBusinessType = (cloudSettings?.businessType || businessType) as BusinessType;

    if (cloudSettings) saveMerchantSettings(id, cloudSettings, true);

    const [productsSnap, ordersSnap, expensesSnap, pettyCashSnap] = await Promise.all([
      getDoc(doc(db, 'yupos_catalog', id, resolvedBusinessType, 'products')),
      getDoc(doc(db, 'yupos_transactions', id, resolvedBusinessType, 'orders')),
      getDoc(doc(db, 'yupos_finances', id, resolvedBusinessType, 'expenses')),
      getDoc(doc(db, 'yupos_finances', id, resolvedBusinessType, 'pettyCash')),
    ]);

    if (productsSnap.exists()) saveMerchantProducts(id, resolvedBusinessType, (productsSnap.data().items || []) as ProductItem[], true);
    if (ordersSnap.exists()) saveMerchantOrders(id, resolvedBusinessType, (ordersSnap.data().list || []) as Order[], true);
    if (expensesSnap.exists()) saveMerchantExpenses(id, resolvedBusinessType, (expensesSnap.data().list || []) as Expense[], true);
    if (pettyCashSnap.exists()) saveMerchantPettyCash(id, resolvedBusinessType, Number(pettyCashSnap.data().amount || 0), true);
    return Boolean(settingsSnap.exists() || productsSnap.exists() || ordersSnap.exists() || expensesSnap.exists() || pettyCashSnap.exists());
  } catch (err) { console.error('Firebase merchant hydration failed:', err); return false; }
}

function isLegacyDemoProduct(item: ProductItem): boolean { return /^(barber|salon|fnb|ret|ld|ws|cst)-/i.test(String(item.id || '').trim()); }
function createCollisionSafeOrderId(): string { const d = new Date(); const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`; const r = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase() : Math.random().toString(36).slice(2,10).toUpperCase(); return `ORD-${stamp}-${r}`; }
function normalizeOrderIds(orders: Order[]): Order[] { const used = new Set<string>(); return orders.map(order => { let id = String(order.id || '').trim(); if (!id || used.has(id)) { do id = createCollisionSafeOrderId(); while (used.has(id)); } used.add(id); return id === order.id ? order : { ...order, id }; }); }
function orderFingerprint(order: Order): string { return JSON.stringify({ timestamp: Number(order.timestamp || 0), date: order.date || '', time: order.time || '', total: Number(order.total || 0), customer: order.customer || '', customerCode: order.customerCode || '', payment: order.payment || '', items: order.items || [] }); }
function dedupeOrders(orders: Order[]): Order[] { const seen = new Set<string>(); return orders.filter(order => { const fp = orderFingerprint(order); if (seen.has(fp)) return false; seen.add(fp); return true; }); }

export function loadMerchantSettings(merchantId: string): StoreSettings { if (!merchantId) return { ...defaultSettings }; return mergeSettings(loadLocalData<StoreSettings>(getMerchantStorageKey(merchantId, 'default', 'settings'), defaultSettings)); }

// Save helpers are cache-only by design. The cache is written only when explicitly requested
// by hydration or after a successful Firestore write.
export function saveMerchantSettings(merchantId: string, settings: StoreSettings, persistToCache = false): void {
  if (!merchantId || !persistToCache) return;
  saveLocalData(getMerchantStorageKey(merchantId, 'default', 'settings'), mergeSettings(settings));
}

const settingsMetaKey = (merchantId: string): string => `yupos_${merchantId}_settings_meta`;

function readSettingsMeta(merchantId: string): { updatedAt: number } {
  try {
    const raw = localStorage.getItem(settingsMetaKey(merchantId));
    const parsed = raw ? JSON.parse(raw) : null;
    const updatedAt = Number(parsed?.updatedAt);
    return Number.isFinite(updatedAt) ? { updatedAt } : { updatedAt: 0 };
  } catch {
    return { updatedAt: 0 };
  }
}

function writeSettingsMeta(merchantId: string, updatedAt: number): void {
  try {
    localStorage.setItem(settingsMetaKey(merchantId), JSON.stringify({ updatedAt }));
  } catch (error) {
    console.warn('Merchant settings metadata cache write failed:', error);
  }
}
export function loadMerchantProducts(merchantId: string, businessType: BusinessType): ProductItem[] { if (!merchantId) return []; return loadLocalData<ProductItem[]>(getMerchantStorageKey(merchantId, businessType, 'products'), []).filter(item => !isLegacyDemoProduct(item)).map(item => ({ ...item, businessType, merchantId })); }
export function saveMerchantProducts(merchantId: string, businessType: BusinessType, products: ProductItem[], persistToCache = false): void { if (!merchantId || !persistToCache) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'products'), products.map(p => ({ ...p, merchantId: id, businessType }))); }
export function loadMerchantOrders(merchantId: string, businessType: BusinessType): Order[] { if (!merchantId) return []; const parsed = loadLocalData<Order[]>(getMerchantStorageKey(merchantId, businessType, 'orders'), []); return normalizeOrderIds(dedupeOrders(parsed)).map(o => ({ ...o, merchantId, businessType })); }
export function saveMerchantOrders(merchantId: string, businessType: BusinessType, orders: Order[], persistToCache = false): void { if (!merchantId || !persistToCache) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'orders'), normalizeOrderIds(dedupeOrders(orders.map(o => ({ ...o, merchantId: id, businessType })) ))); }
export function loadMerchantExpenses(merchantId: string, businessType: BusinessType): Expense[] { if (!merchantId) return []; return loadLocalData<Expense[]>(getMerchantStorageKey(merchantId, businessType, 'expenses'), []).map(e => ({ ...e, merchantId, businessType })); }
export function saveMerchantExpenses(merchantId: string, businessType: BusinessType, expenses: Expense[], persistToCache = false): void { if (!merchantId || !persistToCache) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'expenses'), expenses.map(e => ({ ...e, merchantId: id, businessType }))); }
export function loadMerchantPettyCash(merchantId: string, businessType: BusinessType): number { if (!merchantId) return 0; return loadLocalData<number>(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), 0); }
export function saveMerchantPettyCash(merchantId: string, businessType: BusinessType, amount: number, persistToCache = false): void { if (!merchantId || !persistToCache) return; saveLocalData(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), Number(amount) || 0); }

export function syncConfigToFirebase(settings: StoreSettings, merchantId: string = ''): Promise<boolean> {
  return enqueueSync(`settings:${merchantId}`, async () => {
    try {
      const id = requireMerchantId(merchantId);
      const clean = mergeSettings(sanitizeFirestoreData(settings));
      // The local snapshot is durable and carries a monotonic timestamp so the
      // next bootstrap can distinguish a newer unsynced local mutation from an
      // older/stale Firestore snapshot. This removes the need for heuristic
      // "richness" comparisons during normal operation.
      const previousMeta = readSettingsMeta(id);
      const updatedAt = Math.max(Date.now(), previousMeta.updatedAt + 1);

      saveMerchantSettings(id, clean, true);
      writeSettingsMeta(id, updatedAt);

      const settingsRef = doc(db, 'yupos_config', id, 'settings', 'data');
      const payload = sanitizeFirestoreData({ ...clean, merchantId: id, updatedAt });

      await setDoc(settingsRef, payload, { merge: true });

      // Verify against the server after every settings write. A successful
      // client-side enqueue is not enough for business-critical configuration.
      const verifiedSnap = await getDocFromServer(settingsRef);
      if (!verifiedSnap.exists()) {
        throw new Error('Firestore settings document was not readable after write.');
      }
      const verified = verifiedSnap.data() as Record<string, unknown>;
      for (const [key, value] of Object.entries(clean)) {
        if (JSON.stringify(verified[key]) !== JSON.stringify(value)) {
          throw new Error(`Firestore settings verification failed for field: ${key}`);
        }
      }
      if (String(verified.merchantId || '') !== id) {
        throw new Error('Firestore settings verification failed: merchantId mismatch.');
      }

      // Re-write the exact verified snapshot so cache and cloud stay aligned.
      saveMerchantSettings(id, clean, true);
      writeSettingsMeta(id, Number(verified.updatedAt) || updatedAt);
      return true;
    } catch (err) {
      console.error('Firebase config sync failed:', err);
      return false;
    }
  });
}

export function syncProductsToFirebase(products: ProductItem[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  return enqueueSync(`products:${merchantId}:${businessType}`, async () => {
    try {
      const id = requireMerchantId(merchantId);
      const clean = products.map(p => ({ ...p, merchantId: id, businessType }));
      saveMerchantProducts(id, businessType, clean, true);
      await setDoc(doc(db, 'yupos_catalog', id, businessType, 'products'), sanitizeFirestoreData({ items: clean, merchantId: id, businessType, updatedAt: Date.now() }), { merge: true });
      saveMerchantProducts(id, businessType, clean, true);
      return true;
    } catch (err) { console.error('Firebase products sync failed:', err); return false; }
  });
}

export function syncOrdersToFirebase(orders: Order[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  return enqueueSync(`orders:${merchantId}:${businessType}`, async () => {
    try {
      const id = requireMerchantId(merchantId);
      const normalized = normalizeOrderIds(dedupeOrders(orders.map(o => ({ ...o, merchantId: id, businessType }))));
      saveMerchantOrders(id, businessType, normalized, true);
      await setDoc(doc(db, 'yupos_transactions', id, businessType, 'orders'), sanitizeFirestoreData({ list: normalized, merchantId: id, businessType, updatedAt: Date.now() }), { merge: true });
      saveMerchantOrders(id, businessType, normalized, true);
      return true;
    } catch (err) { console.error('Firebase orders sync failed:', err); return false; }
  });
}

export function syncExpensesToFirebase(expenses: Expense[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  return enqueueSync(`expenses:${merchantId}:${businessType}`, async () => {
    try {
      const id = requireMerchantId(merchantId);
      const clean = expenses.map(e => ({ ...e, merchantId: id, businessType }));
      saveMerchantExpenses(id, businessType, clean, true);
      await setDoc(doc(db, 'yupos_finances', id, businessType, 'expenses'), sanitizeFirestoreData({ list: clean, merchantId: id, businessType, updatedAt: Date.now() }), { merge: true });
      saveMerchantExpenses(id, businessType, clean, true);
      return true;
    } catch (err) { console.error('Firebase expenses sync failed:', err); return false; }
  });
}

export function syncPettyCashToFirebase(amount: number, merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> {
  return enqueueSync(`pettyCash:${merchantId}:${businessType}`, async () => {
    try {
      const id = requireMerchantId(merchantId);
      const cleanAmount = Number(amount) || 0;
      saveMerchantPettyCash(id, businessType, cleanAmount, true);
      await setDoc(doc(db, 'yupos_finances', id, businessType, 'pettyCash'), sanitizeFirestoreData({ amount: cleanAmount, merchantId: id, businessType, updatedAt: Date.now() }), { merge: true });
      saveMerchantPettyCash(id, businessType, cleanAmount, true);
      return true;
    } catch (err) { console.error('Firebase petty cash sync failed:', err); return false; }
  });
}
