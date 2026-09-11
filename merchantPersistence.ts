import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config/firebase';
import { BusinessType, StoreSettings } from './types';
import { defaultSettings } from './services/storageService';

const HYDRATION_FLAG = 'yupos_cloud_hydrated_uid';
const RELOAD_FLAG = 'yupos_cloud_hydration_reload';

const safeRead = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`YUPOS local cache write failed for ${key}:`, error);
  }
};

const hasLocalBusinessCache = (merchantId: string, businessType: BusinessType): boolean => {
  const keys = [
    `yupos_${merchantId}_settings`,
    `yupos_${merchantId}_${businessType}_products`,
    `yupos_${merchantId}_${businessType}_orders`,
    `yupos_${merchantId}_${businessType}_expenses`,
    `yupos_${merchantId}_${businessType}_pettyCash`,
    `yupos_${merchantId}_customers`,
  ];
  return keys.every((key) => localStorage.getItem(key) !== null);
};

const hydrateMerchant = async (merchantId: string): Promise<boolean> => {
  const configSnap = await getDoc(doc(db, 'yupos_config', `${merchantId}_settings`));
  const cloudSettings = configSnap.exists() ? (configSnap.data() as Partial<StoreSettings>) : null;
  const localSettings = safeRead<StoreSettings>('yupos_settings', defaultSettings);
  const businessType = (cloudSettings?.businessType || localSettings.businessType || 'barbershop') as BusinessType;

  if (cloudSettings) {
    safeWrite(`yupos_${merchantId}_settings`, { ...defaultSettings, ...cloudSettings });
    safeWrite('yupos_settings', { ...defaultSettings, ...cloudSettings });
  }

  const [products, orders, expenses, pettyCash, customers] = await Promise.all([
    getDoc(doc(db, 'yupos_catalog', `${merchantId}_${businessType}_products`)),
    getDoc(doc(db, 'yupos_transactions', `${merchantId}_${businessType}_orders`)),
    getDoc(doc(db, 'yupos_finances', `${merchantId}_${businessType}_expenses`)),
    getDoc(doc(db, 'yupos_finances', `${merchantId}_${businessType}_pettyCash`)),
    getDoc(doc(db, 'yupos_crm', `${merchantId}_customers`)),
  ]);

  if (products.exists() && Array.isArray(products.data().items)) {
    safeWrite(`yupos_${merchantId}_${businessType}_products`, products.data().items);
  }
  if (orders.exists() && Array.isArray(orders.data().list)) {
    safeWrite(`yupos_${merchantId}_${businessType}_orders`, orders.data().list);
  }
  if (expenses.exists() && Array.isArray(expenses.data().list)) {
    safeWrite(`yupos_${merchantId}_${businessType}_expenses`, expenses.data().list);
  }
  if (pettyCash.exists() && typeof pettyCash.data().amount === 'number') {
    safeWrite(`yupos_${merchantId}_${businessType}_pettyCash`, pettyCash.data().amount);
  }
  if (customers.exists() && Array.isArray(customers.data().list)) {
    safeWrite(`yupos_${merchantId}_customers`, customers.data().list);
  }

  return Boolean(configSnap.exists() || products.exists() || orders.exists() || expenses.exists() || pettyCash.exists() || customers.exists());
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    localStorage.removeItem(HYDRATION_FLAG);
    localStorage.removeItem(RELOAD_FLAG);
    return;
  }

  const merchantId = user.uid;
  const previousHydratedUid = localStorage.getItem(HYDRATION_FLAG);
  if (previousHydratedUid === merchantId) return;

  const localSettingsBeforeHydration = safeRead<StoreSettings>(
    `yupos_${merchantId}_settings`,
    defaultSettings,
  );
  const hadCompleteLocalCache = hasLocalBusinessCache(merchantId, (localSettingsBeforeHydration.businessType || 'barbershop') as BusinessType);

  try {
    const cloudHasData = await hydrateMerchant(merchantId);
    localStorage.setItem(HYDRATION_FLAG, merchantId);

    if (cloudHasData && !hadCompleteLocalCache && !sessionStorage.getItem(RELOAD_FLAG)) {
      // Cloud data was restored into an empty/new browser cache. Reload once so
      // App.tsx initializes its synchronous localStorage state from the restored data.
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    } else {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
  } catch (error) {
    console.warn('YUPOS cloud business restore failed; keeping local data:', error);
  }
});
