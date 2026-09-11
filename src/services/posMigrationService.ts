import initSqlJs, { Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { BusinessType, CartItem, Customer, Expense, Order, ProductItem, StoreSettings } from '../types';
import { auth } from '../config/firebase';
import { loadMerchantSettings, loadMerchantProducts, loadMerchantOrders, loadMerchantExpenses, saveMerchantSettings, saveMerchantProducts, saveMerchantOrders, saveMerchantExpenses, syncConfigToFirebase, syncProductsToFirebase, syncOrdersToFirebase, syncExpensesToFirebase } from './storageService';
import { loadCustomers, saveCustomers, syncCustomersToFirebase } from './customerService';

export type MigrationPayload = {
  kind: 'sqlite-pos';
  source: string;
  createdAt: string;
  products: ProductItem[];
  orders: Order[];
  customers: Customer[];
  expenses: Expense[];
  settings: Partial<StoreSettings>;
  staff: { role: string; names: string[] }[];
  warnings: string[];
};

const text = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number => { const n = Number(String(v ?? '').replace(/[^0-9,.-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const id = (prefix: string, value: unknown): string => `${prefix}-${text(value) || crypto.randomUUID()}`;
const rows = (db: Database, table: string): Record<string, unknown>[] => {
  const result = db.exec(`SELECT * FROM "${table.replace(/"/g, '""')}"`)[0];
  if (!result) return [];
  return result.values.map((row) => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
};
const parseDate = (value: unknown): { date: string; time: string; timestamp: number } => {
  const raw = text(value).replace(' ', 'T');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: new Date(0).toISOString().slice(0, 10), time: '00:00', timestamp: 0 };
  return { date: d.toISOString().slice(0, 10), time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }), timestamp: d.getTime() };
};
const paymentName = (value: unknown, methods: Map<number, string>): string => {
  const name = text(methods.get(num(value)) || value).toLowerCase();
  if (name.includes('transfer') || name.includes('bank')) return 'TRANSFER';
  if (name.includes('cash') || name.includes('tunai')) return 'CASH';
  return text(name).toUpperCase() || 'CASH';
};

export async function parseSqlitePosFile(file: File): Promise<MigrationPayload> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
  try {
    const tables = new Set((db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values || []).map((v) => text(v[0])));
    const required = ['barang', 'transaksi', 'detail_transaksi', 'pelanggan'];
    if (!required.every((t) => tables.has(t))) throw new Error('Database tidak dikenali sebagai database POS yang kompatibel.');
    const sourceName = text(rows(db, 'info_db')[0]?.name_app) || file.name;
    const sourceCode = text(rows(db, 'info_db')[0]?.code_app);
    const barang = rows(db, 'barang');
    const transaksi = rows(db, 'transaksi');
    const detail = rows(db, 'detail_transaksi');
    const pelanggan = rows(db, 'pelanggan');
    const pengeluaran = tables.has('pengeluaran') ? rows(db, 'pengeluaran') : [];
    const mekanik = tables.has('mekanik') ? rows(db, 'mekanik') : [];
    const kasir = tables.has('kasir') ? rows(db, 'kasir') : [];
    const toko = tables.has('toko') ? rows(db, 'toko')[0] || {} : {};
    const methods = new Map<number, string>((tables.has('metode_bayar') ? rows(db, 'metode_bayar') : []).map((r) => [num(r.id_metode_bayar), text(r.nama_metode_bayar)]));
    const productBySource = new Map<number, ProductItem>();
    const products: ProductItem[] = barang.filter((r) => num(r.status) !== 0).map((r) => {
      const product: ProductItem = { id: id('IMP-PROD', r.id_barang), name: text(r.nama_barang) || 'Produk tanpa nama', category: num(r.jenis_barang) === 2 ? 'Layanan' : 'Produk', price: num(r.harga), type: num(r.jenis_barang) === 2 ? 'service' : 'product', reqStaffRole: num(r.jenis_barang) === 2 ? 'Mekanik' : '', available: true, stock: num(r.stok), sku: text(r.barcode) || undefined, businessType: 'workshop', merchantId: auth.currentUser?.uid || undefined };
      productBySource.set(num(r.id_barang), product); return product;
    });
    const detailsByTx = new Map<number, Record<string, unknown>[]>();
    detail.forEach((r) => { const key = num(r.id_transaksi); detailsByTx.set(key, [...(detailsByTx.get(key) || []), r]); });
    const customersBySource = new Map<number, Customer>();
    pelanggan.filter((r) => num(r.status) !== 0).forEach((r) => { const cid = id('IMP-CUST', r.id_pelanggan); customersBySource.set(num(r.id_pelanggan), { id: cid, name: text(r.nama_pelanggan) || 'Pelanggan', phone: text(r.no_hp), customerCode: text(r.kode) || `IMP-${r.id_pelanggan}`, visitCount: 0, isMember: false, totalSpent: 0, lastVisit: '', notes: text(r.alamat) || undefined, createdAt: Date.now(), visitHistory: [], membershipVisits: [], membershipRedemptions: [] }); });
    const orders: Order[] = [];
    transaksi.forEach((r) => {
      const txId = num(r.id_transaksi); const dateInfo = parseDate(r.tgl_transaksi || r.tgl_lunas); const sourceItems = detailsByTx.get(txId) || []; const items: CartItem[] = sourceItems.map((d) => { const product = productBySource.get(num(d.id_barang)); return { id: product?.id || id('IMP-ITEM', d.id_detail_transaksi), name: text(d.nama_barang) || product?.name || 'Item', category: product?.category || (num(d.jenis_barang) === 2 ? 'Layanan' : 'Produk'), price: num(d.harga), type: num(d.jenis_barang) === 2 ? 'service' : 'product', reqStaffRole: num(d.jenis_barang) === 2 ? 'Mekanik' : '', available: true, stock: product?.stock, sku: text(d.kode) || product?.sku, qty: Math.max(1, num(d.qty)), note: text(d.catatan) || undefined, assignedTo: text(r.nama_mekanik) || undefined }; });
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0); const total = Math.max(0, num(r.total_harga)); const discount = Math.max(0, num(r.diskon) || subtotal - total); const sourceCustomer = customersBySource.get(num(r.id_pelanggan));
      const order: Order = { id: id('IMP-ORD', txId), date: dateInfo.date, time: dateInfo.time, timestamp: dateInfo.timestamp, customer: text(r.nama_pelanggan) || 'Umum', customerPhone: text(r.no_hp) || undefined, customerCode: sourceCustomer?.customerCode, items, subtotal, discount, discountType: 'Rp', discountValue: discount, total, status: num(r.status_transaksi) === 2 ? 'batal' : (num(r.status_bayar) === 1 ? 'selesai' : 'pending'), payment: paymentName(r.id_metode_bayar, methods), shift: text(r.antrian) || '', cashierName: text((kasir.find((k) => num(k.id_kasir) === num(r.id_kasir)) || {}).nama_kasir) || 'Kasir', businessType: 'workshop', merchantId: auth.currentUser?.uid || undefined };
      orders.push(order);
      if (sourceCustomer) { sourceCustomer.visitCount += order.status === 'selesai' ? 1 : 0; sourceCustomer.totalSpent += order.status === 'selesai' ? total : 0; sourceCustomer.lastVisit = dateInfo.date; const visit = { id: `VISIT-${order.id}`, date: dateInfo.date, time: dateInfo.time, amount: total, orderId: order.id, services: items.filter((x) => x.type === 'service').map((x) => x.name), staff: text(r.nama_mekanik) ? [text(r.nama_mekanik)] : [] }; sourceCustomer.visitHistory!.push(visit); sourceCustomer.membershipVisits!.push(visit); }
    });
    const customers = [...customersBySource.values()];
    const expenses: Expense[] = pengeluaran.map((r) => { const d = parseDate(r.tanggal_pengeluaran || r.tanggal_dibuat); return { id: `IMP-EXP-${text(r.id_pengeluaran)}`, date: d.date, timestamp: d.timestamp, payment: 'KAS TUNAI', category: 'Migrasi POS', name: text(r.nama_pengeluaran) || 'Pengeluaran', amount: num(r.nominal), businessType: 'workshop', merchantId: auth.currentUser?.uid || undefined }; });
    const staff = [{ role: 'Mekanik', names: mekanik.filter((r) => num(r.status) !== 0).map((r) => text(r.nama_mekanik)).filter(Boolean) }, { role: 'Kasir', names: kasir.filter((r) => num(r.status) !== 0).map((r) => text(r.nama_kasir)).filter(Boolean) }].filter((x) => x.names.length);
    const settings: Partial<StoreSettings> = { businessType: 'workshop', storeName: text(toko.nama_toko) || sourceName, storeAddress: text(toko.alamat_toko), footer: text(toko.bottom_message), categories: [...new Set(products.map((p) => p.category))], staffRoles: staff.map((x) => x.role), staffList: Object.fromEntries(staff.map((x) => [x.role, x.names])) };
    const warnings = ['PIN kasir dan kredensial dari database sumber tidak diimpor.', 'Foto/base64 besar dari database sumber tidak diimpor untuk mencegah backup membengkak.', 'Status transaksi sumber dipetakan: 1=selesai, 2=batal.'];
    if (sourceCode) warnings.push(`Sumber terdeteksi: ${sourceName} (${sourceCode}).`);
    return { kind: 'sqlite-pos', source: sourceName, createdAt: new Date().toISOString(), products, orders, customers, expenses, settings, staff, warnings };
  } finally { db.close(); }
}

export function migrationCounts(payload: MigrationPayload) { return { products: payload.products.length, orders: payload.orders.length, customers: payload.customers.length, expenses: payload.expenses.length, staff: payload.staff.reduce((n, x) => n + x.names.length, 0) }; }

const mergeById = <T extends { id?: string | number }>(current: T[], incoming: T[]): T[] => { const map = new Map(current.map((x) => [String(x.id), x])); incoming.forEach((x) => { const key = String(x.id || ''); if (key) map.set(key, map.has(key) ? { ...map.get(key), ...x } : x); }); return [...map.values()]; };

export async function restoreSqliteMigration(payload: MigrationPayload, mode: 'merge' | 'replace'): Promise<void> {
  const merchantId = auth.currentUser?.uid?.trim(); if (!merchantId) throw new Error('Akun belum terautentikasi.');
  const businessType = 'workshop'; const currentSettings = loadMerchantSettings(merchantId);
  const products = mode === 'replace' ? payload.products : mergeById(loadMerchantProducts(merchantId, businessType), payload.products);
  const orders = mode === 'replace' ? payload.orders : mergeById(loadMerchantOrders(merchantId, businessType), payload.orders);
  const expenses = mode === 'replace' ? payload.expenses : mergeById(loadMerchantExpenses(merchantId, businessType), payload.expenses);
  const customers = mode === 'replace' ? payload.customers : mergeById(loadCustomers(merchantId), payload.customers);
  const settings: StoreSettings = mode === 'replace' ? { ...currentSettings, ...payload.settings, businessType } : { ...currentSettings, storeName: currentSettings.storeName || payload.settings.storeName || '', storeAddress: currentSettings.storeAddress || payload.settings.storeAddress || '', footer: currentSettings.footer || payload.settings.footer || '', categories: [...new Set([...currentSettings.categories, ...(payload.settings.categories || [])])], staffRoles: [...new Set([...currentSettings.staffRoles, ...(payload.settings.staffRoles || [])])], staffList: Object.fromEntries([...new Set([...Object.keys(currentSettings.staffList || {}), ...Object.keys(payload.settings.staffList || {})])].map((role) => [role, [...new Set([...(currentSettings.staffList?.[role] || []), ...(payload.settings.staffList?.[role] || [])])]])), businessType: currentSettings.businessType === 'custom' && !currentSettings.storeName ? businessType : currentSettings.businessType };
  saveMerchantSettings(merchantId, settings); saveMerchantProducts(merchantId, businessType, products); saveMerchantOrders(merchantId, businessType, orders); saveMerchantExpenses(merchantId, businessType, expenses); saveCustomers(merchantId, customers);
  await Promise.allSettled([syncConfigToFirebase(settings, merchantId), syncProductsToFirebase(products, merchantId, businessType), syncOrdersToFirebase(orders, merchantId, businessType), syncExpensesToFirebase(expenses, merchantId, businessType), syncCustomersToFirebase(merchantId, customers)]);
}
