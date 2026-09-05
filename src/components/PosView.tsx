import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  PauseCircle, 
  CheckCircle, 
  Sparkles, 
  Scissors, 
  Store, 
  Tag, 
  UserCheck, 
  Receipt,
  Clock,
  ArrowRight,
  User,
  Phone,
  Crown,
  X,
  AlertCircle,
  Hash
} from 'lucide-react';
import { 
  ProductItem, 
  CartItem, 
  StoreSettings, 
  Order, 
  ItemType,
  Customer
} from '../types';
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
    customerDetails?: {
      name: string;
      phone: string;
      customerCode: string;
      isMember: boolean;
      registerAsMember?: boolean;
    }
  ) => void;
  onPrintCart: (customerNote: string, discount: number) => void;
  onCancelEditOrder?: () => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  settings,
  cart,
  setCart,
  editingOrder,
  customers = [],
  onSaveOrder,
  onPrintCart,
  onCancelEditOrder,
  onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedType, setSelectedType] = useState<'all' | 'service' | 'product'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [discountType, setDiscountType] = useState<'Rp' | '%'>(editingOrder?.discountType || 'Rp');
  const [discountValue, setDiscountValue] = useState<number>(editingOrder?.discountValue || 0);
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Customer Management States
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerCode, setCustomerCode] = useState<string>('');
  const [isMember, setIsMember] = useState<boolean>(false);
  const [registerAsMember, setRegisterAsMember] = useState<boolean>(false);
  const [seatOrTableNote, setSeatOrTableNote] = useState<string>('');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dynamic customer code preview when typing new customer
  useEffect(() => {
    if (!selectedCustomer) {
      if (customerName.trim() && customerPhone.trim()) {
        const code = generateCustomerCode(customerName, customerPhone);
        setCustomerCode(code);
      } else {
        setCustomerCode('');
      }
    }
  }, [customerName, customerPhone, selectedCustomer]);

  // Load editing order
  useEffect(() => {
    if (editingOrder) {
      setCustomerName(editingOrder.customer || '');
      setCustomerPhone(editingOrder.customerPhone || '');
      setCustomerCode(editingOrder.customerCode || '');
      setIsMember(editingOrder.customerIsMember || false);
      setDiscountType(editingOrder.discountType || 'Rp');
      setDiscountValue(editingOrder.discountValue || 0);
      setMobileTab('cart');
    }
  }, [editingOrder]);

  const preset = BUSINESS_PRESETS[settings.businessType] || BUSINESS_PRESETS.barbershop;

  // Filter categories strictly by current business type
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && !p.deleted) {
        if (!p.businessType || p.businessType === settings.businessType) {
          set.add(p.category);
        }
      }
    });
    return ['Semua', ...Array.from(set)];
  }, [products, settings.businessType]);

  // Filtered product items strictly matching settings.businessType
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.deleted) return false;
      // Filter strictly by current business type
      if (p.businessType && p.businessType !== settings.businessType) return false;
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchType = selectedType === 'all' || p.type === selectedType;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchType && matchSearch;
    });
  }, [products, settings.businessType, selectedCategory, selectedType, searchQuery]);

  // Matching existing customers for quick autocomplete
  const matchingCustomers = useMemo(() => {
    if (!searchCustomerQuery.trim()) return [];
    const q = searchCustomerQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.customerCode.toLowerCase().includes(q)
    );
  }, [customers, searchCustomerQuery]);

  // Select existing customer
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerCode(c.customerCode);
    setIsMember(c.isMember);
    setRegisterAsMember(false);
    setSearchCustomerQuery('');
    setShowCustomerDropdown(false);
    setCustomerError(null);
  };

  // Clear customer selection to allow inputting a new customer
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCode('');
    setIsMember(false);
    setRegisterAsMember(false);
    setSearchCustomerQuery('');
    setCustomerError(null);
  };

  // Calculate cart totals
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === '%') {
      return Math.round(subtotal * (Math.min(100, Math.max(0, discountValue)) / 100));
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const ppnRate = settings.ppnEnabled ? (settings.ppnRate ?? 0) : 0;
  const ppnAmount = useMemo(() => {
    if (ppnRate > 0) {
      return Math.round(afterDiscount * (ppnRate / 100));
    }
    return 0;
  }, [afterDiscount, ppnRate]);

  const finalTotal = afterDiscount + ppnAmount;

  // Cart operations
  const addToCart = (product: ProductItem) => {
    if (!product.available) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id && !item.note);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      } else {
        const staffListForRole = settings.staffList[product.reqStaffRole] || [];
        const defaultStaff = staffListForRole.length > 0 ? staffListForRole[0] : '';
        return [
          ...prev,
          {
            ...product,
            qty: 1,
            note: '',
            assignedTo: defaultStaff,
          },
        ];
      }
    });
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].qty + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index].qty = newQty;
      }
      return updated;
    });
  };

  const updateItemNote = (index: number, note: string) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index].note = note;
      return updated;
    });
  };

  const updateItemStaff = (index: number, staffName: string) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index].assignedTo = staffName;
      return updated;
    });
  };

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getStaffOptions = (reqRole: string) => {
    const list = settings.staffList[reqRole] || [];
    const allStaff = Object.values(settings.staffList).flat();
    return Array.from(new Set([...list, ...allStaff]));
  };

  // Checkout Trigger with Mandatory Customer Verification
  const handleCheckout = (status: 'selesai' | 'pending', paymentMethod: string) => {
    if (cart.length === 0) return;

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    // Mandatory Customer Check
    if (!trimmedName || !trimmedPhone) {
      setCustomerError('Nama dan Nomor Telepon Customer wajib diisi!');
      if (onShowToast) {
        onShowToast('Nama & Nomor Telepon customer wajib diisi untuk transaksi!', 'error');
      }
      setMobileTab('cart');
      return;
    }

    setCustomerError(null);
    const finalCode = customerCode || generateCustomerCode(trimmedName, trimmedPhone);
    const customerIdentifierText = `${trimmedName} [${finalCode}]` + 
      (seatOrTableNote.trim() ? ` (${seatOrTableNote.trim()})` : '');

    onSaveOrder(
      status,
      paymentMethod,
      customerIdentifierText,
      discountAmount,
      discountType,
      discountValue,
      {
        name: trimmedName,
        phone: trimmedPhone,
        customerCode: finalCode,
        isMember: isMember || registerAsMember,
        registerAsMember,
      }
    );

    // If finished, reset customer form
    if (status === 'selesai') {
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerCode('');
      setIsMember(false);
      setRegisterAsMember(false);
      setSeatOrTableNote('');
      setSearchCustomerQuery('');
    }
  };

  // Print Bill
  const handleTriggerPrintBill = () => {
    if (cart.length === 0) return;
    const finalName = customerName.trim() || 'Pelanggan (Bill)';
    const finalIdentifier = finalName + (seatOrTableNote.trim() ? ` (${seatOrTableNote.trim()})` : '');
    onPrintCart(finalIdentifier, discountAmount);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden bg-slate-100 relative">
      {/* LEFT: Product Catalog & Filter Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 p-3 sm:p-4 overflow-hidden ${
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex bg-white p-1 rounded-xl border border-slate-200 mb-2.5 shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('catalog')}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
              mobileTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Katalog Produk & Jasa
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'cart'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Keranjang ({cart.reduce((s, i) => s + i.qty, 0)})</span>
          </button>
        </div>

        {/* Top Controls: Search & Type Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari menu, layanan, atau produk di ${settings.storeName}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-red-500"
            />
          </div>

          {/* Quick toggle: Jasa vs Barang */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0 self-start">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedType === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setSelectedType('service')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                selectedType === 'service'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Layanan / Jasa
            </button>
            <button
              onClick={() => setSelectedType('product')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                selectedType === 'product'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3 h-3" />
              Barang / Produk
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product / Service Grid */}
        <div className="flex-1 overflow-y-auto pt-2 pb-4 pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Tag className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-sm font-semibold">Tidak ada produk/layanan yang sesuai model usaha ini.</p>
              <p className="text-xs mt-1">Buka tab "PRODUK & JASA" untuk menambahkan katalog baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((p) => {
                const isService = p.type === 'service';
                return (
                  <button
                    key={p.id}
                    disabled={!p.available}
                    onClick={() => addToCart(p)}
                    className={`relative p-3.5 bg-white rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                      p.available
                        ? 'border-slate-200 hover:border-red-500 hover:shadow-md active:scale-[0.98]'
                        : 'border-red-100 bg-red-50/50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* Item header badges */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isService
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isService ? 'JASA' : 'BARANG'}
                      </span>
                      {p.available ? (
                        <span className="text-[10px] text-emerald-600 font-bold">Ready</span>
                      ) : (
                        <span className="text-[10px] text-blue-600 font-bold">Habis</span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {p.category}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-black text-blue-600">
                        {formatRp(p.price)}
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-600 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout Panel */}
      <div
        className={`w-full lg:w-[420px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xl overflow-hidden ${
          mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Cart Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
          {editingOrder && (
            <div className="mb-2.5 p-2 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 font-black">
              <span>Mode Edit: #{editingOrder.id}</span>
              {onCancelEditOrder && (
                <button
                  type="button"
                  onClick={onCancelEditOrder}
                  className="px-2 py-0.5 bg-white text-blue-600 rounded-lg text-[10px] font-black hover:bg-red-50 border border-amber-300 transition-colors"
                >
                  Batal Edit
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('catalog')}
                className="lg:hidden p-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold"
              >
                ← Menu
              </button>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-600" />
                {editingOrder ? `Rincian Edit: #${editingOrder.id}` : 'Keranjang Kasir'}
              </h3>
            </div>
            <span className="px-2.5 py-0.5 bg-red-100 text-blue-700 rounded-full text-[11px] font-extrabold">
              {cart.reduce((s, i) => s + i.qty, 0)} item
            </span>
          </div>

          {/* CUSTOMER IDENTIFIER & REGISTRATION SECTION */}
          <div className="space-y-2">
            {/* If Customer is selected from database */}
            {selectedCustomer ? (
              <div className="p-3 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-amber-200 relative">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">
                        {selectedCustomer.name}
                      </span>
                      {selectedCustomer.isMember && (
                        <MembershipBadge size="sm" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                      <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-700">
                        [{selectedCustomer.customerCode}]
                      </span>
                      <span>📞 {selectedCustomer.phone}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">
                        {selectedCustomer.visitCount}x Kunjungan
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    className="p-1 rounded-lg bg-white/80 hover:bg-white text-slate-400 hover:text-blue-600 border border-slate-200 transition-colors"
                    title="Ganti Pelanggan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* If existing customer is NOT member yet, show Upgrade to Member button */}
                {!selectedCustomer.isMember && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-amber-900 font-bold">
                      Customer Reguler
                    </span>
                    <button
                      type="button"
                      onClick={() => setRegisterAsMember(!registerAsMember)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all border ${
                        registerAsMember
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <Crown className="w-3 h-3 text-amber-300" />
                      <span>{registerAsMember ? '✓ Didaftarkan Member' : '⭐ Daftarkan Member'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* New / Search Customer Flow */
              <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                {/* Search / Autocomplete Field for Repeat Customers */}
                <div className="relative" ref={customerSearchRef}>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchCustomerQuery}
                      onChange={(e) => {
                        setSearchCustomerQuery(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Cari customer lama (Nama / Kode Unik)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showCustomerDropdown && matchingCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {matchingCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="p-2.5 hover:bg-red-50 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900">{c.name}</span>
                              {c.isMember && <MembershipBadge size="sm" />}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-blue-600">[{c.customerCode}]</span>
                              <span>{c.phone}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {c.visitCount}x Kunjungan
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mandatory Fields for New / Unregistered Customer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 mb-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-600" />
                      <span>Nama Customer *</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (customerError) setCustomerError(null);
                      }}
                      placeholder="Nama pelanggan..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 mb-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>Nomor Telepon / WA *</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (customerError) setCustomerError(null);
                      }}
                      placeholder="081234567890"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Live Generated Unique Code & Daftar Member Button */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>Kode Unik:</span>
                    <span className="font-mono font-black text-blue-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      {customerCode ? `[${customerCode}]` : '-'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRegisterAsMember(!registerAsMember)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all border ${
                      registerAsMember
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span>{registerAsMember ? '✓ Daftar Member Aktif' : '⭐ Daftar Member'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Optional Seat / Table / Chair Note */}
            <div>
              <input
                type="text"
                value={seatOrTableNote}
                onChange={(e) => setSeatOrTableNote(e.target.value)}
                placeholder={`Catatan posisi: ${preset.identifierLabel} (opsional)...`}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Validation Error Message */}
            {customerError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5 text-[11px] font-bold text-blue-700 animate-shake">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{customerError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <Receipt className="w-12 h-12 mb-2 stroke-1 text-slate-300" />
              <p className="text-xs font-bold text-slate-500">Keranjang masih kosong</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Pilih menu atau layanan di sebelah kiri untuk memulai transaksi kasir.
              </p>
            </div>
          ) : (
            cart.map((item, index) => {
              const staffOptions = getStaffOptions(item.reqStaffRole);
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                        {item.name}
                      </h5>
                      <span className="text-[11px] font-black text-blue-600">
                        {formatRp(item.price * item.qty)}
                      </span>
                    </div>

                    {/* Quantity controller */}
                    <div className="flex items-center gap-1.5 bg-white px-1.5 py-1 rounded-lg border border-slate-200 shadow-xs shrink-0">
                      <button
                        onClick={() => updateQty(index, -1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-blue-600 font-black text-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-black text-xs text-slate-900">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(index, 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-blue-600 font-black text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Staff assignment & item notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                    {item.type === 'service' && staffOptions.length > 0 && (
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          Petugas / Stylist:
                        </label>
                        <select
                          value={item.assignedTo || ''}
                          onChange={(e) => updateItemStaff(index, e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Pilih Petugas --</option>
                          {staffOptions.map((staff) => (
                            <option key={staff} value={staff}>
                              {staff}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className={item.type !== 'service' ? 'sm:col-span-2' : ''}>
                      <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                        Catatan Khusus:
                      </label>
                      <input
                        type="text"
                        value={item.note || ''}
                        onChange={(e) => updateItemNote(index, e.target.value)}
                        placeholder="Contoh: Potongan tipis, Less Sugar..."
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary & Payment Controls */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 space-y-3 shrink-0">
          {/* Subtotal, Discount & PPN Summary */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-bold text-slate-800">{formatRp(subtotal)}</span>
            </div>

            {/* Discount Form */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Diskon / Potongan</span>
              <div className="flex items-center gap-1.5">
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDiscountType('Rp')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      discountType === 'Rp' ? 'bg-slate-900 text-white' : 'text-slate-500'
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('%')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      discountType === '%' ? 'bg-slate-900 text-white' : 'text-slate-500'
                    }`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {discountAmount > 0 && (
                  <span className="text-blue-600 font-black text-xs">
                    -{formatRp(discountAmount)}
                  </span>
                )}
              </div>
            </div>

            {/* PPN summary if enabled */}
            {settings.ppnEnabled && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>PPN ({settings.ppnRate || 11}%)</span>
                <span>+{formatRp(ppnAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="font-extrabold text-sm text-slate-900">Total Tagihan</span>
              <span className="font-black text-xl text-blue-600">
                {formatRp(finalTotal)}
              </span>
            </div>
          </div>

          {/* Action buttons: Hold Order & Print Bill */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleCheckout('pending', 'Pending')}
              disabled={cart.length === 0}
              className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <PauseCircle className="w-4 h-4" />
              GANTUNG / ANTRIAN
            </button>

            <button
              onClick={handleTriggerPrintBill}
              disabled={cart.length === 0}
              className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              PRINT BILL
            </button>
          </div>

          {/* Payment Methods Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCheckout('selesai', 'Cash')}
              disabled={cart.length === 0}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              CASH (TUNAI)
            </button>

            <button
              onClick={() => handleCheckout('selesai', 'QRIS')}
              disabled={cart.length === 0}
              className="py-3 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              QRIS / TRANSFER
            </button>

            {settings.businessType === 'fnb' ? (
              <>
                <button
                  onClick={() => handleCheckout('selesai', 'Shopeefood')}
                  disabled={cart.length === 0}
                  className="py-2 px-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-300 rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                >
                  ShopeeFood
                </button>
                <button
                  onClick={() => handleCheckout('selesai', 'Gofood')}
                  disabled={cart.length === 0}
                  className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                >
                  GoFood
                </button>
              </>
            ) : (
              <button
                onClick={() => handleCheckout('selesai', 'Debit / Kartu')}
                disabled={cart.length === 0}
                className="col-span-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                DEBIT / KARTU KREDIT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
