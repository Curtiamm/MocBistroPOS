import { useMemo, useState } from 'react';
import { ArrowRightLeft, Combine, Minus, Plus, Split, X } from 'lucide-react';
import { TableEntity, TableOrder } from '../types/pos';
import { calculateSubtotal, formatVnd } from '../utils/format';

export type TableOpTab = 'transfer' | 'merge' | 'split';

interface TableOperationsModalProps {
  sourceTable: TableEntity;
  sourceOrder: TableOrder;
  tables: TableEntity[];
  orders: Record<string, TableOrder>;
  initialTab?: TableOpTab;
  onTransfer: (sourceId: string, targetId: string) => { ok: boolean; error?: string };
  onMerge: (primaryId: string, sourceIds: string[]) => { ok: boolean; error?: string };
  onSplit: (
    sourceId: string,
    targetId: string,
    quantities: Record<string, number>
  ) => { ok: boolean; error?: string };
  onSuccess: (message: string, focusTableId?: string) => void;
  onClose: () => void;
}

export function TableOperationsModal({
  sourceTable,
  sourceOrder,
  tables,
  orders,
  initialTab = 'transfer',
  onTransfer,
  onMerge,
  onSplit,
  onSuccess,
  onClose,
}: TableOperationsModalProps) {
  const [tab, setTab] = useState<TableOpTab>(initialTab);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [splitTargetId, setSplitTargetId] = useState<string>('');
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const availableTables = useMemo(
    () => tables.filter((t) => t.status === 'available' && t.id !== sourceTable.id),
    [tables, sourceTable.id]
  );

  const otherOccupiedTables = useMemo(
    () => tables.filter((t) => t.status === 'occupied' && t.id !== sourceTable.id),
    [tables, sourceTable.id]
  );

  const otherAllTables = useMemo(
    () => tables.filter((t) => t.id !== sourceTable.id),
    [tables, sourceTable.id]
  );

  const toggleMergeSelection = (tableId: string) => {
    setError(null);
    setMergeSelectedIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    );
  };

  const adjustSplitQty = (itemId: string, maxQty: number, delta: number) => {
    setError(null);
    setSplitQuantities((prev) => {
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const totalSplitItemsCount = useMemo(
    () => Object.values(splitQuantities).reduce((sum, q) => sum + q, 0),
    [splitQuantities]
  );

  const handleSubmit = () => {
    setError(null);
    if (tab === 'transfer') {
      if (!transferTargetId) {
        setError('Vui lòng chọn bàn trống cần chuyển đến.');
        return;
      }
      const target = tables.find((t) => t.id === transferTargetId);
      const res = onTransfer(sourceTable.id, transferTargetId);
      if (!res.ok) {
        setError(res.error ?? 'Không thể chuyển bàn.');
        return;
      }
      onSuccess(
        `Đã chuyển toàn bộ đơn từ ${sourceTable.name} sang ${target?.name ?? 'bàn mới'}.`,
        transferTargetId
      );
      onClose();
      return;
    }

    if (tab === 'merge') {
      if (mergeSelectedIds.length === 0) {
        setError('Vui lòng chọn ít nhất một bàn đang phục vụ để gộp.');
        return;
      }
      const names = mergeSelectedIds
        .map((id) => tables.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      const res = onMerge(sourceTable.id, mergeSelectedIds);
      if (!res.ok) {
        setError(res.error ?? 'Không thể gộp bàn.');
        return;
      }
      onSuccess(`Đã gộp ${names} vào ${sourceTable.name}.`, sourceTable.id);
      onClose();
      return;
    }

    if (tab === 'split') {
      if (!splitTargetId) {
        setError('Vui lòng chọn bàn đích để nhận các món được tách.');
        return;
      }
      if (totalSplitItemsCount <= 0) {
        setError('Vui lòng chọn số lượng ít nhất 1 món để tách.');
        return;
      }
      const target = tables.find((t) => t.id === splitTargetId);
      const res = onSplit(sourceTable.id, splitTargetId, splitQuantities);
      if (!res.ok) {
        setError(res.error ?? 'Không thể tách bàn.');
        return;
      }
      onSuccess(
        `Đã tách ${totalSplitItemsCount} phần món từ ${sourceTable.name} sang ${target?.name ?? 'bàn đích'}.`,
        splitTargetId
      );
      onClose();
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nghiệp vụ chuyển, gộp và tách bàn"
    >
      <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
          <div>
            <h2 className="font-display text-lg font-bold text-[#231D19]">
              Xử lý bàn · {sourceTable.name}
            </h2>
            <p className="text-xs text-[#6B6056] mt-0.5">
              {sourceTable.zone} · {sourceOrder.items.length} dòng món · Tạm tính{' '}
              <span className="font-tabular font-medium text-[#231D19]">
                {formatVnd(calculateSubtotal(sourceOrder.items))}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg hover:bg-[#F7F4EE] transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Operation Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F4EE] rounded-lg border border-[#E5DDD2]">
            <button
              type="button"
              onClick={() => {
                setTab('transfer');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'transfer'
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Chuyển bàn</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('merge');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'merge'
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              <Combine className="w-3.5 h-3.5" />
              <span>Gộp bàn</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('split');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'split'
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Tách bàn</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {tab === 'transfer' && (
            <div className="space-y-3">
              <p className="text-sm text-[#6B6056]">
                Chọn một bàn trống để chuyển toàn bộ món và thời gian phục vụ của{' '}
                <strong className="text-[#231D19]">{sourceTable.name}</strong> sang:
              </p>
              {availableTables.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-[#E5DDD2] rounded-lg text-sm text-[#6B6056]">
                  Hiện không còn bàn trống nào trong nhà hàng.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {availableTables.map((t) => {
                    const selected = transferTargetId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTransferTargetId(t.id);
                          setError(null);
                        }}
                        className={`text-left p-3.5 rounded-lg border transition-colors ${
                          selected
                            ? 'border-[#1E4D3B] bg-[#1E4D3B]/6'
                            : 'border-[#E5DDD2] bg-white hover:bg-[#F7F4EE]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[#231D19]">{t.name}</div>
                        <div className="text-xs text-[#6B6056] mt-0.5">
                          {t.zone} · {t.capacity} chỗ
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'merge' && (
            <div className="space-y-3">
              <p className="text-sm text-[#6B6056]">
                Chọn các bàn đang phục vụ muốn gộp đơn vào{' '}
                <strong className="text-[#231D19]">{sourceTable.name}</strong> (các bàn được chọn sẽ trở về trạng thái trống):
              </p>
              {otherOccupiedTables.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-[#E5DDD2] rounded-lg text-sm text-[#6B6056]">
                  Không có bàn đang phục vụ nào khác để gộp.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {otherOccupiedTables.map((t) => {
                    const ord = t.activeOrderId ? orders[t.activeOrderId] : undefined;
                    const subtotal = ord ? calculateSubtotal(ord.items) : 0;
                    const selected = mergeSelectedIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleMergeSelection(t.id)}
                        className={`text-left p-3.5 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                          selected
                            ? 'border-[#1E4D3B] bg-[#1E4D3B]/6'
                            : 'border-[#E5DDD2] bg-white hover:bg-[#F7F4EE]'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-[#231D19]">{t.name}</div>
                          <div className="text-xs text-[#6B6056] mt-0.5">
                            {t.zone} · {ord?.items.length ?? 0} món
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-tabular text-sm font-semibold text-[#231D19]">
                            {formatVnd(subtotal)}
                          </div>
                          <div className="text-xs text-[#1E4D3B] font-medium">
                            {selected ? 'Đã chọn' : 'Chọn gộp'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'split' && (
            <div className="space-y-5">
              {/* Step 1: Select items */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-[#231D19]">
                  1. Chọn số lượng món cần tách từ {sourceTable.name}
                </p>
                {sourceOrder.items.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-[#E5DDD2] rounded-lg text-sm text-[#6B6056]">
                    Bàn này chưa có món nào để tách.
                  </div>
                ) : (
                  <div className="border border-[#E5DDD2] rounded-lg divide-y divide-[#E5DDD2]">
                    {sourceOrder.items.map((item) => {
                      const qty = splitQuantities[item.id] ?? 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#231D19] truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#6B6056]">
                              Đang có{' '}
                              <span className="font-tabular font-medium text-[#231D19]">
                                {item.quantity}
                              </span>{' '}
                              · <span className="font-tabular">{formatVnd(item.unitPrice)}</span>
                              {item.note ? ` · ${item.note}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => adjustSplitQty(item.id, item.quantity, -1)}
                              disabled={qty === 0}
                              className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E5DDD2] text-[#231D19] hover:bg-[#F7F4EE] disabled:opacity-35"
                              aria-label="Giảm số lượng tách"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-tabular text-sm font-semibold w-7 text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustSplitQty(item.id, item.quantity, 1)}
                              disabled={qty >= item.quantity}
                              className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E5DDD2] text-[#231D19] hover:bg-[#F7F4EE] disabled:opacity-35"
                              aria-label="Tăng số lượng tách"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: Select destination table */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-[#231D19]">
                  2. Chọn bàn đích nhận món tách
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {otherAllTables.map((t) => {
                    const selected = splitTargetId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSplitTargetId(t.id);
                          setError(null);
                        }}
                        className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                          selected
                            ? 'border-[#1E4D3B] bg-[#1E4D3B]/6'
                            : 'border-[#E5DDD2] bg-white hover:bg-[#F7F4EE]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[#231D19]">{t.name}</div>
                        <div className="text-xs text-[#6B6056]">
                          {t.status === 'occupied' ? 'Đang có khách' : 'Bàn trống'} · {t.zone}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-[#9E2A2B] pt-1">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5DDD2] bg-[#F7F4EE]/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6B6056] hover:text-[#231D19] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE] transition-colors whitespace-nowrap"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg transition-colors whitespace-nowrap"
          >
            {tab === 'transfer' && 'Xác nhận chuyển bàn'}
            {tab === 'merge' && 'Xác nhận gộp bàn'}
            {tab === 'split' && `Tách ${totalSplitItemsCount > 0 ? `${totalSplitItemsCount} phần món` : 'món'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
