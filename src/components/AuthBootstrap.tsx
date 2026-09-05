import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthBootstrapProps { children: React.ReactNode; }

export const AuthBootstrap: React.FC<AuthBootstrapProps> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      if (!user) {
        localStorage.removeItem('yupos_merchant_session');
      }
      setReady(true);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-slate-950" aria-label="Memuat YUPOS" />;
  }

  return <>{children}</>;
};
