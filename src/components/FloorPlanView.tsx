import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CreditCard, Plus } from 'lucide-react';
import { TableEntity, TableOrder, ZoneName } from '../types/pos';
import {
  calculateSubtotal,
  formatElapsedMinutes,
  formatVnd,
} from '../utils/format';

interface FloorPlanViewProps {
  tables: TableEntity[];
  orders: Record<string, TableOrder>;
  onSelectTableForOrder: (tableId: string) => void;
  onOpenTableOps: (tableId: string) => void;
  onQuickCheckout: (tableId: string) => void;
}

const ZONES: Array<'Tất cả' | ZoneName> = ['Tất cả', 'Tầng 1', 'Ban công', 'Phòng riêng'];

export function FloorPlanView({
  tables,
  orders,
  onSelectTableForOrder,
  onOpenTableOps,
  onQuickCheckout,
}: FloorPlanViewProps) {
  const [selectedZone, setSelectedZone] = useState<'Tất cả' | ZoneName>('Tất cả');
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'available'>('all');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Keep elapsed table durations fresh every 30s
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const occupied = tables.filter((t) => t.status === 'occupied');
    const available = tables.length - occupied.length;
    const provisionalRevenue = occupied.reduce((sum, t) => {
      const ord = t.activeOrderId ? orders[t.activeOrderId] : undefined;
      return sum + (ord ? calculateSubtotal(ord.items) : 0);
    }, 0);
    const totalGuests = occupied.reduce((sum, t) => {
      const ord = t.activeOrderId ? orders[t.activeOrderId] : undefined;
      return sum + (ord ? ord.guests : 0);
    }, 0);
    return { occupiedCount: occupied.length, availableCount: available, provisionalRevenue, totalGuests };
  }, [tables, orders]);

  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      if (selectedZone !== 'Tất cả' && table.zone !== selectedZone) return false;
      if (statusFilter !== 'all' && table.status !== statusFilter) return false;
      return true;
    });
  }, [tables, selectedZone, statusFilter]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Compact Operational Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E5DDD2] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-[#E5DDD2]">
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Bàn đang phục vụ</p>
          <p className="font-tabular text-2xl font-semibold text-[#231D19] mt-1">
            {stats.occupiedCount}{' '}
            <span className="text-sm font-normal text-[#6B6056]">/ {tables.length} bàn</span>
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Bàn trống sẵn sàng</p>
          <p className="font-tabular text-2xl font-semibold text-[#1F6E4A] mt-1">
            {stats.availableCount}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Khách đang dùng bữa</p>
          <p className="font-tabular text-2xl font-semibold text-[#231D19] mt-1">
            {stats.totalGuests} <span className="text-sm font-normal text-[#6B6056]">khách</span>
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Tạm tính đang mở</p>
          <p className="font-tabular text-2xl font-semibold text-[#1E4D3B] mt-1">
            {formatVnd(stats.provisionalRevenue)}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Zone Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
          {ZONES.map((zone) => {
            const active = selectedZone === zone;
            const count =
              zone === 'Tất cả'
                ? tables.length
                : tables.filter((t) => t.zone === zone).length;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setSelectedZone(zone)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#231D19] shadow-xs'
                    : 'text-[#6B6056] hover:text-[#231D19]'
                }`}
              >
                {zone} <span className="font-tabular font-normal opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Status Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
          {[
            { id: 'all' as const, label: 'Tất cả' },
            { id: 'occupied' as const, label: 'Đang phục vụ' },
            { id: 'available' as const, label: 'Bàn trống' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === opt.id
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabletop Grid */}
      {filteredTables.length === 0 ? (
        <div className="bg-white border border-[#E5DDD2] rounded-xl py-16 text-center space-y-2">
          <p className="text-sm font-medium text-[#231D19]">
            Không có bàn nào phù hợp với bộ lọc hiện tại.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedZone('Tất cả');
              setStatusFilter('all');
            }}
            className="text-xs font-semibold text-[#1E4D3B] hover:underline"
          >
            Xem lại toàn bộ sơ đồ bàn
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((table) => {
            const order = table.activeOrderId ? orders[table.activeOrderId] : undefined;
            const isOccupied = table.status === 'occupied' && Boolean(order);
            const subtotal = order ? calculateSubtotal(order.items) : 0;
            const totalItemQty = order
              ? order.items.reduce((sum, i) => sum + i.quantity, 0)
              : 0;

            return (
              <div
                key={table.id}
                className={`rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                  isOccupied
                    ? 'bg-[#FFFDF9] border-[#B4691E]/45 hover:border-[#B4691E]'
                    : 'bg-white border-[#E5DDD2] hover:border-[#1E4D3B]/50'
                }`}
              >
                {/* Clickable Main Surface */}
                <button
                  type="button"
                  onClick={() => onSelectTableForOrder(table.id)}
                  className="text-left p-5 flex-1 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3B] rounded-t-xl"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-[#231D19] truncate">
                      {table.name}
                    </h3>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        isOccupied ? 'text-[#B4691E]' : 'text-[#1F6E4A]'
                      }`}
                    >
                      {isOccupied ? 'Đang phục vụ' : 'Bàn trống'}
                    </span>
                  </div>

                  {/* Unboxed Metadata Line */}
                  <div className="flex items-center gap-1.5 text-xs text-[#6B6056] mt-1.5">
                    <span>{table.zone}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isOccupied && order
                        ? `${order.guests}/${table.capacity} khách`
                        : `${table.capacity} chỗ`}
                    </span>
                    {isOccupied && order && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-tabular">
                          {formatElapsedMinutes(order.openedAt, nowMs)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Provisional Amount or Open Prompt */}
                  <div className="mt-5 pt-4 border-t border-[#E5DDD2]/70 flex items-baseline justify-between">
                    {isOccupied && order ? (
                      <>
                        <span className="text-xs text-[#6B6056]">
                          <span className="font-tabular font-medium text-[#231D19]">
                            {totalItemQty}
                          </span>{' '}
                          món đã gọi
                        </span>
                        <span className="font-tabular text-base font-bold text-[#231D19]">
                          {formatVnd(subtotal)}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E4D3B]">
                        <Plus className="w-3.5 h-3.5" />
                        Mở bàn & gọi món
                      </span>
                    )}
                  </div>
                </button>

                {/* Direct Actions Bar for Occupied Tables */}
                {isOccupied && order && (
                  <div className="px-4 py-2.5 border-t border-[#E5DDD2]/80 bg-[#F7F4EE]/60 rounded-b-xl flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTableOps(table.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#6B6056] hover:text-[#231D19] hover:bg-white rounded-md transition-colors whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Chuyển / Tách / Gộp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickCheckout(table.id)}
                      disabled={order.items.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-40 rounded-md transition-colors whitespace-nowrap"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Tính tiền</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
