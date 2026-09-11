import React, { useMemo, useState } from 'react';
import { UserPlus, Search, Trash2, Edit3, Crown, Phone, FileSpreadsheet, X, Hash, Eye, History, CalendarDays, ShoppingBag, Gift } from 'lucide-react';
import { Customer, MembershipRewardType } from '../types';
import { MembershipBadge } from './MembershipBadge';
import { MembershipCardModal } from './MembershipCardModal';
import { generateCustomerCode, claimMembershipReward } from '../services/customerService';
import * as XLSX from 'xlsx';

interface CustomerViewProps {
  customers: Customer[];
  onSaveCustomer: (customerData: Omit<Customer, 'id'>, id?: string) => void;
  onDeleteCustomer: (id: string) => void;
  onToggleMembership: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ customers, onSaveCustomer, onDeleteCustomer, onToggleMembership, onShowToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'members' | 'regular'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Customer | null>(null);
  const [cardCustomer, setCardCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsMember, setFormIsMember] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  const merchantId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('yupos_merchant_session') || '{}')?.uid || ''; }
    catch { return ''; }
  }, []);

  const filteredCustomers = useMemo(() => customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matches = !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || c.phone.includes(q);
    if (!matches) return false;
    if (activeFilter === 'members') return c.isMember === true;
    if (activeFilter === 'regular') return c.isMember !== true;
    return true;
  }), [customers, searchQuery, activeFilter]);

  const totalCustomers = customers.length;
  const totalMembers = customers.filter((c) => c.isMember === true).length;
  const totalRegular = totalCustomers - totalMembers;
  const totalVisits = customers.reduce((sum, c) => sum + (c.visitCount || 0), 0);
  const formatRp = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

  const openAdd = () => {
    setEditingCustomer(null); setFormName(''); setFormPhone(''); setFormIsMember(false); setFormNotes(''); setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c); setFormName(c.name); setFormPhone(c.phone); setFormIsMember(c.isMember === true); setFormNotes(c.notes || ''); setIsModalOpen(true);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      onShowToast('Nama dan nomor WhatsApp/HP wajib diisi.', 'error'); return;
    }
    const code = generateCustomerCode(formName, formPhone);
    if (editingCustomer) {
      const member = formIsMember;
      onSaveCustomer({
        ...editingCustomer,
        name: formName.trim(), phone: formPhone.trim(), customerCode: code,
        isMember: member,
        memberSince: member ? (editingCustomer.memberSince || new Date().toISOString().split('T')[0]) : undefined,
        notes: formNotes.trim(),
      }, editingCustomer.id);
    } else {
      const member = formIsMember;
      onSaveCustomer({
        name: formName.trim(), phone: formPhone.trim(), customerCode: code,
        visitCount: 0, isMember: member,
        memberSince: member ? new Date().toISOString().split('T')[0] : undefined,
        totalSpent: 0, lastVisit: '-', notes: formNotes.trim(), createdAt: Date.now(),
        visitHistory: [], membershipVisits: [], membershipRedemptions: [],
      });
    }
    setIsModalOpen(false);
  };

  const claimReward = (reward: MembershipRewardType) => {
    if (!cardCustomer) return;
    const result = claimMembershipReward(customers, cardCustomer.id, reward, merchantId);
    if (!result.success) { onShowToast(result.message, 'warning'); return; }
    const updated = result.customers.find((c) => c.id === cardCustomer.id);
    if (updated) { onSaveCustomer({ ...updated }, updated.id); setCardCustomer(updated); setHistoryCustomer(updated); }
    onShowToast(result.message, 'success');
  };

  const exportExcel = () => {
    const rows = customers.map((c, idx) => ({
      No: idx + 1,
      'Kode Unik': c.customerCode,
      'Nama Pelanggan': c.name,
      'Nomor WhatsApp/HP': c.phone,
      'Kategori': c.isMember ? 'MEMBERSHIP CUSTOMER' : 'CUSTOMER REGULER',
      'Tanggal Bergabung Member': c.memberSince || '-',
      'Kunjungan Siklus': `${c.visitCount || 0}x`,
      'Total Riwayat Kunjungan': `${(c.visitHistory || c.membershipVisits || []).length}x`,
      'Total Belanja (Rp)': c.totalSpent || 0,
      'Kunjungan Terakhir': c.lastVisit || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Customer');
    XLSX.writeFile(wb, `YuPOS_Data_Customer_${new Date().toISOString().split('T')[0]}.xlsx`);
    onShowToast('Data customer berhasil diekspor ke Excel.', 'success');
  };

  return <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5 overflow-auto overscroll-contain min-h-0 h-full">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Data Pelanggan & Membership</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-extrabold text-xs">{totalCustomers} Customer</span>
        </div>
        <p className="text-xs text-slate-500 font-semibold mt-1">Customer Membership dan Customer Reguler dipisahkan. Member memiliki tanda khusus dan Member Card QR.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={exportExcel} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> Ekspor Excel</button>
        <button type="button" onClick={openAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Tambah Customer</button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-[11px] font-bold text-slate-500">Total Pelanggan</div><p className="text-2xl font-black">{totalCustomers}</p></div>
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4"><div className="text-[11px] font-black text-amber-800">Membership Customer</div><p className="text-2xl font-black text-amber-950">{totalMembers}</p></div>
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4"><div className="text-[11px] font-black text-slate-600">Customer Reguler</div><p className="text-2xl font-black text-slate-900">{totalRegular}</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-[11px] font-bold text-slate-500">Total Kunjungan Siklus</div><p className="text-2xl font-black">{totalVisits}x</p></div>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama, kode, atau nomor HP..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" /></div>
        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap ${activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Semua ({totalCustomers})</button>
          <button onClick={() => setActiveFilter('members')} className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap ${activeFilter === 'members' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 text-amber-900'}`}><Crown className="inline w-3 h-3 mr-1" />Membership ({totalMembers})</button>
          <button onClick={() => setActiveFilter('regular')} className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap ${activeFilter === 'regular' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Reguler ({totalRegular})</button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 max-h-[62dvh]">
        <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
          <thead><tr className="bg-slate-50 text-slate-700 font-black border-b"><th className="py-3 px-3.5">Kode</th><th className="py-3 px-3.5">Nama / Status</th><th className="py-3 px-3.5">WhatsApp/HP</th><th className="py-3 px-3.5 text-center">Kunjungan</th><th className="py-3 px-3.5 text-center">Riwayat</th><th className="py-3 px-3.5 text-right">Total Belanja</th><th className="py-3 px-3.5 text-center">Terakhir</th><th className="py-3 px-3.5 text-right">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100 font-semibold">
            {filteredCustomers.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada data customer.</td></tr> : filteredCustomers.map((c) => {
              const historyCount = (c.visitHistory || c.membershipVisits || []).length;
              const member = c.isMember === true;
              return <tr key={c.id} className={member ? 'hover:bg-amber-50/60' : 'hover:bg-slate-50'}>
                <td className="py-3 px-3.5"><span className="inline-flex items-center gap-1 font-mono font-black px-2.5 py-1 rounded-lg bg-slate-900 text-yellow-300"><Hash className="w-3 h-3" />{c.customerCode}</span></td>
                <td className="py-3 px-3.5"><div className="flex items-center gap-2 flex-wrap"><span className="font-extrabold text-slate-900 text-sm">{c.name}</span>{member ? <MembershipBadge size="sm" onClick={() => setCardCustomer(c)} /> : <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">REGULER</span>}</div></td>
                <td className="py-3 px-3.5 whitespace-nowrap"><a href={`https://wa.me/${c.phone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-slate-700 hover:text-emerald-600 font-bold inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-emerald-600" />{c.phone}</a></td>
                <td className="py-3 px-3.5 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${member && (c.visitCount || 0) >= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{c.visitCount || 0}x</span></td>
                <td className="py-3 px-3.5 text-center"><button type="button" onClick={() => setHistoryCustomer(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-black" title="Lihat semua riwayat kunjungan"><History className="w-3.5 h-3.5" />{historyCount} kunjungan</button></td>
                <td className="py-3 px-3.5 text-right font-black">{formatRp(c.totalSpent)}</td>
                <td className="py-3 px-3.5 text-center text-[11px] text-slate-500">{c.lastVisit || '-'}</td>
                <td className="py-3 px-3.5 text-right"><div className="inline-flex items-center gap-1.5">
                  {member && <button type="button" onClick={() => setCardCustomer(c)} className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" title="Buka Member Card + QR"><Eye className="w-3.5 h-3.5" /></button>}
                  <button type="button" onClick={() => onToggleMembership(c.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${member ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'}`}><Crown className="inline w-3 h-3 mr-1" />{member ? 'Member Aktif' : 'Daftar Member'}</button>
                  <button type="button" onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setDeleteConfirmTarget(c)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>

    {isModalOpen && <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl"><div className="flex items-center justify-between mb-4"><h3 className="font-black text-base">{editingCustomer ? 'Perbarui Data Customer' : 'Tambah Customer Baru'}</h3><button type="button" onClick={() => setIsModalOpen(false)}><X /></button></div><form onSubmit={submitForm} className="space-y-3">
      <input required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nama Lengkap Pelanggan" className="w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
      <input required type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Nomor WhatsApp / HP" className="w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
      <div className="rounded-2xl border border-slate-200 p-3"><div className="text-[10px] font-black text-slate-500 uppercase">Kode Customer</div><div className="mt-1 font-mono font-black text-slate-900">{generateCustomerCode(formName || 'Customer', formPhone || '0000')}</div></div>
      <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 cursor-pointer"><input type="checkbox" checked={formIsMember} onChange={(e) => setFormIsMember(e.target.checked)} className="w-4 h-4 accent-amber-500" /><span><span className="block text-xs font-black text-amber-950">Jadikan Membership Customer</span><span className="block text-[10px] text-amber-800 mt-0.5">Customer akan mendapat badge Member, Member Card, QR dan sistem reward.</span></span></label>
      <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Catatan (opsional)" className="w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold min-h-20 resize-none" />
      <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs">Simpan Customer</button>
    </form></div></div>}

    {deleteConfirmTarget && <div className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl"><h3 className="font-black">Hapus Customer?</h3><p className="text-xs text-slate-500 mt-2">Data <strong>{deleteConfirmTarget.name}</strong> akan dihapus dari daftar customer.</p><div className="flex gap-2 mt-4"><button type="button" onClick={() => setDeleteConfirmTarget(null)} className="flex-1 py-2 rounded-xl bg-slate-100 font-black text-xs">Batal</button><button type="button" onClick={() => { onDeleteCustomer(deleteConfirmTarget.id); setDeleteConfirmTarget(null); }} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-black text-xs">Hapus</button></div></div></div>}

    {cardCustomer && <MembershipCardModal customer={cardCustomer} onClose={() => setCardCustomer(null)} onClaimReward={claimReward} />}

    {historyCustomer && <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3"><div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white"><div><div className="text-base font-black">Riwayat Customer</div><div className="text-xs text-slate-500 mt-0.5">{historyCustomer.name} • {historyCustomer.customerCode}</div></div><button type="button" onClick={() => setHistoryCustomer(null)} className="p-2 rounded-xl bg-slate-100"><X className="w-4 h-4" /></button></div><div className="p-4 space-y-2">{(historyCustomer.visitHistory || historyCustomer.membershipVisits || []).length === 0 ? <div className="py-10 text-center text-xs text-slate-400">Belum ada riwayat kunjungan.</div> : (historyCustomer.visitHistory || historyCustomer.membershipVisits || []).slice().reverse().map((visit, index) => <div key={visit.id || `${visit.date}-${index}`} className="rounded-2xl border border-slate-200 p-3 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-black"><CalendarDays className="w-3.5 h-3.5 text-blue-600" />{visit.date} {visit.time}</div><div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" />{visit.services?.length ? visit.services.join(', ') : 'Layanan'}</div><div className="mt-1 text-[10px] text-slate-400">Staff: {visit.staff?.join(', ') || '-'}</div></div><div className="text-right"><div className="text-xs font-black">{formatRp(visit.amount)}</div>{visit.orderId && <div className="text-[10px] text-slate-400">Order #{visit.orderId}</div>}</div></div>)}</div></div></div>}
  </div>;
};
