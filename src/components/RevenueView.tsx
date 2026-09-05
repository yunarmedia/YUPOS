import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Calendar, 
  Coins, 
  Copy, 
  FileSpreadsheet, 
  Share2, 
  Sun, 
  Moon, 
  DollarSign, 
  TrendingUp, 
  Receipt,
  CheckCircle2,
  Wallet,
  Layers
} from 'lucide-react';
import { Order, Expense, StoreSettings } from '../types';

interface RevenueViewProps {
  orders: Order[];
  expenses: Expense[];
  pettyCash: number;
  onSavePettyCash: (val: number) => void;
  settings: StoreSettings;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigateToExtract?: () => void;
}

export const RevenueView: React.FC<RevenueViewProps> = ({
  orders,
  expenses,
  pettyCash,
  onSavePettyCash,
  settings,
  onShowToast,
  onNavigateToExtract,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [pettyCashInput, setPettyCashInput] = useState<string>(pettyCash.toString());

  // Date formatting helpers
  const targetDateFormatted = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('id-ID');
    }
    return '';
  }, [selectedDate]);

  // Calculations for chosen date
  const stats = useMemo(() => {
    let s1Cash = 0;
    let s1Qris = 0;
    let s2Cash = 0;
    let s2Qris = 0;
    let shopee = 0;
    let gofood = 0;
    let grab = 0;
    let totalCash = 0;
    let totalQris = 0;
    let totalOnline = 0;

    orders.forEach((o) => {
      if (o.status !== 'selesai') return;
      if (o.date === selectedDate || o.date === targetDateFormatted) {
        const isCash = o.payment === 'Cash';
        const isOnline = ['Shopeefood', 'Gofood', 'Grabfood'].includes(o.payment);

        if (isCash) totalCash += o.total;
        else if (isOnline) totalOnline += o.total;
        else totalQris += o.total;

        if (o.payment === 'Shopeefood') shopee += o.total;
        else if (o.payment === 'Gofood') gofood += o.total;
        else if (o.payment === 'Grabfood') grab += o.total;
        else if (o.shift === '1') {
          if (isCash) s1Cash += o.total;
          else s1Qris += o.total;
        } else {
          if (isCash) s2Cash += o.total;
          else s2Qris += o.total;
        }
      }
    });

    const dayExpenses = expenses.filter(
      (e) => e.date === selectedDate || e.date === targetDateFormatted
    );
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Filter cash expenses for physical drawer balance
    const cashExpenses = dayExpenses
      .filter((e) => e.payment === 'KAS TUNAI' || e.payment === 'KAS NON PPN')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDrawerCash = totalCash + pettyCash;
    const physicalCashRemaining = totalDrawerCash - cashExpenses;

    return {
      s1Cash,
      s1Qris,
      s1Total: s1Cash + s1Qris,
      s2Cash,
      s2Qris,
      s2Total: s2Cash + s2Qris,
      shopee,
      gofood,
      grab,
      totalOnline,
      totalCash,
      totalQris,
      grandTotal: totalCash + totalQris + totalOnline,
      dayExpenses,
      totalExpenses,
      cashExpenses,
      totalDrawerCash,
      physicalCashRemaining,
    };
  }, [orders, expenses, selectedDate, targetDateFormatted, pettyCash]);

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleSavePetty = () => {
    const val = Number(pettyCashInput) || 0;
    onSavePettyCash(val);
    onShowToast('Modal awal (petty cash) berhasil diperbarui!', 'success');
  };

  const formatReportRp = (num: number) => {
    return `Rp. ${Math.round(num).toLocaleString('id-ID')}`;
  };

  // Generate WA formatted report
  const generateReportText = () => {
    const parts = selectedDate.split('-');
    const day = parseInt(parts[2] || '1', 10);
    const month = parseInt(parts[1] || '1', 10);
    const year = parts[0] || '2026';
    const dateFormatted = `${day}/${month}/${year}`;

    let report = `*OMZET TGL ${dateFormatted}*\n\n`;
    report += `CASH: ${formatReportRp(stats.totalCash)}\n`;
    report += `QRIS: ${formatReportRp(stats.totalQris)}\n`;
    report += `TOTAL: ${formatReportRp(stats.totalCash + stats.totalQris)}\n`;
    report += `__________________________\n`;
    report += `CASH: ${formatReportRp(stats.totalCash)}\n`;
    report += `PETTY CASH: ${formatReportRp(pettyCash)}\n`;
    report += `TOTAL CASH: ${formatReportRp(stats.totalDrawerCash)}\n`;
    report += `__________________________\n`;
    report += `*PENGELUARAN*\n\n`;

    if (stats.dayExpenses.length === 0) {
      report += `# Tidak ada pengeluaran  : Rp. 0\n`;
    } else {
      stats.dayExpenses.forEach((e) => {
        report += `# ${e.name}  : ${formatReportRp(e.amount)}\n`;
      });
    }

    report += `TOTAL KELUAR: ${formatReportRp(stats.totalExpenses)}\n`;
    report += `_________________________\n`;
    report += `SISA CASH (FISIK LACI): ${formatReportRp(stats.physicalCashRemaining)}\n\n`;
    report += `*(${formatReportRp(stats.physicalCashRemaining)})*`;

    return report;
  };

  const handleCopyReport = () => {
    const text = generateReportText();
    navigator.clipboard.writeText(text).then(
      () => onShowToast('Laporan berhasil disalin ke clipboard!', 'success'),
      () => onShowToast('Gagal menyalin laporan', 'error')
    );
  };

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Orders
    const ordersData: any[] = [
      ['LAPORAN TRANSAKSI', settings.storeName],
      ['Tanggal', targetDateFormatted || selectedDate],
      [],
      ['ID Pesanan', 'Waktu', 'Pelanggan / Meja / Kursi', 'Rincian Item', 'Shift', 'Metode Bayar', 'Total'],
    ];

    orders
      .filter((o) => o.status === 'selesai' && (o.date === selectedDate || o.date === targetDateFormatted))
      .forEach((o) => {
        const itemStr = o.items.map((i) => `${i.name} (x${i.qty})${i.assignedTo ? ` [${i.assignedTo}]` : ''}`).join(', ');
        ordersData.push([o.id, o.time, o.customer, itemStr, `Shift ${o.shift}`, o.payment, o.total]);
      });

    const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Transaksi');

    // Sheet 2: Expenses
    const expenseData: any[] = [
      ['LAPORAN PENGELUARAN', settings.storeName],
      ['Tanggal', targetDateFormatted || selectedDate],
      [],
      ['Kategori', 'Metode Pembayaran', 'Keterangan', 'Nominal (Rp)'],
    ];

    stats.dayExpenses.forEach((e) => {
      expenseData.push([e.category, e.payment, e.name, e.amount]);
    });

    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Pengeluaran');

    XLSX.writeFile(wb, `Laporan_Omzet_${settings.storeName.replace(/\s+/g, '_')}_${selectedDate}.xlsx`);
    onShowToast('File Excel berhasil diunduh!', 'success');
  };

  const handleShareWA = () => {
    const text = generateReportText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Laporan Omzet & Arus Kas
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Rekap transaksi kasir, rincian shift, dan rekonsiliasi kas fisik harian.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-emerald-50 border-2 border-emerald-500 p-2 rounded-2xl shadow-sm">
          <Calendar className="w-5 h-5 text-emerald-600 shrink-0 ml-1" />
          <div>
            <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-wider">
              Pilih Tanggal Laporan
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-black text-emerald-950 text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Petty Cash & Export Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          Modal Awal Kasir (Petty Cash) & Export Laporan
        </h3>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 flex gap-2">
            <input
              type="number"
              value={pettyCashInput}
              onChange={(e) => setPettyCashInput(e.target.value)}
              placeholder="Input modal awal (Rp)..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSavePetty}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shrink-0"
            >
              Simpan Modal
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyReport}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Teks WA
            </button>
            <button
              onClick={handleDownloadExcel}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Excel
            </button>
            {onNavigateToExtract && (
              <button
                onClick={onNavigateToExtract}
                className="flex-1 sm:flex-none px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                Ekstrak Data (Spreadsheet)
              </button>
            )}
            <button
              onClick={handleShareWA}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              Kirim WA
            </button>
          </div>
        </div>

        <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
          Modal Awal Tercatat: {formatRp(pettyCash)}
        </div>
      </div>

      {/* KPI Highlight Cards - Ringkasan Harian Lengkap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Omzet */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Omzet Penjualan</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {formatRp(stats.grandTotal)}
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Cash: {formatRp(stats.totalCash)} | Non-Cash: {formatRp(stats.totalQris + stats.totalOnline)}
            </p>
          </div>
        </div>

        {/* Total Pengeluaran per Hari */}
        <div className="bg-white rounded-2xl border border-red-200 bg-red-50/20 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Pengeluaran / Hari</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-black text-blue-600 tracking-tight">
              {formatRp(stats.totalExpenses)}
            </div>
            <p className="text-[10px] font-bold text-blue-700/80 mt-0.5">
              {stats.dayExpenses.length} transaksi (Tunai: {formatRp(stats.cashExpenses)})
            </p>
          </div>
        </div>

        {/* Laba Bersih Hari Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Estimasi Laba Bersih</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className={`text-xl font-black tracking-tight ${
              stats.grandTotal - stats.totalExpenses >= 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {formatRp(stats.grandTotal - stats.totalExpenses)}
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Omzet Penjualan dikurangi Total Biaya
            </p>
          </div>
        </div>

        {/* Sisa Uang Kas Laci */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sisa Uang Fisik Laci</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-black text-blue-600 tracking-tight">
              {formatRp(stats.physicalCashRemaining)}
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Wajib ada di laci saat tutup kasir
            </p>
          </div>
        </div>
      </div>

      {/* Shifts Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shift 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  SHIFT 1 (Pagi - Siang)
                </h4>
                <p className="text-[11px] font-bold text-slate-400">
                  Kasir: {settings.shift1Name || 'Belum diatur'}
                </p>
              </div>
            </div>
            <span className="text-base font-black text-slate-900">
              {formatRp(stats.s1Total)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-slate-200 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-bold block text-[10px]">Tunai / Cash</span>
              <strong className="text-slate-900 font-extrabold">{formatRp(stats.s1Cash)}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-bold block text-[10px]">QRIS / Transfer</span>
              <strong className="text-slate-900 font-extrabold">{formatRp(stats.s1Qris)}</strong>
            </div>
          </div>
        </div>

        {/* Shift 2 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  SHIFT 2 (Sore - Malam)
                </h4>
                <p className="text-[11px] font-bold text-slate-400">
                  Kasir: {settings.shift2Name || 'Belum diatur'}
                </p>
              </div>
            </div>
            <span className="text-base font-black text-slate-900">
              {formatRp(stats.s2Total)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-slate-200 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-bold block text-[10px]">Tunai / Cash</span>
              <strong className="text-slate-900 font-extrabold">{formatRp(stats.s2Cash)}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-bold block text-[10px]">QRIS / Transfer</span>
              <strong className="text-slate-900 font-extrabold">{formatRp(stats.s2Qris)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Online orders if any */}
      {stats.totalOnline > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h4 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-2">
            Pesanan Online & Delivery
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
              <span className="text-[10px] font-black text-orange-700 uppercase">ShopeeFood</span>
              <p className="font-black text-sm text-orange-950 mt-0.5">{formatRp(stats.shopee)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-black text-emerald-700 uppercase">GoFood</span>
              <p className="font-black text-sm text-emerald-950 mt-0.5">{formatRp(stats.gofood)}</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
              <span className="text-[10px] font-black text-teal-700 uppercase">GrabFood</span>
              <p className="font-black text-sm text-teal-950 mt-0.5">{formatRp(stats.grab)}</p>
            </div>
          </div>
        </div>
      )}

      {/* FINAL CASH DRAWER CALCULATION CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
        <div className="text-center pb-4 border-b border-slate-800">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider mb-2">
            Rekap Akhir Keuangan
          </span>
          <h3 className="text-lg font-black tracking-tight">
            Laporan Arus Kas & Sisa Laci Kasir
          </h3>
        </div>

        <div className="space-y-2.5 text-xs sm:text-sm font-semibold max-w-xl mx-auto">
          <div className="flex justify-between items-center text-slate-300">
            <span>Total Omzet Tunai (Cash):</span>
            <span className="font-black text-emerald-400 text-sm sm:text-base">
              {formatRp(stats.totalCash)}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>Total Omzet QRIS / Transfer:</span>
            <span className="font-black text-blue-400 text-sm sm:text-base">
              {formatRp(stats.totalQris)}
            </span>
          </div>

          {stats.totalOnline > 0 && (
            <div className="flex justify-between items-center text-slate-300">
              <span>Total Pesanan Online:</span>
              <span className="font-black text-amber-400 text-sm sm:text-base">
                {formatRp(stats.totalOnline)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-white pt-2 border-t border-slate-800 font-extrabold text-sm sm:text-base">
            <span>TOTAL OMZET KESELURUHAN:</span>
            <span className="font-black text-red-400">
              {formatRp(stats.grandTotal)}
            </span>
          </div>

          <div className="pt-4 border-t border-dashed border-slate-800">
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wide block">
                  SISA CASH FISIK DALAM LACI:
                </span>
                <span className="text-[10px] text-slate-400">
                  (Omzet Cash + Petty Cash - Pengeluaran Tunai)
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {formatRp(stats.physicalCashRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
