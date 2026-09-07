import React, { useEffect, useState } from 'react';
import { Briefcase, Clock, Layers, Plus, Percent, Save, Scissors, Shirt, Sparkles, Store, Trash2, Upload, Utensils, Wrench } from 'lucide-react';
import { StoreSettings, BusinessType } from '../types';
import { BUSINESS_PRESETS } from '../config/businessCategories';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, onShowToast }) => {
  const [businessType, setBusinessType] = useState<BusinessType>(settings.businessType);
  const [customBusinessTypeName, setCustomBusinessTypeName] = useState(settings.customBusinessTypeName || '');
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storePhone, setStorePhone] = useState(settings.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress || '');
  const [footer, setFooter] = useState(settings.footer);
  const [logoBase64, setLogoBase64] = useState(settings.logoBase64 || '');
  const [ppnEnabled, setPpnEnabled] = useState(settings.ppnEnabled ?? false);
  const [ppnRate, setPpnRate] = useState(settings.ppnRate ?? 11);
  const [shift1Start, setShift1Start] = useState(settings.shift1Start || '10:00');
  const [shift1End, setShift1End] = useState(settings.shift1End || '13:00');
  const [shift2Start, setShift2Start] = useState(settings.shift2Start || '13:00');
  const [shift2End, setShift2End] = useState(settings.shift2End || '22:00');
  const [newCat, setNewCat] = useState('');
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    setBusinessType(settings.businessType);
    setCustomBusinessTypeName(settings.customBusinessTypeName || '');
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
        const maxWidth = 250;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setLogoBase64(canvas.toDataURL('image/png'));
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
      customBusinessTypeName: newType === 'custom' ? customBusinessTypeName : '',
      categories: preset.defaultCategories,
      staffRoles: preset.defaultStaffRoles,
    });
    onShowToast(newType === 'custom' ? 'Mode usaha custom aktif.' : `Model usaha aktif: ${preset.name}!`, 'success');
  };

  const handleSaveAll = () => {
    const customName = customBusinessTypeName.trim().slice(0, 80);
    if (businessType === 'custom' && !customName) {
      onShowToast('Isi nama jenis usaha custom terlebih dahulu.', 'error');
      return;
    }
    onUpdateSettings({
      businessType,
      customBusinessTypeName: businessType === 'custom' ? customName : '',
      storeName: storeName.trim(),
      storePhone,
      storeAddress,
      footer,
      logoBase64,
      ppnEnabled,
      ppnRate: Math.min(100, Math.max(0, Number(ppnRate) || 0)),
      shift1Start,
      shift1End,
      shift2Start,
      shift2End,
    });
    onShowToast('Profil toko & pengaturan sistem berhasil disimpan!', 'success');
  };

  const addCategory = () => {
    const value = newCat.trim();
    if (!value) return;
    if (settings.categories.includes(value)) {
      onShowToast('Kategori sudah ada!', 'error');
      return;
    }
    onUpdateSettings({ categories: [...settings.categories, value] });
    setNewCat('');
    onShowToast(`Kategori "${value}" ditambahkan!`, 'success');
  };

  const addRole = () => {
    const value = newRole.trim();
    if (!value) return;
    if (settings.staffRoles.includes(value)) {
      onShowToast('Peran staf sudah ada!', 'error');
      return;
    }
    onUpdateSettings({ staffRoles: [...settings.staffRoles, value] });
    setNewRole('');
    onShowToast(`Peran staf "${value}" ditambahkan!`, 'success');
  };

  const businessOptions: Array<{ type: BusinessType; name: string; icon: React.ReactNode }> = [
    { type: 'barbershop', name: 'Barbershop & Pangkas Rambut', icon: <Scissors className="w-4 h-4" /> },
    { type: 'salon', name: 'Salon Kecantikan & Spa', icon: <Sparkles className="w-4 h-4" /> },
    { type: 'fnb', name: 'FnB (Cafe, Resto, Warmindo)', icon: <Utensils className="w-4 h-4" /> },
    { type: 'retail', name: 'Retail / Toko / Minimarket', icon: <Store className="w-4 h-4" /> },
    { type: 'laundry', name: 'Laundry Kiloan & Satuan', icon: <Shirt className="w-4 h-4" /> },
    { type: 'workshop', name: 'Bengkel & Servis Kendaraan', icon: <Wrench className="w-4 h-4" /> },
    { type: 'custom', name: 'Custom / Jenis Usaha Sendiri', icon: <Briefcase className="w-4 h-4" /> },
  ];

  const activeBusinessName = businessType === 'custom' ? (customBusinessTypeName.trim() || 'Jenis Usaha Custom') : (BUSINESS_PRESETS[businessType]?.name || businessType);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">Pengaturan Sistem & Profil Toko</h2>
        <p className="text-xs text-slate-500 font-semibold mt-1">Atur identitas usaha, model POS, pajak, kategori produk, dan peran staf.</p>
      </div>

      <section className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl p-5 shadow-md">
        <div className="flex items-center gap-2 mb-2"><Layers className="w-5 h-5" /><h3 className="font-extrabold">Model Usaha Universal</h3></div>
        <p className="text-xs text-blue-100 mb-4">Pilih template atau gunakan Custom. Jenis usaha bukan ID keamanan dan tidak memisahkan data merchant.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {businessOptions.map((option) => {
            const selected = businessType === option.type;
            return (
              <button key={option.type} type="button" onClick={() => handleBusinessTypeChange(option.type)} className={`p-3 rounded-2xl border text-left flex flex-col gap-2 ${selected ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-black/20 border-white/10 text-white'}`}>
                <div className="flex items-center justify-between"><span className="p-1.5 rounded-lg bg-white/10">{option.icon}</span>{selected && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">Aktif</span>}</div>
                <span className="text-xs font-bold leading-snug">{option.name}</span>
              </button>
            );
          })}
        </div>
        {businessType === 'custom' && (
          <div className="mt-4 p-4 bg-white/10 border border-white/20 rounded-2xl">
            <label className="block text-xs font-black mb-1.5">Nama Jenis Usaha Anda</label>
            <input type="text" maxLength={80} value={customBusinessTypeName} onChange={(e) => setCustomBusinessTypeName(e.target.value)} placeholder="Contoh: Fotocopy & Percetakan, Klinik, Florist..." className="w-full px-3 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold" />
            <div className="mt-2 text-[11px] font-bold">Preview: {activeBusinessName}</div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Profil Toko & Informasi Struk</h3>
          <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Nama usaha / toko" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
          <input type="text" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="Nomor Telepon / WhatsApp" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
          <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Alamat singkat" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
          <textarea rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Pesan bawah struk" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold" />
          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <label className="block text-xs font-bold mb-2"><Upload className="inline w-3.5 h-3.5 mr-1" />Logo Usaha</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs" />
            {logoBase64 && <div className="mt-3 flex items-center gap-3"><img src={logoBase64} alt="Preview Logo" className="h-10 w-auto object-contain" /><button type="button" onClick={() => setLogoBase64('')} className="text-xs text-blue-600 font-bold">Hapus Logo</button></div>}
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /><h3 className="font-extrabold text-sm">Pengaturan Jam Kerja Auto Shift</h3></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">Shift 1 Mulai<input type="time" value={shift1Start} onChange={(e) => setShift1Start(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded-lg" /></label>
              <label className="text-xs font-bold">Shift 1 Selesai<input type="time" value={shift1End} onChange={(e) => setShift1End(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded-lg" /></label>
              <label className="text-xs font-bold">Shift 2 Mulai<input type="time" value={shift2Start} onChange={(e) => setShift2Start(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded-lg" /></label>
              <label className="text-xs font-bold">Shift 2 Selesai<input type="time" value={shift2End} onChange={(e) => setShift2End(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded-lg" /></label>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2"><Percent className="w-4 h-4 text-emerald-600" /><h3 className="font-extrabold text-sm">Pengaturan Pajak (PPN)</h3></div>
            <label className="flex items-center justify-between text-xs font-bold"><span>Aktifkan PPN</span><input type="checkbox" checked={ppnEnabled} onChange={(e) => setPpnEnabled(e.target.checked)} className="w-5 h-5" /></label>
            {ppnEnabled && <div className="flex items-center gap-2"><input type="number" min="0" max="100" step="0.1" value={ppnRate} onChange={(e) => setPpnRate(Number(e.target.value) || 0)} className="flex-1 px-3 py-2 border rounded-xl text-xs font-bold" /><span className="text-xs font-bold">%</span></div>}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm">Kategori Produk & Layanan</h3>
          <div className="flex gap-2"><input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Tambah kategori..." className="flex-1 px-3 py-2 border rounded-xl text-xs" /><button type="button" onClick={addCategory} className="px-3 rounded-xl bg-blue-600 text-white"><Plus className="w-4 h-4" /></button></div>
          <div className="flex flex-wrap gap-2">{settings.categories.map((category) => <span key={category} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold">{category}<button type="button" onClick={() => onUpdateSettings({ categories: settings.categories.filter((item) => item !== category) })}><Trash2 className="w-3 h-3" /></button></span>)}</div>
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm">Peran Petugas Staf</h3>
          <div className="flex gap-2"><input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Tambah peran..." className="flex-1 px-3 py-2 border rounded-xl text-xs" /><button type="button" onClick={addRole} className="px-3 rounded-xl bg-blue-600 text-white"><Plus className="w-4 h-4" /></button></div>
          <div className="flex flex-wrap gap-2">{settings.staffRoles.map((role) => <span key={role} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold">{role}<button type="button" onClick={() => onUpdateSettings({ staffRoles: settings.staffRoles.filter((item) => item !== role) })}><Trash2 className="w-3 h-3" /></button></span>)}</div>
        </section>
      </div>

      <button type="button" onClick={handleSaveAll} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><Save className="w-4 h-4" />Simpan Profil & Pengaturan Sistem</button>
    </div>
  );
};
