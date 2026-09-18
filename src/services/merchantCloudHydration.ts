import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type JsonRecord = Record<string, unknown>;

const hydrationInFlight = new Map<string, Promise<boolean>>();

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Merchant local cache write failed:', error);
  }
}

function isMeaningful(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value as object).length > 0;
  return value !== undefined && value !== null;
}

function settingsRichness(settings: JsonRecord): number {
  const keys = [
    'storeName',
    'storeAddress',
    'storePhone',
    'footer',
    'logoBase64',
    'customBusinessTypeName',
    'categories',
    'staffRoles',
    'staffList',
    'customPaymentMethods',
    'membershipRewards',
    'shift1Name',
    'shift2Name',
    'shift1Start',
    'shift1End',
    'shift2Start',
    'shift2End',
    'portalPins',
  ];
  return keys.reduce((score, key) => score + (isMeaningful(settings[key]) ? 1 : 0), 0);
}

function cloudUpdatedAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    try { return Number((value as { toMillis: () => number }).toMillis()) || 0; } catch { return 0; }
  }
  return 0;
}

function localUpdatedAt(merchantId: string): number {
  try {
    const raw = localStorage.getItem(`yupos_${merchantId}_settings_meta`);
    const parsed = raw ? JSON.parse(raw) : null;
    const value = Number(parsed?.updatedAt);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function mergeSettings(local: JsonRecord, cloud: JsonRecord, merchantId: string): { settings: JsonRecord; preferLocal: boolean } {
  const localTimestamp = localUpdatedAt(merchantId);
  const cloudTimestamp = cloudUpdatedAt(cloud.updatedAt);

  // Normal operation is timestamp-authoritative. A local timestamp newer than
  // the cloud snapshot means the merchant changed data after that snapshot.
  if (localTimestamp > 0 && localTimestamp > cloudTimestamp) {
    return { settings: { ...cloud, ...local }, preferLocal: true };
  }

  // Backward compatibility for snapshots created before settings metadata was
  // introduced: retain the old recovery rule only when no local timestamp exists.
  if (localTimestamp === 0 && settingsRichness(local) > settingsRichness(cloud)) {
    return { settings: { ...cloud, ...local }, preferLocal: true };
  }

  const merged: JsonRecord = { ...local };
  for (const [key, cloudValue] of Object.entries(cloud)) {
    if (key === 'updatedAt' || key === 'merchantId') continue;
    const localValue = local[key];
    if (isMeaningful(cloudValue) || !isMeaningful(localValue)) {
      merged[key] = cloudValue;
    }
  }

  return { settings: merged, preferLocal: false };
}

/**
 * Restore merchant data from Firestore while also repairing Firestore from a
 * richer merchant-local cache. This is deliberately bidirectional because old
 * YUPOS builds could leave a partially initialized/default cloud document.
 *
 * Firebase Auth UID remains the tenant boundary; localStorage is only a cache.
 */
export async function hydrateMerchantDataFromFirebase(uid: string): Promise<boolean> {
  const merchantId = String(uid || '').trim();
  if (!merchantId) return false;

  const existing = hydrationInFlight.get(merchantId);
  if (existing) return existing;

  const operation = (async (): Promise<boolean> => {
    try {
    const settingsRef = doc(db, 'yupos_config', merchantId, 'settings', 'data');
    const settingsSnap = await getDoc(settingsRef);

    const localSettings = readLocal<JsonRecord>(`yupos_${merchantId}_settings`, {});
    const cloudSettings = settingsSnap.exists() ? (settingsSnap.data() || {}) : {};
    const mergedResult = mergeSettings(localSettings, cloudSettings, merchantId);
    const mergedSettings = mergedResult.settings;

    const localBusinessType = String(localSettings.businessType || '').trim();
    const businessType = String(mergedSettings.businessType || localBusinessType || 'custom');

    // If local contains richer business configuration than the cloud snapshot,
    // repair the cloud document before continuing.
    const localTimestamp = localUpdatedAt(merchantId);
    const cloudTimestamp = cloudUpdatedAt(cloudSettings.updatedAt);
    const repairSettings =
      Object.keys(localSettings).length > 0 &&
      (!settingsSnap.exists() || mergedResult.preferLocal || localTimestamp > cloudTimestamp);

    if (repairSettings) {
      const repairUpdatedAt = Math.max(localTimestamp, Date.now());
      await setDoc(
        settingsRef,
        { ...localSettings, merchantId, updatedAt: repairUpdatedAt },
        { merge: true },
      );
      try {
        localStorage.setItem(`yupos_${merchantId}_settings_meta`, JSON.stringify({ updatedAt: repairUpdatedAt }));
      } catch (error) {
        console.warn('Merchant settings metadata repair failed:', error);
      }
    }

    writeLocal(`yupos_${merchantId}_settings`, mergedSettings);
    writeLocal('yupos_settings', mergedSettings);

    const [productsSnap, ordersSnap, expensesSnap, pettyCashSnap, customersSnap] = await Promise.all([
      getDoc(doc(db, 'yupos_catalog', merchantId, businessType, 'products')),
      getDoc(doc(db, 'yupos_transactions', merchantId, businessType, 'orders')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'expenses')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'pettyCash')),
      getDoc(doc(db, 'yupos_crm', merchantId, 'customers', 'data')),
    ]);

    const chooseList = <T,>(localKey: string, cloudValue: unknown): { value: T[] | null; repair: boolean } => {
      const local = readLocal<T[]>(localKey, []);
      const cloud = Array.isArray(cloudValue) ? (cloudValue as T[]) : null;

      if (!cloud || (cloud.length === 0 && local.length > 0)) {
        return { value: local.length ? local : null, repair: local.length > 0 };
      }

      return { value: cloud, repair: false };
    };

    const productsKey = `yupos_${merchantId}_${businessType}_products`;
    const ordersKey = `yupos_${merchantId}_${businessType}_orders`;
    const expensesKey = `yupos_${merchantId}_${businessType}_expenses`;
    const customersKey = `yupos_${merchantId}_customers`;

    const products = chooseList<unknown>(productsKey, productsSnap.exists() ? productsSnap.data()?.items : null);
    const orders = chooseList<unknown>(ordersKey, ordersSnap.exists() ? ordersSnap.data()?.list : null);
    const expenses = chooseList<unknown>(expensesKey, expensesSnap.exists() ? expensesSnap.data()?.list : null);
    const customers = chooseList<unknown>(customersKey, customersSnap.exists() ? customersSnap.data()?.list : null);

    if (products.value) {
      writeLocal(productsKey, products.value);
      if (products.repair) {
        await setDoc(
          doc(db, 'yupos_catalog', merchantId, businessType, 'products'),
          { items: products.value, merchantId, businessType, updatedAt: Date.now() },
          { merge: true },
        );
      }
    }

    if (orders.value) {
      writeLocal(ordersKey, orders.value);
      if (orders.repair) {
        await setDoc(
          doc(db, 'yupos_transactions', merchantId, businessType, 'orders'),
          { list: orders.value, merchantId, businessType, updatedAt: Date.now() },
          { merge: true },
        );
      }
    }

    if (expenses.value) {
      writeLocal(expensesKey, expenses.value);
      if (expenses.repair) {
        await setDoc(
          doc(db, 'yupos_finances', merchantId, businessType, 'expenses'),
          { list: expenses.value, merchantId, businessType, updatedAt: Date.now() },
          { merge: true },
        );
      }
    }

    if (customers.value) {
      writeLocal(customersKey, customers.value);
      if (customers.repair) {
        await setDoc(
          doc(db, 'yupos_crm', merchantId, 'customers', 'data'),
          { list: customers.value, merchantId, updatedAt: Date.now() },
          { merge: true },
        );
      }
    }

    const pettyKey = `yupos_${merchantId}_${businessType}_pettyCash`;
    const localPettyRaw = localStorage.getItem(pettyKey);
    const cloudPetty = pettyCashSnap.exists() ? pettyCashSnap.data()?.amount : undefined;
    const localPetty = localPettyRaw === null ? undefined : Number(localPettyRaw);

    if (Number.isFinite(Number(cloudPetty))) {
      writeLocal(pettyKey, Number(cloudPetty));
    } else if (Number.isFinite(localPetty)) {
      writeLocal(pettyKey, localPetty);
      await setDoc(
        doc(db, 'yupos_finances', merchantId, businessType, 'pettyCash'),
        { amount: Number(localPetty), merchantId, businessType, updatedAt: Date.now() },
        { merge: true },
      );
    }

      return true;
    } catch (error) {
      console.error('Merchant cloud hydration/repair failed:', error);
      return false;
    }
  })();

  hydrationInFlight.set(merchantId, operation);
  void operation.finally(() => {
    if (hydrationInFlight.get(merchantId) === operation) hydrationInFlight.delete(merchantId);
  });
  return operation;
}
