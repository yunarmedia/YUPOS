import React from 'react';
import { 
  Store, 
  TrendingUp, 
  Receipt, 
  Package, 
  History, 
  Users, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  Briefcase,
  Scissors,
  Sparkles,
  Utensils,
  Shirt,
  Wrench,
  ChevronRight,
  X
} from 'lucide-react';
import { StoreSettings, MerchantUser, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  settings: StoreSettings;
  merchant: MerchantUser | null;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  settings,
  merchant,
  onLogout,
  isOpen = false,
  onClose,
}) => {
  const activeShiftName = settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name;
  const currentPreset = BUSINESS_PRESETS[settings.businessType] || BUSINESS_PRESETS.barbershop;

  const getBusinessIcon = (type: BusinessType) => {
    switch (type) {
      case 'barbershop': return <Scissors className="w-3.5 h-3.5" />;
      case 'salon': return <Sparkles className="w-3.5 h-3.5" />;
      case 'fnb': return <Utensils className="w-3.5 h-3.5" />;
      case 'retail': return <Store className="w-3.5 h-3.5" />;
      case 'laundry': return <Shirt className="w-3.5 h-3.5" />;
      case 'workshop': return <Wrench className="w-3.5 h-3.5" />;
      default: return <Briefcase className="w-3.5 h-3.5" />;
    }
  };

  const navItems = [
    { id: 'pos', label: 'TRANSAKSI', icon: '🏷️' },
    { id: 'customers', label: 'DATA CUSTOMER', icon: '👤' },
    { id: 'revenue', label: 'OMZET & KAS', icon: '📈' },
    { id: 'extract', label: 'EKSTRAK DATA', icon: '📊' },
    { id: 'expenses', label: 'PENGELUARAN', icon: '💸' },
    { id: 'inventory', label: 'PRODUK & JASA', icon: '📦' },
    { id: 'history', label: 'RIWAYAT', icon: '📋' },
    { id: 'staff', label: 'KARYAWAN & SHIFT', icon: '👥' },
    { id: 'printer', label: 'PRINTER', icon: '🖨️' },
    { id: 'settings', label: 'PENGATURAN', icon: '⚙️' },
  ];

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity animate-in fade-in"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shrink-0 h-full border-r border-slate-800 shadow-2xl md:shadow-xl overflow-y-auto transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 bg-gradient-to-b from-red-600 to-red-700 text-white flex flex-col border-b border-blue-800/60 sticky top-0 z-20 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-white/20">
                <img src="/assets/icon-192.png" alt="YUPOS" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-black text-base tracking-tight leading-none">YUPOS</h1>
                <p className="mt-1 truncate text-[9px] font-bold tracking-wide text-blue-100">One Pos For Everything</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Business Type Pill */}
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[11px] font-bold text-blue-50 border border-white/10">
            {getBusinessIcon(settings.businessType)}
            <span className="truncate">{currentPreset.name}</span>
          </div>
        </div>

        {/* Active Cashier & Shift Card */}
        <div className="p-3 mx-3 my-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Kasir & Shift Aktif
          </p>
          <h4 className="text-sm font-extrabold text-white mt-0.5 uppercase tracking-wide truncate">
            {activeShiftName || 'KASIR'} (S{settings.activeShift})
          </h4>
          <div className="text-[10px] font-semibold text-emerald-400 mt-1 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {settings.manualOverride ? 'Manual Override' : 'Auto-Shift Aktif'}
          </div>
        </div>

        {/* Navigation Buttons */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {isActive && <ChevronRight className="w-4 h-4 text-white/70" />}
              </button>
            );
          })}

          {/* Admin Secret Portal Nav */}
          <div className="pt-2">
            <button
              onClick={() => handleItemClick('admin')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                  : 'text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>👑</span>
                <span>ADMIN KONTROL</span>
              </span>
              {activeTab === 'admin' && <ChevronRight className="w-4 h-4 text-slate-950" />}
            </button>
          </div>
        </nav>

        {/* Merchant Profile & Footer */}
        <div className="p-3 mt-auto border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] text-slate-400 font-semibold truncate">
                {merchant?.email || 'Merchant Kasir'}
              </p>
              <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Sistem Aktif & Siap
              </p>
            </div>
            <button
              onClick={onLogout}
              title="Keluar / Ganti Akun"
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
