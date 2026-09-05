import * as XLSX from 'xlsx';
import { Order, Expense } from '../types';

export interface DateFilterRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Filter items by date range
 */
export function filterOrdersByDate(orders: Order[], filter: DateFilterRange): Order[] {
  return orders.filter((o) => {
    if (!o.date) return false;
    const d = o.date.trim();
    // Support YYYY-MM-DD or DD/MM/YYYY
    let orderIso = d;
    if (d.includes('/')) {
      const parts = d.split('/');
      if (parts.length === 3) {
        orderIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return orderIso >= filter.startDate && orderIso <= filter.endDate;
  });
}

export function filterExpensesByDate(expenses: Expense[], filter: DateFilterRange): Expense[] {
  return expenses.filter((e) => {
    if (!e.date) return false;
    const d = e.date.trim();
    let expIso = d;
    if (d.includes('/')) {
      const parts = d.split('/');
      if (parts.length === 3) {
        expIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return expIso >= filter.startDate && expIso <= filter.endDate;
  });
}

/**
 * 1. Extract Data Pemasukan Per Hari Menjadi Spreadsheet
 */
export function exportIncomeSpreadsheet(
  orders: Order[],
  filterLabel: string = 'Harian'
) {
  const completedOrders = orders.filter((o) => o.status === 'selesai');

  const rows: any[][] = [
    ['LAPORAN DATA PEMASUKAN KASIR (HARIAN)'],
    [`Periode: ${filterLabel}`],
    [`Dicetak pada: ${new Date().toLocaleString('id-ID')}`],
    [],
    [
      'Tanggal',
      'Jam',
      'No. Transaksi',
      'Shift',
      'Kasir',
      'Pelanggan',
      'Daftar Item Terjual',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'PPN (Rp)',
      'Total Akhir (Rp)',
      'Metode Bayar',
      'Status',
      'Catatan',
    ],
  ];

  let totalOmzet = 0;
  let totalCash = 0;
  let totalQris = 0;
  let totalOther = 0;
  let totalDiskon = 0;

  completedOrders.forEach((o) => {
    const itemDetails = o.items
      .map((i) => `${i.name} (x${i.qty}) [${i.assignedTo || '-'}]`)
      .join(', ');

    rows.push([
      o.date,
      o.time,
      `#${o.id}`,
      `Shift ${o.shift}`,
      o.cashierName || 'Kasir',
      o.customer || 'Pelanggan',
      itemDetails,
      o.subtotal || o.total + o.discount,
      o.discount,
      o.ppn || 0,
      o.total,
      o.payment,
      o.status.toUpperCase(),
      o.customer || '',
    ]);

    totalOmzet += o.total;
    totalDiskon += o.discount;
    const pay = (o.payment || '').toLowerCase();
    if (pay.includes('cash') || pay.includes('tunai')) {
      totalCash += o.total;
    } else if (pay.includes('qris')) {
      totalQris += o.total;
    } else {
      totalOther += o.total;
    }
  });

  // Summary rows
  rows.push([]);
  rows.push(['=== RINGKASAN PEMASUKAN ===']);
  rows.push(['Total Transaksi Selesai', completedOrders.length]);
  rows.push(['Total Diskon Diberikan (Rp)', totalDiskon]);
  rows.push(['Total Cash / Tunai (Laci) (Rp)', totalCash]);
  rows.push(['Total QRIS (Rp)', totalQris]);
  rows.push(['Total Transfer / Lainnya (Rp)', totalOther]);
  rows.push(['GRAND TOTAL OMZET BERSIH (Rp)', totalOmzet]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pemasukan Harian');

  const fileName = `Pemasukan_Harian_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 2. Extract Data Pengeluaran Secara Rinci Per Hari Menjadi Spreadsheet
 */
export function exportExpensesSpreadsheet(
  expenses: Expense[],
  filterLabel: string = 'Harian'
) {
  const rows: any[][] = [
    ['LAPORAN RINCIAN PENGELUARAN (HARIAN)'],
    [`Periode: ${filterLabel}`],
    [`Dicetak pada: ${new Date().toLocaleString('id-ID')}`],
    [],
    [
      'Tanggal',
      'No. Pengeluaran',
      'Keterangan Pengeluaran',
      'Kategori',
      'Sumber Dana (Metode Bayar)',
      'Nominal Pengeluaran (Rp)',
    ],
  ];

  let totalCashExpense = 0;
  let totalNonCashExpense = 0;
  let grandTotalExpense = 0;

  expenses.forEach((e) => {
    rows.push([
      e.date,
      `EXP-${e.id}`,
      e.name,
      e.category,
      e.payment,
      e.amount,
    ]);

    grandTotalExpense += e.amount;
    const p = (e.payment || '').toUpperCase();
    if (p.includes('TUNAI') || p.includes('CASH') || p.includes('LACI')) {
      totalCashExpense += e.amount;
    } else {
      totalNonCashExpense += e.amount;
    }
  });

  // Summary
  rows.push([]);
  rows.push(['=== RINGKASAN PENGELUARAN ===']);
  rows.push(['Total Catatan Pengeluaran', expenses.length]);
  rows.push(['Total Pengeluaran Kas Tunai / Laci (Rp)', totalCashExpense]);
  rows.push(['Total Pengeluaran Non-Tunai / Bank (Rp)', totalNonCashExpense]);
  rows.push(['GRAND TOTAL PENGELUARAN (Rp)', grandTotalExpense]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rincian Pengeluaran');

  const fileName = `Pengeluaran_Rinci_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 3. Extract Data Penjualan Body Cloud Per Hari Secara Rinci
 * Pembagian: Barber 50%, Owner 50%
 */
export interface BodyCloudRecord {
  date: string;
  time: string;
  orderId: string;
  itemName: string;
  barber: string;
  qty: number;
  price: number;
  total: number;
  barberShare: number; // 50%
  ownerShare: number;  // 50%
  customer: string;
  payment: string;
}

export function extractBodyCloudData(orders: Order[]): {
  records: BodyCloudRecord[];
  barberSummary: Record<string, { count: number; totalOmzet: number; barberShare: number; ownerShare: number }>;
  grandTotalOmzet: number;
  grandBarberShare: number;
  grandOwnerShare: number;
} {
  const records: BodyCloudRecord[] = [];
  const barberSummary: Record<string, { count: number; totalOmzet: number; barberShare: number; ownerShare: number }> = {};
  let grandTotalOmzet = 0;
  let grandBarberShare = 0;
  let grandOwnerShare = 0;

  orders
    .filter((o) => o.status === 'selesai')
    .forEach((order) => {
      order.items.forEach((item) => {
        const cat = (item.category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const isBodyCloud =
          cat === 'body cloud' ||
          name.includes('body cloud') ||
          name.includes('massage') ||
          name.includes('spa mist') ||
          cat.includes('body cloud');

        if (isBodyCloud) {
          const itemTotal = item.price * item.qty;
          const bShare = Math.round(itemTotal * 0.5);
          const oShare = itemTotal - bShare;
          const barberName = item.assignedTo || order.cashierName || 'Barber Tidak Terdata';

          records.push({
            date: order.date,
            time: order.time,
            orderId: order.id,
            itemName: item.name,
            barber: barberName,
            qty: item.qty,
            price: item.price,
            total: itemTotal,
            barberShare: bShare,
            ownerShare: oShare,
            customer: order.customer || 'Pelanggan',
            payment: order.payment,
          });

          grandTotalOmzet += itemTotal;
          grandBarberShare += bShare;
          grandOwnerShare += oShare;

          if (!barberSummary[barberName]) {
            barberSummary[barberName] = { count: 0, totalOmzet: 0, barberShare: 0, ownerShare: 0 };
          }
          barberSummary[barberName].count += item.qty;
          barberSummary[barberName].totalOmzet += itemTotal;
          barberSummary[barberName].barberShare += bShare;
          barberSummary[barberName].ownerShare += oShare;
        }
      });
    });

  return {
    records,
    barberSummary,
    grandTotalOmzet,
    grandBarberShare,
    grandOwnerShare,
  };
}

export function exportBodyCloudSpreadsheet(
  orders: Order[],
  filterLabel: string = 'Harian'
) {
  const { records, barberSummary, grandTotalOmzet, grandBarberShare, grandOwnerShare } =
    extractBodyCloudData(orders);

  const rows: any[][] = [
    ['LAPORAN RINCI PENJUALAN BODY CLOUD (BAGI HASIL: BARBER 50% - OWNER 50%)'],
    [`Periode: ${filterLabel}`],
    [`Dicetak pada: ${new Date().toLocaleString('id-ID')}`],
    [],
    [
      'No',
      'Tanggal',
      'Jam',
      'No. Transaksi',
      'Nama Layanan Body Cloud',
      'Barber / Petugas',
      'Qty',
      'Harga Satuan (Rp)',
      'Total Penjualan (Rp)',
      'Hak Barber 50% (Rp)',
      'Hak Owner 50% (Rp)',
      'Pelanggan',
      'Metode Bayar',
    ],
  ];

  records.forEach((r, idx) => {
    rows.push([
      idx + 1,
      r.date,
      r.time,
      `#${r.orderId}`,
      r.itemName,
      r.barber,
      r.qty,
      r.price,
      r.total,
      r.barberShare,
      r.ownerShare,
      r.customer,
      r.payment,
    ]);
  });

  // Barber Summary
  rows.push([]);
  rows.push(['=== REKAP BAGI HASIL PER BARBER (50% BARBER - 50% OWNER) ===']);
  rows.push([
    'Nama Barber / Petugas',
    'Total Layanan Body Cloud',
    'Total Omzet Body Cloud (Rp)',
    'Komisi Barber 50% (Rp)',
    'Bagian Owner 50% (Rp)',
  ]);

  Object.entries(barberSummary).forEach(([name, stat]) => {
    rows.push([
      name,
      stat.count,
      stat.totalOmzet,
      stat.barberShare,
      stat.ownerShare,
    ]);
  });

  // Grand Total
  rows.push([]);
  rows.push(['=== TOTAL KESELURUHAN BODY CLOUD ===']);
  rows.push(['Total Layanan Body Cloud Terjual', records.reduce((s, r) => s + r.qty, 0)]);
  rows.push(['TOTAL OMZET BODY CLOUD (Rp)', grandTotalOmzet]);
  rows.push(['TOTAL HAK / KOMISI BARBER (50%) (Rp)', grandBarberShare]);
  rows.push(['TOTAL BERSIH OWNER (50%) (Rp)', grandOwnerShare]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Body Cloud 50-50');

  const fileName = `Body_Cloud_Bagi_Hasil_50-50_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 4. Extract Data Treatment Per Karyawan & Total Harga Treatment x 20% = Insentif Treatment
 */
export interface TreatmentRecord {
  date: string;
  time: string;
  orderId: string;
  staffName: string;
  itemName: string;
  category: string;
  qty: number;
  price: number;
  total: number;
  incentive: number; // total * 0.20
  customer: string;
}

export function extractTreatmentData(orders: Order[]): {
  records: TreatmentRecord[];
  staffSummary: Record<string, { count: number; totalOmzet: number; totalIncentive: number }>;
  grandTotalOmzet: number;
  grandTotalIncentive: number;
} {
  const records: TreatmentRecord[] = [];
  const staffSummary: Record<string, { count: number; totalOmzet: number; totalIncentive: number }> = {};
  let grandTotalOmzet = 0;
  let grandTotalIncentive = 0;

  orders
    .filter((o) => o.status === 'selesai')
    .forEach((order) => {
      order.items.forEach((item) => {
        const cat = (item.category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const isTreatment =
          cat.includes('treatment') ||
          name.includes('treatment') ||
          name.includes('scalp') ||
          name.includes('creambath') ||
          name.includes('hair spa') ||
          name.includes('tonic');

        if (isTreatment) {
          const itemTotal = item.price * item.qty;
          const incentive = Math.round(itemTotal * 0.20); // 20% insentif
          const staffName = item.assignedTo || order.cashierName || 'Petugas Tidak Terdata';

          records.push({
            date: order.date,
            time: order.time,
            orderId: order.id,
            staffName,
            itemName: item.name,
            category: item.category || 'Treatment',
            qty: item.qty,
            price: item.price,
            total: itemTotal,
            incentive,
            customer: order.customer || 'Pelanggan',
          });

          grandTotalOmzet += itemTotal;
          grandTotalIncentive += incentive;

          if (!staffSummary[staffName]) {
            staffSummary[staffName] = { count: 0, totalOmzet: 0, totalIncentive: 0 };
          }
          staffSummary[staffName].count += item.qty;
          staffSummary[staffName].totalOmzet += itemTotal;
          staffSummary[staffName].totalIncentive += incentive;
        }
      });
    });

  return {
    records,
    staffSummary,
    grandTotalOmzet,
    grandTotalIncentive,
  };
}

export function exportTreatmentSpreadsheet(
  orders: Order[],
  filterLabel: string = 'Harian'
) {
  const { records, staffSummary, grandTotalOmzet, grandTotalIncentive } =
    extractTreatmentData(orders);

  const rows: any[][] = [
    ['LAPORAN TREATMENT PER KARYAWAN & INSENTIF 20% (TOTAL HARGA TREATMENT x 20%)'],
    [`Periode: ${filterLabel}`],
    [`Rumus: Total Harga Treatment x 20% = Insentif Treatment`],
    [`Dicetak pada: ${new Date().toLocaleString('id-ID')}`],
    [],
    [
      'No',
      'Tanggal',
      'Jam',
      'No. Transaksi',
      'Nama Karyawan / Barber',
      'Nama Layanan Treatment',
      'Kategori',
      'Qty',
      'Harga Satuan (Rp)',
      'Total Harga Treatment (Rp)',
      'Insentif Treatment (20%) (Rp)',
      'Pelanggan',
    ],
  ];

  records.forEach((r, idx) => {
    rows.push([
      idx + 1,
      r.date,
      r.time,
      `#${r.orderId}`,
      r.staffName,
      r.itemName,
      r.category,
      r.qty,
      r.price,
      r.total,
      r.incentive,
      r.customer,
    ]);
  });

  // Staff summary table
  rows.push([]);
  rows.push(['=== REKAP INSENTIF TREATMENT PER KARYAWAN (20%) ===']);
  rows.push([
    'Nama Karyawan / Barber',
    'Jumlah Layanan Treatment',
    'Total Omzet Treatment (Rp)',
    'Total Insentif Treatment (20%) (Rp)',
  ]);

  Object.entries(staffSummary).forEach(([name, stat]) => {
    rows.push([
      name,
      stat.count,
      stat.totalOmzet,
      stat.totalIncentive,
    ]);
  });

  // Grand Total
  rows.push([]);
  rows.push(['=== TOTAL KESELURUHAN TREATMENT & INSENTIF ===']);
  rows.push(['Total Layanan Treatment Dikerjakan', records.reduce((s, r) => s + r.qty, 0)]);
  rows.push(['TOTAL OMZET TREATMENT (Rp)', grandTotalOmzet]);
  rows.push(['GRAND TOTAL INSENTIF TREATMENT 20% (Rp)', grandTotalIncentive]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Insentif Treatment 20%');

  const fileName = `Treatment_Insentif_20%_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 5. Master Export: All 4 Sheets in a single Excel Workbook!
 */
export function exportMasterSpreadsheet(
  orders: Order[],
  expenses: Expense[],
  filterLabel: string = 'Harian'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Pemasukan
  const completedOrders = orders.filter((o) => o.status === 'selesai');
  const incRows: any[][] = [
    ['LAPORAN DATA PEMASUKAN KASIR'],
    [`Periode: ${filterLabel}`],
    [],
    ['Tanggal', 'Jam', 'No. Transaksi', 'Shift', 'Kasir', 'Pelanggan', 'Rincian Item', 'Subtotal', 'Diskon', 'PPN', 'Total', 'Metode Bayar'],
  ];
  let totInc = 0;
  completedOrders.forEach((o) => {
    incRows.push([
      o.date,
      o.time,
      `#${o.id}`,
      `Shift ${o.shift}`,
      o.cashierName,
      o.customer,
      o.items.map((i) => `${i.name} (x${i.qty})`).join(', '),
      o.subtotal || o.total + o.discount,
      o.discount,
      o.ppn || 0,
      o.total,
      o.payment,
    ]);
    totInc += o.total;
  });
  incRows.push([]);
  incRows.push(['GRAND TOTAL OMZET PEMASUKAN', totInc]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'Pemasukan Harian');

  // Sheet 2: Pengeluaran
  const expRows: any[][] = [
    ['LAPORAN RINCIAN PENGELUARAN'],
    [`Periode: ${filterLabel}`],
    [],
    ['Tanggal', 'ID', 'Keterangan Pengeluaran', 'Kategori', 'Sumber Dana', 'Nominal (Rp)'],
  ];
  let totExp = 0;
  expenses.forEach((e) => {
    expRows.push([e.date, `EXP-${e.id}`, e.name, e.category, e.payment, e.amount]);
    totExp += e.amount;
  });
  expRows.push([]);
  expRows.push(['GRAND TOTAL PENGELUARAN', totExp]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Rincian Pengeluaran');

  // Sheet 3: Body Cloud 50-50
  const bcData = extractBodyCloudData(orders);
  const bcRows: any[][] = [
    ['PENJUALAN BODY CLOUD (BAGI HASIL: BARBER 50% - OWNER 50%)'],
    [`Periode: ${filterLabel}`],
    [],
    ['Tanggal', 'No. Transaksi', 'Layanan', 'Barber', 'Qty', 'Harga', 'Total Omzet', 'Hak Barber 50%', 'Hak Owner 50%', 'Pelanggan'],
  ];
  bcData.records.forEach((r) => {
    bcRows.push([r.date, `#${r.orderId}`, r.itemName, r.barber, r.qty, r.price, r.total, r.barberShare, r.ownerShare, r.customer]);
  });
  bcRows.push([]);
  bcRows.push(['TOTAL OMZET BODY CLOUD', bcData.grandTotalOmzet]);
  bcRows.push(['TOTAL KOMISI BARBER (50%)', bcData.grandBarberShare]);
  bcRows.push(['TOTAL BERSIH OWNER (50%)', bcData.grandOwnerShare]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bcRows), 'Body Cloud 50-50');

  // Sheet 4: Treatment Insentif 20%
  const trData = extractTreatmentData(orders);
  const trRows: any[][] = [
    ['TREATMENT PER KARYAWAN & INSENTIF 20% (Total Harga Treatment x 20%)'],
    [`Periode: ${filterLabel}`],
    [],
    ['Tanggal', 'No. Transaksi', 'Karyawan', 'Layanan Treatment', 'Qty', 'Harga', 'Total Treatment', 'Insentif 20%', 'Pelanggan'],
  ];
  trData.records.forEach((r) => {
    trRows.push([r.date, `#${r.orderId}`, r.staffName, r.itemName, r.qty, r.price, r.total, r.incentive, r.customer]);
  });
  trRows.push([]);
  trRows.push(['TOTAL OMZET TREATMENT', trData.grandTotalOmzet]);
  trRows.push(['GRAND TOTAL INSENTIF 20%', trData.grandTotalIncentive]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trRows), 'Treatment 20% Insentif');

  const fileName = `YuPOS_Master_Extract_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
