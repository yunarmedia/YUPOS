import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Upload, 
  Check, 
  Scissors, 
  Sparkles, 
  Utensils, 
  Shirt, 
  Wrench, 
  Briefcase,
  Layers,
  Plus,
  Trash2,
  Percent,
  Receipt,
  Save,
  Clock
} from 'lucide-react';
import { StoreSettings, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onShowToast,
}) => {
  const [businessType, setBusinessType] = useState<BusinessType>(settings.businessType);
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storePhone, setStorePhone] = useState(settings.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress || '');
  const [footer, setFooter] = useState(settings.footer);
  const [logoBase64, setLogoBase64] = useState(settings.logoBase64 || '');
  const [ppnEnabled, setPpnEnabled] = useState(settings.ppnEnabled ?? false);
  const [ppnRate, setPpnRate] = useState<number>(settings.ppnRate ?? 11);

  // Auto Shift custom hours
  const [shift1Start, setShift1Start] = useState(settings.shift1Start || '10:00');
  const [shift1End, setShift1End] = useState(settings.shift1End || '13:00');
  const [shift2Start, setShift2Start] = useState(settings.shift2Start || '13:00');
  const [shift2End, setShift2End] = useState(settings.shift2End || '22:00');

  const [newCat, setNewCat] = useState('');
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    setBusinessType(settings.businessType);
    setStoreName(settings.storeName);
    setStorePhone(settings.storePhone || '');
    setStoreAddress(settings.storeAddress || '');
    setFooter(settings.footer);
    setLogoBase64(settings.logoBase64 || '');
    setPpnEnabled(settings.ppnEnabled ?? false);
    setPpnRate(settings.ppnRate ?? 11);
    setShift1Start(settings.shift1Start || '10:00');
    setShift1End(settings.shift1End || '13:00');
    setShift2Start(settings.shift2Start || '13:00');
    setShift2End(settings.shift2End || '22:00');
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        let scale = MAX_WIDTH / img.width;
        if (scale > 1) scale = 1;

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/png');
          setLogoBase64(compressed);
          onShowToast('Logo toko berhasil diunggah!', 'success');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessTypeChange = (newType: BusinessType) => {
    const preset = BUSINESS_PRESETS[newType];
    setBusinessType(newType);
    onUpdateSettings({
      businessType: newType,
      categories: preset.defaultCategories,
      staffRoles: preset.defaultStaffRoles,
    });
    onShowToast(`Model usaha aktif: ${preset.name}!`, 'success');
  };

  const handleSaveAll = () => {
    onUpdateSettings({
      businessType,
      storeName,
      storePhone,
      storeAddress,
      footer,
      logoBase64,
      ppnEnabled,
      ppnRate: Number(ppnRate) || 0,
      shift1Start,
      shift1End,
      shift2Start,
      shift2End,
    });
    onShowToast('Profil toko & pengaturan sistem berhasil disimpan!', 'success');
  };

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    if (settings.categories.includes(newCat.trim())) {
      onShowToast('Kategori sudah ada!', 'error');
      return;
    }
    const updated = [...settings.categories, newCat.trim()];
    onUpdateSettings({ categories: updated });
    setNewCat('');
    onShowToast(`Kategori "${newCat}" ditambahkan!`, 'success');
  };

  const handleDeleteCategory = (cat: string) => {
    const updated = settings.categories.filter((c) => c !== cat);
    onUpdateSettings({ categories: updated });
    onShowToast(`Kategori "${cat}" dihapus!`, 'info');
  };

  const handleAddRole = () => {
    if (!newRole.trim()) return;
    if (settings.staffRoles.includes(newRole.trim())) {
      onShowToast('Peran staf sudah ada!', 'error');
      return;
    }
    const updated = [...settings.staffRoles, newRole.trim()];
    onUpdateSettings({ staffRoles: updated });
    setNewRole('');
    onShowToast(`Peran staf "${newRole}" ditambahkan!`, 'success');
  };

  const handleDeleteRole = (role: string) => {
    const updated = settings.staffRoles.filter((r) => r !== role);
    onUpdateSettings({ staffRoles: updated });
    onShowToast(`Peran staf "${role}" dihapus!`, 'info');
  };

  const businessOptions: { type: BusinessType; name: string; icon: any }[] = [
    { type: 'barbershop', name: 'Barbershop & Pangkas Rambut', icon: <Scissors className="w-4 h-4" /> },
    { type: 'salon', name: 'Salon Kecantikan & Spa', icon: <Sparkles className="w-4 h-4" /> },
    { type: 'fnb', name: 'FnB (Cafe, Resto, Warmindo)', icon: <Utensils className="w-4 h-4" /> },
    { type: 'retail', name: 'Retail / Toko / Minimarket', icon: <Store className="w-4 h-4" /> },
    { type: 'laundry', name: 'Laundry Kiloan & Satuan', icon: <Shirt className="w-4 h-4" /> },
    { type: 'workshop', name: 'Bengkel & Servis Kendaraan', icon: <Wrench className="w-4 h-4" /> },
    { type: 'custom', name: 'Usaha Jasa & Bisnis Lainnya', icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pengaturan Sistem & Profil Toko
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Atur jenis model usaha, identitas toko pada struk kasir, pajak PPN, dan kategori produk.
        </p>
      </div>

      {/* Business Model Selector */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-blue-200" />
          <h3 className="font-extrabold text-base tracking-tight">
            Pilih Model Kategori Usaha Kasir
          </h3>
        </div>
        <p className="text-xs text-blue-100 mb-4 max-w-2xl">
          YuPOS dirancang universal untuk segala jenis usaha. Memilih kategori akan menyesuaikan istilah
          layanan, peran petugas (seperti Capster, Stylist, Barista, Mekanik), dan kategori produk.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {businessOptions.map((b) => {
            const isSelected = businessType === b.type;
            return (
              <button
                key={b.type}
                type="button"
                onClick={() => handleBusinessTypeChange(b.type)}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 border-white shadow-lg font-black scale-[1.02]'
                    : 'bg-black/20 hover:bg-black/30 border-white/10 text-white font-bold'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-red-50 text-blue-600' : 'bg-white/10'}`}>
                    {b.icon}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <span className="text-xs leading-snug">{b.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Profil Toko & Informasi Struk
            </h3>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Usaha / Toko
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Nama toko Anda..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Singkat
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Kota / Cabang"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pesan Bawah Struk (Footer)
              </label>
              <textarea
                rows={3}
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Pesan ucapan terima kasih dan info kontak..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Logo upload */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                Logo Usaha (Untuk Cetak Struk)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-blue-700 hover:file:bg-red-100 cursor-pointer"
              />
              {logoBase64 && (
                <div className="mt-3 flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 w-fit">
                  <img src={logoBase64} alt="Preview Logo" className="h-10 w-auto object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoBase64('');
                      onShowToast('Logo toko dihapus!', 'info');
                    }}
                    className="text-[11px] text-blue-600 font-bold hover:underline"
                  >
                    Hapus Logo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Auto Shift Custom Hours Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Pengaturan Jam Kerja Auto Shift
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                Shift {settings.activeShift} Aktif
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Atur jam pergantian otomatis antara Shift 1 (pagi/siang) dan Shift 2 (sore/malam). Sistem kasir akan berganti shift secara otomatis sesuai rentang jam ini.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Shift 1 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    Shift 1 ({settings.shift1Name || 'Pagi'})
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">Pagi/Siang</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Mulai</label>
                    <input
                      type="time"
                      value={shift1Start}
                      onChange={(e) => setShift1Start(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Selesai</label>
                    <input
                      type="time"
                      value={shift1End}
                      onChange={(e) => setShift1End(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Shift 2 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    Shift 2 ({settings.shift2Name || 'Sore'})
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">Sore/Malam</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Mulai</label>
                    <input
                      type="time"
                      value={shift2Start}
                      onChange={(e) => setShift2Start(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Selesai</label>
                    <input
                      type="time"
                      value={shift2End}
                      onChange={(e) => setShift2End(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PPN & Tax Configuration Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Pengaturan Pajak (PPN)
              </h3>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 mb-4">
              Aktifkan perhitungan PPN untuk otomatis menambahkan persentase pajak pada setiap transaksi kasir
              dan mencantumkan rincian PPN pada struk pembayaran pelanggan.
            </p>

            <div className="space-y-4">
              {/* PPN Toggle */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label className="font-extrabold text-xs text-slate-900 block cursor-pointer">
                    Aktifkan Fitur PPN Transaksi
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {ppnEnabled ? 'PPN diterapkan pada kalkulasi kasir' : 'Transaksi bebas PPN (0%)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={ppnEnabled}
                  onChange={(e) => setPpnEnabled(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* PPN Rate Input */}
              {ppnEnabled && (
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-emerald-900">
                    Tarif Persentase PPN (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={ppnRate}
                        onChange={(e) => setPpnRate(Number(e.target.value) || 0)}
                        placeholder="11"
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-2 text-xs font-extrabold text-emerald-700">
                        %
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[10, 11, 12].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setPpnRate(rate)}
                          className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            ppnRate === rate
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    * Tarif PPN standar Indonesia adalah 11% (atau disesuaikan dengan ketentuan usaha).
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            className="w-full mt-4 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Profil & Pengaturan Sistem</span>
          </button>
        </div>
      </div>
    </div>

      {/* Category & Staff Role Manager */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Category Manager */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900">
            Daftar Kategori Katalog Produk & Layanan
          </h3>
          <p className="text-[11px] text-slate-500">
            Kategori ini akan otomatis muncul sebagai pilihan dropdown pada formulir penambahan produk.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Tambah kategori baru..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddCategory}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 max-h-48 overflow-y-auto">
            {settings.categories.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                {c}
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c)}
                  className="text-slate-400 hover:text-blue-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Roles Manager */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900">
            Peran Petugas Staf
          </h3>
          <p className="text-[11px] text-slate-500">
            Peran ini akan otomatis muncul sebagai pilihan dropdown penanggung jawab pengerjaan layanan.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Tambah peran baru..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddRole}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 max-h-48 overflow-y-auto">
            {settings.staffRoles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                {r}
                <button
                  type="button"
                  onClick={() => handleDeleteRole(r)}
                  className="text-slate-400 hover:text-blue-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
