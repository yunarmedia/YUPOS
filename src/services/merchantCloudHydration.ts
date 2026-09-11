import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/** Restore merchant-scoped cloud data into the local cache for a new device. */
export async function hydrateMerchantDataFromFirebase(uid: string): Promise<boolean> {
  const merchantId = String(uid || '').trim();
  if (!merchantId) return false;

  try {
    const settingsSnap = await getDoc(doc(db, 'yupos_config', merchantId, 'settings', 'data'));
    if (!settingsSnap.exists()) return false;

    const settings = settingsSnap.data() || {};
    const businessType = String(settings.businessType || 'custom');
    const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

    write(`yupos_${merchantId}_settings`, settings);
    write('yupos_settings', settings);

    const [productsSnap, ordersSnap, expensesSnap, pettyCashSnap, customersSnap] = await Promise.all([
      getDoc(doc(db, 'yupos_catalog', merchantId, businessType, 'products')),
      getDoc(doc(db, 'yupos_transactions', merchantId, businessType, 'orders')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'expenses')),
      getDoc(doc(db, 'yupos_finances', merchantId, businessType, 'pettyCash')),
      getDoc(doc(db, 'yupos_crm', merchantId, 'customers', 'data')),
    ]);

    if (productsSnap.exists() && Array.isArray(productsSnap.data()?.items))
      write(`yupos_${merchantId}_${businessType}_products`, productsSnap.data().items);
    if (ordersSnap.exists() && Array.isArray(ordersSnap.data()?.list))
      write(`yupos_${merchantId}_${businessType}_orders`, ordersSnap.data().list);
    if (expensesSnap.exists() && Array.isArray(expensesSnap.data()?.list))
      write(`yupos_${merchantId}_${businessType}_expenses`, expensesSnap.data().list);
    if (pettyCashSnap.exists() && Number.isFinite(Number(pettyCashSnap.data()?.amount)))
      write(`yupos_${merchantId}_${businessType}_pettyCash`, Number(pettyCashSnap.data().amount));
    if (customersSnap.exists() && Array.isArray(customersSnap.data()?.list))
      write(`yupos_${merchantId}_customers`, customersSnap.data().list);

    return true;
  } catch (error) {
    console.warn('Merchant cloud hydration warning:', error);
    return false;
  }
}
