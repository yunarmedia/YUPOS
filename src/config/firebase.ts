import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// New Firebase configuration provided for YuPOS Universal
export const firebaseConfig = {
  apiKey: "AIzaSyCuKy-_tBuUcUUluUfNLYIBdh1u4KYzQ1k",
  authDomain: "yuposcashier.firebaseapp.com",
  projectId: "yuposcashier",
  storageBucket: "yuposcashier.firebasestorage.app",
  messagingSenderId: "402921958668",
  appId: "1:402921958668:web:5fe5215eeb9a5082e1ed29"
};

// Initialize Firebase safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Firebase Authentication is the source of merchant identity.
 * localStorage is only a browser cache and must never be used to decide
 * which merchant is currently authenticated.
 *
 * When browser site data is cleared, the local cache disappears. If the
 * merchant signs in again, restore the merchant-owned cache from Firestore.
 */
async function restoreMerchantCacheFromCloud(uid: string): Promise<void> {
  if (typeof window === 'undefined' || !uid) return;

  const restoreMarker = `yupos_cloud_restore_${uid}`;
  if (sessionStorage.getItem(restoreMarker) === '1') return;

  try {
    const settingsRef = doc(db, 'yupos_config', uid, 'settings', 'data');
    const settingsSnap = await getDoc(settingsRef);

    let restoredAnything = false;
    let businessType = 'barbershop';

    if (settingsSnap.exists()) {
      const settings = settingsSnap.data() as Record<string, unknown>;
      businessType = String(settings.businessType || 'barbershop');
      localStorage.setItem(`yupos_${uid}_settings`, JSON.stringify(settings));
      restoredAnything = true;
    } else {
      try {
        const localSettings = JSON.parse(localStorage.getItem(`yupos_${uid}_settings`) || '{}');
        businessType = String(localSettings.businessType || 'barbershop');
      } catch {
        // Keep the safe fallback business type.
      }
    }

    const cloudDocs = [
      { ref: doc(db, 'yupos_catalog', uid, businessType, 'products'), localKey: `yupos_${uid}_${businessType}_products`, extract: (data: Record<string, unknown>) => data.items },
      { ref: doc(db, 'yupos_transactions', uid, businessType, 'orders'), localKey: `yupos_${uid}_${businessType}_orders`, extract: (data: Record<string, unknown>) => data.list },
      { ref: doc(db, 'yupos_finances', uid, businessType, 'expenses'), localKey: `yupos_${uid}_${businessType}_expenses`, extract: (data: Record<string, unknown>) => data.list },
      { ref: doc(db, 'yupos_finances', uid, businessType, 'pettyCash'), localKey: `yupos_${uid}_${businessType}_pettyCash`, extract: (data: Record<string, unknown>) => data.amount },
      { ref: doc(db, 'yupos_crm', uid, 'customers', 'data'), localKey: `yupos_${uid}_customers`, extract: (data: Record<string, unknown>) => data.list },
    ];

    for (const cloudDoc of cloudDocs) {
      const snapshot = await getDoc(cloudDoc.ref);
      if (!snapshot.exists()) continue;

      const value = cloudDoc.extract(snapshot.data() as Record<string, unknown>);
      if (value === undefined) continue;

      localStorage.setItem(cloudDoc.localKey, JSON.stringify(value));
      restoredAnything = true;
    }

    sessionStorage.setItem(restoreMarker, '1');

    // React initializes POS state synchronously from localStorage. Reload once
    // after a successful cloud restore so the recovered data is reflected in state.
    if (restoredAnything) window.location.reload();
  } catch (error) {
    console.warn('Firestore merchant cache restore warning:', error);
  }
}

if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    try {
      const raw = localStorage.getItem('yupos_merchant_session');
      if (raw) {
        const saved = JSON.parse(raw) as { uid?: string };
        const savedUid = String(saved?.uid || '').trim();
        const authUid = String(user?.uid || '').trim();

        if (!user || !savedUid || savedUid !== authUid) {
          localStorage.removeItem('yupos_merchant_session');
          window.location.reload();
          return;
        }
      }

      if (user) {
        void restoreMerchantCacheFromCloud(user.uid);
      }
    } catch {
      localStorage.removeItem('yupos_merchant_session');
      window.location.reload();
    }
  });
}
