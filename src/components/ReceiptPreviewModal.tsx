import { Printer, X } from 'lucide-react';
import { Invoice } from '../types/pos';
import { formatDateTime, formatVnd, paymentMethodLabel } from '../utils/format';

interface ReceiptPreviewModalProps {
  invoice: Invoice;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({
  invoice,
  restaurantName,
  restaurantAddress,
  restaurantPhone,
  onClose,
}: ReceiptPreviewModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/50 p-4 print:static print:inset-auto print:bg-white print:p-0 print:block"
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước hóa đơn nhiệt 80mm"
    >
      <div className="bg-[#F7F4EE] border border-[#E5DDD2] rounded-xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl print:max-w-none print:max-h-none print:border-none print:shadow-none print:bg-white">
        {/* Modal Header (hidden in print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-white border-b border-[#E5DDD2]">
          <div>
            <h2 className="text-sm font-semibold text-[#231D19]">
              Hóa đơn khổ 80mm · <span className="font-tabular">{invoice.code}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg hover:bg-[#F7F4EE] transition-colors"
            aria-label="Đóng xem trước"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Thermal Paper Area */}
        <div className="overflow-y-auto p-6 flex justify-center print:overflow-visible print:p-0 print:block">
          <div className="print-only-receipt w-[310px] bg-white border border-[#E5DDD2] px-5 py-6 text-[#231D19] shadow-sm">
            {/* Restaurant Header */}
            <div className="text-center pb-4 border-b border-dashed border-[#C9BEB0]">
              <h3 className="font-display text-xl font-bold tracking-tight">
                {restaurantName}
              </h3>
              <p className="text-[11px] text-[#6B6056] print:text-black mt-1 leading-snug">
                {restaurantAddress}
              </p>
              <p className="text-[11px] text-[#6B6056] print:text-black font-tabular mt-0.5">
                Hotline: {restaurantPhone}
              </p>
            </div>

            {/* Invoice Title & Metadata */}
            <div className="py-3.5 border-b border-dashed border-[#C9BEB0] space-y-1 text-xs">
              <div className="text-center font-semibold tracking-wide text-sm pb-1">
                HÓA ĐƠN THANH TOÁN
              </div>
              {invoice.status === 'voided' && (
                <div className="text-center text-[#9E2A2B] font-semibold text-xs py-1 border border-[#9E2A2B]/40 rounded">
                  ĐÃ HỦY · {invoice.voidReason}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Số HĐ:</span>
                <span className="font-tabular font-medium">{invoice.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Bàn:</span>
                <span className="font-medium">
                  {invoice.tableName} ({invoice.zone})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Giờ vào:</span>
                <span className="font-tabular">{formatDateTime(invoice.openedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Thanh toán:</span>
                <span className="font-tabular">{formatDateTime(invoice.paidAt)}</span>
              </div>
              {invoice.splitLabel && (
                <div className="flex justify-between gap-2 pt-0.5">
                  <span className="text-[#6B6056] print:text-black shrink-0">Ghi chú:</span>
                  <span className="text-right font-medium">{invoice.splitLabel}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-3 border-b border-dashed border-[#C9BEB0]">
              <div className="grid grid-cols-[1fr_34px_78px] gap-1 text-[11px] font-semibold text-[#6B6056] print:text-black pb-2">
                <span>Tên món</span>
                <span className="text-center">SL</span>
                <span className="text-right">Thành tiền</span>
              </div>
              <div className="space-y-2 text-xs">
                {invoice.items.map((item) => (
                  <div key={item.id}>
                    <div className="grid grid-cols-[1fr_34px_78px] gap-1 items-start">
                      <span className="leading-snug">{item.name}</span>
                      <span className="font-tabular text-center">{item.quantity}</span>
                      <span className="font-tabular text-right">
                        {formatVnd(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6B6056] print:text-black font-tabular">
                      {formatVnd(item.unitPrice)}
                      {item.note ? ` · ${item.note}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="py-3 border-b border-dashed border-[#C9BEB0] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Tạm tính</span>
                <span className="font-tabular">{formatVnd(invoice.subtotal)}</span>
              </div>
              {invoice.discount && invoice.discount.amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B6056] print:text-black">
                    Chiết khấu
                    {invoice.discount.type === 'percent'
                      ? ` (${invoice.discount.value}%)`
                      : ''}
                  </span>
                  <span className="font-tabular">
                    -{formatVnd(invoice.discount.amount)}
                  </span>
                </div>
              )}
              {invoice.vatEnabled && (
                <div className="flex justify-between">
                  <span className="text-[#6B6056] print:text-black">
                    Thuế VAT ({invoice.vatRate}%)
                  </span>
                  <span className="font-tabular">{formatVnd(invoice.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#E5DDD2] text-sm font-bold">
                <span>TỔNG CỘNG</span>
                <span className="font-tabular">{formatVnd(invoice.total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6B6056] print:text-black">Hình thức:</span>
                <span className="font-medium">
                  {paymentMethodLabel(invoice.paymentMethod)}
                </span>
              </div>
              {invoice.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#6B6056] print:text-black">Khách đưa:</span>
                    <span className="font-tabular">
                      {formatVnd(invoice.amountReceived)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B6056] print:text-black">Tiền thối:</span>
                    <span className="font-tabular font-medium">
                      {formatVnd(invoice.changeDue)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-dashed border-[#C9BEB0] text-center text-[11px] text-[#6B6056] print:text-black space-y-1">
              <p>Cảm ơn quý khách đã dùng bữa tại {restaurantName}!</p>
              <p>Hẹn gặp lại quý khách.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions (hidden in print) */}
        <div className="no-print flex items-center justify-end gap-3 px-5 py-3.5 bg-white border-t border-[#E5DDD2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6B6056] hover:text-[#231D19] border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE] transition-colors whitespace-nowrap"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>In hóa đơn</span>
          </button>
        </div>
      </div>
    </div>
  );
}
