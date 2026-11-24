import { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  MessageSquare,
  Minus,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import {
  MenuCategory,
  MenuItem,
  TableEntity,
  TableOrder,
} from '../types/pos';
import {
  calculateSubtotal,
  formatTime,
  formatVnd,
} from '../utils/format';

interface OrderPosViewProps {
  tables: TableEntity[];
  orders: Record<string, TableOrder>;
  menu: MenuItem[];
  selectedTableId: string | null;
  defaultVatRate: number;
  onSelectTable: (tableId: string) => void;
  onUpdateGuests: (tableId: string, guests: number) => void;
  onAddItem: (tableId: string, menuItem: MenuItem) => void;
  onUpdateQty: (tableId: string, orderItemId: string, delta: number) => void;
  onUpdateNote: (tableId: string, orderItemId: string, note: string) => void;
  onRemoveItem: (tableId: string, orderItemId: string) => void;
  onClearTable: (tableId: string) => void;
  onOpenTableOps: (tableId: string) => void;
  onOpenCheckout: (tableId: string) => void;
  onGoToFloor: () => void;
}

const CATEGORIES: Array<'Tất cả' | MenuCategory> = [
  'Tất cả',
  'Khai vị',
  'Món chính',
  'Đồ uống',
  'Tráng miệng',
];

const QUICK_NOTES = ['Ít cay', 'Không hành', 'Chín vừa', 'Ít đá', 'Không đường', 'Lên món trước'];

export function OrderPosView({
  tables,
  orders,
  menu,
  selectedTableId,
  defaultVatRate,
  onSelectTable,
  onUpdateGuests,
  onAddItem,
  onUpdateQty,
  onUpdateNote,
  onRemoveItem,
  onClearTable,
  onOpenTableOps,
  onOpenCheckout,
  onGoToFloor,
}: OrderPosViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Tất cả' | MenuCategory>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirmCancelTable, setConfirmCancelTable] = useState(false);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) ?? null,
    [tables, selectedTableId]
  );

  const activeOrder = useMemo(() => {
    if (!selectedTable?.activeOrderId) return null;
    return orders[selectedTable.activeOrderId] ?? null;
  }, [selectedTable, orders]);

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menu.filter((item) => {
      if (selectedCategory !== 'Tất cả' && item.category !== selectedCategory) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [menu, selectedCategory, searchQuery]);

  const subtotal = activeOrder ? calculateSubtotal(activeOrder.items) : 0;
  const estVat = Math.round((subtotal * defaultVatRate) / 100);
  const estTotal = subtotal + estVat;

  const startEditingNote = (orderItemId: string, currentNote: string) => {
    if (editingNoteItemId === orderItemId) {
      setEditingNoteItemId(null);
      return;
    }
    setEditingNoteItemId(orderItemId);
    setNoteDraft(currentNote);
  };

  const commitNote = (orderItemId: string, value: string) => {
    if (!selectedTable) return;
    onUpdateNote(selectedTable.id, orderItemId, value);
    setEditingNoteItemId(null);
  };

  const handleConfirmClear = () => {
    if (!selectedTable) return;
    onClearTable(selectedTable.id);
    setConfirmCancelTable(false);
    onGoToFloor();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* LEFT PANE (~62%): Bistro Menu Selection */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-[#E5DDD2]">
        {/* Category Tabs + Search */}
        <div className="px-6 py-4 bg-[#F7F4EE] border-b border-[#E5DDD2] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-white text-[#231D19] shadow-xs'
                    : 'text-[#6B6056] hover:text-[#231D19]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#6B6056] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên món hoặc mã (MC01)..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg text-[#231D19] placeholder:text-[#6B6056]/70 focus:outline-none focus:border-[#1E4D3B]"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedTable && (
            <div className="mb-5 px-4 py-3 bg-white border border-[#B4691E]/40 rounded-lg flex items-center justify-between gap-4">
              <p className="text-sm text-[#231D19]">
                Chưa chọn bàn phục vụ. Hãy chọn một bàn ở góc phải hoặc quay lại Sơ đồ bàn để bắt đầu gọi món.
              </p>
              <button
                type="button"
                onClick={onGoToFloor}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-md whitespace-nowrap shrink-0"
              >
                Mở sơ đồ bàn
              </button>
            </div>
          )}

          {filteredMenu.length === 0 ? (
            <div className="bg-white border border-[#E5DDD2] rounded-xl py-16 text-center space-y-2">
              <p className="text-sm font-medium text-[#231D19]">
                Không tìm thấy món phù hợp với "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Tất cả');
                }}
                className="text-xs font-semibold text-[#1E4D3B] hover:underline"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredMenu.map((item) => {
                const inOrderQty = activeOrder
                  ? activeOrder.items
                      .filter((oi) => oi.menuItemId === item.id)
                      .reduce((sum, oi) => sum + oi.quantity, 0)
                  : 0;

                const disabled = !item.available || !selectedTable;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectedTable && onAddItem(selectedTable.id, item)}
                    className={`text-left p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between min-h-[126px] ${
                      !item.available
                        ? 'bg-[#EFEAE0]/50 border-[#E5DDD2] opacity-65 cursor-not-allowed'
                        : !selectedTable
                          ? 'bg-white border-[#E5DDD2] opacity-75 cursor-not-allowed'
                          : 'bg-white border-[#E5DDD2] hover:border-[#1E4D3B] active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#6B6056]">
                        <span className="font-tabular">
                          {item.code} · {item.category}
                        </span>
                        {!item.available ? (
                          <span className="font-semibold text-[#9E2A2B]">Tạm hết</span>
                        ) : inOrderQty > 0 ? (
                          <span className="font-tabular font-semibold text-[#1E4D3B]">
                            Đã gọi ×{inOrderQty}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-sm font-semibold text-[#231D19] mt-1.5 leading-snug">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-[#6B6056] mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#E5DDD2]/70 flex items-center justify-between">
                      <span className="font-tabular text-sm font-bold text-[#231D19]">
                        {formatVnd(item.price)}
                      </span>
                      {item.available && selectedTable && (
                        <span className="text-xs font-semibold text-[#1E4D3B]">
                          + Thêm món
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE (~38%, min 380px): Active Order Ticket */}
      <aside className="w-[410px] xl:w-[440px] shrink-0 bg-white flex flex-col overflow-hidden">
        {/* Table Selector & Metadata Header */}
        <div className="px-5 py-4 border-b border-[#E5DDD2] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="table-switcher" className="sr-only">
                Chọn bàn đang thao tác
              </label>
              <select
                id="table-switcher"
                value={selectedTable?.id ?? ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setConfirmCancelTable(false);
                    onSelectTable(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-sm font-bold text-[#231D19] bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
              >
                <option value="" disabled>
                  -- Chọn bàn phục vụ --
                </option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.zone}) — {t.status === 'occupied' ? 'Đang phục vụ' : 'Trống'}
                  </option>
                ))}
              </select>
            </div>

            {selectedTable && activeOrder && (
              <button
                type="button"
                onClick={() => onOpenTableOps(selectedTable.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#231D19] bg-white hover:bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg transition-colors whitespace-nowrap shrink-0"
                title="Chuyển, gộp hoặc tách bàn"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Chuyển/Tách</span>
              </button>
            )}
          </div>

          {selectedTable && activeOrder && (
            <div className="flex items-center justify-between text-xs text-[#6B6056]">
              <span>
                Giờ vào:{' '}
                <strong className="font-tabular text-[#231D19]">
                  {formatTime(activeOrder.openedAt)}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#6B6056]" />
                <span>Khách:</span>
                <button
                  type="button"
                  onClick={() => onUpdateGuests(selectedTable.id, activeOrder.guests - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-[#E5DDD2] hover:bg-[#F7F4EE] text-[#231D19]"
                  aria-label="Giảm số khách"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-tabular font-semibold text-[#231D19] w-5 text-center">
                  {activeOrder.guests}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateGuests(selectedTable.id, activeOrder.guests + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-[#E5DDD2] hover:bg-[#F7F4EE] text-[#231D19]"
                  aria-label="Tăng số khách"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Line Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E5DDD2]/80">
          {!selectedTable ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center space-y-2">
              <p className="text-sm font-semibold text-[#231D19]">Chưa chọn bàn</p>
              <p className="text-xs text-[#6B6056] leading-relaxed">
                Chọn một bàn từ danh sách phía trên hoặc từ Sơ đồ bàn để bắt đầu lập phiếu gọi món.
              </p>
            </div>
          ) : !activeOrder || activeOrder.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center space-y-2">
              <p className="text-sm font-semibold text-[#231D19]">
                {selectedTable.name} chưa có món nào
              </p>
              <p className="text-xs text-[#6B6056] leading-relaxed">
                Nhấn trực tiếp vào món ăn ở thực đơn bên trái để thêm vào phiếu tạm tính.
              </p>
            </div>
          ) : (
            activeOrder.items.map((item) => {
              const isEditingNote = editingNoteItemId === item.id;
              return (
                <div key={item.id} className="px-5 py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#231D19] leading-snug">
                        {item.name}
                      </p>
                      <p className="text-xs text-[#6B6056] font-tabular mt-0.5">
                        {formatVnd(item.unitPrice)}
                      </p>
                    </div>
                    <div className="font-tabular text-sm font-bold text-[#231D19] shrink-0">
                      {formatVnd(item.unitPrice * item.quantity)}
                    </div>
                  </div>

                  {/* Existing kitchen note */}
                  {item.note && !isEditingNote && (
                    <p className="text-xs text-[#B4691E] font-medium">
                      Ghi chú bếp: {item.note}
                    </p>
                  )}

                  {/* Row Controls */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(selectedTable.id, item.id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E5DDD2] text-[#231D19] hover:bg-[#F7F4EE]"
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-tabular text-sm font-semibold w-7 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(selectedTable.id, item.id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E5DDD2] text-[#231D19] hover:bg-[#F7F4EE]"
                        aria-label="Tăng số lượng"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingNote(item.id, item.note)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#6B6056] hover:text-[#231D19] hover:bg-[#F7F4EE] rounded transition-colors whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{item.note ? 'Sửa ghi chú' : 'Ghi chú'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(selectedTable.id, item.id)}
                        className="p-1.5 text-[#6B6056] hover:text-[#9E2A2B] hover:bg-[#9E2A2B]/8 rounded transition-colors"
                        aria-label="Xóa món"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Kitchen Note Editor */}
                  {isEditingNote && (
                    <div className="pt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_NOTES.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setNoteDraft((prev) =>
                                prev ? `${prev}, ${preset}` : preset
                              )
                            }
                            className="px-2 py-1 text-[11px] font-medium text-[#231D19] bg-[#F7F4EE] hover:bg-[#EFEAE0] border border-[#E5DDD2] rounded transition-colors"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitNote(item.id, noteDraft);
                          }}
                          placeholder="Nhập yêu cầu cho bếp..."
                          className="flex-1 px-2.5 py-1.5 text-xs border border-[#E5DDD2] rounded-md focus:outline-none focus:border-[#1E4D3B]"
                        />
                        <button
                          type="button"
                          onClick={() => commitNote(item.id, noteDraft)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-md whitespace-nowrap"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Checkout Footer */}
        <div className="p-5 border-t border-[#E5DDD2] bg-[#F7F4EE]/60 space-y-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-[#6B6056]">
              <span>Tạm tính</span>
              <span className="font-tabular text-[#231D19]">{formatVnd(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#6B6056]">
              <span>VAT dự kiến ({defaultVatRate}%)</span>
              <span className="font-tabular text-[#231D19]">{formatVnd(estVat)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E5DDD2] text-base font-bold text-[#231D19]">
              <span>Tổng dự kiến</span>
              <span className="font-tabular text-[#1E4D3B]">{formatVnd(estTotal)}</span>
            </div>
          </div>

          {confirmCancelTable ? (
            <div className="p-3 bg-white border border-[#9E2A2B]/30 rounded-lg space-y-2.5">
              <p className="text-xs font-medium text-[#231D19]">
                Hủy toàn bộ phiếu tạm tính và trả <strong>{selectedTable?.name}</strong> về trạng thái trống?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancelTable(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#6B6056] border border-[#E5DDD2] rounded-md hover:bg-[#F7F4EE]"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#9E2A2B] hover:bg-[#7F2021] rounded-md"
                >
                  Xác nhận hủy bàn
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {selectedTable && activeOrder && (
                <button
                  type="button"
                  onClick={() => setConfirmCancelTable(true)}
                  className="px-3.5 py-2.5 text-xs font-semibold text-[#9E2A2B] bg-white hover:bg-[#9E2A2B]/8 border border-[#E5DDD2] rounded-lg transition-colors whitespace-nowrap"
                >
                  Hủy bàn
                </button>
              )}
              <button
                type="button"
                disabled={!selectedTable || !activeOrder || activeOrder.items.length === 0}
                onClick={() => selectedTable && onOpenCheckout(selectedTable.id)}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                Thanh toán & Chia bill
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
