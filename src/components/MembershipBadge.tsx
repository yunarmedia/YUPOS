import React from 'react';
import { Crown, Sparkles } from 'lucide-react';

interface MembershipBadgeProps { size?: 'sm' | 'md' | 'lg'; showIcon?: boolean; className?: string; onClick?: () => void; }

export const MembershipBadge: React.FC<MembershipBadgeProps> = ({ size = 'md', showIcon = true, className = '', onClick }) => {
  const sizeClasses = { sm: 'text-[9px] px-1.5 py-0.5 gap-1', md: 'text-[10px] px-2.5 py-1 gap-1.5', lg: 'text-xs px-3 py-1.5 gap-2' };
  const iconSizes = { sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };
  const Tag: React.ElementType = onClick ? 'button' : 'span';
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`inline-flex items-center font-black tracking-wider uppercase rounded-full select-none bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 text-amber-950 border border-yellow-300 shadow-sm ring-1 ring-amber-400/50 relative overflow-hidden ${onClick ? 'cursor-pointer hover:brightness-105 active:scale-[.98]' : ''} ${sizeClasses[size]} ${className}`} title="Pelanggan Terdaftar Sebagai Membership">
    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
    {showIcon && <Crown className={`${iconSizes[size]} text-amber-900 shrink-0 fill-amber-900/20`} />}
    <span className="relative z-10 whitespace-nowrap drop-shadow-2xs">Membership Customer</span>
    <Sparkles className={`${iconSizes[size]} text-amber-800 shrink-0 opacity-80`} />
  </Tag>;
};
