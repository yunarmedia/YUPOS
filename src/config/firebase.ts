import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// The local merchant session is only a cache. Firebase Authentication remains the source of truth.
// If a stale/tampered local session exists without a matching Firebase user, clear it and reload
// so the app cannot expose merchant-scoped local data to an unauthenticated session.
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    try {
      const raw = localStorage.getItem('yupos_merchant_session');
      if (!raw) return;

      const saved = JSON.parse(raw) as { uid?: string };
      const savedUid = String(saved?.uid || '').trim();
      const authUid = String(user?.uid || '').trim();

      if (!user || !savedUid || savedUid !== authUid) {
        localStorage.removeItem('yupos_merchant_session');
        window.location.reload();
      }
    } catch {
      localStorage.removeItem('yupos_merchant_session');
      window.location.reload();
    }
  });
}
