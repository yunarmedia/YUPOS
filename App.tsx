import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './config/firebase';
import { 
  BusinessType, 
  ItemType, 
  ProductItem, 
  CartItem, 
  Order, 
  Expense, 
  StoreSettings, 
  MerchantUser, 
  PortalPins,
  Customer
} from './types';
import { BUSINESS_PRESETS } from './config/businessCategories';
import { 
  defaultSettings, 
  loadMerchantSettings,
  saveMerchantSettings,
  loadMerchantProducts,
  saveMerchantProducts,
  loadMerchantOrders,
  saveMerchantOrders,
  loadMerchantExpenses,
  saveMerchantExpenses,
  loadMerchantPettyCash,
  saveMerchantPettyCash,
  syncConfigToFirebase, 
  syncProductsToFirebase,
  syncOrdersToFirebase,
  syncExpensesToFirebase,
  syncPettyCashToFirebase 
} from './services/storageService';
import {
  loadCustomers,
  saveCustomers,
  syncCustomersToFirebase,
  recordCustomerVisit
} from './services/customerService';

import { MerchantLogin } from './components/MerchantLogin';
import { Sidebar } from './components/Sidebar';
import { PosView } from './components/PosView';
import { CustomerView } from './components/CustomerView';
import { RevenueView } from './components/RevenueView';
import { ExpensesView } from './components/ExpensesView';
import { InventoryView } from './components/InventoryView';
import { HistoryView } from './components/HistoryView';
import { StaffView } from './components/StaffView';
import { SettingsView } from './components/SettingsView';
import { PrinterView } from './components/PrinterView';
import { ExtractDataView } from './components/ExtractDataView';
import { 
  requestBluetoothPrinter, 
  sendBluetoothData, 
  buildReceiptEscPos 
} from './services/printerService';
import { AdminModal } from './components/AdminModal';
import { PrintReceipt } from './components/PrintReceipt';
import { Toast, ToastMessage } from './components/Toast';
import { Menu, Lock, Eye, EyeOff } from 'lucide-react';
import { AppSplash } from './components/AppSplash';
import { playPaymentSound, speakPayment } from './services/audioService';

function isTimeWithinRange(currentTimeStr: string, startStr: string, endStr: string): boolean {
  if (!startStr || !endStr) return false;
  const [curH, curM] = currentTimeStr.split(':').map(Number);
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const curMinutes = curH * 60 + curM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return curMinutes >= startMinutes && curMinutes < endMinutes;
  }
  return curMinutes >= startMinutes || curMinutes < endMinutes;
}

