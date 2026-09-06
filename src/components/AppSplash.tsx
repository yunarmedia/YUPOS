import React, { useEffect } from 'react';
import { speakBrandIntro } from '../services/audioService';

export const AppSplash: React.FC = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => speakBrandIntro(), 450);
    return () => {
      window.clearTimeout(timer);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#2563eb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_58%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center px-8 text-center">
        <div className="relative flex w-[min(82vw,420px)] items-center justify-center animate-[yupos-logo-in_900ms_cubic-bezier(.22,1,.36,1)_both]">
          <img
            src="./assets/yupos-loading-logo.png"
            alt="YUPOS - One Pos For Everything"
            className="block h-auto w-full object-contain mix-blend-screen drop-shadow-[0_0_55px_rgba(255,255,255,0.18)]"
          />
        </div>
        <div className="mt-7 flex items-center gap-2 text-white/80">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300 [animation-delay:160ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300 [animation-delay:320ms]" />
        </div>
        <p className="mt-3 text-[11px] font-bold tracking-[0.24em] text-white/65">ONE POS FOR EVERYTHING</p>
      </div>
    </div>
  );
};
