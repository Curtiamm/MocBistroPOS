import { useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  X,
} from 'lucide-react';
import {
  DiscountType,
  OrderItem,
  PaymentMethod,
  TableEntity,
  TableOrder,
} from '../types/pos';
import { CheckoutPayload } from '../hooks/usePosStore';
import { calculateTotals, formatVnd } from '../utils/format';

interface CheckoutModalProps {
  table: TableEntity;
  order: TableOrder;
  defaultVatRate: number;
  restaurantName: string;
  onConfirmCheckout: (payload: CheckoutPayload) => void;
  onClose: () => void;
}

const CASH_PRESETS = [100000, 200000, 500000, 1000000];

// Deterministic clean geometric QR matrix SVG for bank transfer preview
function TransferQrSvg({ seed }: { seed: string }) {
  const size = 21;
  const cells: Array<{ x: number; y: number }> = [];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isFinder(x, y)) continue;
      const bit = ((hash ^ (x * 37 + y * 91)) >>> ((x + y) % 16)) & 1;
      if (bit === 1) cells.push({ x, y });
    }
  }

  const renderFinder = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width={7} height={7} fill="#231D19" />
      <rect x={ox + 1} y={oy + 1} width={5} height={5} fill="#FFFFFF" />
      <rect x={ox + 2} y={oy + 2} width={3} height={3} fill="#1E4D3B" />
    </g>
  );

  return (
    <svg
      viewBox={`-1 -1 ${size + 2} ${size + 2}`}
      className="w-32 h-32 bg-white border border-[#E5DDD2] rounded-lg p-1.5 shrink-0"
      aria-label="Mã QR chuyển khoản ngân hàng"
    >
      {renderFinder(0, 0)}
      {renderFinder(size - 7, 0)}
      {renderFinder(0, size - 7)}
      {cells.map((c, idx) => (
        <rect key={idx} x={c.x} y={c.y} width={1} height={1} fill="#231D19" />
      ))}
    </svg>
  );
}

