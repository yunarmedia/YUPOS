import * as XLSX from 'xlsx';
import { ProductItem, ItemType } from '../types';

export interface CatalogImportResult {
  products: ProductItem[];
  categories: string[];
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string> = {
  id: 'id',
  kode: 'id',
  sku: 'sku',
  nama: 'name',
  'nama produk': 'name',
  'nama item': 'name',
  'nama menu': 'name',
  'nama layanan': 'name',
  kategori: 'category',
  category: 'category',
  jenis: 'type',
  tipe: 'type',
  type: 'type',
  harga: 'price',
  'harga jual': 'price',
  stok: 'stock',
  stock: 'stock',
  tersedia: 'available',
  available: 'available',
  status: 'available',
  'peran petugas': 'reqStaffRole',
  role: 'reqStaffRole',
  'req staff role': 'reqStaffRole',
};

const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const parseBoolean = (value: unknown, fallback = true): boolean => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'ya', 'y', 'ready', 'tersedia', 'aktif'].includes(normalized)) return true;
  if (['false', '0', 'no', 'tidak', 'n', 'habis', 'nonaktif', 'tidak tersedia'].includes(normalized)) return false;
  return fallback;
};

const parseNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  const cleaned = normalizeText(value)
    .replace(/rp/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
};

const parseItemType = (value: unknown): ItemType | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (['service', 'jasa', 'layanan', 'treatment'].includes(normalized)) return 'service';
  if (['product', 'produk', 'barang', 'fisik', 'item'].includes(normalized)) return 'product';
  return null;
};

const sanitizeName = (value: unknown): string => normalizeText(value).slice(0, 120);
const sanitizeCategory = (value: unknown): string => normalizeText(value).slice(0, 80);
const sanitizeRole = (value: unknown): string => normalizeText(value).slice(0, 80);
const sanitizeSku = (value: unknown): string => normalizeText(value).slice(0, 80);

