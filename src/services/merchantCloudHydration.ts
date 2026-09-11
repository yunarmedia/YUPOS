import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Restore merchant-scoped cloud data into the local cache without destroying
 * an existing local dataset when the cloud copy is empty or incomplete.
 */
export async function hydrateMerchantDataFromFirebase(uid: string): Promise<boolean> {
  const merchantId = String(uid || '').trim();
  if (!merchantId) return false;

  try {
    const settingsSnap = await getDoc(doc(db, 'yupos_config', merchantId, 'settings', 'data'));
    if (!settingsSnap.exists()) return false;

    const cloudSettings = settingsSnap.data() || {};
    const localSettingsRaw = localStorage.getItem(`yupos_${merchantId}_settings`);
    let localSettings: Record<string, unknown> = {};
    try {
      localSettings = localSettingsRaw ? JSON.parse(localSettingsRaw) : {};
    } catch {
      localSettings = {};
    }

    // Cloud remains the preferred source, but empty cloud fields must not wipe
    // business identity/configuration that already exists locally.
    const mergedSettings: Record<string, unknown> = { ...localSettings };
    for (const [key, value] of Object.entries(cloudSettings)) {
      const isEmptyString = typeof value === 'string' && value.trim() === '';
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      const isEmptyObject = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0;
      if (!isEmptyString && !isEmptyArray && !isEmptyObject) mergedSettings[key] = value;
      else if (!(key in mergedSettings)) mergedSettings[key] = value;
    }

    const businessType = String(mergedSettings.businessType || cloudSettings.businessType || 'custom');
    const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

    write(`yupos_${merchantId}_settings`, mergedSettings);
    write('yupos_settings', mergedSettings);

    const [productsSnap, ordersSnap, expensesSnap, pettyCashSnap, customersSnap] = await Promise.all([
      getDoc(doc(db, 'yupos_catalog', merchantId, businessType, 'products')),
      getDoc(doc(db, 'yupos_transactions', merchantId, businessType, 'orders')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'expenses')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'pettyCash')),
      getDoc(doc(db, 'yupos_crm', merchantId, 'customers', 'data')),
    ]);

    const chooseList = <T,>(localKey: string, cloudValue: unknown): T[] | null => {
      let local: T[] = [];
      try {
        const raw = localStorage.getItem(localKey);
        local = raw ? (JSON.parse(raw) as T[]) : [];
      } catch {
        local = [];
      }
      const cloud = Array.isArray(cloudValue) ? (cloudValue as T[]) : null;
      if (!cloud) return local.length ? local : null;
      // Never replace existing merchant data with an empty cloud list.
      if (cloud.length === 0 && local.length > 0) return local;
      return cloud;
    };

    const products = chooseList<unknown>(
      `yupos_${merchantId}_${businessType}_products`,
      productsSnap.exists() ? productsSnap.data()?.items : null,
    );
    const orders = chooseList<unknown>(
      `yupos_${merchantId}_${businessType}_orders`,
      ordersSnap.exists() ? ordersSnap.data()?.list : null,
    );
    const expenses = chooseList<unknown>(
      `yupos_${merchantId}_${businessType}_expenses`,
      expensesSnap.exists() ? expensesSnap.data()?.list : null,
    );
    const customers = chooseList<unknown>(
      `yupos_${merchantId}_customers`,
      customersSnap.exists() ? customersSnap.data()?.list : null,
    );

    if (products) write(`yupos_${merchantId}_${businessType}_products`, products);
    if (orders) write(`yupos_${merchantId}_${businessType}_orders`, orders);
    if (expenses) write(`yupos_${merchantId}_${businessType}_expenses`, expenses);
    if (customers) write(`yupos_${merchantId}_customers`, customers);

    const cloudPettyCash = pettyCashSnap.exists() ? pettyCashSnap.data()?.amount : undefined;
    const localPettyKey = `yupos_${merchantId}_${businessType}_pettyCash`;
    const localPettyRaw = localStorage.getItem(localPettyKey);
    const hasCloudPetty = Number.isFinite(Number(cloudPettyCash));
    const hasLocalPetty = localPettyRaw !== null && Number.isFinite(Number(localPettyRaw));
    if (hasCloudPetty || hasLocalPetty) {
      // A valid cloud value is authoritative; otherwise retain the local value.
      write(localPettyKey, hasCloudPetty ? Number(cloudPettyCash) : Number(localPettyRaw));
    }

    return true;
  } catch (error) {
    console.warn('Merchant cloud hydration warning:', error);
    return false;
  }
}