export function CheckoutModal({
  table,
  order,
  defaultVatRate,
  restaurantName,
  onConfirmCheckout,
  onClose,
}: CheckoutModalProps) {
  const [mode, setMode] = useState<'full' | 'split_items' | 'split_even'>('full');
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(order.items.map((item) => [item.id, item.quantity]))
  );
  const [evenSplitCount, setEvenSplitCount] = useState<number>(Math.max(2, order.guests));

  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [vatEnabled, setVatEnabled] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const billedItems: OrderItem[] = useMemo(() => {
    if (mode !== 'split_items') return order.items;
    return order.items
      .map((item) => ({
        ...item,
        quantity: Math.max(0, Math.min(item.quantity, selectedItemQuantities[item.id] ?? 0)),
      }))
      .filter((item) => item.quantity > 0);
  }, [mode, order.items, selectedItemQuantities]);

  const totals = useMemo(
    () =>
      calculateTotals({
        items: billedItems,
        discountType,
        discountValue,
        vatEnabled,
        vatRate: defaultVatRate,
      }),
    [billedItems, discountType, discountValue, vatEnabled, defaultVatRate]
  );

  const perPersonAmount = useMemo(() => {
    if (mode !== 'split_even' || evenSplitCount <= 1) return totals.total;
    return Math.ceil(totals.total / evenSplitCount);
  }, [mode, evenSplitCount, totals.total]);

  const parsedCashReceived =
    cashReceivedInput.trim() === '' ? totals.total : Number(cashReceivedInput.replace(/[^\d]/g, ''));
  const cashShortage = paymentMethod === 'cash' && parsedCashReceived < totals.total;
  const changeDue =
    paymentMethod === 'cash' ? Math.max(0, parsedCashReceived - totals.total) : 0;

  const adjustItemSplitQty = (itemId: string, maxQty: number, delta: number) => {
    setError(null);
    setSelectedItemQuantities((prev) => {
      const current = prev[itemId] ?? 0;
      return { ...prev, [itemId]: Math.max(0, Math.min(maxQty, current + delta)) };
    });
  };

  const handleConfirm = () => {
    setError(null);
    if (billedItems.length === 0) {
      setError('Vui lòng chọn ít nhất 1 món để thanh toán.');
      return;
    }
    if (paymentMethod === 'cash' && parsedCashReceived < totals.total) {
      setError('Số tiền khách đưa nhỏ hơn tổng tiền cần thanh toán.');
      return;
    }

    onConfirmCheckout({
      tableId: table.id,
      mode,
      selectedItemQuantities: mode === 'split_items' ? selectedItemQuantities : undefined,
      evenSplitCount: mode === 'split_even' ? evenSplitCount : undefined,
      discountType,
      discountValue,
      discountReason,
      vatEnabled,
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? parsedCashReceived : totals.total,
    });
  };

  const remainingItemsAfterSplit = useMemo(() => {
    if (mode !== 'split_items') return 0;
    return order.items.reduce(
      (sum, item) => sum + Math.max(0, item.quantity - (selectedItemQuantities[item.id] ?? 0)),
      0
    );
  }, [mode, order.items, selectedItemQuantities]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Thanh toán và chia hóa đơn"
    >
      <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
          <div>
            <h2 className="font-display text-xl font-bold text-[#231D19]">
              Thanh toán · {table.name}
            </h2>
            <p className="text-xs text-[#6B6056] mt-0.5">
              {table.zone} · {order.guests} khách · {order.items.length} dòng món
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg hover:bg-[#F7F4EE] transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Column Checkout Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E5DDD2]">
          {/* LEFT: Billing Mode + Item List */}
          <div className="lg:col-span-6 p-6 space-y-5">
            {/* Mode Selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#6B6056]">Chế độ xuất hóa đơn</p>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F4EE] rounded-lg border border-[#E5DDD2]">
                {[
                  { id: 'full' as const, label: 'Nguyên bàn' },
                  { id: 'split_items' as const, label: 'Tách theo món' },
                  { id: 'split_even' as const, label: 'Chia đều' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMode(opt.id);
                      setError(null);
                    }}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      mode === opt.id
                        ? 'bg-white text-[#231D19] shadow-xs'
                        : 'text-[#6B6056] hover:text-[#231D19]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'split_even' && (
              <div className="p-4 bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#231D19]">Chia đều hóa đơn</p>
                  <p className="text-xs text-[#6B6056] mt-0.5">
                    Mỗi người:{' '}
                    <strong className="font-tabular text-[#1E4D3B] text-sm">
                      {formatVnd(perPersonAmount)}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEvenSplitCount((c) => Math.max(2, c - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-[#E5DDD2] hover:bg-[#EFEAE0]"
                    aria-label="Giảm số người chia"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-tabular text-sm font-bold w-14 text-center">
                    {evenSplitCount} người
                  </span>
                  <button
                    type="button"
                    onClick={() => setEvenSplitCount((c) => Math.min(20, c + 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-[#E5DDD2] hover:bg-[#EFEAE0]"
                    aria-label="Tăng số người chia"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {mode === 'split_items' && (
              <p className="text-xs text-[#6B6056]">
                Chọn số lượng món thanh toán ngay.{' '}
                {remainingItemsAfterSplit > 0 ? (
                  <strong className="text-[#B4691E]">
                    Còn {remainingItemsAfterSplit} phần món sẽ giữ lại trên {table.name}.
                  </strong>
                ) : (
                  <span>Đã chọn toàn bộ món trên bàn.</span>
                )}
              </p>
            )}

            {/* Items Table */}
            <div className="border border-[#E5DDD2] rounded-lg divide-y divide-[#E5DDD2] max-h-[340px] overflow-y-auto">
              {order.items.map((item) => {
                const payQty =
                  mode === 'split_items'
                    ? selectedItemQuantities[item.id] ?? 0
                    : item.quantity;

                return (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#231D19] truncate">{item.name}</p>
                      <p className="text-xs text-[#6B6056] font-tabular">
                        {formatVnd(item.unitPrice)} × {item.quantity}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    </div>

                    {mode === 'split_items' ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustItemSplitQty(item.id, item.quantity, -1)}
                          disabled={payQty === 0}
                          className="w-7 h-7 flex items-center justify-center rounded border border-[#E5DDD2] hover:bg-[#F7F4EE] disabled:opacity-35"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-tabular text-xs font-bold w-8 text-center">
                          {payQty}/{item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustItemSplitQty(item.id, item.quantity, 1)}
                          disabled={payQty >= item.quantity}
                          className="w-7 h-7 flex items-center justify-center rounded border border-[#E5DDD2] hover:bg-[#F7F4EE] disabled:opacity-35"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-tabular font-semibold text-[#231D19] shrink-0">
                        {formatVnd(item.unitPrice * item.quantity)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Discount, VAT & Payment Method */}
          <div className="lg:col-span-6 p-6 space-y-5 bg-[#FAF8F4]">
            {/* Discount Controls */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#6B6056]">
                  Chiết khấu / Giảm giá
                </label>
                <div className="flex items-center gap-1 p-0.5 bg-[#EFEAE0] rounded-md">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      setDiscountValue(0);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      discountType === 'percent'
                        ? 'bg-white text-[#231D19]'
                        : 'text-[#6B6056]'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('amount');
                      setDiscountValue(0);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      discountType === 'amount'
                        ? 'bg-white text-[#231D19]'
                        : 'text-[#6B6056]'
                    }`}
                  >
                    VNĐ
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min={0}
                  max={discountType === 'percent' ? 100 : totals.subtotal}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                  placeholder={discountType === 'percent' ? 'VD: 10 (%)' : 'VD: 50000 (₫)'}
                  className="px-3 py-2 text-sm font-tabular bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Lý do (VD: Khách VIP)"
                  className="px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              {discountType === 'percent' && (
                <div className="flex items-center gap-1.5">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountValue(pct)}
                      className={`px-2.5 py-1 text-xs font-tabular font-medium rounded border transition-colors ${
                        discountValue === pct
                          ? 'bg-[#1E4D3B] text-white border-[#1E4D3B]'
                          : 'bg-white text-[#6B6056] border-[#E5DDD2] hover:text-[#231D19]'
                      }`}
                    >
                      {pct === 0 ? 'Không giảm' : `-${pct}%`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* VAT Toggle & Summary */}
            <div className="p-4 bg-white border border-[#E5DDD2] rounded-lg space-y-2 text-sm">
              <div className="flex justify-between text-[#6B6056]">
                <span>Tạm tính ({billedItems.reduce((s, i) => s + i.quantity, 0)} món)</span>
                <span className="font-tabular text-[#231D19]">{formatVnd(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-[#B4691E]">
                  <span>Chiết khấu</span>
                  <span className="font-tabular">-{formatVnd(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[#6B6056]">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={vatEnabled}
                    onChange={(e) => setVatEnabled(e.target.checked)}
                    className="rounded border-[#E5DDD2] accent-[#1E4D3B] w-4 h-4"
                  />
                  <span>Áp dụng thuế VAT ({defaultVatRate}%)</span>
                </label>
                <span className="font-tabular text-[#231D19]">{formatVnd(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-[#E5DDD2] text-lg font-bold text-[#231D19]">
                <span>Khách cần trả</span>
                <span className="font-tabular text-[#1E4D3B]">{formatVnd(totals.total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#6B6056]">Phương thức thanh toán</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash' as const, label: 'Tiền mặt', icon: Banknote },
                  { id: 'transfer' as const, label: 'Chuyển khoản', icon: QrCode },
                  { id: 'card' as const, label: 'Thẻ POS', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id);
                        setError(null);
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1E4D3B] text-white border-[#1E4D3B]'
                          : 'bg-white text-[#231D19] border-[#E5DDD2] hover:bg-[#F7F4EE]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cash Input & Change Calculator */}
              {paymentMethod === 'cash' && (
                <div className="p-4 bg-white border border-[#E5DDD2] rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="cash-received"
                      className="text-xs font-semibold text-[#231D19] whitespace-nowrap"
                    >
                      Tiền khách đưa
                    </label>
                    <input
                      id="cash-received"
                      type="number"
                      min={0}
                      step={1000}
                      value={cashReceivedInput}
                      onChange={(e) => {
                        setCashReceivedInput(e.target.value);
                        setError(null);
                      }}
                      placeholder={String(totals.total)}
                      className="w-44 text-right px-3 py-1.5 text-sm font-tabular font-semibold border border-[#E5DDD2] rounded-md focus:outline-none focus:border-[#1E4D3B]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashReceivedInput(String(totals.total))}
                      className="px-2.5 py-1 text-xs font-medium bg-[#F7F4EE] hover:bg-[#EFEAE0] border border-[#E5DDD2] rounded text-[#231D19]"
                    >
                      Đúng số tiền
                    </button>
                    {CASH_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashReceivedInput(String(amount))}
                        className="px-2.5 py-1 text-xs font-tabular font-medium bg-[#F7F4EE] hover:bg-[#EFEAE0] border border-[#E5DDD2] rounded text-[#231D19]"
                      >
                        {amount.toLocaleString('vi-VN')}₫
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#E5DDD2] flex items-center justify-between text-sm">
                    <span className="text-[#6B6056]">Tiền thối lại</span>
                    {cashShortage ? (
                      <span className="font-tabular font-semibold text-[#9E2A2B]">
                        Thiếu {formatVnd(totals.total - parsedCashReceived)}
                      </span>
                    ) : (
                      <span className="font-tabular font-bold text-[#1F6E4A]">
                        {formatVnd(changeDue)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Bank Transfer QR */}
              {paymentMethod === 'transfer' && (
                <div className="p-4 bg-white border border-[#E5DDD2] rounded-lg flex items-center gap-4">
                  <TransferQrSvg seed={`${table.id}-${totals.total}`} />
                  <div className="text-xs space-y-1.5 min-w-0">
                    <p className="font-semibold text-[#231D19] text-sm">
                      Chuyển khoản VietQR
                    </p>
                    <p className="text-[#6B6056]">
                      Ngân hàng: <strong className="text-[#231D19]">Vietcombank</strong>
                    </p>
                    <p className="text-[#6B6056]">
                      Số TK: <strong className="font-tabular text-[#231D19]">1028 6688 9999</strong>
                    </p>
                    <p className="text-[#6B6056]">
                      Chủ TK: <strong className="text-[#231D19]">{restaurantName.toUpperCase()}</strong>
                    </p>
                    <p className="text-[#6B6056]">
                      Nội dung:{' '}
                      <strong className="font-tabular text-[#1E4D3B]">
                        TT {table.name.toUpperCase()}
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Card POS */}
              {paymentMethod === 'card' && (
                <div className="p-4 bg-white border border-[#E5DDD2] rounded-lg text-xs text-[#6B6056] leading-relaxed">
                  Vui lòng thực hiện quẹt thẻ / chạm NFC số tiền{' '}
                  <strong className="font-tabular text-[#231D19]">{formatVnd(totals.total)}</strong>{' '}
                  trên máy POS ngân hàng, sau đó nhấn xác nhận thanh toán để xuất hóa đơn.
                </div>
              )}
            </div>

            {error && <p className="text-xs font-semibold text-[#9E2A2B]">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5DDD2] flex items-center justify-between gap-4">
          <div className="text-xs text-[#6B6056]">
            Sau khi xác nhận sẽ mở ngay bản xem trước hóa đơn nhiệt 80mm để in.
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-[#6B6056] hover:text-[#231D19] border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE] transition-colors whitespace-nowrap"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={billedItems.length === 0 || cashShortage}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              Xác nhận thanh toán · {formatVnd(totals.total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
