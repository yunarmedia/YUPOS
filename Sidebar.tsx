import React, { useState } from 'react';
import { Store, TrendingUp, Receipt, Package, History, Users, Settings, ShieldAlert, LogOut, Briefcase, Scissors, Sparkles, Utensils, Shirt, Wrench, ChevronRight, X, Lock, Eye, EyeOff } from 'lucide-react';
import { StoreSettings, MerchantUser, BusinessType, PortalPins } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';
import { syncConfigToFirebase } from '../services/storageService';
import { AdminModal } from './AdminModal';

interface SidebarProps { activeTab: string; onSelectTab: (tabId: string) => void; settings: StoreSettings; merchant: MerchantUser | null; onLogout: () => void; isOpen?: boolean; onClose?: () => void; }

const PROTECTED_TABS: Record<string, keyof PortalPins> = {
  customers: 'customers', revenue: 'revenue', extract: 'extract', history: 'history', printer: 'printer',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, settings, merchant, onLogout, isOpen = false, onClose }) => {
  const activeShiftName = settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name;
  const currentPreset = BUSINESS_PRESETS[settings.businessType] || BUSINESS_PRESETS.barbershop;
  const [showAdmin, setShowAdmin] = useState(false);
  const [pinModal, setPinModal] = useState<{ title: string; expected: string; action: () => void } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

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
    { id: 'pos', label: 'TRANSAKSI', icon: '🏷️' }, { id: 'customers', label: 'DATA CUSTOMER', icon: '👤' },
    { id: 'revenue', label: 'OMZET & KAS', icon: '📈' }, { id: 'extract', label: 'EKSTRAK DATA', icon: '📊' },
    { id: 'expenses', label: 'PENGELUARAN', icon: '💸' }, { id: 'inventory', label: 'PRODUK & JASA', icon: '📦' },
    { id: 'history', label: 'RIWAYAT', icon: '📋' }, { id: 'staff', label: 'KARYAWAN & SHIFT', icon: '👥' },
    { id: 'printer', label: 'PRINTER', icon: '🖨️' }, { id: 'settings', label: 'PENGATURAN', icon: '⚙️' },
  ];

  const openPin = (title: string, expected: string, action: () => void) => {
    if (!expected) { action(); return; }
    setEnteredPin(''); setPinError(''); setShowPin(false); setPinModal({ title, expected, action });
  };

  const handleItemClick = (id: string) => {
    if (id === 'admin') {
      openPin('Otoritas Admin Kontrol', settings.portalPins?.admin || '2024UDC', () => setShowAdmin(true));
      return;
    }
    const pinKey = PROTECTED_TABS[id];
    const expected = pinKey ? settings.portalPins?.[pinKey] || '' : '';
    if (pinKey && expected) {
      openPin(`Akses ${navItems.find((item) => item.id === id)?.label || id}`, expected, () => onSelectTab(id));
      return;
    }
    onSelectTab(id);
  };

  const verifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    if (enteredPin === pinModal.expected) {
      const action = pinModal.action; setPinModal(null); setEnteredPin(''); setPinError(''); action();
    } else setPinError('PIN / Sandi salah.');
  };

  const handleAdminPinsUpdate = (pins: PortalPins) => {
    const uid = merchant?.uid || 'default_merchant';
    let customPaymentMethods = settings.customPaymentMethods || [];
    try { customPaymentMethods = JSON.parse(localStorage.getItem(`yupos_${uid}_custom_payment_methods`) || 'null') || customPaymentMethods; } catch { /* keep current */ }
    const nextSettings: StoreSettings = { ...settings, portalPins: pins, customPaymentMethods };
    localStorage.setItem(`yupos_${uid}_settings`, JSON.stringify(nextSettings));
    localStorage.setItem('yupos_settings', JSON.stringify(nextSettings));
    void syncConfigToFirebase(nextSettings, uid).catch((error) => console.warn('Admin authority sync failed:', error));
    window.dispatchEvent(new CustomEvent('yupos-admin-settings-updated'));
    setShowAdmin(false);
  };

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity animate-in fade-in" />}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shrink-0 h-full border-r border-slate-800 shadow-2xl md:shadow-xl overflow-y-auto transform transition-transform duration-200 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 bg-gradient-to-b from-red-600 to-red-700 text-white flex flex-col border-b border-blue-800/60 sticky top-0 z-20 shadow-md">
          <div className="flex items-center justify-between"><div className="flex min-w-0 items-center gap-2.5"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-white/20"><img src="/assets/icon-192.png" alt="YUPOS" className="h-full w-full object-cover" /></div><div className="min-w-0"><h1 className="truncate font-black text-base tracking-tight leading-none">YUPOS</h1><p className="mt-1 truncate text-[9px] font-bold tracking-wide text-blue-100">One Pos For Everything</p></div></div><button type="button" onClick={onClose} className="md:hidden p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"><X className="w-4 h-4" /></button></div>
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[11px] font-bold text-blue-50 border border-white/10">{getBusinessIcon(settings.businessType)}<span className="truncate">{currentPreset.name}</span></div>
        </div>
        <div className="p-3 mx-3 my-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kasir & Shift Aktif</p><h4 className="text-sm font-extrabold text-white mt-0.5 uppercase tracking-wide truncate">{activeShiftName || 'KASIR'} (S{settings.activeShift})</h4><div className="text-[10px] font-semibold text-emerald-400 mt-1 flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{settings.manualOverride ? 'Manual Override' : 'Auto-Shift Aktif'}</div></div>
        <nav className="flex-1 px-2 space-y-1">{navItems.map((item) => { const isActive = activeTab === item.id; return <button key={item.id} onClick={() => handleItemClick(item.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}><span className="flex items-center gap-2.5"><span className="text-base leading-none">{item.icon}</span><span>{item.label}</span></span>{isActive && <ChevronRight className="w-4 h-4 text-white/70" />}</button>; })}
          <div className="pt-2"><button onClick={() => handleItemClick('admin')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-amber-400 hover:bg-amber-500/10'}`}><span className="flex items-center gap-2.5"><span>👑</span><span>ADMIN KONTROL</span></span>{activeTab === 'admin' && <ChevronRight className="w-4 h-4 text-slate-950" />}</button></div>
        </nav>
        <div className="p-3 mt-auto border-t border-slate-800 bg-slate-950/60"><div className="flex items-center justify-between mb-2"><div className="min-w-0 pr-2"><p className="text-[10px] text-slate-400 font-semibold truncate">{merchant?.email || 'Merchant Kasir'}</p><p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Sistem Aktif & Siap</p></div><button onClick={onLogout} title="Keluar / Ganti Akun" className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button></div></div>
      </aside>

      {showAdmin && <div className="fixed inset-0 z-[80] bg-slate-50"><AdminModal settings={settings} onUpdatePins={handleAdminPinsUpdate} onShowToast={(msg) => { const event = new CustomEvent('yupos-admin-toast', { detail: msg }); window.dispatchEvent(event); }} /></div>}

      {pinModal && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs"><div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700"><Lock className="w-5 h-5" /></div><div><h3 className="text-sm font-extrabold text-slate-900">{pinModal.title}</h3><p className="text-[11px] text-slate-500 font-medium">Masukkan PIN / Sandi untuk melanjutkan</p></div></div><form onSubmit={verifyPin} className="space-y-4"><div className="relative"><input type={showPin ? 'text' : 'password'} autoFocus value={enteredPin} onChange={(e) => { setEnteredPin(e.target.value); setPinError(''); }} placeholder="Masukkan PIN..." className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500" /><button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>{pinError && <p className="text-[11px] font-bold text-red-600">{pinError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setPinModal(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button><button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black">Buka Akses</button></div></form></div></div>}
    </>
  );
};