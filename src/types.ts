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
  identifierLabel: string;
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
  type: ItemType;
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
  assignedTo?: string;
}

export type OrderStatus = 'selesai' | 'pending' | 'batal';

export interface Order {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  customer: string;
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
  payment: string;
  shift: string;
  cashierName: string;
  businessType?: BusinessType;
  merchantId?: string;
}

export interface MembershipVisit {
  id: string;
  date: string;
  time: string;
  amount: number;
  orderId?: string;
  services: string[];
  staff: string[];
}

export type MembershipRewardType = 'discount50' | 'freeHaircut';

export interface MembershipRedemption {
  id: string;
  type: MembershipRewardType;
  date: string;
  visitCount: number;
}

export interface Customer {
  id: string;
  merchantId?: string;
  name: string;
  phone: string;
  customerCode: string;
  visitCount: number;
  isMember: boolean;
  memberSince?: string;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
  createdAt?: number;
  membershipVisits?: MembershipVisit[];
  membershipRedemptions?: MembershipRedemption[];
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
  historyCancelPin?: string;
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
  shift1Start?: string;
  shift1End?: string;
  shift2Start?: string;
  shift2End?: string;
  activeShift: '1' | '2';
  manualOverride: boolean;
  portalPins: PortalPins;
  btAutoPrint: boolean;
  printerPaperWidth?: '58mm' | '80mm';
  ppnEnabled?: boolean;
  ppnRate?: number;
  categories: string[];
  staffRoles: string[];
  staffList: Record<string, string[]>;
}

export interface MerchantUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
