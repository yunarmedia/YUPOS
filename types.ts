export type BusinessType = 
  | 'barbershop' 
  | 'salon' 
  | 'fnb' 
  | 'retail' 
  | 'laundry' 
  | 'workshop' 
  | 'custom';

export type ItemType = 'service' | 'product';

export interface BusinessCategoryPreset {
  id: BusinessType;
  name: string;
  tagline: string;
  icon: string;
  identifierLabel: string; // e.g. "No. Meja / Pemesan" or "Kursi / Nama Pelanggan"
  defaultStaffRoles: string[];
  defaultCategories: string[];
  defaultItems: ProductItem[];
  defaultPaymentMethods: string[];
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  type: ItemType; // 'service' (Jasa) or 'product' (Barang)
  reqStaffRole: string;
  available: boolean;
  stock?: number;
  sku?: string;
  deleted?: boolean;
  businessType?: BusinessType;
  merchantId?: string;
}

export interface CartItem extends ProductItem {
  qty: number;
  note?: string;
  assignedTo?: string; // name of staff who performed the service
}

export type OrderStatus = 'selesai' | 'pending' | 'batal';

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD or DD/MM/YYYY
  time: string;
  timestamp: number;
  customer: string; // Customer name / Table / Seat / Plate / Note
  customerPhone?: string;
  customerCode?: string;
  customerIsMember?: boolean;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountType: 'Rp' | '%';
  discountValue: number;
  ppn?: number;
  ppnRate?: number;
  total: number;
  status: OrderStatus;
  payment: string; // 'Cash' | 'QRIS' | 'Bank Transfer' | 'Shopeefood' | 'Gofood' | 'Grabfood' | etc.
  shift: string; // '1' | '2' | 'Online Web'
  cashierName: string;
  businessType?: BusinessType;
  merchantId?: string;
}

export interface Customer {
  id: string;
  merchantId?: string;
  name: string;
  phone: string;
  customerCode: string; // 2 first letters (capital) + 4 last digits of phone
  visitCount: number;
  isMember: boolean;
  memberSince?: string;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
  createdAt?: number;
}

export interface Expense {
  id: number | string;
  date: string;
  timestamp: number;
  payment: 'KAS TUNAI' | 'KAS NON PPN' | 'BANK / TRANSFER' | 'HUTANG USAHA' | string;
  category: string;
  name: string;
  amount: number;
  photo?: string;
  businessType?: BusinessType;
  merchantId?: string;
}

export interface PortalPins {
  admin?: string;
  expenses: string;
  inventory: string;
  staff: string;
  settings: string;
  historyDeletePin?: string;
  historyEditPin?: string;
}

export interface StoreSettings {
  businessType: BusinessType;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  footer: string;
  logoBase64: string;
  shift1Name: string;
  shift2Name: string;
  shift1Start?: string; // e.g. "10:00"
  shift1End?: string;   // e.g. "13:00"
  shift2Start?: string; // e.g. "13:00"
  shift2End?: string;   // e.g. "22:00"
  activeShift: '1' | '2';
  manualOverride: boolean;
  portalPins: PortalPins;
  btAutoPrint: boolean;
  printerPaperWidth?: '58mm' | '80mm';
  ppnEnabled?: boolean;
  ppnRate?: number;
  categories: string[];
  staffRoles: string[];
  staffList: Record<string, string[]>; // role -> list of names
}

export interface MerchantUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
