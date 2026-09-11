import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { MerchantUser } from '../types';
import { getLicenseMessage, getMerchantProfile, isMerchantLicenseActive } from '../services/merchantService';

interface AuthBootstrapProps { children: React.ReactNode; }
type GateState = 'checking' | 'ready' | 'blocked';

export const AuthBootstrap: React.FC<AuthBootstrapProps> = ({ children }) => {
  const [state, setState] = useState<GateState>('checking');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    const clearSession = () => localStorage.removeItem('yupos_merchant_session');

    const evaluateUser = async (user: typeof auth.currentUser) => {
      if (!active) return;

      // Only the initial bootstrap may show the full-screen checking state.
      // Periodic license checks must never unmount App, otherwise activeTab
      // falls back to the default POS/dashboard view.
      if (!initialCheckDone.current) setState('checking');

      if (!user) {
        if (interval !== null) window.clearInterval(interval);
        interval = null;
        clearSession();
        setBlockedMessage('');
        setBlockedEmail(null);
        initialCheckDone.current = true;
        setState('ready');
        return;
      }

      setBlockedEmail(user.email);

      try {
        const profile = await getMerchantProfile(user.uid);
        if (!active) return;

        if (!isMerchantLicenseActive(profile)) {
          clearSession();
          setBlockedMessage(getLicenseMessage(profile));
          initialCheckDone.current = true;
          setState('blocked');
          return;
        }

        const merchant: MerchantUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Merchant',
        };
        localStorage.setItem('yupos_merchant_session', JSON.stringify(merchant));
        setBlockedMessage('');
        setBlockedEmail(null);
        initialCheckDone.current = true;
        setState('ready');
      } catch (error) {
        console.warn('Merchant license verification failed:', error);
        if (!active) return;

        // A transient Firebase/network failure during a periodic check must
        // not kick an already authenticated user out of the running app.
        if (initialCheckDone.current) return;

        clearSession();
        setBlockedMessage('Gagal memverifikasi status merchant. Periksa koneksi internet lalu coba lagi.');
        initialCheckDone.current = true;
        setState('blocked');
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void evaluateUser(user);

      if (interval !== null) window.clearInterval(interval);
      interval = null;
      if (user) {
        interval = window.setInterval(() => {
          void evaluateUser(auth.currentUser);
        }, 60_000);
      }
    });

    return () => {
      active = false;
      unsubscribe();
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);

  const handleBlockedLogout = async () => {
    clearBlockedSession();
    try { await signOut(auth); } catch (error) { console.warn('Logout error:', error); }
  };

  const clearBlockedSession = () => {
    localStorage.removeItem('yupos_merchant_session');
    setBlockedMessage('');
    setBlockedEmail(null);
    setState('checking');
  };

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center text-white">
        <div>
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-blue-400" />
          <p className="text-sm font-bold">Memverifikasi akses YUPOS...</p>
          <p className="mt-1 text-xs text-slate-400">Memeriksa akun dan status lisensi merchant.</p>
        </div>
      </div>
    );
  }

  if (state === 'blocked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">🔒</div>
          <div className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-blue-600">YUPOS • LICENSE CONTROL</div>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Akses YUPOS belum tersedia</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{blockedMessage}</p>
          {blockedEmail && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{blockedEmail}</p>}
          <button type="button" onClick={handleBlockedLogout} className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700">Keluar dari akun</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
