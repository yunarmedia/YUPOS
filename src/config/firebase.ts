import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
