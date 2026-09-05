import React from 'react';

interface YuposLogoProps {
  size?: number;
  showWordmark?: boolean;
  darkText?: boolean;
  className?: string;
}

export const YuposLogo: React.FC<YuposLogoProps> = ({
  size = 56,
  showWordmark = false,
  darkText = false,
  className = '',
}) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div
      className="shrink-0 overflow-hidden rounded-[22%] shadow-lg ring-1 ring-white/30"
      style={{ width: size, height: size }}
      aria-label="YUPOS"
      role="img"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="yupos-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563eb" />
            <stop offset="1" stopColor="#0b3fbf" />
          </linearGradient>
          <linearGradient id="yupos-yellow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde047" />
            <stop offset="1" stopColor="#facc15" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#yupos-blue)" />
        <path d="M25 24h14l11 24 11-24h14L58 61v15H43V61L25 24Z" fill="url(#yupos-yellow)" />
        <circle cx="79" cy="76" r="6" fill="#fff" opacity="0.95" />
      </svg>
    </div>
    {showWordmark && (
      <div className="min-w-0 leading-none">
        <div className={`text-2xl font-black tracking-[-0.04em] ${darkText ? 'text-slate-950' : 'text-white'}`}>YUPOS</div>
        <div className={`mt-1 text-[10px] font-bold tracking-[0.12em] uppercase ${darkText ? 'text-slate-500' : 'text-blue-100'}`}>One Pos For Everything</div>
      </div>
    )}
  </div>
);
