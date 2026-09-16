import { doc, getDoc, setDoc } from 'firebase/firestore';
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

function mergeSettings(saved: StoreSettings): StoreSettings {
  return { ...defaultSettings, ...saved, portalPins: { ...defaultSettings.portalPins, ...(saved.portalPins || {}) }, categories: Array.isArray(saved.categories) ? saved.categories : [], staffRoles: Array.isArray(saved.staffRoles) ? saved.staffRoles : [], staffList: saved.staffList && typeof saved.staffList === 'object' ? saved.staffList : {} };
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
    const [settingsSnap, productsSnap, ordersSnap, expensesSnap, pettyCashSnap] = await Promise.all([
      getDoc(doc(db, 'yupos_config', id, 'settings', 'data')),
      getDoc(doc(db, 'yupos_catalog', id, businessType, 'products')),
      getDoc(doc(db, 'yupos_transactions', id, businessType, 'orders')),
      getDoc(doc(db, 'yupos_finances', id, businessType, 'expenses')),
      getDoc(doc(db, 'yupos_finances', id, businessType, 'pettyCash')),
    ]);
    if (settingsSnap.exists()) saveMerchantSettings(id, mergeSettings(settingsSnap.data() as StoreSettings));
    if (productsSnap.exists()) saveMerchantProducts(id, businessType, (productsSnap.data().items || []) as ProductItem[]);
    if (ordersSnap.exists()) saveMerchantOrders(id, businessType, (ordersSnap.data().list || []) as Order[]);
    if (expensesSnap.exists()) saveMerchantExpenses(id, businessType, (expensesSnap.data().list || []) as Expense[]);
    if (pettyCashSnap.exists()) saveMerchantPettyCash(id, businessType, Number(pettyCashSnap.data().amount || 0));
    return true;
  } catch (err) { console.warn('Firebase merchant hydration warning:', err); return false; }
}