const createProductId = (): string =>
  `PRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

function rowsFromWorkbook(workbook: XLSX.WorkBook): { rows: Record<string, unknown>[]; sheetName: string; categories: string[] } {
  const preferred = ['Item', 'Menu', 'Produk', 'Products', 'Catalog', 'Template Import'];
  const candidates = [...preferred, ...workbook.SheetNames].filter((name, index, arr) => arr.indexOf(name) === index);
  const sheetName = candidates.find((name) => workbook.Sheets[name]) || workbook.SheetNames[0];
  if (!sheetName) throw new Error('Workbook Excel tidak memiliki sheet.');

  const categorySheet = workbook.Sheets['Kategori'];
  const importedCategories = categorySheet
    ? XLSX.utils.sheet_to_json<unknown[]>(categorySheet, { header: 1, defval: null, raw: true })
        .slice(1)
        .map((row) => sanitizeCategory(Array.isArray(row) ? row[1] : ''))
        .filter(Boolean)
    : [];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = matrix.findIndex((row) =>
    Array.isArray(row) && row.some((cell) => ['nama', 'nama produk', 'nama item', 'nama menu', 'sku', 'kode'].includes(normalizeHeader(cell)))
  );

  if (headerIndex < 0) throw new Error('Header import tidak ditemukan. Gunakan template YUPOS.');

  const rawHeaders = (matrix[headerIndex] as unknown[]).map(normalizeHeader);
  const headers = rawHeaders.map((header) => HEADER_ALIASES[header] || header);

  return {
    sheetName,
    categories: importedCategories,
    rows: matrix.slice(headerIndex + 1)
      .filter((row) => Array.isArray(row) && row.some((cell) => normalizeText(cell) !== ''))
      .map((row) => {
        const record: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (header) record[header] = (row as unknown[])[index];
        });
        return record;
      }),
  };
}

export function importCatalogWorkbook(
  file: File,
  existingProducts: ProductItem[],
  settings: { businessType: ProductItem['businessType']; categories?: string[] },
): Promise<CatalogImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Gagal membaca file Excel.'));
    reader.onload = () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) throw new Error('Format file Excel tidak dapat dibaca.');

        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const { rows, categories: workbookCategories } = rowsFromWorkbook(workbook);

        const next = [...existingProducts];
        const categories = new Set<string>(settings.categories || []);
        workbookCategories.forEach((category) => categories.add(category));
        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        const existingByKey = new Map<string, ProductItem>();
        next.forEach((product) => {
          const idKey = normalizeText(product.id).toLowerCase();
          const skuKey = normalizeText(product.sku).toLowerCase();
          if (idKey) existingByKey.set(`id:${idKey}`, product);
          if (skuKey) existingByKey.set(`sku:${skuKey}`, product);
          if (product.category) categories.add(product.category);
        });

        rows.forEach((row, rowIndex) => {
          const excelRow = rowIndex + 2;
          const name = sanitizeName(row.name);
          const category = sanitizeCategory(row.category) || 'Umum';
          const price = parseNonNegativeNumber(row.price);
          const type = parseItemType(row.type) || 'product';
          const stock = row.stock === undefined || row.stock === null || normalizeText(row.stock) === ''
            ? undefined
            : parseNonNegativeNumber(row.stock);
          const sku = sanitizeSku(row.sku);
          const requestedId = sanitizeSku(row.id);

          if (!name) {
            skipped += 1;
            errors.push(`Baris ${excelRow}: nama item wajib diisi.`);
            return;
          }
          if (price === null) {
            skipped += 1;
            errors.push(`Baris ${excelRow}: harga tidak valid.`);
            return;
          }
          if (row.stock !== undefined && row.stock !== null && normalizeText(row.stock) !== '' && stock === null) {
            skipped += 1;
            errors.push(`Baris ${excelRow}: stok tidak valid.`);
            return;
          }

          const existing =
            (requestedId && existingByKey.get(`id:${requestedId.toLowerCase()}`)) ||
            (sku && existingByKey.get(`sku:${sku.toLowerCase()}`));

          if (existing) {
            const merged: ProductItem = {
              ...existing,
              name,
              category,
              price,
              type,
              reqStaffRole: sanitizeRole(row.reqStaffRole) || existing.reqStaffRole || 'Kasir',
              available: parseBoolean(row.available, existing.available ?? true),
              stock: type === 'product' ? stock : undefined,
              sku: sku || existing.sku,
              businessType: settings.businessType,
              merchantId: existing.merchantId,
              deleted: false,
            };

            const index = next.findIndex((product) => product.id === existing.id);
            if (index >= 0) next[index] = merged;
            updated += 1;
            categories.add(category);
            existingByKey.set(`id:${existing.id.toLowerCase()}`, merged);
            if (merged.sku) existingByKey.set(`sku:${merged.sku.toLowerCase()}`, merged);
            return;
          }

          const product: ProductItem = {
            id: requestedId || createProductId(),
            name,
            category,
            price,
            type,
            reqStaffRole: sanitizeRole(row.reqStaffRole) || 'Kasir',
            available: parseBoolean(row.available, true),
            stock: type === 'product' ? stock : undefined,
            sku: sku || undefined,
            businessType: settings.businessType,
          };

          next.push(product);
          created += 1;
          categories.add(category);
          existingByKey.set(`id:${product.id.toLowerCase()}`, product);
          if (product.sku) existingByKey.set(`sku:${product.sku.toLowerCase()}`, product);
        });

        resolve({
          products: next,
          categories: Array.from(categories),
          created,
          updated,
          skipped,
          errors: errors.slice(0, 50),
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('File Excel tidak dapat diproses.'));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

export function exportCatalogWorkbook(
  products: ProductItem[],
  categories: string[],
  businessType: ProductItem['businessType'],
): void {
  const visibleProducts = products.filter((product) => !product.deleted && (!product.businessType || product.businessType === businessType));
  const categoryNames = Array.from(new Set([...categories, ...visibleProducts.map((product) => product.category).filter(Boolean)])).sort((a, b) => a.localeCompare(b, 'id'));

  const categoryRows = categoryNames.map((category, index) => ({
    No: index + 1,
    Kategori: category,
  }));

  const productRows = visibleProducts.map((product) => ({
    ID: product.id,
    SKU: product.sku || '',
    Nama: product.name,
    Kategori: product.category,
    Jenis: product.type === 'service' ? 'Jasa' : 'Produk',
    Harga: product.price,
    Stok: product.type === 'product' ? product.stock ?? '' : '',
    Tersedia: product.available ? 'Ya' : 'Tidak',
    'Peran Petugas': product.reqStaffRole || '',
  }));

  const itemRows = visibleProducts.map((product) => ({
    ID: product.id,
    SKU: product.sku || '',
    'Nama Item/Menu': product.name,
    Kategori: product.category,
    Jenis: product.type === 'service' ? 'Jasa' : 'Produk',
    Harga: product.price,
    Stok: product.type === 'product' ? product.stock ?? '' : '',
    Status: product.available ? 'Ready' : 'Habis',
    'Role/Petugas': product.reqStaffRole || '',
  }));

  const templateRows = [
    {
      ID: '',
      SKU: '',
      Nama: 'Contoh Menu / Produk',
      Kategori: categoryNames[0] || 'Umum',
      Jenis: 'Produk',
      Harga: 15000,
      Stok: 10,
      Tersedia: 'Ya',
      'Peran Petugas': 'Kasir',
    },
  ];

  const wb = XLSX.utils.book_new();
  const append = (name: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws['!autofilter'] = { ref: ws['!ref'] || 'A1:A1' };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  append('Kategori', categoryRows);
  append('Produk', productRows);
  append('Item/Menu', itemRows);
  append('Template Import', templateRows);

  const fileName = `YUPOS_Katalog_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // Mobile-safe generation: avoid ZIP compression overhead on Android/WebView.
  const output = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: false,
  });

  const blob = new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  try {
    // SheetJS handles browser download behavior and is the primary path.
    XLSX.writeFile(wb, fileName, {
      bookType: 'xlsx',
      compression: false,
    });
  } catch (writeFileError) {
    console.warn('YUPOS catalog writeFile fallback:', writeFileError);

    // Fallback for browsers/WebViews that block SheetJS's download handling.
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);

    try {
      anchor.click();
    } finally {
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }
}
