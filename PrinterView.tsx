import React, { useState } from 'react';
import { 
  Printer, 
  Bluetooth, 
  CheckCircle2, 
  HelpCircle, 
  Wifi, 
  FileText, 
  Settings2,
  RefreshCw,
  Sliders,
  Unlink,
  ExternalLink,
  Zap,
  PrinterCheck
} from 'lucide-react';
import { StoreSettings } from '../types';

interface PrinterViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onTestPrint: () => void;
  onBrowserTestPrint?: () => void;
  onConnectPrinter: (type: 'kasir' | 'dapur') => void;
  onDisconnectPrinter?: (type: 'kasir' | 'dapur') => void;
  btStatusKasir: string;
  btStatusDapur: string;
}

export const PrinterView: React.FC<PrinterViewProps> = ({
  settings,
  onUpdateSettings,
  onShowToast,
  onTestPrint,
  onBrowserTestPrint,
  onConnectPrinter,
  onDisconnectPrinter,
  btStatusKasir,
  btStatusDapur,
}) => {
  const [btAutoPrint, setBtAutoPrint] = useState(settings.btAutoPrint);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(settings.printerPaperWidth || '58mm');

  const isBluetoothSupported = typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

  const handleToggleAutoPrint = (val: boolean) => {
    setBtAutoPrint(val);
    onUpdateSettings({ btAutoPrint: val });
    onShowToast(
      val 
        ? 'Cetak otomatis AKTIF! Setiap transaksi selesai akan langsung dikirim ke printer.' 
        : 'Cetak otomatis dinonaktifkan.',
      'info'
    );
  };

  const handlePaperWidthChange = (val: '58mm' | '80mm') => {
    setPaperWidth(val);
    onUpdateSettings({ printerPaperWidth: val });
    onShowToast(`Ukuran kertas struk diatur ke ${val}.`, 'success');
  };

  const isKasirConnected = btStatusKasir.includes('🟢');
  const isDapurConnected = btStatusDapur.includes('🟢');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Printer className="w-6 h-6 text-blue-600" />
          Koneksi & Pengaturan Printer Bluetooth
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Kelola perangkat printer thermal Bluetooth ESC/POS (58mm/80mm) untuk cetak struk kasir otomatis dan manual.
        </p>
      </div>

      {/* Web Bluetooth Compatibility Notice */}
      {!isBluetoothSupported && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <h4 className="font-extrabold text-amber-950">
              Web Bluetooth API Tidak Terdeteksi di Browser Ini
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
              Untuk menghubungkan printer via Bluetooth langsung, gunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> (di Android, Windows, Mac, Chromebook). Jika berada di dalam mode pratinjau AI Studio, Anda dapat membuka aplikasi di <strong>Tab Baru</strong> agar browser memberikan izin akses Bluetooth perangkat Anda. Anda tetap dapat mencetak struk menggunakan <strong>Dialog Cetak Sistem / USB</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Printer Kasir */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isKasirConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-blue-600'}`}>
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Printer Kasir Utama</h3>
                  <p className="text-[11px] font-semibold text-slate-400">Untuk struk bukti pembayaran pelanggan</p>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isKasirConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isKasirConnected ? 'Terhubung' : 'Terputus'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Perangkat:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[180px]">{btStatusKasir}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Protokol:</span>
                <span className="font-extrabold text-slate-900">ESC/POS Bluetooth BLE</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Auto-Print:</span>
                <span className={`font-extrabold ${btAutoPrint ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {btAutoPrint ? 'Aktif Otomatis' : 'Manual'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {isKasirConnected ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onTestPrint}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <PrinterCheck className="w-4 h-4" />
                  <span>Test Cetak Kasir</span>
                </button>
                {onDisconnectPrinter && (
                  <button
                    type="button"
                    onClick={() => onDisconnectPrinter('kasir')}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-extrabold flex items-center justify-center transition-colors border border-slate-200"
                    title="Putuskan sambungan"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onConnectPrinter('kasir')}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Sambungkan Printer Kasir</span>
              </button>
            )}
          </div>
        </div>

        {/* Printer Dapur / Petugas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isDapurConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'}`}>
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Printer Dapur / Petugas</h3>
                  <p className="text-[11px] font-semibold text-slate-400">Untuk tiket pesanan dapur / ruang kerja</p>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isDapurConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isDapurConnected ? 'Terhubung' : 'Terputus'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Perangkat:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[180px]">{btStatusDapur}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Protokol:</span>
                <span className="font-extrabold text-slate-900">Bluetooth ESC/POS</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Fungsi:</span>
                <span className="font-extrabold text-slate-700">Tiket Dapur / Order Slip</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {isDapurConnected ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onTestPrint}
                  className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <PrinterCheck className="w-4 h-4" />
                  <span>Test Cetak Dapur</span>
                </button>
                {onDisconnectPrinter && (
                  <button
                    type="button"
                    onClick={() => onDisconnectPrinter('dapur')}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-extrabold flex items-center justify-center transition-colors border border-slate-200"
                    title="Putuskan sambungan"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onConnectPrinter('dapur')}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-slate-900/20"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Sambungkan Printer Dapur</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preferences & Test Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-700" />
          Opsi Cetak Otomatis & Konfigurasi Kertas Struk
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto Print Toggle */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <label className="font-extrabold text-xs text-slate-900 block cursor-pointer flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Cetak Otomatis Setelah Bayar
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Langsung mencetak struk begitu transaksi kasir diselesaikan tanpa perlu klik tombol cetak lagi
              </span>
            </div>
            <input
              type="checkbox"
              checked={btAutoPrint}
              onChange={(e) => handleToggleAutoPrint(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Paper Width Selection */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <label className="font-extrabold text-xs text-slate-900 block">
                Lebar Kertas Struk Thermal
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Sesuaikan lebar kolom (58mm = 32 karakter, 80mm = 48 karakter)
              </span>
            </div>
            <div className="flex gap-1.5 bg-white p-1 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => handlePaperWidthChange('58mm')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  paperWidth === '58mm' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => handlePaperWidthChange('80mm')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  paperWidth === '80mm' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80 mm
              </button>
            </div>
          </div>
        </div>

        {/* Test Print Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-red-50/60 rounded-xl border border-red-100">
          <div>
            <h4 className="font-black text-xs text-red-900">Uji Coba Cetak Struk Kasir (Manual)</h4>
            <p className="text-[11px] text-blue-700 font-medium">
              Kirimkan format struk pengujian ke printer Bluetooth yang sedang terhubung atau cetak via sistem browser.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onTestPrint}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Test Cetak Bluetooth</span>
            </button>
            {onBrowserTestPrint && (
              <button
                type="button"
                onClick={onBrowserTestPrint}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Test Cetak Browser</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Technical Guidance */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          Panduan & Tips Penggunaan Printer Thermal
        </h4>
        <ul className="list-disc list-inside space-y-1 text-[11px] font-medium text-slate-500 leading-relaxed">
          <li><strong>Mendukung Semua Tipe Printer:</strong> Kompatibel dengan printer mini 58mm & 80mm ESC/POS (RPP02N, Panda, Goojprt, Iware, MPT-II, POS-58, Epson, dll).</li>
          <li><strong>Cetak Otomatis:</strong> Aktifkan <em>"Cetak Otomatis Setelah Bayar"</em> di atas agar setiap transaksi di halaman kasir langsung dicetak tanpa jeda.</li>
          <li><strong>Cetak Manual:</strong> Anda juga dapat mencetak struk secara manual kapan saja dari keranjang kasir (Cetak Struk Sementara) atau dari halaman Riwayat Transaksi (tombol <em>Print</em>).</li>
          <li><strong>Fallback Cetak Browser:</strong> Bila printer Bluetooth belum terhubung, sistem otomatis membuka jendela dialog cetak browser (mendukung printer kabel USB & thermal driver).</li>
        </ul>
      </div>
    </div>
  );
};
