import React, { useState } from 'react';
import { ReceiptText, History, UsersRound, WalletCards, ChartNoAxesCombined, Database, BriefcaseBusiness, Printer, Settings2, ShieldCheck, LogOut, Briefcase, Scissors, Sparkles, Utensils, Shirt, Wrench, ChevronRight, X, Lock, Eye, EyeOff } from 'lucide-react';
import { StoreSettings, MerchantUser, BusinessType, PortalPins } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';
import { syncConfigToFirebase } from '../services/storageService';
import { YuposLogo } from './YuposLogo';
import { AdminModal } from './AdminModal';

interface SidebarProps { activeTab: string; onSelectTab: (tabId: string) => void; settings: StoreSettings; merchant: MerchantUser | null; onLogout: () => void; isOpen?: boolean; onClose?: () => void; }

const PROTECTED_TABS: Record<string, keyof PortalPins> = { customers: 'customers', revenue: 'revenue', extract: 'extract', history: 'history', printer: 'printer' };

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
      case 'retail': return <Briefcase className="w-3.5 h-3.5" />;
      case 'laundry': return <Shirt className="w-3.5 h-3.5" />;
      case 'workshop': return <Wrench className="w-3.5 h-3.5" />;
      default: return <Briefcase className="w-3.5 h-3.5" />;
    }
  };

  // Premium cashier navigation: text labels stay compact while icons communicate the function clearly.
  const navItems = [
    { id: 'pos', label: 'TRANSAKSI', icon: ReceiptText },
    { id: 'history', label: 'RIWAYAT', icon: History },
    { id: 'customers', label: 'DATA CUSTOMER', icon: UsersRound },
    { id: 'expenses', label: 'PENGELUARAN', icon: WalletCards },
    { id: 'revenue', label: 'OMZET & KAS', icon: ChartNoAxesCombined },
    { id: 'extract', label: 'EKSTRAK DATA', icon: Database },
    { id: 'staff', label: 'KARYAWAN & SHIFT', icon: BriefcaseBusiness },
    { id: 'printer', label: 'PRINTER', icon: Printer },
    { id: 'settings', label: 'PENGATURAN', icon: Settings2 },
  ];

  const openPin = (title: string, expected: string, action: () => void) => {
    if (!expected) { action(); return; }
    setEnteredPin(''); setPinError(''); setShowPin(false); setPinModal({ title, expected, action });
  };

  const handleItemClick = (id: string) => {
    if (id === 'admin') { openPin('Otoritas Admin Kontrol', settings.portalPins?.admin || '2024UDC', () => setShowAdmin(true)); return; }
    const pinKey = PROTECTED_TABS[id];
    const expected = pinKey ? settings.portalPins?.[pinKey] || '' : '';
    if (pinKey && expected) { openPin(`Akses ${navItems.find((item) => item.id === id)?.label || id}`, expected, () => onSelectTab(id)); return; }
    onSelectTab(id);
  };

  const verifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    if (enteredPin === pinModal.expected) { const action = pinModal.action; setPinModal(null); setEnteredPin(''); setPinError(''); action(); }
    else setPinError('PIN / Sandi salah.');
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

  return <>
    {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />}
    <aside className={`fixed md:static inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 transform flex-col overflow-y-auto border-r border-blue-950/80 bg-slate-950 text-white shadow-2xl transition-transform duration-200 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="sticky top-0 z-20 border-b border-blue-900/70 bg-gradient-to-b from-blue-700 to-blue-950 p-4 shadow-md"><div className="flex items-center justify-between"><YuposLogo size={42} showWordmark /><button type="button" onClick={onClose} className="rounded-lg bg-black/20 p-1.5 text-white md:hidden"><X className="h-4 w-4" /></button></div><div className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-blue-50">{getBusinessIcon(settings.businessType)}<span className="truncate">{currentPreset.name}</span></div></div>
      <div className="mx-3 my-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kasir & Shift Aktif</p><h4 className="mt-0.5 truncate text-sm font-extrabold uppercase tracking-wide text-white">{activeShiftName || 'KASIR'} (S{settings.activeShift})</h4><div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{settings.manualOverride ? 'Manual Override' : 'Auto-Shift Aktif'}</div></div>
      <nav className="flex-1 space-y-1 px-2">{navItems.map((item) => { const isActive = activeTab === item.id; const Icon = item.icon; return <button key={item.id} onClick={() => handleItemClick(item.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><span className="flex items-center gap-2.5"><Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} strokeWidth={1.9} /><span>{item.label}</span></span>{isActive && <ChevronRight className="h-4 w-4 text-white/70" />}</button>; })}<div className="pt-2"><button onClick={() => handleItemClick('admin')} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-yellow-400 text-slate-950 shadow-md' : 'text-yellow-300 hover:bg-yellow-400/10'}`}><span className="flex items-center gap-2.5"><ShieldCheck className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} /><span>ADMIN KONTROL</span></span>{activeTab === 'admin' && <ChevronRight className="h-4 w-4" />}</button></div></nav>
      <div className="mt-auto border-t border-slate-800 bg-slate-950/80 p-3"><div className="mb-2 flex items-center justify-between"><div className="min-w-0 pr-2"><p className="truncate text-[10px] font-semibold text-slate-400">{merchant?.email || 'Merchant Kasir'}</p><p className="flex items-center gap-1 text-[9px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Sistem Aktif & Siap</p></div><button onClick={onLogout} title="Keluar / Ganti Akun" className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-red-900/50 hover:text-red-400"><LogOut className="h-4 w-4" /></button></div></div>
    </aside>
    {showAdmin && <div className="fixed inset-0 z-[80] bg-slate-50"><AdminModal settings={settings} onUpdatePins={handleAdminPinsUpdate} onShowToast={() => undefined} /></div>}
    {pinModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"><div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Lock className="h-5 w-5" /></div><div><h3 className="text-sm font-extrabold text-slate-900">{pinModal.title}</h3><p className="text-[11px] font-medium text-slate-500">Masukkan PIN / Sandi untuk melanjutkan</p></div></div><form onSubmit={verifyPin} className="space-y-4"><div className="relative"><input type={showPin ? 'text' : 'password'} autoFocus value={enteredPin} onChange={(e) => { setEnteredPin(e.target.value); setPinError(''); }} placeholder="Masukkan PIN..." className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm font-bold tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500" /><button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>{pinError && <p className="text-[11px] font-bold text-red-600">{pinError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setPinModal(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button><button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950">Buka Akses</button></div></form></div></div>}
  </>;
};
