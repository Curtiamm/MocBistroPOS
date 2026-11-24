import { useCallback, useEffect, useState } from 'react';
import { createInitialSeedState, STORAGE_KEY } from '../data/seedData';
import {
  DiscountType,
  Invoice,
  MenuCategory,
  MenuItem,
  OrderItem,
  PaymentMethod,
  PosState,
  ShiftRecord,
  TableOrder,
} from '../types/pos';
import {
  calculateTotals,
  generateInvoiceCode,
  generateShiftCode,
} from '../utils/format';

function loadInitialState(): PosState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialSeedState();
    }
    const parsed = JSON.parse(raw) as Partial<PosState>;
    if (
      !parsed ||
      !Array.isArray(parsed.tables) ||
      !Array.isArray(parsed.menu) ||
      typeof parsed.orders !== 'object' ||
      !Array.isArray(parsed.invoices) ||
      !Array.isArray(parsed.shifts)
    ) {
      return createInitialSeedState();
    }
    return {
      ...createInitialSeedState(),
      ...parsed,
    };
  } catch {
    return createInitialSeedState();
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function mergeOrderItems(baseItems: OrderItem[], incomingItems: OrderItem[]): OrderItem[] {
  const result = baseItems.map((item) => ({ ...item }));
  for (const inc of incomingItems) {
    const normalizedNote = inc.note.trim().toLowerCase();
    const existing = result.find(
      (item) =>
        item.menuItemId === inc.menuItemId &&
        item.note.trim().toLowerCase() === normalizedNote &&
        item.unitPrice === inc.unitPrice
    );
    if (existing) {
      existing.quantity += inc.quantity;
    } else {
      result.push({ ...inc, id: makeId('oi') });
    }
  }
  return result;
}

export interface CheckoutPayload {
  tableId: string;
  mode: 'full' | 'split_items' | 'split_even';
  selectedItemQuantities?: Record<string, number>; // orderItemId -> qty to pay
  evenSplitCount?: number;
  discountType: DiscountType;
  discountValue: number;
  discountReason: string;
  vatEnabled: boolean;
  paymentMethod: PaymentMethod;
  amountReceived: number;
}

export function usePosStore() {
  const [state, setState] = useState<PosState>(() => loadInitialState());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors silently in restricted storage modes
    }
  }, [state]);

  const openTable = useCallback((tableId: string, guests?: number): string => {
    let resolvedOrderId = '';
    setState((prev) => {
      const table = prev.tables.find((t) => t.id === tableId);
      if (!table) return prev;
      if (table.status === 'occupied' && table.activeOrderId && prev.orders[table.activeOrderId]) {
        resolvedOrderId = table.activeOrderId;
        return prev;
      }
      const orderId = makeId('ord');
      resolvedOrderId = orderId;
      const newOrder: TableOrder = {
        id: orderId,
        tableId: table.id,
        openedAt: new Date().toISOString(),
        guests: guests ?? Math.min(2, table.capacity),
        items: [],
        note: '',
      };
      return {
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, status: 'occupied', activeOrderId: orderId } : t
        ),
        orders: {
          ...prev.orders,
          [orderId]: newOrder,
        },
      };
    });
    return resolvedOrderId;
  }, []);

  const updateTableGuests = useCallback((tableId: string, guests: number) => {
    const safeGuests = Math.max(1, Math.min(30, guests));
    setState((prev) => {
      const table = prev.tables.find((t) => t.id === tableId);
      if (!table?.activeOrderId) return prev;
      const order = prev.orders[table.activeOrderId];
      if (!order) return prev;
      return {
        ...prev,
        orders: {
          ...prev.orders,
          [order.id]: { ...order, guests: safeGuests },
        },
      };
    });
  }, []);

  const addItemToTable = useCallback((tableId: string, menuItem: MenuItem, note = '') => {
    if (!menuItem.available) return;
    setState((prev) => {
      const table = prev.tables.find((t) => t.id === tableId);
      if (!table) return prev;

      let orderId = table.activeOrderId;
      let currentOrder = orderId ? prev.orders[orderId] : undefined;
      let nextTables = prev.tables;

      if (!currentOrder) {
        orderId = makeId('ord');
        currentOrder = {
          id: orderId,
          tableId: table.id,
          openedAt: new Date().toISOString(),
          guests: Math.min(2, table.capacity),
          items: [],
          note: '',
        };
        nextTables = prev.tables.map((t) =>
          t.id === tableId ? { ...t, status: 'occupied', activeOrderId: orderId! } : t
        );
      }

      const normalizedNote = note.trim().toLowerCase();
      const existingIndex = currentOrder.items.findIndex(
        (item) =>
          item.menuItemId === menuItem.id &&
          item.note.trim().toLowerCase() === normalizedNote &&
          item.unitPrice === menuItem.price
      );

      let nextItems: OrderItem[];
      if (existingIndex >= 0) {
        nextItems = currentOrder.items.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        nextItems = [
          ...currentOrder.items,
          {
            id: makeId('oi'),
            menuItemId: menuItem.id,
            code: menuItem.code,
            name: menuItem.name,
            unitPrice: menuItem.price,
            quantity: 1,
            note: note.trim(),
          },
        ];
      }

      return {
        ...prev,
        tables: nextTables,
        orders: {
          ...prev.orders,
          [currentOrder.id]: {
            ...currentOrder,
            items: nextItems,
          },
        },
      };
    });
  }, []);

  const updateOrderItemQuantity = useCallback(
    (tableId: string, orderItemId: string, delta: number) => {
      setState((prev) => {
        const table = prev.tables.find((t) => t.id === tableId);
        if (!table?.activeOrderId) return prev;
        const order = prev.orders[table.activeOrderId];
        if (!order) return prev;

        const nextItems = order.items
          .map((item) =>
            item.id === orderItemId
              ? { ...item, quantity: item.quantity + delta }
              : item
          )
          .filter((item) => item.quantity > 0);

        return {
          ...prev,
          orders: {
            ...prev.orders,
            [order.id]: {
              ...order,
              items: nextItems,
            },
          },
        };
      });
    },
    []
  );

  const updateOrderItemNote = useCallback(
    (tableId: string, orderItemId: string, note: string) => {
      setState((prev) => {
        const table = prev.tables.find((t) => t.id === tableId);
        if (!table?.activeOrderId) return prev;
        const order = prev.orders[table.activeOrderId];
        if (!order) return prev;

        return {
          ...prev,
          orders: {
            ...prev.orders,
            [order.id]: {
              ...order,
              items: order.items.map((item) =>
                item.id === orderItemId ? { ...item, note: note.trim() } : item
              ),
            },
          },
        };
      });
    },
    []
  );

  const removeOrderItem = useCallback((tableId: string, orderItemId: string) => {
    setState((prev) => {
      const table = prev.tables.find((t) => t.id === tableId);
      if (!table?.activeOrderId) return prev;
      const order = prev.orders[table.activeOrderId];
      if (!order) return prev;

      return {
        ...prev,
        orders: {
          ...prev.orders,
          [order.id]: {
            ...order,
            items: order.items.filter((item) => item.id !== orderItemId),
          },
        },
      };
    });
  }, []);

  const clearTable = useCallback((tableId: string) => {
    setState((prev) => {
      const table = prev.tables.find((t) => t.id === tableId);
      if (!table?.activeOrderId) return prev;
      const nextOrders = { ...prev.orders };
      delete nextOrders[table.activeOrderId];
      return {
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, status: 'available', activeOrderId: null } : t
        ),
        orders: nextOrders,
      };
    });
  }, []);

  const transferTable = useCallback(
    (sourceTableId: string, targetTableId: string): { ok: boolean; error?: string } => {
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        const source = prev.tables.find((t) => t.id === sourceTableId);
        const target = prev.tables.find((t) => t.id === targetTableId);
        if (!source || !target) {
          result = { ok: false, error: 'Không tìm thấy bàn cần chuyển.' };
          return prev;
        }
        if (source.status !== 'occupied' || !source.activeOrderId) {
          result = { ok: false, error: 'Bàn nguồn chưa có đơn hàng.' };
          return prev;
        }
        if (target.status !== 'available') {
          result = { ok: false, error: 'Bàn đích đang có khách. Hãy dùng chức năng Gộp bàn.' };
          return prev;
        }
        const order = prev.orders[source.activeOrderId];
        if (!order) {
          result = { ok: false, error: 'Không tìm thấy đơn hàng của bàn nguồn.' };
          return prev;
        }

        return {
          ...prev,
          tables: prev.tables.map((t) => {
            if (t.id === sourceTableId) {
              return { ...t, status: 'available', activeOrderId: null };
            }
            if (t.id === targetTableId) {
              return { ...t, status: 'occupied', activeOrderId: order.id };
            }
            return t;
          }),
          orders: {
            ...prev.orders,
            [order.id]: { ...order, tableId: targetTableId },
          },
        };
      });
      return result;
    },
    []
  );

  const mergeTables = useCallback(
    (primaryTableId: string, sourceTableIds: string[]): { ok: boolean; error?: string } => {
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        const primary = prev.tables.find((t) => t.id === primaryTableId);
        if (!primary || !primary.activeOrderId || !prev.orders[primary.activeOrderId]) {
          result = { ok: false, error: 'Bàn đích phải đang có đơn hoạt động.' };
          return prev;
        }
        const validSources = sourceTableIds
          .filter((id) => id !== primaryTableId)
          .map((id) => prev.tables.find((t) => t.id === id))
          .filter((t): t is NonNullable<typeof t> => Boolean(t && t.status === 'occupied' && t.activeOrderId));

        if (validSources.length === 0) {
          result = { ok: false, error: 'Hãy chọn ít nhất một bàn đang phục vụ để gộp.' };
          return prev;
        }

        const primaryOrder = prev.orders[primary.activeOrderId];
        let combinedItems = [...primaryOrder.items];
        let combinedGuests = primaryOrder.guests;
        const nextOrders = { ...prev.orders };
        const releasedTableIds = new Set<string>();

        for (const src of validSources) {
          const srcOrder = src.activeOrderId ? prev.orders[src.activeOrderId] : undefined;
          if (srcOrder) {
            combinedItems = mergeOrderItems(combinedItems, srcOrder.items);
            combinedGuests += srcOrder.guests;
            delete nextOrders[srcOrder.id];
            releasedTableIds.add(src.id);
          }
        }

        nextOrders[primaryOrder.id] = {
          ...primaryOrder,
          guests: combinedGuests,
          items: combinedItems,
        };

        return {
          ...prev,
          tables: prev.tables.map((t) =>
            releasedTableIds.has(t.id)
              ? { ...t, status: 'available', activeOrderId: null }
              : t
          ),
          orders: nextOrders,
        };
      });
      return result;
    },
    []
  );

  const splitTable = useCallback(
    (
      sourceTableId: string,
      targetTableId: string,
      itemQuantities: Record<string, number>
    ): { ok: boolean; error?: string } => {
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        const source = prev.tables.find((t) => t.id === sourceTableId);
        const target = prev.tables.find((t) => t.id === targetTableId);
        if (!source || !target || source.id === target.id) {
          result = { ok: false, error: 'Bàn nguồn hoặc bàn đích không hợp lệ.' };
          return prev;
        }
        if (!source.activeOrderId || !prev.orders[source.activeOrderId]) {
          result = { ok: false, error: 'Bàn nguồn không có đơn hàng.' };
          return prev;
        }

        const sourceOrder = prev.orders[source.activeOrderId];
        const movedItems: OrderItem[] = [];
        const remainingItems: OrderItem[] = [];

        for (const item of sourceOrder.items) {
          const requested = Math.max(0, Math.min(item.quantity, Math.floor(itemQuantities[item.id] ?? 0)));
          if (requested > 0) {
            movedItems.push({ ...item, id: makeId('oi'), quantity: requested });
          }
          const left = item.quantity - requested;
          if (left > 0) {
            remainingItems.push({ ...item, quantity: left });
          }
        }

        if (movedItems.length === 0) {
          result = { ok: false, error: 'Hãy chọn ít nhất 1 món để tách sang bàn khác.' };
          return prev;
        }

        const nextOrders = { ...prev.orders };
        let nextTables = [...prev.tables];

        // Update or release source table
        if (remainingItems.length === 0) {
          delete nextOrders[sourceOrder.id];
          nextTables = nextTables.map((t) =>
            t.id === sourceTableId ? { ...t, status: 'available', activeOrderId: null } : t
          );
        } else {
          nextOrders[sourceOrder.id] = {
            ...sourceOrder,
            items: remainingItems,
          };
        }

        // Update or create target table order
        if (target.status === 'occupied' && target.activeOrderId && nextOrders[target.activeOrderId]) {
          const targetOrder = nextOrders[target.activeOrderId];
          nextOrders[targetOrder.id] = {
            ...targetOrder,
            items: mergeOrderItems(targetOrder.items, movedItems),
          };
        } else {
          const newOrderId = makeId('ord');
          nextOrders[newOrderId] = {
            id: newOrderId,
            tableId: targetTableId,
            openedAt: new Date().toISOString(),
            guests: Math.max(1, Math.min(2, target.capacity)),
            items: movedItems,
            note: `Tách từ ${source.name}`,
          };
          nextTables = nextTables.map((t) =>
            t.id === targetTableId ? { ...t, status: 'occupied', activeOrderId: newOrderId } : t
          );
        }

        return {
          ...prev,
          tables: nextTables,
          orders: nextOrders,
        };
      });
      return result;
    },
    []
  );

  const checkoutOrder = useCallback((payload: CheckoutPayload): Invoice | null => {
    let createdInvoice: Invoice | null = null;

    setState((prev) => {
      const table = prev.tables.find((t) => t.id === payload.tableId);
      if (!table?.activeOrderId) return prev;
      const order = prev.orders[table.activeOrderId];
      if (!order || order.items.length === 0) return prev;

      let billedItems: OrderItem[] = [];
      let remainingItems: OrderItem[] = [];

      if (payload.mode === 'split_items' && payload.selectedItemQuantities) {
        for (const item of order.items) {
          const qtyToPay = Math.max(
            0,
            Math.min(item.quantity, Math.floor(payload.selectedItemQuantities[item.id] ?? 0))
          );
          if (qtyToPay > 0) {
            billedItems.push({ ...item, quantity: qtyToPay });
          }
          const left = item.quantity - qtyToPay;
          if (left > 0) {
            remainingItems.push({ ...item, quantity: left });
          }
        }
      } else {
        billedItems = order.items.map((i) => ({ ...i }));
        remainingItems = [];
      }

      if (billedItems.length === 0) return prev;

      // Ensure an open shift exists so checkout is never blocked
      let activeShiftId = prev.activeShiftId;
      let nextShifts = prev.shifts;
      if (!activeShiftId || !prev.shifts.some((s) => s.id === activeShiftId && s.status === 'open')) {
        const autoShift: ShiftRecord = {
          id: makeId('shift'),
          code: generateShiftCode(prev.shifts.length + 1),
          cashierName: 'Thu ngân ca',
          openedAt: new Date().toISOString(),
          closedAt: null,
          openingCash: 0,
          actualClosingCash: null,
          expectedClosingCash: null,
          cashDifference: null,
          status: 'open',
        };
        activeShiftId = autoShift.id;
        nextShifts = [autoShift, ...prev.shifts];
      }

      const totals = calculateTotals({
        items: billedItems,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        vatEnabled: payload.vatEnabled,
        vatRate: prev.defaultVatRate,
      });

      const received =
        payload.paymentMethod === 'cash'
          ? Math.max(totals.total, payload.amountReceived)
          : totals.total;
      const changeDue = Math.max(0, received - totals.total);

      let splitLabel: string | undefined;
      if (payload.mode === 'split_items' && remainingItems.length > 0) {
        splitLabel = 'Tách thanh toán theo món';
      } else if (payload.mode === 'split_even' && payload.evenSplitCount && payload.evenSplitCount > 1) {
        const perPerson = Math.ceil(totals.total / payload.evenSplitCount);
        splitLabel = `Chia đều ${payload.evenSplitCount} người (${perPerson.toLocaleString('vi-VN')}₫/người)`;
      }

      const invoice: Invoice = {
        id: makeId('inv'),
        code: generateInvoiceCode(prev.invoiceCounter),
        shiftId: activeShiftId,
        tableId: table.id,
        tableName: table.name,
        zone: table.zone,
        openedAt: order.openedAt,
        paidAt: new Date().toISOString(),
        guests: order.guests,
        items: billedItems,
        subtotal: totals.subtotal,
        discount:
          totals.discountAmount > 0
            ? {
                type: payload.discountType,
                value: payload.discountValue,
                amount: totals.discountAmount,
                reason: payload.discountReason.trim(),
              }
            : null,
        vatEnabled: payload.vatEnabled,
        vatRate: prev.defaultVatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        paymentMethod: payload.paymentMethod,
        amountReceived: received,
        changeDue,
        splitLabel,
        status: 'paid',
      };

      createdInvoice = invoice;

      const nextOrders = { ...prev.orders };
      let nextTables = prev.tables;

      if (remainingItems.length === 0) {
        delete nextOrders[order.id];
        nextTables = prev.tables.map((t) =>
          t.id === table.id ? { ...t, status: 'available', activeOrderId: null } : t
        );
      } else {
        nextOrders[order.id] = {
          ...order,
          items: remainingItems,
        };
      }

      return {
        ...prev,
        tables: nextTables,
        orders: nextOrders,
        shifts: nextShifts,
        activeShiftId,
        invoices: [invoice, ...prev.invoices],
        invoiceCounter: prev.invoiceCounter + 1,
      };
    });

    return createdInvoice;
  }, []);

  const voidInvoice = useCallback((invoiceId: string, reason: string) => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: 'voided',
              voidReason: trimmed,
              voidedAt: new Date().toISOString(),
            }
          : inv
      ),
    }));
  }, []);

  const openShift = useCallback((cashierName: string, openingCash: number) => {
    setState((prev) => {
      if (prev.activeShiftId && prev.shifts.some((s) => s.id === prev.activeShiftId && s.status === 'open')) {
        return prev;
      }
      const newShift: ShiftRecord = {
        id: makeId('shift'),
        code: generateShiftCode(prev.shifts.length + 1),
        cashierName: cashierName.trim() || 'Thu ngân',
        openedAt: new Date().toISOString(),
        closedAt: null,
        openingCash: Math.max(0, Math.round(openingCash)),
        actualClosingCash: null,
        expectedClosingCash: null,
        cashDifference: null,
        status: 'open',
      };
      return {
        ...prev,
        shifts: [newShift, ...prev.shifts],
        activeShiftId: newShift.id,
      };
    });
  }, []);

  const closeShift = useCallback((actualClosingCash: number, closingNote: string) => {
    setState((prev) => {
      if (!prev.activeShiftId) return prev;
      const activeShift = prev.shifts.find((s) => s.id === prev.activeShiftId);
      if (!activeShift || activeShift.status !== 'open') return prev;

      const shiftCashRevenue = prev.invoices
        .filter((inv) => inv.shiftId === activeShift.id && inv.status === 'paid' && inv.paymentMethod === 'cash')
        .reduce((sum, inv) => sum + inv.total, 0);

      const expected = activeShift.openingCash + shiftCashRevenue;
      const actual = Math.max(0, Math.round(actualClosingCash));
      const diff = actual - expected;

      return {
        ...prev,
        shifts: prev.shifts.map((s) =>
          s.id === activeShift.id
            ? {
                ...s,
                status: 'closed',
                closedAt: new Date().toISOString(),
                actualClosingCash: actual,
                expectedClosingCash: expected,
                cashDifference: diff,
                closingNote: closingNote.trim() || undefined,
              }
            : s
        ),
        activeShiftId: null,
      };
    });
  }, []);

  const addMenuItem = useCallback(
    (input: {
      code: string;
      name: string;
      category: MenuCategory;
      price: number;
      description: string;
      available: boolean;
    }): { ok: boolean; error?: string } => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      if (!code || !name) {
        return { ok: false, error: 'Mã món và tên món không được để trống.' };
      }
      if (input.price < 0 || Number.isNaN(input.price)) {
        return { ok: false, error: 'Đơn giá phải lớn hơn hoặc bằng 0.' };
      }
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        if (prev.menu.some((m) => m.code.toUpperCase() === code)) {
          result = { ok: false, error: `Mã món "${code}" đã tồn tại trong thực đơn.` };
          return prev;
        }
        const newItem: MenuItem = {
          id: makeId('m'),
          code,
          name,
          category: input.category,
          price: Math.round(input.price),
          available: input.available,
          description: input.description.trim(),
        };
        return {
          ...prev,
          menu: [newItem, ...prev.menu],
        };
      });
      return result;
    },
    []
  );

  const updateMenuItem = useCallback(
    (
      id: string,
      input: {
        code: string;
        name: string;
        category: MenuCategory;
        price: number;
        description: string;
        available: boolean;
      }
    ): { ok: boolean; error?: string } => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      if (!code || !name) {
        return { ok: false, error: 'Mã món và tên món không được để trống.' };
      }
      if (input.price < 0 || Number.isNaN(input.price)) {
        return { ok: false, error: 'Đơn giá phải lớn hơn hoặc bằng 0.' };
      }
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        if (prev.menu.some((m) => m.id !== id && m.code.toUpperCase() === code)) {
          result = { ok: false, error: `Mã món "${code}" đã được dùng cho món khác.` };
          return prev;
        }
        return {
          ...prev,
          menu: prev.menu.map((m) =>
            m.id === id
              ? {
                  ...m,
                  code,
                  name,
                  category: input.category,
                  price: Math.round(input.price),
                  available: input.available,
                  description: input.description.trim(),
                }
              : m
          ),
        };
      });
      return result;
    },
    []
  );

  const toggleMenuAvailability = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      menu: prev.menu.map((m) => (m.id === id ? { ...m, available: !m.available } : m)),
    }));
  }, []);

  const deleteMenuItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      menu: prev.menu.filter((m) => m.id !== id),
    }));
  }, []);

  const exportBackupJson = useCallback((): string => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importBackupJson = useCallback((rawText: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawText) as Partial<PosState>;
      if (
        !parsed ||
        !Array.isArray(parsed.tables) ||
        !Array.isArray(parsed.menu) ||
        typeof parsed.orders !== 'object' ||
        !Array.isArray(parsed.invoices) ||
        !Array.isArray(parsed.shifts)
      ) {
        return {
          ok: false,
          error: 'Tệp sao lưu không đúng định dạng dữ liệu Mộc Bistro POS.',
        };
      }
      setState({
        ...createInitialSeedState(),
        ...parsed,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể đọc tệp JSON. Vui lòng kiểm tra lại tệp sao lưu.' };
    }
  }, []);

  const resetSampleData = useCallback(() => {
    const fresh = createInitialSeedState();
    setState(fresh);
  }, []);

  return {
    state,
    openTable,
    updateTableGuests,
    addItemToTable,
    updateOrderItemQuantity,
    updateOrderItemNote,
    removeOrderItem,
    clearTable,
    transferTable,
    mergeTables,
    splitTable,
    checkoutOrder,
    voidInvoice,
    openShift,
    closeShift,
    addMenuItem,
    updateMenuItem,
    toggleMenuAvailability,
    deleteMenuItem,
    exportBackupJson,
    importBackupJson,
    resetSampleData,
  };
}
