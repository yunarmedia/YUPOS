import React, { useState, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Camera, 
  Image as ImageIcon, 
  X, 
  AlertCircle,
  Eye,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Expense } from '../types';

interface ExpensesViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string | number) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const EXPENSE_CATEGORIES = [
  'BEBAN GAJI / UPAH & KOMISI',
  'BEBAN OPERASIONAL & UMUM',
  'PERSEDIAAN / BAHAN BAKU',
  'BEBAN SEWA TEMPAT',
  'BEBAN LISTRIK, AIR & INTERNET',
  'BEBAN ALAT TULIS & PERLENGKAPAN KASIR',
  'BEBAN IKLAN & PROMOSI',
  'REFUND / RETUR PELANGGAN',
  'BIAYA ADMINISTRASI BANK',
  'PERBAIKAN & PERAWATAN ALAT',
  'PRIVE / PENARIKAN OWNER',
  'PELUNASAN HUTANG',
  'LAIN-LAIN',
];

const PAYMENT_METHODS = [
  'KAS TUNAI',
  'KAS NON PPN',
  'BANK / TRANSFER',
  'HUTANG USAHA',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [payment, setPayment] = useState<string>('KAS TUNAI');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let scale = MAX_WIDTH / img.width;
        if (scale > 1) scale = 1;

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoBase64(compressed);
          onShowToast('Foto bukti pengeluaran berhasil dilampirkan!', 'info');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) {
      onShowToast('Harap isi keterangan dan nominal pengeluaran!', 'error');
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowToast('Nominal harus lebih besar dari 0!', 'error');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];

    if (editingId !== null) {
      const existing = expenses.find((e) => String(e.id) === String(editingId));
      if (existing) {
        onUpdateExpense({
          ...existing,
          payment,
          category,
          name: name.trim(),
          amount: numAmount,
          photo: photoBase64 || existing.photo,
        });
        onShowToast('Pengeluaran berhasil diperbarui!', 'success');
      }
      resetForm();
    } else {
      onAddExpense({
        date: todayDate,
        timestamp: Date.now(),
        payment,
        category,
        name: name.trim(),
        amount: numAmount,
        photo: photoBase64,
      });
      onShowToast('Pengeluaran baru berhasil dicatat!', 'success');
      resetForm();
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setPayment(expense.payment);
    setCategory(expense.category);
    setName(expense.name);
    setAmount(expense.amount.toString());
    setPhotoBase64(expense.photo || '');
    onShowToast(`Mengedit pengeluaran: "${expense.name}"`, 'info');

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 200);
  };

  const resetForm = () => {
    setEditingId(null);
    setPayment('KAS TUNAI');
    setCategory(EXPENSE_CATEGORIES[0]);
    setName('');
    setAmount('');
    setPhotoBase64('');
  };

  const confirmDelete = () => {
    if (!deletingExpense) return;
    onDeleteExpense(deletingExpense.id);
    onShowToast(`Pengeluaran "${deletingExpense.name}" berhasil dihapus.`, 'info');
    setDeletingExpense(null);
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pencatatan Pengeluaran Operasional
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Catat arus kas keluar, beban operasional, pembelian bahan baku, dan simpan bukti nota fisik.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div ref={formRef} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              {editingId !== null ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Edit Catatan Pengeluaran</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Input Pengeluaran Baru</span>
                </>
              )}
            </h3>
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-blue-600 font-black hover:underline"
              >
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sumber Kas / Pembayaran
              </label>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Pengeluaran
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan / Rincian Pengeluaran
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Beli Pomade / Bayar Listrik / Cabe"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Biaya (Rp)
              </label>
              <input
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Foto Bukti / Nota (Opsional)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors">
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>{photoBase64 ? 'Ganti Foto' : 'Unggah Foto Nota'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {photoBase64 && (
                  <button
                    type="button"
                    onClick={() => setPhotoBase64('')}
                    className="p-2 text-red-500 hover:text-blue-700"
                    title="Hapus foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {photoBase64 && (
                <div className="mt-2 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                  <img
                    src={photoBase64}
                    alt="Nota Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-1/3 py-3 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                className={`flex-1 py-3 px-4 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
                  editingId !== null
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                }`}
              >
                {editingId !== null ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Simpan Pengeluaran</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Expenses List & Stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Card */}
          <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-100 uppercase tracking-wider">
                Total Seluruh Pengeluaran Tercatat
              </p>
              <h3 className="text-2xl font-black tracking-tight mt-0.5">
                {formatRp(totalExpense)}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-white/20 text-white backdrop-blur-sm inline-block">
                {expenses.length} Transaksi Keluar
              </span>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">
                Daftar Catatan Pengeluaran
              </h3>
              <span className="text-xs font-bold text-slate-400">
                Terurut dari yang terbaru
              </span>
            </div>

            {expenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">Belum ada pengeluaran dicatat.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Kategori & Sumber</th>
                      <th className="p-3">Keterangan / Item</th>
                      <th className="p-3">Nominal</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...expenses].reverse().map((e) => (
                      <tr 
                        key={e.id} 
                        className={`transition-colors ${
                          String(e.id) === String(editingId) ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-3 font-medium">
                          <div className="text-[11px] font-bold text-slate-800">{e.category}</div>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 inline-block mt-0.5">
                            {e.payment}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{e.name}</span>
                            {e.photo && (
                              <button
                                type="button"
                                onClick={() => setPreviewModalImg(e.photo || null)}
                                className="text-indigo-600 hover:text-indigo-800 p-1"
                                title="Lihat foto nota"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">{e.date}</span>
                        </td>
                        <td className="p-3 font-black text-blue-600 whitespace-nowrap text-sm">
                          {formatRp(e.amount)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(e)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-black text-xs flex items-center gap-1 transition-all"
                              title="Edit pengeluaran ini"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingExpense(e)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-blue-600 hover:text-blue-700 font-black text-xs flex items-center gap-1 transition-all"
                              title="Hapus pengeluaran ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-blue-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Pengeluaran?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <p className="text-slate-500 font-bold">Keterangan:</p>
              <p className="font-black text-slate-900">{deletingExpense.name}</p>
              <p className="text-slate-500 font-bold pt-1">Nominal:</p>
              <p className="font-black text-blue-600 text-sm">{formatRp(deletingExpense.amount)}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-colors shadow-md shadow-blue-600/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewModalImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-w-xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalImg}
              alt="Foto Bukti Nota"
              className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
