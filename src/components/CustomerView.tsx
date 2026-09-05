import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  Crown, 
  Phone, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  X, 
  Sparkles,
  Award,
  Hash,
  ShoppingBag,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { Customer } from '../types';
import { MembershipBadge } from './MembershipBadge';
import { generateCustomerCode } from '../services/customerService';
import * as XLSX from 'xlsx';

interface CustomerViewProps {
  customers: Customer[];
  onSaveCustomer: (customerData: Omit<Customer, 'id'>, id?: string) => void;
  onDeleteCustomer: (id: string) => void;
  onToggleMembership: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  customers,
  onSaveCustomer,
  onDeleteCustomer,
  onToggleMembership,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'members' | 'regular'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Customer | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsMember, setFormIsMember] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  // Auto-calculated customer code preview
  const previewCode = useMemo(() => {
    if (!formName.trim() && !formPhone.trim()) return '--';
    return generateCustomerCode(formName || 'Customer', formPhone || '0000');
  }, [formName, formPhone]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = 
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.phone.includes(q);

      if (!matchSearch) return false;

      if (activeFilter === 'members') return c.isMember;
      if (activeFilter === 'regular') return !c.isMember;
      return true;
    });
  }, [customers, searchQuery, activeFilter]);

  // Statistics
  const totalCustomers = customers.length;
  const totalMembers = customers.filter((c) => c.isMember).length;
  const totalVisits = customers.reduce((acc, c) => acc + (c.visitCount || 0), 0);
  const avgVisits = totalCustomers > 0 ? (totalVisits / totalCustomers).toFixed(1) : '0';

  const formatRp = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormIsMember(false);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormIsMember(c.isMember);
    setFormNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onShowToast('Nama customer wajib diisi!', 'error');
      return;
    }
    if (!formPhone.trim()) {
      onShowToast('Nomor telepon customer wajib diisi!', 'error');
      return;
    }

    const code = generateCustomerCode(formName, formPhone);

    if (editingCustomer) {
      onSaveCustomer(
        {
          name: formName.trim(),
          phone: formPhone.trim(),
          customerCode: code,
          visitCount: editingCustomer.visitCount,
          isMember: formIsMember,
          memberSince: formIsMember 
            ? (editingCustomer.memberSince || new Date().toISOString().split('T')[0]) 
            : undefined,
          totalSpent: editingCustomer.totalSpent,
          lastVisit: editingCustomer.lastVisit,
          notes: formNotes.trim(),
        },
        editingCustomer.id
      );
      onShowToast(`Data customer "${formName}" berhasil diperbarui!`, 'success');
    } else {
      onSaveCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        customerCode: code,
        visitCount: 0,
        isMember: formIsMember,
        memberSince: formIsMember ? new Date().toISOString().split('T')[0] : undefined,
        totalSpent: 0,
        lastVisit: '-',
        notes: formNotes.trim(),
        createdAt: Date.now(),
      });
      onShowToast(`Customer baru "${formName}" [${code}] berhasil ditambahkan!`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    onDeleteCustomer(deleteConfirmTarget.id);
    onShowToast(`Customer "${deleteConfirmTarget.name}" telah dihapus!`, 'info');
    setDeleteConfirmTarget(null);
  };

  // Export Customer list to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const rows = customers.map((c, idx) => ({
        'No': idx + 1,
        'Kode Unik': c.customerCode,
        'Nama Pelanggan': c.name,
        'Nomor WhatsApp/HP': c.phone,
        'Status Membership': c.isMember ? 'MEMBERSHIP CUSTOMER' : 'Reguler',
        'Tanggal Bergabung Member': c.memberSince || '-',
        'Jumlah Kunjungan': `${c.visitCount || 0}x`,
        'Total Belanja (Rp)': c.totalSpent || 0,
        'Kunjungan Terakhir': c.lastVisit || '-',
        'Catatan Khusus': c.notes || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Customer');
      XLSX.writeFile(workbook, `YuPOS_Data_Customer_${new Date().toISOString().split('T')[0]}.xlsx`);
      onShowToast('Data customer berhasil diekspor ke Excel (.xlsx)!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      onShowToast('Gagal mengekspor data customer ke Excel.', 'error');
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5 overflow-auto overscroll-contain min-h-0 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Data Pelanggan & Membership
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">
              {totalCustomers} Customer
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Manajemen direktori pelanggan, pencatatan loyalitas kunjungan, dan status keanggotaan Membership Customer.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Customer Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Total Pelanggan</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalCustomers}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Semua data tersimpan</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50/70 rounded-2xl border border-amber-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-black">Membership Customer</span>
            <Crown className="w-4 h-4 text-amber-600 fill-amber-600/20" />
          </div>
          <p className="text-2xl font-black text-amber-950">{totalMembers}</p>
          <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Pelanggan prioritas VIP</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Total Kunjungan</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalVisits}x</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Akumulasi seluruh transaksi</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Rata-rata Kunjungan</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{avgVisits}x</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Per pelanggan terdaftar</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kode unik (misal: BU7890), atau nomor telepon..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({totalCustomers})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('members')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeFilter === 'members'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              <span>Membership ({totalMembers})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('regular')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                activeFilter === 'regular'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reguler ({totalCustomers - totalMembers})
            </button>
          </div>
        </div>

        {/* Customer Table List */}
        <div className="overflow-auto rounded-xl border border-slate-200 max-h-[62dvh]">
          <table className="w-full min-w-[980px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <th className="py-3 px-3.5">Kode Unik</th>
                <th className="py-3 px-3.5">Nama Pelanggan</th>
                <th className="py-3 px-3.5">No. WhatsApp/HP</th>
                <th className="py-3 px-3.5 text-center">Kunjungan</th>
                <th className="py-3 px-3.5 text-right">Total Belanja</th>
                <th className="py-3 px-3.5 text-center">Terakhir Berkunjung</th>
                <th className="py-3 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                    Tidak ada data customer yang cocok dengan filter / pencarian.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Unique Customer Code */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-yellow-300 border border-slate-700 shadow-2xs">
                        <Hash className="w-3 h-3 text-yellow-400" />
                        {c.customerCode}
                      </span>
                    </td>

                    {/* Customer Name + Membership Customer Badge */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {c.name}
                        </span>
                        {c.isMember && <MembershipBadge size="sm" />}
                      </div>
                      {c.notes && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5 max-w-xs truncate">
                          {c.notes}
                        </p>
                      )}
                    </td>

                    {/* Phone Number */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <a
                        href={`https://wa.me/${c.phone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-700 hover:text-emerald-600 font-bold inline-flex items-center gap-1 transition-colors"
                        title="Chat WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{c.phone}</span>
                      </a>
                    </td>

                    {/* Visit Count */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${
                        c.visitCount >= 5 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.visitCount || 0}x Kunjungan
                      </span>
                    </td>

                    {/* Total Spent */}
                    <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      {formatRp(c.totalSpent || 0)}
                    </td>

                    {/* Last Visit */}
                    <td className="py-3 px-3.5 text-center text-[11px] text-slate-500 whitespace-nowrap">
                      {c.lastVisit || '-'}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleMembership(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all ${
                            c.isMember
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                              : 'bg-slate-100 hover:bg-yellow-100 text-slate-700 hover:text-amber-900'
                          }`}
                          title={c.isMember ? 'Cabut Status Member' : 'Jadikan Membership Customer'}
                        >
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>{c.isMember ? 'Member Aktif' : 'Daftar Member'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget(c)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Hapus Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Customer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-50 text-blue-600">
                  {editingCustomer ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <h3 className="font-black text-base text-slate-900">
                  {editingCustomer ? 'Perbarui Data Customer' : 'Tambah Customer Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp / HP *
                </label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Unique Code Preview Badge */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Kode Unik Customer (Otomatis)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    2 Huruf Depan + 4 Angka Terakhir HP
                  </span>
                </div>
                <span className="font-mono font-black text-sm px-3 py-1 bg-slate-900 text-yellow-300 rounded-lg shadow-xs">
                  {previewCode}
                </span>
              </div>

              {/* Membership Toggle */}
              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-xs text-amber-950">
                    <Crown className="w-4 h-4 text-amber-600 fill-amber-600/30" />
                    <span>Daftarkan Sebagai Member VIP</span>
                  </div>
                  <p className="text-[10px] text-amber-800">
                    Mendapatkan tanda emas mengkilap "Membership Customer".
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsMember}
                  onChange={(e) => setFormIsMember(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Catatan preferensi layanan, produk favorit, dsb..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all"
                >
                  {editingCustomer ? 'Simpan Perubahan' : 'Simpan Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Guaranteed to work in iframe without window.confirm) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-blue-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Hapus Data Customer?
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda yakin ingin menghapus <strong>{deleteConfirmTarget.name}</strong> [{deleteConfirmTarget.customerCode}] dari daftar customer?
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
