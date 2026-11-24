import { useMemo, useState } from 'react';
import {
  Ban,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { Invoice, ShiftRecord } from '../types/pos';
import {
  formatDateTime,
  formatVnd,
  paymentMethodLabel,
} from '../utils/format';

interface ReportsViewProps {
  invoices: Invoice[];
  shifts: ShiftRecord[];
  activeShift: ShiftRecord | null;
  canVoidInvoice: boolean;
  defaultCashierName: string;
  onOpenShift: (cashierName: string, openingCash: number) => void;
  onCloseShift: (actualClosingCash: number, note: string) => void;
  onVoidInvoice: (invoiceId: string, reason: string) => void;
  onViewReceipt: (invoice: Invoice) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  shiftModalTrigger: 'open' | 'close' | null;
  onClearShiftModalTrigger: () => void;
}

export function ReportsView({
  invoices,
  shifts,
  activeShift,
  canVoidInvoice,
  defaultCashierName,
  onOpenShift,
  onCloseShift,
  onVoidInvoice,
  onViewReceipt,
  onNotify,
  shiftModalTrigger,
  onClearShiftModalTrigger,
}: ReportsViewProps) {
  const [scope, setScope] = useState<'active_shift' | 'all'>(
    activeShift ? 'active_shift' : 'all'
  );
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'paid' | 'voided'>('all');

  // Local modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Open shift form
  const [cashierName, setCashierName] = useState(defaultCashierName || 'Minh Anh');
  const [openingCashInput, setOpeningCashInput] = useState('2000000');

  // Close shift form
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNote, setClosingNote] = useState('');

  const effectiveShowOpenModal = showOpenShiftModal || shiftModalTrigger === 'open';
  const effectiveShowCloseModal = showCloseShiftModal || shiftModalTrigger === 'close';

  const closeShiftModals = () => {
    setShowOpenShiftModal(false);
    setShowCloseShiftModal(false);
    onClearShiftModalTrigger();
  };

  const scopedInvoices = useMemo(() => {
    if (scope === 'active_shift' && activeShift) {
      return invoices.filter((inv) => inv.shiftId === activeShift.id);
    }
    return invoices;
  }, [invoices, scope, activeShift]);

  const paidInvoices = useMemo(
    () => scopedInvoices.filter((inv) => inv.status === 'paid'),
    [scopedInvoices]
  );

  const metrics = useMemo(() => {
    const netRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalDiscount = paidInvoices.reduce(
      (sum, inv) => sum + (inv.discount?.amount ?? 0),
      0
    );
    const cashRevenue = paidInvoices
      .filter((i) => i.paymentMethod === 'cash')
      .reduce((sum, i) => sum + i.total, 0);
    const transferRevenue = paidInvoices
      .filter((i) => i.paymentMethod === 'transfer')
      .reduce((sum, i) => sum + i.total, 0);
    const cardRevenue = paidInvoices
      .filter((i) => i.paymentMethod === 'card')
      .reduce((sum, i) => sum + i.total, 0);
    const avgOrder = paidInvoices.length > 0 ? Math.round(netRevenue / paidInvoices.length) : 0;

    return {
      netRevenue,
      totalDiscount,
      cashRevenue,
      transferRevenue,
      cardRevenue,
      invoiceCount: paidInvoices.length,
      avgOrder,
    };
  }, [paidInvoices]);

  // Expected cash specifically for the currently open shift
  const activeShiftExpectedCash = useMemo(() => {
    if (!activeShift) return 0;
    const shiftCash = invoices
      .filter(
        (inv) =>
          inv.shiftId === activeShift.id &&
          inv.status === 'paid' &&
          inv.paymentMethod === 'cash'
      )
      .reduce((sum, inv) => sum + inv.total, 0);
    return activeShift.openingCash + shiftCash;
  }, [activeShift, invoices]);

  const topDishes = useMemo(() => {
    const map = new Map<string, { name: string; code: string; qty: number; revenue: number }>();
    for (const inv of paidInvoices) {
      for (const item of inv.items) {
        const current = map.get(item.menuItemId) ?? {
          name: item.name,
          code: item.code,
          qty: 0,
          revenue: 0,
        };
        current.qty += item.quantity;
        current.revenue += item.unitPrice * item.quantity;
        map.set(item.menuItemId, current);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [paidInvoices]);

  const filteredInvoiceRows = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    return scopedInvoices.filter((inv) => {
      if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) return false;
      if (
        q &&
        !inv.code.toLowerCase().includes(q) &&
        !inv.tableName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [scopedInvoices, invoiceSearch, invoiceStatusFilter]);

  const handleConfirmOpenShift = () => {
    const cash = Math.max(0, Number(openingCashInput) || 0);
    onOpenShift(cashierName, cash);
    setScope('active_shift');
    onNotify('success', 'Đã mở ca làm việc mới', `Thu ngân: ${cashierName || 'Thu ngân'} · Tiền đầu ca ${formatVnd(cash)}`);
    closeShiftModals();
  };

  const handleConfirmCloseShift = () => {
    const actual = actualCashInput.trim() === '' ? activeShiftExpectedCash : Math.max(0, Number(actualCashInput) || 0);
    const diff = actual - activeShiftExpectedCash;
    onCloseShift(actual, closingNote);
    setScope('all');
    setActualCashInput('');
    setClosingNote('');
    onNotify(
      'success',
      'Đã chốt ca làm việc',
      diff === 0
        ? 'Tiền mặt khớp chính xác với hệ thống.'
        : `Chênh lệch két: ${diff > 0 ? '+' : ''}${formatVnd(diff)}`
    );
    closeShiftModals();
  };

  const handleConfirmVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    onVoidInvoice(voidTarget.id, voidReason.trim());
    onNotify('info', `Đã hủy hóa đơn ${voidTarget.code}`, `Lý do: ${voidReason.trim()}`);
    setVoidTarget(null);
    setVoidReason('');
  };

  const parsedActualCash =
    actualCashInput.trim() === '' ? activeShiftExpectedCash : Math.max(0, Number(actualCashInput) || 0);
  const liveDiff = parsedActualCash - activeShiftExpectedCash;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Shift Status & Scope Switcher */}
      <div className="bg-white border border-[#E5DDD2] rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          {activeShift ? (
            <>
              <p className="text-sm font-bold text-[#231D19]">
                Ca đang mở: <span className="font-tabular">{activeShift.code}</span> · Thu ngân{' '}
                {activeShift.cashierName}
              </p>
              <p className="text-xs text-[#6B6056] mt-0.5">
                Mở lúc <span className="font-tabular">{formatDateTime(activeShift.openedAt)}</span> · Tiền đầu ca{' '}
                <span className="font-tabular font-medium text-[#231D19]">
                  {formatVnd(activeShift.openingCash)}
                </span>{' '}
                · Tiền mặt dự kiến trong két{' '}
                <span className="font-tabular font-semibold text-[#1E4D3B]">
                  {formatVnd(activeShiftExpectedCash)}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-[#231D19]">Chưa có ca làm việc đang mở</p>
              <p className="text-xs text-[#6B6056] mt-0.5">
                Mở ca mới để khai báo tiền mặt đầu ca và đối soát cuối ca chính xác.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
            <button
              type="button"
              disabled={!activeShift}
              onClick={() => setScope('active_shift')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-40 ${
                scope === 'active_shift' && activeShift
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              Ca hiện tại
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                scope === 'all' || !activeShift
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              Toàn bộ lịch sử
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E5DDD2] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-[#E5DDD2]">
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Doanh thu thuần</p>
          <p className="font-tabular text-2xl font-bold text-[#1E4D3B] mt-1">
            {formatVnd(metrics.netRevenue)}
          </p>
          <p className="text-xs text-[#6B6056] mt-1">
            Chiết khấu: <span className="font-tabular">{formatVnd(metrics.totalDiscount)}</span>
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Hóa đơn đã thu</p>
          <p className="font-tabular text-2xl font-bold text-[#231D19] mt-1">
            {metrics.invoiceCount}
          </p>
          <p className="text-xs text-[#6B6056] mt-1">
            Đã hủy:{' '}
            <span className="font-tabular">
              {scopedInvoices.filter((i) => i.status === 'voided').length}
            </span>
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Giá trị trung bình / đơn</p>
          <p className="font-tabular text-2xl font-bold text-[#231D19] mt-1">
            {formatVnd(metrics.avgOrder)}
          </p>
          <p className="text-xs text-[#6B6056] mt-1">Tính trên đơn hoàn tất</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Tiền mặt trong két (ca mở)</p>
          <p className="font-tabular text-2xl font-bold text-[#231D19] mt-1">
            {activeShift ? formatVnd(activeShiftExpectedCash) : '—'}
          </p>
          <p className="text-xs text-[#6B6056] mt-1">
            {activeShift ? 'Gồm tiền đầu ca + thu tiền mặt' : 'Chưa mở ca'}
          </p>
        </div>
      </div>

      {/* Payment Breakdown + Top Dishes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Method Breakdown */}
        <div className="lg:col-span-5 bg-white border border-[#E5DDD2] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#231D19]">
            Cơ cấu theo phương thức thanh toán
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Tiền mặt', amount: metrics.cashRevenue, color: 'bg-[#1E4D3B]' },
              { label: 'Chuyển khoản VietQR', amount: metrics.transferRevenue, color: 'bg-[#B4691E]' },
              { label: 'Thẻ POS', amount: metrics.cardRevenue, color: 'bg-[#6B6056]' },
            ].map((row) => {
              const pct =
                metrics.netRevenue > 0
                  ? Math.round((row.amount / metrics.netRevenue) * 100)
                  : 0;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#231D19]">{row.label}</span>
                    <span className="font-tabular text-[#231D19] font-semibold">
                      {formatVnd(row.amount)}{' '}
                      <span className="text-[#6B6056] font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-[#EFEAE0] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Dishes */}
        <div className="lg:col-span-7 bg-white border border-[#E5DDD2] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5DDD2]">
            <h3 className="text-sm font-bold text-[#231D19]">Món bán chạy nhất</h3>
          </div>
          {topDishes.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6B6056]">
              Chưa có dữ liệu món bán ra trong phạm vi đã chọn.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-[#FAF8F4]">
                  <th className="text-left font-medium px-5 py-2.5">Món ăn</th>
                  <th className="text-right font-medium px-4 py-2.5">Số lượng</th>
                  <th className="text-right font-medium px-5 py-2.5">Doanh số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDD2]/70">
                {topDishes.map((dish) => (
                  <tr key={dish.code} className="hover:bg-[#FAF8F4]">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-[#231D19]">{dish.name}</span>{' '}
                      <span className="font-tabular text-xs text-[#6B6056]">· {dish.code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular text-[#231D19]">
                      {dish.qty}
                    </td>
                    <td className="px-5 py-2.5 text-right font-tabular font-semibold text-[#231D19]">
                      {formatVnd(dish.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="bg-white border border-[#E5DDD2] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5DDD2] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#231D19]">
            Lịch sử hóa đơn ({filteredInvoiceRows.length})
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
              {[
                { id: 'all' as const, label: 'Tất cả' },
                { id: 'paid' as const, label: 'Đã thanh toán' },
                { id: 'voided' as const, label: 'Đã hủy' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setInvoiceStatusFilter(st.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    invoiceStatusFilter === st.id
                      ? 'bg-white text-[#231D19] shadow-xs'
                      : 'text-[#6B6056] hover:text-[#231D19]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative w-60">
              <Search className="w-3.5 h-3.5 text-[#6B6056] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Tìm mã HĐ hoặc tên bàn..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F4] border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>
          </div>
        </div>

        {filteredInvoiceRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#6B6056]">
            Không có hóa đơn nào khớp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-[#FAF8F4]">
                  <th className="text-left font-medium px-5 py-3">Mã hóa đơn</th>
                  <th className="text-left font-medium px-4 py-3">Bàn</th>
                  <th className="text-left font-medium px-4 py-3">Thời gian</th>
                  <th className="text-left font-medium px-4 py-3">Phương thức</th>
                  <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                  <th className="text-right font-medium px-4 py-3">Tổng tiền</th>
                  <th className="text-right font-medium px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDD2]/70">
                {filteredInvoiceRows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAF8F4]">
                    <td className="px-5 py-3 font-tabular font-semibold text-[#231D19] whitespace-nowrap">
                      {inv.code}
                    </td>
                    <td className="px-4 py-3 text-[#231D19] whitespace-nowrap">
                      {inv.tableName}{' '}
                      <span className="text-xs text-[#6B6056]">· {inv.zone}</span>
                    </td>
                    <td className="px-4 py-3 font-tabular text-xs text-[#6B6056] whitespace-nowrap">
                      {formatDateTime(inv.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#231D19] whitespace-nowrap">
                      {paymentMethodLabel(inv.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {inv.status === 'paid' ? (
                        <span className="font-semibold text-[#1F6E4A]">Hoàn tất</span>
                      ) : (
                        <span className="font-semibold text-[#9E2A2B]" title={inv.voidReason}>
                          Đã hủy
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-tabular font-semibold whitespace-nowrap ${
                        inv.status === 'voided'
                          ? 'line-through text-[#6B6056]'
                          : 'text-[#231D19]'
                      }`}
                    >
                      {formatVnd(inv.total)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewReceipt(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#231D19] hover:bg-[#EFEAE0] border border-[#E5DDD2] rounded-md transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Xem / In</span>
                        </button>
                        {canVoidInvoice && inv.status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVoidTarget(inv);
                              setVoidReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#9E2A2B] hover:bg-[#9E2A2B]/8 border border-[#9E2A2B]/25 rounded-md transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Hủy</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Shifts History */}
      {shifts.some((s) => s.status === 'closed') && (
        <div className="bg-white border border-[#E5DDD2] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5DDD2]">
            <h3 className="text-sm font-bold text-[#231D19]">Biên bản chốt ca trước đây</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-[#FAF8F4]">
                  <th className="text-left font-medium px-5 py-2.5">Mã ca</th>
                  <th className="text-left font-medium px-4 py-2.5">Thu ngân</th>
                  <th className="text-left font-medium px-4 py-2.5">Thời gian chốt</th>
                  <th className="text-right font-medium px-4 py-2.5">Két hệ thống</th>
                  <th className="text-right font-medium px-4 py-2.5">Kiểm đếm thực tế</th>
                  <th className="text-right font-medium px-5 py-2.5">Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDD2]/70">
                {shifts
                  .filter((s) => s.status === 'closed')
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-[#FAF8F4]">
                      <td className="px-5 py-2.5 font-tabular font-semibold text-[#231D19]">
                        {s.code}
                      </td>
                      <td className="px-4 py-2.5 text-[#231D19]">{s.cashierName}</td>
                      <td className="px-4 py-2.5 font-tabular text-xs text-[#6B6056]">
                        {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-tabular text-[#231D19]">
                        {formatVnd(s.expectedClosingCash ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-tabular text-[#231D19]">
                        {formatVnd(s.actualClosingCash ?? 0)}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-tabular font-semibold ${
                          (s.cashDifference ?? 0) === 0
                            ? 'text-[#1F6E4A]'
                            : (s.cashDifference ?? 0) < 0
                              ? 'text-[#9E2A2B]'
                              : 'text-[#B4691E]'
                        }`}
                      >
                        {(s.cashDifference ?? 0) > 0 ? '+' : ''}
                        {formatVnd(s.cashDifference ?? 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPEN SHIFT MODAL */}
      {effectiveShowOpenModal && !activeShift && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
              <h3 className="font-display text-lg font-bold text-[#231D19]">
                Mở ca làm việc mới
              </h3>
              <button
                type="button"
                onClick={closeShiftModals}
                className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Tên thu ngân phụ trách
                </label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  placeholder="VD: Minh Anh"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Tiền mặt đầu ca trong két (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-tabular border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-[#FAF8F4] border-t border-[#E5DDD2] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={closeShiftModals}
                className="px-4 py-2 text-sm font-medium text-[#6B6056] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmOpenShift}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg"
              >
                Bắt đầu ca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT RECONCILIATION MODAL */}
      {effectiveShowCloseModal && activeShift && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
              <div>
                <h3 className="font-display text-lg font-bold text-[#231D19]">
                  Chốt ca & Đối soát két
                </h3>
                <p className="text-xs text-[#6B6056]">
                  {activeShift.code} · {activeShift.cashierName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeShiftModals}
                className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-[#FAF8F4] border border-[#E5DDD2] rounded-lg space-y-2 text-sm">
                <div className="flex justify-between text-[#6B6056]">
                  <span>Tiền mặt đầu ca</span>
                  <span className="font-tabular text-[#231D19]">
                    {formatVnd(activeShift.openingCash)}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B6056]">
                  <span>Thu tiền mặt trong ca</span>
                  <span className="font-tabular text-[#231D19]">
                    {formatVnd(activeShiftExpectedCash - activeShift.openingCash)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E5DDD2] font-bold text-[#231D19]">
                  <span>Két kỳ vọng (Hệ thống)</span>
                  <span className="font-tabular text-[#1E4D3B]">
                    {formatVnd(activeShiftExpectedCash)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Tiền mặt kiểm đếm thực tế (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  placeholder={String(activeShiftExpectedCash)}
                  className="w-full px-3 py-2 text-sm font-tabular font-semibold border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
                <p className="text-xs">
                  Chênh lệch:{' '}
                  <strong
                    className={`font-tabular ${
                      liveDiff === 0
                        ? 'text-[#1F6E4A]'
                        : liveDiff < 0
                          ? 'text-[#9E2A2B]'
                          : 'text-[#B4691E]'
                    }`}
                  >
                    {liveDiff > 0 ? '+' : ''}
                    {formatVnd(liveDiff)}
                  </strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Ghi chú bàn giao (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="VD: Đã bàn giao quỹ tiền lẻ cho ca tối"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-[#FAF8F4] border-t border-[#E5DDD2] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={closeShiftModals}
                className="px-4 py-2 text-sm font-medium text-[#6B6056] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseShift}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg"
              >
                Xác nhận chốt ca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID INVOICE MODAL */}
      {voidTarget && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
              <h3 className="font-display text-lg font-bold text-[#231D19]">
                Hủy hóa đơn {voidTarget.code}
              </h3>
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#6B6056] leading-relaxed">
                Hóa đơn trị giá{' '}
                <strong className="font-tabular text-[#231D19]">
                  {formatVnd(voidTarget.total)}
                </strong>{' '}
                tại <strong>{voidTarget.tableName}</strong> sẽ bị đánh dấu hủy và trừ khỏi doanh thu thuần (vẫn lưu vết kiểm toán).
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Lý do hủy hóa đơn (bắt buộc)
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="VD: Thu ngân nhập nhầm phương thức thanh toán"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-[#FAF8F4] border-t border-[#E5DDD2] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#6B6056] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={!voidReason.trim()}
                onClick={handleConfirmVoid}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#9E2A2B] hover:bg-[#7F2021] disabled:opacity-40 rounded-lg"
              >
                Xác nhận hủy hóa đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