export default function App() {
  const [merchant, setMerchant] = useState<MerchantUser | null>(() => {
    try {
      const saved = localStorage.getItem('yupos_merchant_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authInitialized, setAuthInitialized] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const [activeTab, setActiveTab] = useState<string>('pos');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const merchantId = merchant?.uid || 'default_merchant';

  const [settings, setSettings] = useState<StoreSettings>(() => loadMerchantSettings(merchantId));
  const [products, setProducts] = useState<ProductItem[]>(() => loadMerchantProducts(merchantId, settings.businessType));
  const [orders, setOrders] = useState<Order[]>(() => loadMerchantOrders(merchantId, settings.businessType));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadMerchantExpenses(merchantId, settings.businessType));
  const [pettyCash, setPettyCash] = useState<number>(() => loadMerchantPettyCash(merchantId, settings.businessType));
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers(merchantId));

  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const [btStatusKasir, setBtStatusKasir] = useState<string>('🔴 Belum Terkoneksi');
  const [btStatusDapur, setBtStatusDapur] = useState<string>('🔴 Belum Terkoneksi');
  const printerKasirCharRef = useRef<any>(null);
  const printerKasirDeviceRef = useRef<any>(null);
  const printerDapurCharRef = useRef<any>(null);
  const printerDapurDeviceRef = useRef<any>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tabAuthModal, setTabAuthModal] = useState<{
    targetTab: string;
    title: string;
    expectedPin: string;
  } | null>(null);
  const [enteredTabPin, setEnteredTabPin] = useState('');
  const [tabPinError, setTabPinError] = useState<string | null>(null);
  const [showTabPin, setShowTabPin] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const playBuzzer = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio may be blocked before a user gesture.
    }
  };

  // Only reload merchant-scoped data when the actual merchant identity changes.
  // No auth callback is allowed to clear a live UI session.
  const previousMerchantIdRef = useRef<string | null>(merchant?.uid ?? null);
  useEffect(() => {
    const nextMerchantId = merchant?.uid ?? null;
    if (!nextMerchantId || nextMerchantId === previousMerchantIdRef.current) return;

    previousMerchantIdRef.current = nextMerchantId;
    const loadedSettings = loadMerchantSettings(nextMerchantId);
    setSettings(loadedSettings);
    setProducts(loadMerchantProducts(nextMerchantId, loadedSettings.businessType));
    setOrders(loadMerchantOrders(nextMerchantId, loadedSettings.businessType));
    setExpenses(loadMerchantExpenses(nextMerchantId, loadedSettings.businessType));
    setPettyCash(loadMerchantPettyCash(nextMerchantId, loadedSettings.businessType));
    setCustomers(loadCustomers(nextMerchantId));
    setCart([]);
    setEditingOrder(null);
  }, [merchant?.uid]);

  // Resolve the persisted session exactly once. When it exists, do not subscribe
  // to auth state just to replace the current local session after the app is open.
  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem('yupos_merchant_session');

    if (saved) {
      try {
        const persistedUser = JSON.parse(saved) as MerchantUser;
        if (!cancelled && persistedUser?.uid && persistedUser.uid !== merchant?.uid) {
          setMerchant(persistedUser);
        }
        if (!cancelled) setAuthInitialized(true);
      } catch {
        localStorage.removeItem('yupos_merchant_session');
        if (!cancelled) setAuthInitialized(true);
      }
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      if (user) {
        const userObj: MerchantUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Merchant',
        };
        setMerchant((current) => {
          if (current?.uid === userObj.uid) return current;
          localStorage.setItem('yupos_merchant_session', JSON.stringify(userObj));
          return userObj;
        });
      }
      setAuthInitialized(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkShift = () => {
      if (settings.manualOverride) return;

      const now = new Date();
      const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const s1Start = settings.shift1Start || '10:00';
      const s1End = settings.shift1End || '13:00';
      const expectedShift: '1' | '2' = isTimeWithinRange(curTime, s1Start, s1End) ? '1' : '2';

      if (settings.activeShift !== expectedShift) {
        setSettings((prev) => ({ ...prev, activeShift: expectedShift }));
        const mId = merchant?.uid || 'default_merchant';
        const updated = { ...settings, activeShift: expectedShift };
        saveMerchantSettings(mId, updated);
        void syncConfigToFirebase(updated, mId);
      }
    };

    checkShift();
    const interval = window.setInterval(checkShift, 30000);
    return () => window.clearInterval(interval);
  }, [
    settings.manualOverride,
    settings.activeShift,
    settings.shift1Start,
    settings.shift1End,
    merchant?.uid,
  ]);

  const handleSelectTab = (tabId: string) => {
    if (tabId === 'admin') {
      const expected = settings.portalPins?.admin || '2024UDC';
      setTabAuthModal({ targetTab: 'admin', title: 'Otoritas Admin Kontrol', expectedPin: expected });
      setEnteredTabPin('');
      setTabPinError(null);
      return;
    }
    if (tabId === 'expenses' && settings.portalPins?.expenses) {
      setTabAuthModal({ targetTab: 'expenses', title: 'Sandi Portal Pengeluaran', expectedPin: settings.portalPins.expenses });
      setEnteredTabPin('');
      setTabPinError(null);
      return;
    }
    if (tabId === 'inventory' && settings.portalPins?.inventory) {
      setTabAuthModal({ targetTab: 'inventory', title: 'Sandi Portal Produk & Jasa', expectedPin: settings.portalPins.inventory });
      setEnteredTabPin('');
      setTabPinError(null);
      return;
    }
    if (tabId === 'staff' && settings.portalPins?.staff) {
      setTabAuthModal({ targetTab: 'staff', title: 'Sandi Portal Karyawan & Shift', expectedPin: settings.portalPins.staff });
      setEnteredTabPin('');
      setTabPinError(null);
      return;
    }
    if (tabId === 'settings' && settings.portalPins?.settings) {
      setTabAuthModal({ targetTab: 'settings', title: 'Sandi Portal Pengaturan Sistem', expectedPin: settings.portalPins.settings });
      setEnteredTabPin('');
      setTabPinError(null);
      return;
    }
    setActiveTab(tabId);
  };

  const handleVerifyTabPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tabAuthModal) return;
    if (enteredTabPin === tabAuthModal.expectedPin) {
      setActiveTab(tabAuthModal.targetTab);
      setTabAuthModal(null);
      showToast(`Akses ${tabAuthModal.title} dibuka!`, 'success');
    } else {
      setTabPinError('Sandi / Kode Otoritas Salah! Periksa kembali.');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('yupos_merchant_session');
    previousMerchantIdRef.current = null;
    setMerchant(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Logout error:', e);
    }
    showToast('Berhasil keluar dari akun kasir.', 'info');
  };

  const connectBluetoothPrinter = async (type: 'kasir' | 'dapur') => {
    try {
      showToast('Membuka dialog pencarian printer Bluetooth...', 'info');
      const conn = await requestBluetoothPrinter();
      conn.device.addEventListener('gattserverdisconnected', () => {
        if (type === 'kasir') {
          setBtStatusKasir('🔴 Terputus');
          printerKasirCharRef.current = null;
          printerKasirDeviceRef.current = null;
        } else {
          setBtStatusDapur('🔴 Terputus');
          printerDapurCharRef.current = null;
          printerDapurDeviceRef.current = null;
        }
        showToast(`Printer Bluetooth ${type === 'kasir' ? 'Kasir' : 'Dapur'} terputus.`, 'warning');
      });
      if (type === 'kasir') {
        printerKasirCharRef.current = conn.characteristic;
        printerKasirDeviceRef.current = conn.device;
        setBtStatusKasir(`🟢 Terkoneksi: ${conn.device.name || 'Printer Kasir'}`);
      } else {
        printerDapurCharRef.current = conn.characteristic;
        printerDapurDeviceRef.current = conn.device;
        setBtStatusDapur(`🟢 Terkoneksi: ${conn.device.name || 'Printer Dapur'}`);
      }
      showToast(`Printer Bluetooth ${type === 'kasir' ? 'Kasir' : 'Dapur'} (${conn.device.name || 'BT Printer'}) berhasil terhubung!`, 'success');
    } catch (err: any) {
      console.warn('BT Connect error:', err);
      const msg = err?.message || '';
      if (msg.includes('User cancelled')) showToast('Pencarian printer Bluetooth dibatalkan pengguna.', 'info');
      else showToast(`Gagal menghubungkan printer: ${msg || 'Periksa koneksi Bluetooth'}`, 'error');
    }
  };

  const disconnectBluetoothPrinter = async (type: 'kasir' | 'dapur') => {
    try {
      if (type === 'kasir' && printerKasirDeviceRef.current?.gatt?.connected) {
        printerKasirDeviceRef.current.gatt.disconnect();
        printerKasirCharRef.current = null;
        printerKasirDeviceRef.current = null;
        setBtStatusKasir('🔴 Belum Terkoneksi');
        showToast('Printer Kasir berhasil diputus.', 'info');
      } else if (type === 'dapur' && printerDapurDeviceRef.current?.gatt?.connected) {
        printerDapurDeviceRef.current.gatt.disconnect();
        printerDapurCharRef.current = null;
        printerDapurDeviceRef.current = null;
        setBtStatusDapur('🔴 Belum Terkoneksi');
        showToast('Printer Dapur berhasil diputus.', 'info');
      }
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
  };

  const executePrintReceipt = async (orderToPrint: Order) => {
    setReceiptOrder(orderToPrint);
    if (printerKasirCharRef.current) {
      try {
        const rawBytes = buildReceiptEscPos(orderToPrint, settings);
        await sendBluetoothData(printerKasirCharRef.current, rawBytes);
        showToast('Struk berhasil dicetak via Bluetooth ESC/POS!', 'success');
        return;
      } catch (err: any) {
        console.warn('Bluetooth print failed, falling back to window.print:', err);
        showToast('Gagal cetak Bluetooth, membuka dialog cetak browser...', 'warning');
      }
    }
    window.setTimeout(() => window.print(), 150);
  };

  const handleSaveOrder = (
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
  ) => {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const ppnRate = settings.ppnEnabled ? (settings.ppnRate ?? 0) : 0;
    const ppn = ppnRate > 0 ? Math.round(afterDiscount * (ppnRate / 100)) : 0;
    const finalTotal = afterDiscount + ppn;
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const cashierName = settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name;
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    let savedOrder: Order;

    if (editingOrder) {
      savedOrder = {
        ...editingOrder,
        customer: customerNote || editingOrder.customer || 'Pelanggan',
        customerPhone: customerDetails?.phone || editingOrder.customerPhone,
        customerCode: customerDetails?.customerCode || editingOrder.customerCode,
        customerIsMember: customerDetails?.isMember ?? editingOrder.customerIsMember,
        items: [...cart], subtotal, discount, discountType, discountValue, ppn, ppnRate,
        total: finalTotal, status, payment: paymentMethod,
      };
      const updated = orders.map((o) => (o.id === editingOrder.id ? savedOrder : o));
      setOrders(updated);
      saveMerchantOrders(currentMId, currentBType, updated);
      void syncOrdersToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Order sync failed:', error));
    } else {
      const newId = 'ORD-' + Date.now().toString(36).toUpperCase();
      savedOrder = {
        id: newId, date: todayDate, time: timeStr, timestamp: Date.now(),
        customer: customerNote || 'Pelanggan', customerPhone: customerDetails?.phone,
        customerCode: customerDetails?.customerCode, customerIsMember: customerDetails?.isMember,
        items: [...cart], subtotal, discount, discountType, discountValue, ppn, ppnRate,
        total: finalTotal, status, payment: paymentMethod, shift: settings.activeShift,
        cashierName: cashierName || 'Kasir', businessType: currentBType, merchantId: currentMId,
      };
      const updated = [...orders, savedOrder];
      setOrders(updated);
      saveMerchantOrders(currentMId, currentBType, updated);
      void syncOrdersToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Order sync failed:', error));
    }

    if (customerDetails && customerDetails.name && customerDetails.phone) {
      const updatedCustomers = recordCustomerVisit(customers, {
        name: customerDetails.name,
        phone: customerDetails.phone,
        customerCode: customerDetails.customerCode,
        isMember: customerDetails.isMember,
      }, status === 'selesai' ? finalTotal : 0, currentMId);
      setCustomers(updatedCustomers);
      void syncCustomersToFirebase(currentMId, updatedCustomers).catch((error) => console.warn('Customer sync failed:', error));
    }

    setCart([]);
    setEditingOrder(null);
    playBuzzer();
    if (status === 'selesai') {
      void playPaymentSound();
      speakPayment(finalTotal, paymentMethod);
      showToast(`Transaksi ${paymentMethod} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(finalTotal)} berhasil diselesaikan!`, 'success');
      if (settings.btAutoPrint) void executePrintReceipt(savedOrder);
    } else {
      showToast('Pesanan berhasil digantung / masuk antrian.', 'info');
    }
  };

  const handlePrintCart = (customerNote: string, discount: number) => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const ppnRate = settings.ppnEnabled ? (settings.ppnRate ?? 0) : 0;
    const ppn = ppnRate > 0 ? Math.round(afterDiscount * (ppnRate / 100)) : 0;
    const finalTotal = afterDiscount + ppn;
    const tempOrder: Order = {
      id: 'BILL-' + Date.now().toString().slice(-4),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(), customer: customerNote || 'Pelanggan (Bill)', items: [...cart], subtotal,
      discount, discountType: 'Rp', discountValue: discount, ppn, ppnRate, total: finalTotal,
      status: 'pending', payment: 'Belum Bayar', shift: settings.activeShift,
      cashierName: settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name,
      businessType: settings.businessType, merchantId: merchant?.uid,
    };
    void executePrintReceipt(tempOrder);
  };

  const handleUpdateSettings = (newSettings: Partial<StoreSettings>) => {
    const currentMId = merchant?.uid || 'default_merchant';
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveMerchantSettings(currentMId, updated);
      void syncConfigToFirebase(updated, currentMId).catch((error) => console.warn('Config sync failed:', error));

      if (newSettings.businessType && newSettings.businessType !== prev.businessType) {
        const oldType = prev.businessType;
        const newType = newSettings.businessType;
        saveMerchantProducts(currentMId, oldType, products);
        saveMerchantOrders(currentMId, oldType, orders);
        saveMerchantExpenses(currentMId, oldType, expenses);
        saveMerchantPettyCash(currentMId, oldType, pettyCash);
        setProducts(loadMerchantProducts(currentMId, newType));
        setOrders(loadMerchantOrders(currentMId, newType));
        setExpenses(loadMerchantExpenses(currentMId, newType));
        setPettyCash(loadMerchantPettyCash(currentMId, newType));
        setCart([]);
        setEditingOrder(null);
      }
      return updated;
    });
  };

  const handleSaveProduct = (prodData: Omit<ProductItem, 'id'>, id?: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    if (id) {
      const updated = products.map((p) => p.id === id ? { ...prodData, id, businessType: currentBType, merchantId: currentMId } : p);
      setProducts(updated);
      saveMerchantProducts(currentMId, currentBType, updated);
      void syncProductsToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Product sync failed:', error));
      showToast('Katalog berhasil diperbarui!', 'success');
      return;
    }
    const newProduct: ProductItem = { ...prodData, id: 'PRD-' + Date.now().toString(36).toUpperCase(), businessType: currentBType, merchantId: currentMId };
    const updated = [...products, newProduct];
    setProducts(updated);
    saveMerchantProducts(currentMId, currentBType, updated);
    void syncProductsToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Product sync failed:', error));
    showToast('Katalog baru berhasil ditambahkan!', 'success');
  };

  const handleDeleteProduct = (id: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const updated = products.map((p) => p.id === id ? { ...p, deleted: true } : p);
    setProducts(updated);
    saveMerchantProducts(currentMId, currentBType, updated);
    void syncProductsToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Product sync failed:', error));
    showToast('Katalog berhasil dinonaktifkan.', 'info');
  };

  const handleAddExpense = (expData: Omit<Expense, 'id'>) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const newExp: Expense = { ...expData, id: 'EXP-' + Date.now().toString(36).toUpperCase(), businessType: currentBType, merchantId: currentMId };
    const updated = [...expenses, newExp];
    setExpenses(updated);
    saveMerchantExpenses(currentMId, currentBType, updated);
    void syncExpensesToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Expense sync failed:', error));
    showToast('Catatan pengeluaran berhasil disimpan.', 'success');
  };

  const handleUpdateExpense = (exp: Expense) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const updated = expenses.map((e) => String(e.id) === String(exp.id) ? exp : e);
    setExpenses(updated);
    saveMerchantExpenses(currentMId, currentBType, updated);
    void syncExpensesToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Expense sync failed:', error));
    showToast('Catatan pengeluaran diperbarui.', 'success');
  };

  const handleDeleteExpense = (id: string | number) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const updated = expenses.filter((e) => String(e.id) !== String(id));
    setExpenses(updated);
    saveMerchantExpenses(currentMId, currentBType, updated);
    void syncExpensesToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Expense sync failed:', error));
    showToast('Pengeluaran berhasil dihapus.', 'info');
  };

  const handleSavePettyCash = (amount: number) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    setPettyCash(amount);
    saveMerchantPettyCash(currentMId, currentBType, amount);
    void syncPettyCashToFirebase(amount, currentMId, currentBType).catch((error) => console.warn('Petty cash sync failed:', error));
    showToast('Modal awal kasir berhasil diperbarui!', 'success');
  };

  const handleSaveCustomer = (customerData: Omit<Customer, 'id'>, id?: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    let updated: Customer[];
    if (id) {
      updated = customers.map((c) => c.id === id ? { ...customerData, id } : c);
      showToast('Data customer berhasil diperbarui!', 'success');
    } else {
      const newCustomer: Customer = { ...customerData, id: 'CUST-' + Date.now().toString(36).toUpperCase(), createdAt: Date.now(), visitCount: customerData.visitCount || 0, totalSpent: customerData.totalSpent || 0 };
      updated = [newCustomer, ...customers];
      showToast('Customer baru berhasil didaftarkan!', 'success');
    }
    setCustomers(updated);
    saveCustomers(currentMId, updated);
    void syncCustomersToFirebase(currentMId, updated).catch((error) => console.warn('Customer sync failed:', error));
  };

  const handleDeleteCustomer = (id: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const updated = customers.filter((c) => c.id !== id);
    setCustomers(updated);
    saveCustomers(currentMId, updated);
    void syncCustomersToFirebase(currentMId, updated).catch((error) => console.warn('Customer sync failed:', error));
    showToast('Data customer berhasil dihapus.', 'info');
  };

  const handleToggleMembership = (id: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const updated = customers.map((c) => c.id === id ? { ...c, isMember: !c.isMember, memberSince: !c.isMember ? (c.memberSince || new Date().toISOString().split('T')[0]) : undefined } : c);
    setCustomers(updated);
    saveCustomers(currentMId, updated);
    void syncCustomersToFirebase(currentMId, updated).catch((error) => console.warn('Customer sync failed:', error));
    showToast('Status membership customer diperbarui!', 'success');
  };

  const handleEditPendingOrder = (order: Order) => {
    setEditingOrder(order);
    setCart([...order.items]);
    setActiveTab('pos');
    showToast(`Memuat pesanan #${order.id} ke keranjang kasir.`, 'info');
  };

  const handleCancelOrder = (orderId: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const updated = orders.map((o) => o.id === orderId ? { ...o, status: 'batal' as const } : o);
    setOrders(updated);
    saveMerchantOrders(currentMId, currentBType, updated);
    void syncOrdersToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Order sync failed:', error));
    showToast('Status pesanan dibatalkan.', 'warning');
  };

  const handleDeleteOrderPermanently = (orderId: string) => {
    const currentMId = merchant?.uid || 'default_merchant';
    const currentBType = settings.businessType;
    const updated = orders.filter((o) => o.id !== orderId);
    setOrders(updated);
    saveMerchantOrders(currentMId, currentBType, updated);
    void syncOrdersToFirebase(updated, currentMId, currentBType).catch((error) => console.warn('Order sync failed:', error));
    showToast('Pesanan dihapus secara permanen.', 'info');
  };

  if (splashVisible || !authInitialized) return <AppSplash />;

  if (!merchant) {
    return (
      <div className="w-full h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-4">
        <MerchantLogin onLoginSuccess={(u) => {
          setMerchant(u);
          localStorage.setItem('yupos_merchant_session', JSON.stringify(u));
          previousMerchantIdRef.current = null;
        }} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-slate-50 font-sans select-none">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <PrintReceipt order={receiptOrder} settings={settings} />
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          handleSelectTab(tabId);
          setSidebarOpen(false);
        }}
        settings={settings}
        merchant={merchant}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative bg-slate-50">
        <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-blue-950 text-white shrink-0 border-b border-blue-900 shadow-sm z-30">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors" title="Buka Menu"><Menu className="w-5 h-5" /></button>
            <div className="leading-tight">
              <span className="text-xs font-black tracking-wide text-white block truncate max-w-[150px] sm:max-w-[220px]">{settings.storeName}</span>
              <span className="text-[10px] text-blue-300 font-bold uppercase">{activeTab} • Shift {settings.activeShift}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => handleSelectTab('printer')} className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${activeTab === 'printer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}>🖨️</button>
            <button type="button" onClick={() => handleSelectTab('pos')} className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${activeTab === 'pos' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'}`}>Kasir</button>
          </div>
        </div>

        {activeTab === 'pos' && <PosView products={products} settings={settings} cart={cart} setCart={setCart} editingOrder={editingOrder} customers={customers} onSaveOrder={handleSaveOrder} onPrintCart={handlePrintCart} onCancelEditOrder={() => { setEditingOrder(null); setCart([]); showToast('Batal edit pesanan.', 'info'); }} onShowToast={showToast} />}
        {activeTab === 'customers' && <CustomerView customers={customers} onSaveCustomer={handleSaveCustomer} onDeleteCustomer={handleDeleteCustomer} onToggleMembership={handleToggleMembership} onShowToast={showToast} />}
        {activeTab === 'revenue' && <RevenueView orders={orders} expenses={expenses} pettyCash={pettyCash} onSavePettyCash={handleSavePettyCash} settings={settings} onShowToast={showToast} onNavigateToExtract={() => handleSelectTab('extract')} />}
        {activeTab === 'extract' && <ExtractDataView orders={orders} expenses={expenses} settings={settings} onShowToast={showToast} />}
        {activeTab === 'expenses' && <ExpensesView expenses={expenses} onAddExpense={handleAddExpense} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense} onShowToast={showToast} />}
        {activeTab === 'inventory' && <InventoryView products={products} settings={settings} onSaveProduct={handleSaveProduct} onDeleteProduct={handleDeleteProduct} onShowToast={showToast} />}
        {activeTab === 'history' && <HistoryView orders={orders} settings={settings} onEditOrder={handleEditPendingOrder} onReprintOrder={executePrintReceipt} onCancelOrder={handleCancelOrder} onDeleteOrderPermanently={handleDeleteOrderPermanently} onShowToast={showToast} />}
        {activeTab === 'staff' && <StaffView settings={settings} onUpdateSettings={handleUpdateSettings} onShowToast={showToast} />}
        {activeTab === 'settings' && <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} onShowToast={showToast} />}
        {activeTab === 'printer' && <PrinterView settings={settings} onUpdateSettings={handleUpdateSettings} onShowToast={showToast} onTestPrint={() => void executePrintReceipt({ id: 'TEST-PRINT', date: new Date().toISOString().split('T')[0], time: '12:00', timestamp: Date.now(), customer: 'Pelanggan Uji Coba', items: [{ id: 'test-1', name: 'Koneksi Printer Berhasil', category: 'Test', price: 15000, qty: 1, type: 'service', reqStaffRole: 'Kasir', available: true }], subtotal: 15000, discount: 0, discountType: 'Rp', discountValue: 0, total: 15000, status: 'selesai', payment: 'Cash', shift: settings.activeShift, cashierName: settings.activeShift === '1' ? settings.shift1Name : settings.shift2Name, businessType: settings.businessType })} btStatusKasir={btStatusKasir} btStatusDapur={btStatusDapur} onConnectPrinterKasir={() => void connectBluetoothPrinter('kasir')} onDisconnectPrinterKasir={() => void disconnectBluetoothPrinter('kasir')} onConnectPrinterDapur={() => void connectBluetoothPrinter('dapur')} onDisconnectPrinterDapur={() => void disconnectBluetoothPrinter('dapur')} />}
      </main>

      {tabAuthModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-blue-600 shrink-0"><Lock className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-extrabold text-slate-900 leading-tight">{tabAuthModal.title}</h3><p className="text-[11px] text-slate-500 font-medium">Masukkan PIN / Sandi untuk melanjutkan</p></div>
            </div>
            <form onSubmit={handleVerifyTabPin} className="space-y-4">
              <div>
                <div className="relative">
                  <input type={showTabPin ? 'text' : 'password'} autoFocus value={enteredTabPin} onChange={(e) => { setEnteredTabPin(e.target.value); setTabPinError(null); }} placeholder="Masukkan PIN..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowTabPin(!showTabPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showTabPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                {tabPinError && <p className="text-[11px] font-bold text-blue-600 mt-1.5 animate-shake">{tabPinError}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setTabAuthModal(null); setEnteredTabPin(''); setTabPinError(null); }} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all">Buka Akses</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
