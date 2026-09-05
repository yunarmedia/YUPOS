import React, { useMemo, useState } from 'react';
import { History as HistoryIcon, Search, Printer, Edit3, XCircle, Trash2, CheckCircle2, Clock, AlertTriangle, Lock, KeyRound, Eye, EyeOff, User, CreditCard, Banknote, Tag } from 'lucide-react';
import { Order, OrderStatus, StoreSettings } from '../types';

interface HistoryViewProps {
  orders: Order[];
  settings: StoreSettings;
  onEditOrder: (order: Order) => void;
  onReprintOrder: (order: Order) => void;
  onCancelOrder: (orderId: string, currentStatus: OrderStatus) => void;
  onDeleteOrderPermanently: (orderId: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ orders, settings, onEditOrder, onReprintOrder, onCancelOrder, onDeleteOrderPermanently, onShowToast }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('selesai');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionModal, setActionModal] = useState<{ type: 'edit' | 'delete' | 'cancel'; order: Order } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesStatus = activeFilter === 'all' || order.status === activeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || [order.id, order.customer, order.paymentMethod].some((v) => String(v ?? '').toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  }), [orders, activeFilter, searchQuery]);

  const startAction = (type: 'edit' | 'delete' | 'cancel', order: Order) => {
    setActionModal({ type, order }); setEnteredPin(''); setPinError(null);
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault(); if (!actionModal) return;
    const pin = actionModal.type === 'edit' ? settings.portalPins?.historyEditPin : actionModal.type === 'delete' ? settings.portalPins?.historyDeletePin : settings.portalPins?.historyCancelPin;
    if (pin && enteredPin !== pin) { setPinError('Sandi otorisasi salah.'); return; }
    const { type, order } = actionModal; setActionModal(null);
    if (type === 'edit') onEditOrder(order);
    if (type === 'delete') onDeleteOrderPermanently(order.id);
    if (type === 'cancel') onCancelOrder(order.id, order.status);
    onShowToast('Aksi transaksi berhasil diproses.', 'success');
  };

  return <div className="flex h-full min-h-0 flex-col gap-4 p-3 sm:p-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2 text-xl font-black text-slate-900"><HistoryIcon className="text-blue-600" /> Riwayat Transaksi</div><p className="text-sm text-slate-500">Kelola transaksi secara aman.</p></div>
      <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Cari transaksi..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-blue-500"/></div>
    </header>
    <div className="flex gap-2 overflow-x-auto pb-1">{(['selesai','pending','dibatalkan','all'] as const).map(f=><button key={f} onClick={()=>setActiveFilter(f)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${activeFilter===f?'bg-blue-600 text-white':'bg-white text-slate-600 border border-slate-200'}`}>{f==='all'?'Semua':f==='selesai'?'Selesai':f==='pending'?'Pending':'Dibatalkan'}</button>)}</div>
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="min-w-[860px]"><div className="grid grid-cols-[1.1fr_1fr_1fr_.8fr_.8fr_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500"><span>Transaksi</span><span>Pelanggan</span><span>Waktu</span><span>Status</span><span>Total</span><span>Aksi</span></div>{filteredOrders.map(order=><div key={order.id} className="grid grid-cols-[1.1fr_1fr_1fr_.8fr_.8fr_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-0"><div className="font-bold">#{order.id}</div><div>{order.customer || 'Umum'}</div><div>{order.date} {order.time}</div><div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{order.status}</span></div><div className="font-black">{formatRp(order.total || 0)}</div><div className="flex gap-1"><button title="Cetak" onClick={()=>onReprintOrder(order)} className="rounded-lg p-2 hover:bg-blue-50"><Printer size={16}/></button><button title="Edit" onClick={()=>startAction('edit',order)} className="rounded-lg p-2 hover:bg-yellow-50"><Edit3 size={16}/></button><button title="Batalkan" onClick={()=>startAction('cancel',order)} className="rounded-lg p-2 hover:bg-orange-50"><XCircle size={16}/></button><button title="Hapus" onClick={()=>startAction('delete',order)} className="rounded-lg p-2 hover:bg-red-50"><Trash2 size={16}/></button></div></div>)}{filteredOrders.length===0&&<div className="p-12 text-center text-slate-500">Tidak ada transaksi.</div>}</div></div>
    {actionModal&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={verify} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Lock/></div><div><h3 className="font-black">Otorisasi Transaksi</h3><p className="text-xs text-slate-500">#{actionModal.order.id}</p></div></div><div className="relative"><input autoFocus type={showPin?'text':'password'} value={enteredPin} onChange={e=>setEnteredPin(e.target.value)} placeholder="Masukkan PIN" className="w-full rounded-xl border p-3 pr-11 outline-none focus:border-blue-500"/><button type="button" onClick={()=>setShowPin(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2">{showPin?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{pinError&&<p className="mt-2 text-sm font-semibold text-red-600">{pinError}</p>}<div className="mt-5 flex gap-2"><button type="button" onClick={()=>setActionModal(null)} className="flex-1 rounded-xl border px-4 py-3 font-bold">Batal</button><button type="submit" className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Konfirmasi</button></div></form></div>}
  </div>;
};
