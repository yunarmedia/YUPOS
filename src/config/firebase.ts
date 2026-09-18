import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Client Firebase configuration for YUPOS.
export const firebaseConfig = {
  apiKey: "AIzaSyAuPCaxBAXYUgkBtr0v1kmiqC2RTCe8dpI",
  authDomain: "yuposcashier.firebaseapp.com",
  projectId: "yuposcashier",
  storageBucket: "yuposcashier.firebasestorage.app",
  messagingSenderId: "402921958668",
  appId: "1:402921958668:web:5fe5215eeb9a5082e1ed29"
};

// Initialize Firebase safely.
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore persistence is enabled so writes/cache survive a page refresh.
// Multiple tabs share the same persistent cache for the same merchant account.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    // A legacy/runtime environment may already have initialized Firestore or
    // may not support persistent IndexedDB. Fall back to the normal instance.
    console.warn('YUPOS Firestore persistent cache unavailable; using default cache.', error);
    return getFirestore(app);
  }
})();
