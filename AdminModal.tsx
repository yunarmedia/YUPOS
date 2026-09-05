import React, { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, Check, ShieldAlert, FileText, Trash2, Edit3 } from 'lucide-react';
import { StoreSettings, PortalPins } from '../types';

interface AdminModalProps {
  settings: StoreSettings;
  onUpdatePins: (pins: PortalPins) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  settings,
  onUpdatePins,
  onShowToast,
}) => {
  const [pins, setPins] = useState<PortalPins>({
    admin: settings.portalPins?.admin || '2024UDC',
    expenses: settings.portalPins?.expenses || '',
    inventory: settings.portalPins?.inventory || '',
    staff: settings.portalPins?.staff || '',
    settings: settings.portalPins?.settings || '',
    historyDeletePin: settings.portalPins?.historyDeletePin || '',
    historyEditPin: settings.portalPins?.historyEditPin || '',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePins(pins);
    onShowToast('Sandi keamanan & otorisasi admin berhasil disimpan!', 'success');
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Ruang Kontrol & Keamanan Admin
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Atur kata sandi akses ruang admin, otorisasi edit & hapus riwayat transaksi, serta kunci portal kasir.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-amber-200/80 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 font-bold leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Otoritas & Keamanan:</strong> Sandi di bawah ini digunakan untuk melindungi tindakan sensitif seperti menghapus nota transaksi, mengedit pesanan kasir, dan membuka ruang admin.
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Master Admin Password */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Sandi Utama Akses Admin Kontrol
            </h4>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Password Admin Kontrol (Default: 2024UDC)
              </label>
              <input
                type="text"
                value={pins.admin}
                onChange={(e) => setPins({ ...pins, admin: e.target.value })}
                placeholder="2024UDC"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Transaction Security: Delete & Edit */}
          <div className="p-4 bg-red-50/60 rounded-2xl border border-red-100 space-y-3">
            <h4 className="text-xs font-black text-red-950 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Otoritas Riwayat Transaksi
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  Sandi Edit Transaksi
                </label>
                <input
                  type="password"
                  value={pins.historyEditPin}
                  onChange={(e) => setPins({ ...pins, historyEditPin: e.target.value })}
                  placeholder="Kosongkan jika bebas edit..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Diminta saat kasir ingin mengedit item / diskon / pembayaran.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5 text-blue-600" />
                  Sandi Hapus Transaksi
                </label>
                <input
                  type="password"
                  value={pins.historyDeletePin}
                  onChange={(e) => setPins({ ...pins, historyDeletePin: e.target.value })}
                  placeholder="Kosongkan jika bebas hapus..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Diminta saat kasir ingin menghapus pesanan dari database.
                </span>
              </div>
            </div>
          </div>

          {/* Portal Locks */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-600" />
              Sandi Pembatasan Portal Fitur
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Portal PENGELUARAN
                </label>
                <input
                  type="password"
                  value={pins.expenses}
                  onChange={(e) => setPins({ ...pins, expenses: e.target.value })}
                  placeholder="Kosongkan jika bebas akses..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Portal PRODUK & JASA
                </label>
                <input
                  type="password"
                  value={pins.inventory}
                  onChange={(e) => setPins({ ...pins, inventory: e.target.value })}
                  placeholder="Kosongkan jika bebas akses..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Portal KARYAWAN & SHIFT
                </label>
                <input
                  type="password"
                  value={pins.staff}
                  onChange={(e) => setPins({ ...pins, staff: e.target.value })}
                  placeholder="Kosongkan jika bebas akses..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Portal PENGATURAN SISTEM
                </label>
                <input
                  type="password"
                  value={pins.settings}
                  onChange={(e) => setPins({ ...pins, settings: e.target.value })}
                  placeholder="Kosongkan jika bebas akses..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Simpan Seluruh Pengaturan Sandi & Keamanan
          </button>
        </form>
      </div>
    </div>
  );
};
