import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Store, 
  CheckCircle2, 
  XCircle,
  Tag
} from 'lucide-react';
import { ProductItem, ItemType, StoreSettings } from '../types';

interface InventoryViewProps {
  products: ProductItem[];
  settings: StoreSettings;
  onSaveProduct: (product: Omit<ProductItem, 'id'>, id?: string) => void;
  onDeleteProduct: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<ItemType>('service');
  const [reqStaffRole, setReqStaffRole] = useState('');
  const [available, setAvailable] = useState(true);
  const [stock, setStock] = useState('');
  const [searchKw, setSearchKw] = useState('');

  // Get active categories
  const categories = useMemo(() => {
    const list = new Set<string>(settings.categories);
    products.forEach((p) => {
      if (p.category && !p.deleted) list.add(p.category);
    });
    return Array.from(list);
  }, [settings.categories, products]);

  // Roles available for selection
  const roles = settings.staffRoles.length > 0 ? settings.staffRoles : ['Petugas', 'Kasir'];

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      onShowToast('Harap lengkapi nama dan harga!', 'error');
      return;
    }

    const numPrice = parseInt(price, 10);
    if (isNaN(numPrice) || numPrice < 0) {
      onShowToast('Harga tidak valid!', 'error');
      return;
    }

    onSaveProduct(
      {
        name,
        category: category || (categories[0] || 'Umum'),
        price: numPrice,
        type,
        reqStaffRole: reqStaffRole || roles[0],
        available,
        stock: type === 'product' && stock ? parseInt(stock, 10) : undefined,
        businessType: settings.businessType,
      },
      editingId || undefined
    );

    onShowToast(
      editingId ? 'Produk/layanan berhasil diperbarui!' : 'Produk/layanan berhasil ditambahkan!',
      'success'
    );
    resetForm();
  };

  const startEdit = (p: ProductItem) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price.toString());
    setType(p.type);
    setReqStaffRole(p.reqStaffRole);
    setAvailable(p.available);
    setStock(p.stock !== undefined ? p.stock.toString() : '');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategory(categories[0] || '');
    setPrice('');
    setType('service');
    setReqStaffRole(roles[0] || '');
    setAvailable(true);
    setStock('');
  };

  const filteredProducts = products.filter((p) => {
    if (p.deleted) return false;
    if (p.businessType && p.businessType !== settings.businessType) return false;
    return (
      p.name.toLowerCase().includes(searchKw.toLowerCase()) ||
      p.category.toLowerCase().includes(searchKw.toLowerCase())
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Manajemen Produk & Layanan
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Kelola katalog jasa layanan dan produk fisik yang dijual di kasir secara terpusat.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900">
              {editingId ? 'Edit Produk / Layanan' : 'Tambah Produk / Jasa'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Type selector (Service vs Product) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Jenis Item
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('service')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    type === 'service'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Jasa / Layanan
                </button>
                <button
                  type="button"
                  onClick={() => setType('product')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    type === 'product'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Barang / Fisik
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Layanan / Produk
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Potong Rambut Fade / Minyak Goreng"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category || categories[0] || ''}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Jual (Rp)
              </label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {type === 'product' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Stok (Opsional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Jumlah unit tersedia"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Peran Petugas Penanggung Jawab
              </label>
              <select
                value={reqStaffRole || roles[0]}
                onChange={(e) => setReqStaffRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Ketersediaan
              </label>
              <select
                value={available ? 'true' : 'false'}
                onChange={(e) => setAvailable(e.target.value === 'true')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Tersedia (Ready)</option>
                <option value="false">Habis / Tidak Tersedia</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              {editingId ? 'Simpan Perubahan' : 'Simpan Produk / Jasa'}
            </button>
          </form>
        </div>

        {/* Product List Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchKw}
                onChange={(e) => setSearchKw(e.target.value)}
                placeholder="Cari nama menu / layanan..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs font-black text-slate-500 shrink-0">
              Total Item: {filteredProducts.length}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Tag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500">Tidak ada produk ditemukan.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-200">
                    <th className="p-3">Nama & Jenis</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Harga</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isService = p.type === 'service';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                isService
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isService ? 'JASA' : 'BARANG'}
                            </span>
                            <span className="font-bold text-slate-900">{p.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Petugas: {p.reqStaffRole} {p.stock !== undefined ? `| Stok: ${p.stock}` : ''}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-600">{p.category}</td>
                        <td className="p-3 font-black text-blue-600 whitespace-nowrap">
                          {formatRp(p.price)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {p.available ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Tersedia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-extrabold text-[11px]">
                              <XCircle className="w-3.5 h-3.5" />
                              Habis
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(p)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              title="Edit item"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Hapus "${p.name}"?`)) {
                                  onDeleteProduct(p.id);
                                  onShowToast('Produk dihapus!', 'info');
                                }
                              }}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-blue-700"
                              title="Hapus item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
