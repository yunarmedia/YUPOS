import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Minus, Trash2, Printer, PauseCircle, Sparkles, Store, Tag, Receipt, User, Phone, Crown, X, AlertCircle, Hash, WalletCards } from 'lucide-react';
import { ProductItem, CartItem, StoreSettings, Order, Customer } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';
import { generateCustomerCode } from '../services/customerService';
import { MembershipBadge } from './MembershipBadge';

interface PosViewProps {
  products: ProductItem[];
  settings: StoreSettings;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  editingOrder: Order | null;
  customers?: Customer[];
  onSaveOrder: (
    status: 'selesai' | 'pending',
    paymentMethod: string,
    customerNote: string,
    discount: number,
    discountType: 'Rp' | '%',
    discountValue: number,
    customerDetails?: { name: string; phone: string; customerCode: string; isMember: boolean; registerAsMember?: boolean }
  ) => void;
  onPrintCart: (customerNote: string, discount: number) => void;
  onCancelEditOrder?: () => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ADDITIONAL_CHARGE_PREFIX = 'CHG-';
const isAdditionalCharge = (item: CartItem) => item.id.startsWith(ADDITIONAL_CHARGE_PREFIX);

export const PosView: React.FC<PosViewProps> = ({
  products, settings, cart, setCart, editingOrder, customers = [], onSaveOrder, onPrintCart, onCancelEditOrder, onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedType, setSelectedType] = useState<'all' | 'service' | 'product'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [discountType, setDiscountType] = useState<'Rp' | '%'>(editingOrder?.discountType || 'Rp');
  const [discountValue, setDiscountValue] = useState(editingOrder?.discountValue || 0);
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const [showAdditionalCharge, setShowAdditionalCharge] = useState(false);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [registerAsMember, setRegisterAsMember] = useState(false);
  const [seatOrTableNote, setSeatOrTableNote] = useState('');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerCode(customerName.trim() && customerPhone.trim() ? generateCustomerCode(customerName, customerPhone) : '');
    }
  }, [customerName, customerPhone, selectedCustomer]);

  useEffect(() => {
    if (!editingOrder) return;
    setCustomerName(editingOrder.customer || '');
    setCustomerPhone(editingOrder.customerPhone || '');
    setCustomerCode(editingOrder.customerCode || '');
    setIsMember(editingOrder.customerIsMember || false);
    setDiscountType(editingOrder.discountType || 'Rp');
    setDiscountValue(editingOrder.discountValue || 0);
    setMobileTab('cart');
  }, [editingOrder]);

  const preset = BUSINESS_PRESETS[settings.businessType] || BUSINESS_PRESETS.barbershop;

  const categories = useMemo(() => {
    const set = new Set<string>(settings.categories || []);
    products.forEach((p) => { if (p.category && !p.deleted && (!p.businessType || p.businessType === settings.businessType)) set.add(p.category); });
    return ['Semua', ...Array.from(set)];
  }, [products, settings.categories, settings.businessType]);

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (p.deleted || (p.businessType && p.businessType !== settings.businessType)) return false;
    const q = searchQuery.toLowerCase().trim();
    return (selectedCategory === 'Semua' || p.category === selectedCategory) &&
      (selectedType === 'all' || p.type === selectedType) &&
      (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }), [products, settings.businessType, selectedCategory, selectedType, searchQuery]);

  const matchingCustomers = useMemo(() => {
    const q = searchCustomerQuery.toLowerCase().trim();
    if (!q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.customerCode.toLowerCase().includes(q));
  }, [customers, searchCustomerQuery]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const discountAmount = useMemo(() => {
    if (discountType === '%') return Math.round(subtotal * (Math.min(100, Math.max(0, discountValue)) / 100));
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const ppnRate = settings.ppnEnabled ? (settings.ppnRate ?? 0) : 0;
  const ppnAmount = ppnRate > 0 ? Math.round(afterDiscount * (ppnRate / 100)) : 0;
  const finalTotal = afterDiscount + ppnAmount;

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  const addToCart = (product: ProductItem) => {
    if (!product.available) return;
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id && !item.note && !isAdditionalCharge(item));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      }
      const staffList = settings.staffList[product.reqStaffRole] || [];
      return [...prev, { ...product, qty: 1, note: '', assignedTo: staffList[0] || '' }];
    });
  };

  const addAdditionalCharge = () => {
    const description = chargeDescription.trim();
    const amount = Math.round(Number(chargeAmount));
    if (!description) {
      onShowToast?.('Tulis keterangan biaya tambahan terlebih dahulu.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowToast?.('Nominal biaya tambahan harus lebih dari Rp0.', 'error');
      return;
    }
    const charge: CartItem = {
      id: `${ADDITIONAL_CHARGE_PREFIX}${Date.now().toString(36).toUpperCase()}`,
      name: `Biaya tambahan: ${description}`,
      category: 'Biaya Tambahan',
      price: amount,
      qty: 1,
      type: 'product',
      reqStaffRole: '',
      available: true,
      note: '',
      assignedTo: '',
      businessType: settings.businessType,
    };
    setCart((prev) => [...prev, charge]);
    setChargeDescription('');
    setChargeAmount('');
    setShowAdditionalCharge(false);
    onShowToast?.(`Biaya tambahan ${formatRp(amount)} ditambahkan.`, 'success');
  };

  const removeItem = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      if (isAdditionalCharge(updated[index])) return updated;
      const nextQty = updated[index].qty + delta;
      if (nextQty <= 0) updated.splice(index, 1); else updated[index].qty = nextQty;
      return updated;
    });
  };

  const updateItemNote = (index: number, note: string) => setCart((prev) => { const updated = [...prev]; updated[index].note = note; return updated; });
  const updateItemStaff = (index: number, staffName: string) => setCart((prev) => { const updated = [...prev]; updated[index].assignedTo = staffName; return updated; });
  const getStaffOptions = (role: string) => Array.from(new Set([...(settings.staffList[role] || []), ...Object.values(settings.staffList).flat()]));

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c); setCustomerName(c.name); setCustomerPhone(c.phone); setCustomerCode(c.customerCode); setIsMember(c.isMember); setRegisterAsMember(false); setSearchCustomerQuery(''); setShowCustomerDropdown(false); setCustomerError(null);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null); setCustomerName(''); setCustomerPhone(''); setCustomerCode(''); setIsMember(false); setRegisterAsMember(false); setSearchCustomerQuery(''); setCustomerError(null);
  };

  const handleCheckout = (status: 'selesai' | 'pending', paymentMethod: string) => {
    if (!cart.length) return;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      setCustomerError('Nama dan Nomor Telepon Customer wajib diisi!');
      onShowToast?.('Nama & Nomor Telepon customer wajib diisi untuk transaksi!', 'error');
      setMobileTab('cart');
      return;
    }
    setCustomerError(null);
    const code = customerCode || generateCustomerCode(name, phone);
    const customerText = `${name} [${code}]${seatOrTableNote.trim() ? ` (${seatOrTableNote.trim()})` : ''}`;
    onSaveOrder(status, paymentMethod, customerText, discountAmount, discountType, discountValue, {
      name, phone, customerCode: code, isMember: isMember || registerAsMember, registerAsMember,
    });
    if (status === 'selesai') {
      setSelectedCustomer(null); setCustomerName(''); setCustomerPhone(''); setCustomerCode(''); setIsMember(false); setRegisterAsMember(false); setSeatOrTableNote(''); setSearchCustomerQuery('');
    }
  };

  const handleTriggerPrintBill = () => {
    if (!cart.length) return;
    const finalName = customerName.trim() || 'Pelanggan (Bill)';
    onPrintCart(finalName + (seatOrTableNote.trim() ? ` (${seatOrTableNote.trim()})` : ''), discountAmount);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden bg-slate-100 relative">
      <div className={`flex-1 flex flex-col min-w-0 p-3 sm:p-4 overflow-hidden ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="lg:hidden flex bg-white p-1 rounded-xl border border-slate-200 mb-2.5 shadow-xs shrink-0">
          <button type="button" onClick={() => setMobileTab('catalog')} className={`flex-1 py-2 text-xs font-black rounded-lg ${mobileTab === 'catalog' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>Katalog Produk & Jasa</button>
          <button type="button" onClick={() => setMobileTab('cart')} className={`flex-1 py-2 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 ${mobileTab === 'cart' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><Receipt className="w-3.5 h-3.5" />Keranjang ({cart.reduce((s, i) => s + i.qty, 0)})</button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-3 shrink-0">
          <div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Cari menu, layanan, atau produk di ${settings.storeName}...`} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0 self-start">
            {(['all', 'service', 'product'] as const).map((type) => <button key={type} onClick={() => setSelectedType(type)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${selectedType === type ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{type === 'all' ? 'Semua' : type === 'service' ? <><Sparkles className="w-3 h-3 inline mr-1" />Layanan / Jasa</> : <><Store className="w-3 h-3 inline mr-1" />Barang / Produk</>}</button>)}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 scrollbar-thin">
          {categories.map((cat) => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{cat}</button>)}
        </div>

        <div className="flex-1 overflow-y-auto pt-2 pb-4 pr-1">
          {filteredProducts.length === 0 ? <div className="h-64 flex flex-col items-center justify-center text-slate-400"><Tag className="w-10 h-10 mb-2 stroke-1" /><p className="text-sm font-semibold">Tidak ada produk/layanan yang sesuai.</p><p className="text-xs mt-1">Tambahkan katalog melalui tab PRODUK & JASA.</p></div> : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((p) => { const isService = p.type === 'service'; return <button key={p.id} disabled={!p.available} onClick={() => addToCart(p)} className={`relative p-3.5 bg-white rounded-2xl border text-left flex flex-col justify-between transition-all ${p.available ? 'border-slate-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]' : 'border-red-100 bg-red-50/50 opacity-60'}`}>
              <div className="flex items-center justify-between gap-1 mb-1.5"><span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${isService ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{isService ? 'JASA' : 'BARANG'}</span><span className={`text-[10px] font-bold ${p.available ? 'text-emerald-600' : 'text-red-600'}`}>{p.available ? 'Ready' : 'Habis'}</span></div>
              <div><h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">{p.name}</h4><p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{p.category}</p></div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-xs sm:text-sm font-black text-blue-600">{formatRp(p.price)}</span><span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></span></div>
            </button>; })}
          </div>}
        </div>
      </div>

      <div className={`w-full lg:w-[420px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xl overflow-hidden ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
          {editingOrder && <div className="mb-2.5 p-2 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 font-black"><span>Mode Edit: #{editingOrder.id}</span>{onCancelEditOrder && <button type="button" onClick={onCancelEditOrder} className="px-2 py-0.5 bg-white text-blue-600 rounded-lg text-[10px] font-black border border-amber-300">Batal Edit</button>}</div>}
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><button type="button" onClick={() => setMobileTab('catalog')} className="lg:hidden p-1.5 rounded-lg bg-slate-200 text-slate-700">← Menu</button><h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-blue-600" />{editingOrder ? `Rincian Edit: #${editingOrder.id}` : 'Keranjang Kasir'}</h3></div><span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-extrabold">{cart.reduce((s, i) => s + i.qty, 0)} item</span></div>

          <div className="space-y-2">
            {selectedCustomer ? <div className="p-3 bg-gradient-to-r from-blue-50 to-amber-50 rounded-xl border border-amber-200"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-black text-slate-900">{selectedCustomer.name}</span>{selectedCustomer.isMember && <MembershipBadge size="sm" />}</div><div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600"><span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border">[{selectedCustomer.customerCode}]</span><span>📞 {selectedCustomer.phone}</span><span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">{selectedCustomer.visitCount}x</span></div></div><button type="button" onClick={handleClearCustomer} className="p-1 rounded-lg bg-white text-slate-400 border"><X className="w-3.5 h-3.5" /></button></div>{!selectedCustomer.isMember && <button type="button" onClick={() => setRegisterAsMember(!registerAsMember)} className={`mt-2 px-2.5 py-1 rounded-lg text-[10px] font-black border ${registerAsMember ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-amber-800 border-amber-300'}`}><Crown className="w-3 h-3 inline mr-1" />{registerAsMember ? '✓ Didaftarkan Member' : '⭐ Daftarkan Member'}</button>}</div> : <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200"><div className="relative" ref={customerSearchRef}><Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input type="text" value={searchCustomerQuery} onChange={(e) => { setSearchCustomerQuery(e.target.value); setShowCustomerDropdown(true); }} onFocus={() => setShowCustomerDropdown(true)} placeholder="Cari customer lama (Nama / Kode Unik)..." className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" />{showCustomerDropdown && matchingCustomers.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">{matchingCustomers.map((c) => <div key={c.id} onClick={() => handleSelectCustomer(c)} className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between"><div><div className="flex items-center gap-1.5"><span className="text-xs font-black">{c.name}</span>{c.isMember && <MembershipBadge size="sm" />}</div><div className="text-[10px] text-slate-500"><span className="font-mono font-bold text-blue-600">[{c.customerCode}]</span> {c.phone}</div></div><span className="text-[10px] font-black bg-slate-100 px-1.5 py-0.5 rounded">{c.visitCount}x</span></div>)}</div>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><label className="block text-[10px] font-extrabold mb-0.5"><User className="w-3 h-3 inline text-blue-600 mr-1" />Nama Customer *</label><input type="text" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerError(null); }} placeholder="Nama pelanggan..." className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" /></div><div><label className="block text-[10px] font-extrabold mb-0.5"><Phone className="w-3 h-3 inline text-emerald-600 mr-1" />Nomor Telepon / WA *</label><input type="tel" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setCustomerError(null); }} placeholder="081234567890" className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" /></div></div><div className="flex items-center justify-between gap-2 pt-1 border-t"><div className="text-[10px] text-slate-600"><Hash className="w-3 h-3 inline mr-1" />Kode Unik: <span className="font-mono font-black text-blue-600">{customerCode ? `[${customerCode}]` : '-'}</span></div><button type="button" onClick={() => setRegisterAsMember(!registerAsMember)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${registerAsMember ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-amber-800 border-amber-300'}`}><Crown className="w-3 h-3 inline mr-1" />{registerAsMember ? '✓ Daftar Member Aktif' : '⭐ Daftar Member'}</button></div></div>}
            <input type="text" value={seatOrTableNote} onChange={(e) => setSeatOrTableNote(e.target.value)} placeholder={`Catatan posisi: ${preset.identifierLabel} (opsional)...`} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold" />
            {customerError && <div className="p-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5 text-[11px] font-bold text-red-700"><AlertCircle className="w-3.5 h-3.5" />{customerError}</div>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12"><Receipt className="w-12 h-12 mb-2 stroke-1 text-slate-300" /><p className="text-xs font-bold text-slate-500">Keranjang masih kosong</p><p className="text-[11px] mt-1">Pilih menu atau layanan di sebelah kiri.</p></div> : cart.map((item, index) => {
            const charge = isAdditionalCharge(item);
            const staffOptions = getStaffOptions(item.reqStaffRole);
            return <div key={`${item.id}-${index}`} className={`p-3 rounded-xl border space-y-2 ${charge ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-1.5 flex-wrap"><h5 className="font-extrabold text-xs text-slate-900 leading-tight">{item.name}</h5>{charge && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">BIAYA TAMBAHAN</span>}</div><span className="text-[11px] font-black text-blue-600">{formatRp(item.price * item.qty)}</span></div>{charge ? <button type="button" onClick={() => removeItem(index)} className="p-1.5 rounded-lg text-red-600 bg-white border border-red-200" title="Hapus biaya tambahan"><Trash2 className="w-3.5 h-3.5" /></button> : <div className="flex items-center gap-1.5 bg-white px-1.5 py-1 rounded-lg border"><button onClick={() => updateQty(index, -1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-100"><Minus className="w-3 h-3" /></button><span className="w-6 text-center font-black text-xs">{item.qty}</span><button onClick={() => updateQty(index, 1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-100"><Plus className="w-3 h-3" /></button></div>}</div>
              {!charge && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">{item.type === 'service' && staffOptions.length > 0 && <div><label className="text-[10px] text-slate-400 font-bold block mb-0.5">Petugas / Stylist:</label><select value={item.assignedTo || ''} onChange={(e) => updateItemStaff(index, e.target.value)} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"><option value="">-- Pilih Petugas --</option>{staffOptions.map((staff) => <option key={staff} value={staff}>{staff}</option>)}</select></div>}<div className={item.type !== 'service' ? 'sm:col-span-2' : ''}><label className="text-[10px] text-slate-400 font-bold block mb-0.5">Catatan Khusus:</label><input type="text" value={item.note || ''} onChange={(e) => updateItemNote(index, e.target.value)} placeholder="Contoh: Less Sugar..." className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold" /></div></div>}
            </div>;
          })}
        </div>

        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 space-y-3 shrink-0">
          <button type="button" onClick={() => setShowAdditionalCharge(true)} className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"><WalletCards className="w-4 h-4" />+ BIAYA TAMBAHAN</button>
          <div className="space-y-1.5 text-xs"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-bold text-slate-800">{formatRp(subtotal)}</span></div><div className="flex items-center justify-between py-1"><span className="text-slate-500">Diskon / Potongan</span><div className="flex items-center gap-1.5"><div className="flex bg-white rounded-lg border p-0.5"><button type="button" onClick={() => setDiscountType('Rp')} className={`px-1.5 py-0.5 rounded text-[10px] font-black ${discountType === 'Rp' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Rp</button><button type="button" onClick={() => setDiscountType('%')} className={`px-1.5 py-0.5 rounded text-[10px] font-black ${discountType === '%' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>%</button></div><input type="number" min="0" value={discountValue || ''} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} placeholder="0" className="w-20 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right" />{discountAmount > 0 && <span className="text-red-600 font-black text-xs">-{formatRp(discountAmount)}</span>}</div></div>{settings.ppnEnabled && <div className="flex justify-between text-emerald-700 font-semibold"><span>PPN ({settings.ppnRate || 11}%)</span><span>+{formatRp(ppnAmount)}</span></div>}<div className="flex justify-between items-baseline pt-2 border-t border-slate-200"><span className="font-extrabold text-sm text-slate-900">Total Tagihan</span><span className="font-black text-xl text-blue-600">{formatRp(finalTotal)}</span></div></div>
          <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={() => handleCheckout('pending', 'Pending')} disabled={!cart.length} className="py-2 px-3 bg-amber-500/10 text-amber-700 border border-amber-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"><PauseCircle className="w-4 h-4" />GANTUNG / ANTRIAN</button><button onClick={handleTriggerPrintBill} disabled={!cart.length} className="py-2 px-3 bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"><Printer className="w-4 h-4" />PRINT BILL</button></div>
          <div className="grid grid-cols-2 gap-2"><button onClick={() => handleCheckout('selesai', 'Cash')} disabled={!cart.length} className="py-3 px-3 bg-emerald-600 text-white rounded-xl text-xs font-black disabled:opacity-50">CASH (TUNAI)</button><button onClick={() => handleCheckout('selesai', 'QRIS')} disabled={!cart.length} className="py-3 px-3 bg-blue-600 text-white rounded-xl text-xs font-black disabled:opacity-50">QRIS / TRANSFER</button>{settings.businessType === 'fnb' ? <><button onClick={() => handleCheckout('selesai', 'Shopeefood')} disabled={!cart.length} className="py-2 px-2 bg-orange-50 text-orange-600 border border-orange-300 rounded-xl text-[11px] font-black disabled:opacity-50">ShopeeFood</button><button onClick={() => handleCheckout('selesai', 'Gofood')} disabled={!cart.length} className="py-2 px-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] font-black disabled:opacity-50">GoFood</button></> : <button onClick={() => handleCheckout('selesai', 'Debit / Kartu')} disabled={!cart.length} className="col-span-2 py-2 px-3 bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50">DEBIT / KARTU KREDIT</button>}</div>
        </div>
      </div>

      {showAdditionalCharge && <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-black text-slate-900">Tambah Biaya Tambahan</h3><p className="text-[11px] text-slate-500 mt-0.5">Untuk upsize, topping, add-on, atau biaya lain.</p></div><button type="button" onClick={() => setShowAdditionalCharge(false)} className="p-2 rounded-lg bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button></div><div className="space-y-3"><div><label className="block text-xs font-bold text-slate-700 mb-1">Keterangan</label><input autoFocus type="text" value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAdditionalCharge(); }} placeholder="Contoh: Topping Coklat" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500" /></div><div><label className="block text-xs font-bold text-slate-700 mb-1">Nominal (Rp)</label><input type="number" min="1" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAdditionalCharge(); }} placeholder="3000" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500" /></div></div><div className="flex gap-2 mt-5"><button type="button" onClick={() => setShowAdditionalCharge(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">Batal</button><button type="button" onClick={addAdditionalCharge} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black">Tambahkan Biaya</button></div></div></div>}
    </div>
  );
};
