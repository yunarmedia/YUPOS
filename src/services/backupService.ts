import * as XLSX from 'xlsx';
import { auth } from '../config/firebase';
import { StoreSettings } from '../types';
import { loadMerchantSettings, saveMerchantSettings, loadMerchantProducts, saveMerchantProducts, loadMerchantOrders, saveMerchantOrders, loadMerchantExpenses, saveMerchantExpenses, loadMerchantPettyCash, saveMerchantPettyCash } from './storageService';
import { getCustomerStorageKey, loadCustomers, saveCustomers, syncCustomersToFirebase } from './customerService';
import { syncConfigToFirebase, syncProductsToFirebase, syncOrdersToFirebase } from './storageService';

export type BackupPayload = {
  format: 'YUPOS_BACKUP';
  version: 1;
  createdAt: string;
  merchantId: string;
  businessType: string;
  settings: StoreSettings;
  products: unknown[];
  orders: unknown[];
  expenses: unknown[];
  pettyCash: unknown;
  customers: unknown[];
};

function merchantIdOrThrow(): string {
  const id = auth.currentUser?.uid?.trim();
  if (!id) throw new Error('Akun belum terautentikasi.');
  return id;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function collectBackup(): BackupPayload {
  const merchantId = merchantIdOrThrow();
  const settings = loadMerchantSettings(merchantId);
  const businessType = settings.businessType || 'custom';
  return {
    format: 'YUPOS_BACKUP', version: 1, createdAt: new Date().toISOString(), merchantId, businessType,
    settings,
    products: loadMerchantProducts(merchantId, businessType),
    orders: loadMerchantOrders(merchantId, businessType),
    expenses: loadMerchantExpenses(merchantId, businessType),
    pettyCash: loadMerchantPettyCash(merchantId, businessType),
    customers: loadCustomers(merchantId),
  };
}

export function exportBin(): void {
  const payload = collectBackup();
  const json = JSON.stringify(payload);
  downloadBlob(new Blob([json], { type: 'application/octet-stream' }), `YUPOS_Backup_${payload.createdAt.replace(/[:.]/g, '-')}.bin`);
}

export function exportSpreadsheet(): void {
  const payload = collectBackup();
  const wb = XLSX.utils.book_new();
  const sheets: Array<[string, unknown]> = [
    ['SETTINGS', [payload.settings]], ['PRODUCTS', payload.products], ['ORDERS', payload.orders],
    ['EXPENSES', payload.expenses], ['PETTY_CASH', [payload.pettyCash]], ['CUSTOMERS', payload.customers],
  ];
  for (const [name, data] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Array.isArray(data) ? data : [data]), name);
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `YUPOS_Backup_${payload.createdAt.slice(0, 10)}.xlsx`);
}

function parseBin(file: File): Promise<BackupPayload> {
  return file.text().then((text) => {
    const parsed = JSON.parse(text) as BackupPayload;
    if (parsed?.format !== 'YUPOS_BACKUP' || parsed.version !== 1 || !parsed.settings) throw new Error('Format BIN bukan backup YUPOS yang valid.');
    return parsed;
  });
}

function parseSpreadsheet(file: File): Promise<BackupPayload> {
  return file.arrayBuffer().then((buffer) => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const rows = (name: string) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : [];
    const settingsRows = rows('SETTINGS');
    if (!settingsRows.length) throw new Error('Sheet SETTINGS tidak ditemukan.');
    return {
      format: 'YUPOS_BACKUP', version: 1, createdAt: new Date().toISOString(), merchantId: merchantIdOrThrow(),
      businessType: String((settingsRows[0] as any).businessType || 'custom'),
      settings: settingsRows[0] as StoreSettings,
      products: rows('PRODUCTS'), orders: rows('ORDERS'), expenses: rows('EXPENSES'),
      pettyCash: rows('PETTY_CASH')[0] ?? null, customers: rows('CUSTOMERS'),
    };
  });
}

export async function parseBackupFile(file: File): Promise<BackupPayload> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.bin')) return parseBin(file);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseSpreadsheet(file);
  throw new Error('Pilih file .BIN atau .XLSX.');
}

export function backupCounts(payload: BackupPayload) {
  return { products: payload.products.length, orders: payload.orders.length, expenses: payload.expenses.length, customers: payload.customers.length, settings: 1 };
}

export async function restoreBackup(payload: BackupPayload, mode: 'replace' | 'merge' = 'merge'): Promise<void> {
  const merchantId = merchantIdOrThrow();
  if (payload.merchantId && payload.merchantId !== merchantId && mode === 'replace') throw new Error('Backup berasal dari akun berbeda. Gunakan Merge untuk memindahkan data secara manual.');
  const settings = { ...loadMerchantSettings(merchantId), ...payload.settings };
  const businessType = String(payload.businessType || settings.businessType || 'custom') as any;
  const currentProducts = loadMerchantProducts(merchantId, businessType);
  const currentOrders = loadMerchantOrders(merchantId, businessType);
  const currentExpenses = loadMerchantExpenses(merchantId, businessType);
  const currentCustomers = loadCustomers(merchantId);
  const byId = (current: any[], incoming: any[]) => {
    const map = new Map(current.map((x) => [String(x.id || ''), x]));
    for (const x of incoming) { const id = String(x.id || ''); if (!id || !map.has(id)) map.set(id, x); else map.set(id, { ...map.get(id), ...x }); }
    return [...map.values()];
  };
  saveMerchantSettings(merchantId, settings);
  saveMerchantProducts(merchantId, businessType, (mode === 'replace' ? payload.products : byId(currentProducts, payload.products)) as any);
  saveMerchantOrders(merchantId, businessType, (mode === 'replace' ? payload.orders : byId(currentOrders, payload.orders)) as any);
  saveMerchantExpenses(merchantId, businessType, (mode === 'replace' ? payload.expenses : byId(currentExpenses, payload.expenses)) as any);
  saveMerchantPettyCash(merchantId, businessType, payload.pettyCash as any);
  const customers = mode === 'replace' ? payload.customers : byId(currentCustomers, payload.customers);
  saveCustomers(merchantId, customers as any);
  await Promise.allSettled([
    syncConfigToFirebase(merchantId, settings),
    syncProductsToFirebase(merchantId, businessType, (mode === 'replace' ? payload.products : byId(currentProducts, payload.products)) as any),
    syncOrdersToFirebase(merchantId, businessType, (mode === 'replace' ? payload.orders : byId(currentOrders, payload.orders)) as any),
    syncCustomersToFirebase(merchantId, customers as any),
  ]);
}
