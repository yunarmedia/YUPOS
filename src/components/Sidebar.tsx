import React from 'react';
import { TrendingUp, Receipt, Package, History, Users, Settings, ShieldAlert, LogOut, Briefcase, Scissors, Sparkles, Utensils, Shirt, Wrench, ChevronRight, X } from 'lucide-react';
import { StoreSettings, MerchantUser, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';
import { YuposLogo } from './YuposLogo';

interface SidebarProps { activeTab: string; onSelectTab: (tabId: string) => void; settings: StoreSettings; merchant: MerchantUser | null; onLogout: () => void; isOpen?: boolean; onClose?: () => void; }

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, settings, merchant, onLogout, isOpen = false, onClose }) => {
  const activeShiftName = settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name;
  const currentPreset = BUSINESS_PRESETS[settings.businessType] || BUSINESS_PRESETS.barbershop;
  const getBusinessIcon = (type: BusinessType) => {
    switch (type) {
      case 'barbershop': return <Scissors className="w-3.5 h-3.5" />;
      case 'salon': return <Sparkles className="w-3.5 h-3.5" />;
      case 'fnb': return <Utensils className="w-3.5 h-3.5" />;
      case 'retail': return <Briefcase className="w-3.5 h-3.5" />;
      case 'laundry': return <Shirt className="w-3.5 h-3.5" />;
      case 'workshop': return <Wrench className="w-3.5 h-3.5" />;
      default: return <Briefcase className="w-3.5 h-3.5" />;
    }
  };
  const navItems = [
    { id: 'pos', label: 'TRANSAKSI', icon: '🏷️' }, { id: 'customers', label: 'DATA CUSTOMER', icon: '👤' }, { id: 'revenue', label: 'OMZET & KAS', icon: '📈' }, { id: 'extract', label: 'EKSTRAK DATA', icon: '📊' }, { id: 'expenses', label: 'PENGELUARAN', icon: '💸' }, { id: 'inventory', label: 'PRODUK & JASA', icon: '📦' }, { id: 'history', label: 'RIWAYAT', icon: '📋' }, { id: 'staff', label: 'KARYAWAN & SHIFT', icon: '👥' }, { id: 'printer', label: 'PRINTER', icon: '🖨️' }, { id: 'settings', label: 'PENGATURAN', icon: '⚙️' },
  ];
  const handleItemClick = (id: string) => { onSelectTab(id); onClose?.(); };

  return <>
    {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />}
    <aside className={`fixed md:static inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 transform flex-col overflow-y-auto border-r border-blue-950/80 bg-slate-950 text-white shadow-2xl transition-transform duration-200 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="sticky top-0 z-20 border-b border-blue-900/70 bg-gradient-to-b from-blue-700 to-blue-950 p-4 shadow-md">
        <div className="flex items-center justify-between"><YuposLogo size={42} showWordmark /><button type="button" onClick={onClose} className="rounded-lg bg-black/20 p-1.5 text-white md:hidden"><X className="h-4 w-4" /></button></div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-blue-50">{getBusinessIcon(settings.businessType)}<span className="truncate">{currentPreset.name}</span></div>
      </div>
      <div className="mx-3 my-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kasir & Shift Aktif</p><h4 className="mt-0.5 truncate text-sm font-extrabold uppercase tracking-wide text-white">{activeShiftName || 'KASIR'} (S{settings.activeShift})</h4><div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{settings.manualOverride ? 'Manual Override' : 'Auto-Shift Aktif'}</div></div>
      <nav className="flex-1 space-y-1 px-2">{navItems.map((item) => { const isActive = activeTab === item.id; return <button key={item.id} onClick={() => handleItemClick(item.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><span className="flex items-center gap-2.5"><span className="text-base leading-none">{item.icon}</span><span>{item.label}</span></span>{isActive && <ChevronRight className="h-4 w-4 text-white/70" />}</button>; })}<div className="pt-2"><button onClick={() => handleItemClick('admin')} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-yellow-400 text-slate-950 shadow-md' : 'text-yellow-300 hover:bg-yellow-400/10'}`}><span className="flex items-center gap-2.5"><span>👑</span><span>ADMIN KONTROL</span></span>{activeTab === 'admin' && <ChevronRight className="h-4 w-4" />}</button></div></nav>
      <div className="mt-auto border-t border-slate-800 bg-slate-950/80 p-3"><div className="mb-2 flex items-center justify-between"><div className="min-w-0 pr-2"><p className="truncate text-[10px] font-semibold text-slate-400">{merchant?.email || 'Merchant Kasir'}</p><p className="flex items-center gap-1 text-[9px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Sistem Aktif & Siap</p></div><button onClick={onLogout} title="Keluar / Ganti Akun" className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-red-900/50 hover:text-red-400"><LogOut className="h-4 w-4" /></button></div></div>
    </aside>
  </>;
};
