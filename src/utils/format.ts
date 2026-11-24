import { DiscountType, OrderItem } from '../types/pos';

export function formatVnd(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('vi-VN')}₫`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} · ${date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatElapsedMinutes(openedAt: string, nowMs: number = Date.now()): string {
  const diffMs = Math.max(0, nowMs - new Date(openedAt).getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'Vừa mở';
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours} giờ` : `${hours}g ${mins}p`;
}

export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function calculateTotals(params: {
  items: OrderItem[];
  discountType: DiscountType;
  discountValue: number;
  vatEnabled: boolean;
  vatRate: number;
}) {
  const subtotal = calculateSubtotal(params.items);
  let discountAmount = 0;

  if (params.discountValue > 0 && subtotal > 0) {
    if (params.discountType === 'percent') {
      const clampedPct = Math.min(100, Math.max(0, params.discountValue));
      discountAmount = Math.round((subtotal * clampedPct) / 100);
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, Math.round(params.discountValue)));
    }
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount = params.vatEnabled
    ? Math.round((afterDiscount * params.vatRate) / 100)
    : 0;
  const total = afterDiscount + vatAmount;

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    total,
  };
}

export function generateInvoiceCode(counter: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `HD-${yy}${mm}${dd}-${String(counter).padStart(3, '0')}`;
}

export function generateShiftCode(count: number): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `CA-${dd}${mm}-${String(count).padStart(2, '0')}`;
}

export function paymentMethodLabel(method: 'cash' | 'transfer' | 'card'): string {
  switch (method) {
    case 'cash':
      return 'Tiền mặt';
    case 'transfer':
      return 'Chuyển khoản';
    case 'card':
      return 'Thẻ POS';
  }
}
