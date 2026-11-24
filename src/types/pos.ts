export type ZoneName = 'Tầng 1' | 'Ban công' | 'Phòng riêng';

export type TableStatus = 'available' | 'occupied';

export interface TableEntity {
  id: string;
  name: string;
  zone: ZoneName;
  capacity: number;
  status: TableStatus;
  activeOrderId: string | null;
}

export type MenuCategory = 'Khai vị' | 'Món chính' | 'Đồ uống' | 'Tráng miệng';

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  category: MenuCategory;
  price: number;
  available: boolean;
  description: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  code: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string;
}

export interface TableOrder {
  id: string;
  tableId: string;
  openedAt: string; // ISO string
  guests: number;
  items: OrderItem[];
  note: string;
}

export type DiscountType = 'percent' | 'amount';

export type PaymentMethod = 'cash' | 'transfer' | 'card';

export interface InvoiceDiscount {
  type: DiscountType;
  value: number;
  amount: number;
  reason: string;
}

export interface Invoice {
  id: string;
  code: string;
  shiftId: string;
  tableId: string;
  tableName: string;
  zone: ZoneName;
  openedAt: string;
  paidAt: string;
  guests: number;
  items: OrderItem[];
  subtotal: number;
  discount: InvoiceDiscount | null;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeDue: number;
  splitLabel?: string;
  status: 'paid' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface ShiftRecord {
  id: string;
  code: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  actualClosingCash: number | null;
  expectedClosingCash: number | null;
  cashDifference: number | null;
  closingNote?: string;
  status: 'open' | 'closed';
}

export interface PosState {
  version: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  defaultVatRate: number;
  tables: TableEntity[];
  menu: MenuItem[];
  orders: Record<string, TableOrder>;
  invoices: Invoice[];
  shifts: ShiftRecord[];
  activeShiftId: string | null;
  invoiceCounter: number;
}

export type ActiveView = 'floor' | 'order' | 'reports' | 'menu';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
