import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Scissors, 
  Award, 
  Calendar, 
  Filter, 
  Layers, 
  DollarSign, 
  Users, 
  CheckCircle2,
  Sparkles,
  Search
} from 'lucide-react';
import { Order, Expense, StoreSettings } from '../types';
import { 
  filterOrdersByDate, 
  filterExpensesByDate, 
  exportIncomeSpreadsheet, 
  exportExpensesSpreadsheet, 
  exportBodyCloudSpreadsheet, 
  exportTreatmentSpreadsheet, 
  exportMasterSpreadsheet,
  extractBodyCloudData,
  extractTreatmentData
} from '../services/excelExportService';

interface ExtractDataViewProps {
  orders: Order[];
  expenses: Expense[];
  settings: StoreSettings;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type ExtractTab = 'income' | 'expenses' | 'bodycloud' | 'treatment';

export const ExtractDataView: React.FC<ExtractDataViewProps> = ({
  orders,
  expenses,
  settings,
  onShowToast,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Date filters
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activeExtractTab, setActiveExtractTab] = useState<ExtractTab>('income');
  const [searchTerm, setSearchTerm] = useState('');

  // Handle date preset change
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(now.getDate() - 7);
      setStartDate(w.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(m.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Filtered orders and expenses
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate]);
  const filteredOrders = useMemo(() => filterOrdersByDate(orders, dateRange), [orders, dateRange]);
  const filteredExpenses = useMemo(() => filterExpensesByDate(expenses, dateRange), [expenses, dateRange]);

  const filterLabel = useMemo(() => {
    if (startDate === endDate) {
      return `Hari ${startDate}`;
    }
    return `${startDate} s/d ${endDate}`;
  }, [startDate, endDate]);

  // Income computations
  const completedOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'selesai');
  }, [filteredOrders]);

  const incomeStats = useMemo(() => {
    let omzet = 0;
    let cash = 0;
    let qris = 0;
    let other = 0;

    completedOrders.forEach((o) => {
      omzet += o.total;
      const p = (o.payment || '').toLowerCase();
      if (p.includes('cash') || p.includes('tunai')) {
        cash += o.total;
      } else if (p.includes('qris')) {
        qris += o.total;
      } else {
        other += o.total;
      }
    });

    return { omzet, cash, qris, other, count: completedOrders.length };
  }, [completedOrders]);

  // Expenses computations
  const expenseStats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let nonCash = 0;

    filteredExpenses.forEach((e) => {
      total += e.amount;
      const p = (e.payment || '').toUpperCase();
      if (p.includes('TUNAI') || p.includes('CASH') || p.includes('LACI')) {
        cash += e.amount;
      } else {
        nonCash += e.amount;
      }
    });

    return { total, cash, nonCash, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // Body Cloud computations (Barber 50% - Owner 50%)
  const bodyCloudData = useMemo(() => {
    return extractBodyCloudData(filteredOrders);
  }, [filteredOrders]);

  // Treatment computations (Total Harga x 20% = Insentif)
  const treatmentData = useMemo(() => {
    return extractTreatmentData(filteredOrders);
  }, [filteredOrders]);

  // Handlers for exporting spreadsheets
  const handleExportIncome = () => {
    try {
      exportIncomeSpreadsheet(filteredOrders, filterLabel);
      onShowToast('Spreadsheet Pemasukan berhasil diunduh (.xlsx)!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast('Gagal mengekspor data pemasukan.', 'error');
    }
  };

  const handleExportExpenses = () => {
    try {
      exportExpensesSpreadsheet(filteredExpenses, filterLabel);
      onShowToast('Spreadsheet Pengeluaran berhasil diunduh (.xlsx)!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast('Gagal mengekspor data pengeluaran.', 'error');
    }
  };

  const handleExportBodyCloud = () => {
    try {
      exportBodyCloudSpreadsheet(filteredOrders, filterLabel);
      onShowToast('Spreadsheet Penjualan Body Cloud (50/50) berhasil diunduh (.xlsx)!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast('Gagal mengekspor data body cloud.', 'error');
    }
  };

  const handleExportTreatment = () => {
    try {
      exportTreatmentSpreadsheet(filteredOrders, filterLabel);
      onShowToast('Spreadsheet Insentif Treatment (20%) berhasil diunduh (.xlsx)!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast('Gagal mengekspor data treatment & insentif.', 'error');
    }
  };

  const handleExportMaster = () => {
    try {
      exportMasterSpreadsheet(filteredOrders, filteredExpenses, filterLabel);
      onShowToast('Rekap Lengkap 4-Sheet Excel berhasil diunduh (.xlsx)!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast('Gagal mengekspor rekap spreadsheet.', 'error');
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5 overflow-auto overscroll-contain min-h-0 h-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Extract Data & Spreadsheet
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium max-w-2xl leading-relaxed">
            Ekstrak data pemasukan, pengeluaran rinci, pembagian Body Cloud (Barber 50% - Owner 50%), 
            dan insentif treatment karyawan (20%) langsung ke format spreadsheet Excel (.xlsx).
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportMaster}
          className="px-4 py-3 bg-white hover:bg-emerald-50 text-emerald-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/10 transition-all shrink-0 active:scale-95"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Unduh Rekap Lengkap (4 Sheet Sekaligus)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Filter Periode Tanggal
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'today', label: 'Hari Ini' },
                { id: 'yesterday', label: 'Kemarin' },
                { id: 'week', label: '7 Hari Terakhir' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">Dari Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">Sampai Tanggal:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="ml-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            Rentang Terpilih: {filterLabel}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Tab 1: Pemasukan */}
        <button
          type="button"
          onClick={() => setActiveExtractTab('income')}
          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
            activeExtractTab === 'income'
              ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {completedOrders.length} Trx
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-black text-slate-900 leading-tight">1. Pemasukan Per Hari</h4>
            <p className="text-[11px] font-extrabold text-emerald-600 mt-0.5">
              Rp {incomeStats.omzet.toLocaleString('id-ID')}
            </p>
          </div>
        </button>

        {/* Tab 2: Pengeluaran Rinci */}
        <button
          type="button"
          onClick={() => setActiveExtractTab('expenses')}
          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
            activeExtractTab === 'expenses'
              ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingDown className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredExpenses.length} Catatan
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-black text-slate-900 leading-tight">2. Pengeluaran Rinci</h4>
            <p className="text-[11px] font-extrabold text-blue-600 mt-0.5">
              Rp {expenseStats.total.toLocaleString('id-ID')}
            </p>
          </div>
        </button>

        {/* Tab 3: Body Cloud 50/50 */}
        <button
          type="button"
          onClick={() => setActiveExtractTab('bodycloud')}
          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
            activeExtractTab === 'bodycloud'
              ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Scissors className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              50% - 50%
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-black text-slate-900 leading-tight">3. Body Cloud (50/50)</h4>
            <p className="text-[11px] font-extrabold text-blue-600 mt-0.5">
              Rp {bodyCloudData.grandTotalOmzet.toLocaleString('id-ID')}
            </p>
          </div>
        </button>

        {/* Tab 4: Treatment Insentif 20% */}
        <button
          type="button"
          onClick={() => setActiveExtractTab('treatment')}
          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
            activeExtractTab === 'treatment'
              ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Insentif 20%
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-black text-slate-900 leading-tight">4. Treatment Karyawan</h4>
            <p className="text-[11px] font-extrabold text-amber-600 mt-0.5">
              Insentif: Rp {treatmentData.grandTotalIncentive.toLocaleString('id-ID')}
            </p>
          </div>
        </button>
      </div>

      {/* Active Tab View Details */}

      {/* 1. PEMASUKAN TAB */}
      {activeExtractTab === 'income' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Omzet Pemasukan</p>
              <h3 className="text-base sm:text-lg font-black text-emerald-600 mt-1">
                Rp {incomeStats.omzet.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Pemasukan Cash (Laci)</p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                Rp {incomeStats.cash.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Pemasukan QRIS</p>
              <h3 className="text-base sm:text-lg font-black text-blue-600 mt-1">
                Rp {incomeStats.qris.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Transaksi</p>
              <h3 className="text-base sm:text-lg font-black text-purple-600 mt-1">
                {incomeStats.count} Transaksi
              </h3>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Data Pemasukan Harian ({filterLabel})
              </h3>
              <p className="text-xs text-slate-500">
                Ekstrak daftar transaksi pemasukan kasir ke berkas spreadsheet Microsoft Excel (.xlsx)
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportIncome}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Spreadsheet Pemasukan (.xlsx)</span>
            </button>
          </div>

          {/* Data Table Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-auto max-h-[55dvh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Tanggal & Jam</th>
                    <th className="py-3 px-4">No. Trx</th>
                    <th className="py-3 px-4">Kasir / Shift</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Item Terjual</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Diskon</th>
                    <th className="py-3 px-4 text-right">Total Akhir</th>
                    <th className="py-3 px-4 text-center">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Tidak ada transaksi pemasukan pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{o.date}</span>
                          <span className="text-slate-400 ml-1.5">{o.time}</span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-700">#{o.id}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-800">{o.cashierName}</span>
                          <span className="text-slate-400 ml-1">(S{o.shift})</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{o.customer || '-'}</td>
                        <td className="py-2.5 px-4 max-w-xs truncate text-slate-600">
                          {o.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          Rp {(o.subtotal || o.total + o.discount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-right text-red-500 font-bold">
                          {o.discount > 0 ? `-Rp ${o.discount.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700">
                          Rp {o.total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                            {o.payment}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PENGELUARAN TAB */}
      {activeExtractTab === 'expenses' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Pengeluaran</p>
              <h3 className="text-base sm:text-lg font-black text-blue-600 mt-1">
                Rp {expenseStats.total.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Pengeluaran Kas Laci (Cash)</p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                Rp {expenseStats.cash.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Pengeluaran Non-Tunai / Bank</p>
              <h3 className="text-base sm:text-lg font-black text-blue-600 mt-1">
                Rp {expenseStats.nonCash.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Jumlah Catatan</p>
              <h3 className="text-base sm:text-lg font-black text-purple-600 mt-1">
                {expenseStats.count} Pengeluaran
              </h3>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Rincian Pengeluaran Harian ({filterLabel})
              </h3>
              <p className="text-xs text-slate-500">
                Ekstrak catatan pengeluaran belanja bahan, operasional, kasbon, dan gaji ke berkas Excel (.xlsx)
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportExpenses}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Spreadsheet Pengeluaran (.xlsx)</span>
            </button>
          </div>

          {/* Data Table Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-auto max-h-[55dvh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">No. Pengeluaran</th>
                    <th className="py-3 px-4">Keterangan / Uraian</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Sumber Kas (Metode)</th>
                    <th className="py-3 px-4 text-right">Nominal Pengeluaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada catatan pengeluaran pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{e.date}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-bold">EXP-{e.id}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">{e.name}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {e.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            {e.payment}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-blue-600">
                          Rp {e.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. BODY CLOUD TAB (50% BARBER - 50% OWNER) */}
      {activeExtractTab === 'bodycloud' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Highlight Banner Formula */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-blue-950">
                  Pembagian Hasil Penjualan Body Cloud: 50% Barber & 50% Owner
                </h4>
                <p className="text-xs text-blue-700 font-medium mt-0.5">
                  Setiap layanan Body Cloud otomatis dibagi rata 50% untuk hak komisi Barber dan 50% pendapatan bersih Owner.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportBodyCloud}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Spreadsheet Body Cloud (.xlsx)</span>
            </button>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Omzet Body Cloud</p>
              <h3 className="text-base sm:text-lg font-black text-blue-600 mt-1">
                Rp {bodyCloudData.grandTotalOmzet.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs">
              <p className="text-[11px] font-extrabold text-blue-800">Hak Komisi Barber (50%)</p>
              <h3 className="text-base sm:text-lg font-black text-blue-700 mt-1">
                Rp {bodyCloudData.grandBarberShare.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
              <p className="text-[11px] font-extrabold text-emerald-800">Hak Bersih Owner (50%)</p>
              <h3 className="text-base sm:text-lg font-black text-emerald-700 mt-1">
                Rp {bodyCloudData.grandOwnerShare.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Layanan Terjual</p>
              <h3 className="text-base sm:text-lg font-black text-purple-600 mt-1">
                {bodyCloudData.records.reduce((s, r) => s + r.qty, 0)} Unit
              </h3>
            </div>
          </div>

          {/* Rekap Per Barber */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Rekap Komisi Per Barber (50% Bagi Hasil)
            </h4>

            {Object.keys(bodyCloudData.barberSummary).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada transaksi Body Cloud pada rentang tanggal ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(Object.entries(bodyCloudData.barberSummary) as [string, { count: number; totalOmzet: number; barberShare: number; ownerShare: number }][]).map(([name, stat]) => (
                  <div key={name} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 truncate">{name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {stat.count}x Layanan
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Omzet Penjualan:</span>
                      <span className="font-bold">Rp {stat.totalOmzet.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-700 pt-1 border-t border-slate-200 font-extrabold">
                      <span>Hak Barber (50%):</span>
                      <span>Rp {stat.barberShare.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-700 font-extrabold">
                      <span>Hak Owner (50%):</span>
                      <span>Rp {stat.ownerShare.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Itemized Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">
                Rincian Transaksi Penjualan Body Cloud
              </h4>
            </div>
            <div className="overflow-auto max-h-[55dvh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Tanggal & Jam</th>
                    <th className="py-3 px-4">No. Trx</th>
                    <th className="py-3 px-4">Layanan Body Cloud</th>
                    <th className="py-3 px-4">Barber</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Harga Total</th>
                    <th className="py-3 px-4 text-right bg-blue-50/50 text-blue-900">Hak Barber (50%)</th>
                    <th className="py-3 px-4 text-right bg-emerald-50/50 text-emerald-900">Hak Owner (50%)</th>
                    <th className="py-3 px-4">Pelanggan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {bodyCloudData.records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Tidak ada penjualan Body Cloud pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    bodyCloudData.records.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{r.date}</span>
                          <span className="text-slate-400 ml-1.5">{r.time}</span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-600">#{r.orderId}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{r.itemName}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md">
                            {r.barber}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-700">{r.qty}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                          Rp {r.total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-blue-700 bg-blue-50/30">
                          Rp {r.barberShare.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700 bg-emerald-50/30">
                          Rp {r.ownerShare.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{r.customer}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TREATMENT PER KARYAWAN & INSENTIF 20% TAB */}
      {activeExtractTab === 'treatment' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Highlight Banner Formula */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-amber-950">
                  Insentif Treatment Karyawan: Total Harga Treatment x 20%
                </h4>
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  Setiap layanan Treatment yang dikerjakan karyawan langsung dihitung insentif sebesar 20% dari total omzet harga treatment.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportTreatment}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Spreadsheet Insentif Treatment (.xlsx)</span>
            </button>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Omzet Treatment</p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                Rp {treatmentData.grandTotalOmzet.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
              <p className="text-[11px] font-extrabold text-amber-900">Total Insentif Karyawan (20%)</p>
              <h3 className="text-base sm:text-lg font-black text-amber-600 mt-1">
                Rp {treatmentData.grandTotalIncentive.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Total Layanan Dikerjakan</p>
              <h3 className="text-base sm:text-lg font-black text-purple-600 mt-1">
                {treatmentData.records.reduce((s, r) => s + r.qty, 0)} Treatment
              </h3>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500">Karyawan Menerima Insentif</p>
              <h3 className="text-base sm:text-lg font-black text-emerald-600 mt-1">
                {Object.keys(treatmentData.staffSummary).length} Orang
              </h3>
            </div>
          </div>

          {/* Rekap Insentif Per Karyawan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Rekap Insentif 20% Per Karyawan / Barber
            </h4>

            {Object.keys(treatmentData.staffSummary).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada transaksi Treatment pada rentang tanggal ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(Object.entries(treatmentData.staffSummary) as [string, { count: number; totalOmzet: number; totalIncentive: number }][]).map(([name, stat]) => (
                  <div key={name} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 truncate">{name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {stat.count}x Treatment
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Total Omzet Treatment:</span>
                      <span className="font-bold">Rp {stat.totalOmzet.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-amber-900 pt-1 border-t border-slate-200 font-extrabold bg-amber-100/50 p-1.5 rounded-lg">
                      <span>Hak Insentif (20%):</span>
                      <span className="text-amber-700 font-black">
                        Rp {stat.totalIncentive.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Itemized Treatment Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">
                Rincian Transaksi Treatment & Kalkulasi Insentif 20%
              </h4>
            </div>
            <div className="overflow-auto max-h-[55dvh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Tanggal & Jam</th>
                    <th className="py-3 px-4">No. Trx</th>
                    <th className="py-3 px-4">Karyawan / Barber</th>
                    <th className="py-3 px-4">Layanan Treatment</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Harga Treatment</th>
                    <th className="py-3 px-4 text-right bg-amber-50/50 text-amber-900">
                      Insentif Treatment (20%)
                    </th>
                    <th className="py-3 px-4">Pelanggan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {treatmentData.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Tidak ada transaksi Treatment pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    treatmentData.records.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{r.date}</span>
                          <span className="text-slate-400 ml-1.5">{r.time}</span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-600">#{r.orderId}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md">
                            {r.staffName}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{r.itemName}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-700">{r.qty}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                          Rp {r.total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-amber-700 bg-amber-50/30">
                          Rp {r.incentive.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{r.customer}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