function isLegacyDemoProduct(item: ProductItem): boolean { return /^(barber|salon|fnb|ret|ld|ws|cst)-/i.test(String(item.id || '').trim()); }
function createCollisionSafeOrderId(): string { const d = new Date(); const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`; const r = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase() : Math.random().toString(36).slice(2,10).toUpperCase(); return `ORD-${stamp}-${r}`; }
function normalizeOrderIds(orders: Order[]): Order[] { const used = new Set<string>(); return orders.map(order => { let id = String(order.id || '').trim(); if (!id || used.has(id)) { do id = createCollisionSafeOrderId(); while (used.has(id)); } used.add(id); return id === order.id ? order : { ...order, id }; }); }
function orderFingerprint(order: Order): string { return JSON.stringify({ timestamp: Number(order.timestamp || 0), date: order.date || '', time: order.time || '', total: Number(order.total || 0), customer: order.customer || '', customerCode: order.customerCode || '', payment: order.payment || '', items: order.items || [] }); }
function dedupeOrders(orders: Order[]): Order[] { const seen = new Set<string>(); return orders.filter(order => { const fp = orderFingerprint(order); if (seen.has(fp)) return false; seen.add(fp); return true; }); }

export function loadMerchantSettings(merchantId: string): StoreSettings { if (!merchantId) return { ...defaultSettings }; return mergeSettings(loadLocalData<StoreSettings>(getMerchantStorageKey(merchantId, 'default', 'settings'), defaultSettings)); }
export function saveMerchantSettings(merchantId: string, settings: StoreSettings): void { if (!merchantId) return; saveLocalData(getMerchantStorageKey(merchantId, 'default', 'settings'), mergeSettings(settings)); }
export function loadMerchantProducts(merchantId: string, businessType: BusinessType): ProductItem[] { if (!merchantId) return []; return loadLocalData<ProductItem[]>(getMerchantStorageKey(merchantId, businessType, 'products'), []).filter(item => !isLegacyDemoProduct(item)).map(item => ({ ...item, businessType, merchantId })); }
export function saveMerchantProducts(merchantId: string, businessType: BusinessType, products: ProductItem[]): void { if (!merchantId) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'products'), products.map(p => ({ ...p, merchantId: id, businessType }))); }
export function loadMerchantOrders(merchantId: string, businessType: BusinessType): Order[] { if (!merchantId) return []; const parsed = loadLocalData<Order[]>(getMerchantStorageKey(merchantId, businessType, 'orders'), []); return normalizeOrderIds(dedupeOrders(parsed)).map(o => ({ ...o, merchantId, businessType })); }
export function saveMerchantOrders(merchantId: string, businessType: BusinessType, orders: Order[]): void { if (!merchantId) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'orders'), normalizeOrderIds(dedupeOrders(orders.map(o => ({ ...o, merchantId: id, businessType }))))); }
export function loadMerchantExpenses(merchantId: string, businessType: BusinessType): Expense[] { if (!merchantId) return []; return loadLocalData<Expense[]>(getMerchantStorageKey(merchantId, businessType, 'expenses'), []).map(e => ({ ...e, merchantId, businessType })); }
export function saveMerchantExpenses(merchantId: string, businessType: BusinessType, expenses: Expense[]): void { if (!merchantId) return; const id = String(merchantId).trim(); saveLocalData(getMerchantStorageKey(id, businessType, 'expenses'), expenses.map(e => ({ ...e, merchantId: id, businessType }))); }
export function loadMerchantPettyCash(merchantId: string, businessType: BusinessType): number { if (!merchantId) return 0; return loadLocalData<number>(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), 0); }
export function saveMerchantPettyCash(merchantId: string, businessType: BusinessType, amount: number): void { if (!merchantId) return; saveLocalData(getMerchantStorageKey(merchantId, businessType, 'pettyCash'), Number(amount) || 0); }

export async function syncConfigToFirebase(settings: StoreSettings, merchantId: string = ''): Promise<boolean> { try { const id = requireMerchantId(merchantId); await setDoc(doc(db, 'yupos_config', id, 'settings', 'data'), { ...settings, merchantId: id }, { merge: true }); saveMerchantSettings(id, settings); return true; } catch (err) { console.warn('Firebase config sync warning:', err); return false; } }
export async function syncProductsToFirebase(products: ProductItem[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> { try { const id = requireMerchantId(merchantId); await setDoc(doc(db, 'yupos_catalog', id, businessType, 'products'), { items: products.map(p => ({ ...p, merchantId: id, businessType })), merchantId: id, businessType, updatedAt: Date.now() }, { merge: true }); saveMerchantProducts(id, businessType, products); return true; } catch (err) { console.warn('Firebase products sync warning:', err); return false; } }
export async function syncOrdersToFirebase(orders: Order[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> { try { const id = requireMerchantId(merchantId); const normalized = normalizeOrderIds(dedupeOrders(orders.map(o => ({ ...o, merchantId: id, businessType })))); await setDoc(doc(db, 'yupos_transactions', id, businessType, 'orders'), { list: normalized, merchantId: id, businessType, updatedAt: Date.now() }, { merge: true }); saveMerchantOrders(id, businessType, normalized); return true; } catch (err) { console.warn('Firebase orders sync warning:', err); return false; } }
export async function syncExpensesToFirebase(expenses: Expense[], merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> { try { const id = requireMerchantId(merchantId); await setDoc(doc(db, 'yupos_finances', id, businessType, 'expenses'), { list: expenses.map(e => ({ ...e, merchantId: id, businessType })), merchantId: id, businessType, updatedAt: Date.now() }, { merge: true }); saveMerchantExpenses(id, businessType, expenses); return true; } catch (err) { console.warn('Firebase expenses sync warning:', err); return false; } }
export async function syncPettyCashToFirebase(amount: number, merchantId: string = '', businessType: BusinessType = 'barbershop'): Promise<boolean> { try { const id = requireMerchantId(merchantId); await setDoc(doc(db, 'yupos_finances', id, businessType, 'pettyCash'), { amount: Number(amount) || 0, merchantId: id, businessType, updatedAt: Date.now() }, { merge: true }); saveMerchantPettyCash(id, businessType, amount); return true; } catch (err) { console.warn('Firebase petty cash sync warning:', err); return false; } }
