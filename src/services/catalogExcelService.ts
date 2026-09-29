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

function findHeaderIndex(matrix: unknown[][]): number {
  return matrix.findIndex((row) =>
    Array.isArray(row) &&
    row.some((cell) => {
      const header = normalizeHeader(cell);
      return Boolean(HEADER_ALIASES[header]) ||
        ['nama', 'nama produk', 'nama item', 'nama item/menu', 'nama menu', 'sku', 'kode'].includes(header);
    }),
  );
}

function rowsFromWorkbook(workbook: XLSX.WorkBook): {
  rows: Record<string, unknown>[];
  sheetName: string;
  categories: string[];
} {
  if (!workbook.SheetNames.length) {
    throw new Error('Workbook Excel tidak memiliki sheet.');
  }

  const readMatrix = (sheetName: string): unknown[][] =>
    XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: true,
    });

  const categorySheetName = workbook.SheetNames.find(
    (name) => normalizeHeader(name) === 'kategori',
  );

  const importedCategories: string[] = [];
  if (categorySheetName) {
    const categoryMatrix = readMatrix(categorySheetName);
    const categoryHeaderIndex = findHeaderIndex(categoryMatrix);
    const categoryRowIndex = categoryHeaderIndex >= 0 ? categoryHeaderIndex : 0;
    const categoryHeaders = Array.isArray(categoryMatrix[categoryRowIndex])
      ? (categoryMatrix[categoryRowIndex] as unknown[]).map(normalizeHeader)
      : [];
    const categoryColumn = categoryHeaders.findIndex(
      (header) => header === 'kategori' || header === 'category' || header === 'nama',
    );

    categoryMatrix.slice(categoryRowIndex + 1).forEach((row) => {
      if (!Array.isArray(row)) return;
      const value = categoryColumn >= 0 ? row[categoryColumn] : row[1] ?? row[0];
      const category = sanitizeCategory(value);
      if (category) importedCategories.push(category);
    });
  }

  const preferredSheetNames = [
    'Item/Menu',
    'Produk',
    'Products',
    'Catalog',
    'Template Import',
    'Item',
    'Menu',
  ];

  const orderedSheetNames = [
    ...preferredSheetNames.filter((name) => workbook.Sheets[name]),
    ...workbook.SheetNames.filter((name) => !preferredSheetNames.includes(name)),
  ];

  let selectedSheetName = '';
  let selectedMatrix: unknown[][] = [];

  for (const name of orderedSheetNames) {
    if (normalizeHeader(name) === 'kategori') continue;
    const matrix = readMatrix(name);
    if (findHeaderIndex(matrix) >= 0) {
      selectedSheetName = name;
      selectedMatrix = matrix;
      break;
    }
  }

  if (!selectedSheetName) {
    throw new Error(
      'Header import tidak ditemukan. Gunakan file .xlsx dari Export Excel YUPOS atau template import YUPOS.',
    );
  }

  const headerIndex = findHeaderIndex(selectedMatrix);
  const rawHeaders = (selectedMatrix[headerIndex] as unknown[]).map(normalizeHeader);
  const headers = rawHeaders.map((header) => HEADER_ALIASES[header] || header);

  const rows = selectedMatrix
    .slice(headerIndex + 1)
    .filter(
      (row) =>
        Array.isArray(row) &&
        row.some((cell) => normalizeText(cell) !== ''),
    )
    .map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = (row as unknown[])[index];
      });
      return record;
    });

  return {
    sheetName: selectedSheetName,
    categories: Array.from(new Set(importedCategories)),
    rows,
  };
}

export async function importCatalogWorkbook(
  file: File,
  existingProducts: ProductItem[],
  settings: { businessType: ProductItem['businessType']; categories?: string[] },
): Promise<CatalogImportResult> {
  if (!file) throw new Error('File Excel tidak ditemukan.');
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error('Format file tidak didukung. Gunakan .xlsx atau .xls.');
  }
  if (file.size <= 0) throw new Error('File Excel kosong.');
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Ukuran file Excel terlalu besar. Maksimal 20 MB.');
  }

  let workbook: XLSX.WorkBook;
  try {
    const data = await file.arrayBuffer();
    workbook = XLSX.read(data, {
      type: 'array',
      cellDates: false,
      cellText: true,
      dense: true,
    });
  } catch (error) {
    console.error('YUPOS Excel read failed:', error);
    throw new Error('File Excel tidak dapat dibaca. Pastikan file tidak rusak dan benar-benar berformat .xlsx/.xls.');
  }

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
    // The imported row starts after the detected header; +2 matches the normal Excel row number.
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

  if (rows.length === 0 && workbookCategories.length === 0) {
    throw new Error('Tidak ada data katalog yang ditemukan di file Excel.');
  }

  return {
    products: next,
    categories: Array.from(categories),
    created,
    updated,
    skipped,
    errors: errors.slice(0, 50),
  };
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
