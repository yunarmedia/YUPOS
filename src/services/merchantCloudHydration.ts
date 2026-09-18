import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type JsonRecord = Record<string, unknown>;

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

function mergeSettings(local: JsonRecord, cloud: JsonRecord): JsonRecord {
  const merged: JsonRecord = { ...local };

  for (const [key, cloudValue] of Object.entries(cloud)) {
    const localValue = local[key];

    // A stale/default cloud document must never erase a richer merchant cache.
    // Cloud values still win when they are meaningful and local is empty.
    if (isMeaningful(cloudValue) || !isMeaningful(localValue)) {
      merged[key] = cloudValue;
    }
  }

  return merged;
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

  try {
    const settingsRef = doc(db, 'yupos_config', merchantId, 'settings', 'data');
    const settingsSnap = await getDoc(settingsRef);

    const localSettings = readLocal<JsonRecord>(`yupos_${merchantId}_settings`, {});
    const cloudSettings = settingsSnap.exists() ? (settingsSnap.data() || {}) : {};
    const mergedSettings = mergeSettings(localSettings, cloudSettings);

    const localBusinessType = String(localSettings.businessType || '').trim();
    const businessType = String(mergedSettings.businessType || localBusinessType || 'custom');

    // If local contains richer business configuration than the cloud snapshot,
    // repair the cloud document before continuing.
    const repairSettings =
      !settingsSnap.exists() ||
      Object.entries(localSettings).some(([key, localValue]) => isMeaningful(localValue) && !isMeaningful(cloudSettings[key]));

    if (repairSettings && Object.keys(localSettings).length > 0) {
      await setDoc(
        settingsRef,
        { ...localSettings, merchantId, updatedAt: Date.now() },
        { merge: true },
      );
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
}
