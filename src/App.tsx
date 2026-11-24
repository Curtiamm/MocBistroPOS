import { useCallback, useMemo, useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { CheckoutModal } from './components/CheckoutModal';
import { DataBackupModal } from './components/DataBackupModal';
import { FloorPlanView } from './components/FloorPlanView';
import { MenuManagerView } from './components/MenuManagerView';
import { OrderPosView } from './components/OrderPosView';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { ReportsView } from './components/ReportsView';
import { Sidebar } from './components/Sidebar';
import { StaffManagerView } from './components/StaffManagerView';
import { TableManagerModal } from './components/TableManagerModal';
import { TableOperationsModal } from './components/TableOperationsModal';
import { ToastContainer } from './components/ToastContainer';
import { CheckoutPayload, usePosStore } from './hooks/usePosStore';
import { ActiveView, Invoice, ToastMessage, UserProfile } from './types/pos';

export default function App() {
  // In-memory session state (Bearer token is never persisted in localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const {
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
    addTable,
    updateTable,
    deleteTable,
    exportBackupJson,
    importBackupJson,
    resetSampleData,
  } = usePosStore(authToken);

  const [activeView, setActiveView] = useState<ActiveView>('floor');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => {
    const firstOccupied = state.tables.find((t) => t.status === 'occupied');
    return firstOccupied?.id ?? state.tables[0]?.id ?? null;
  });

  // Modals & Drawers
  const [tableOpsTableId, setTableOpsTableId] = useState<string | null>(null);
  const [checkoutTableId, setCheckoutTableId] = useState<string | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showTableManagerModal, setShowTableManagerModal] = useState(false);
  const [openCreateMenuDrawer, setOpenCreateMenuDrawer] = useState(false);
  const [openCreateStaffDrawer, setOpenCreateStaffDrawer] = useState(false);
  const [shiftModalTrigger, setShiftModalTrigger] = useState<'open' | 'close' | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isManager = currentUser?.role === 'manager';

  const notify = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAuthenticated = useCallback(
    (token: string, user: UserProfile) => {
      setAuthToken(token);
      setCurrentUser(user);
      setActiveView('floor');
      notify(
        'success',
        `Xin chào, ${user.fullName}`,
        user.role === 'manager'
          ? 'Bạn đang đăng nhập với quyền Quản lý.'
          : 'Bạn đang đăng nhập với quyền Nhân viên.'
      );
    },
    [notify]
  );

  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    setAuthToken(null);
    setCurrentUser(null);
    setActiveView('floor');
    setShowTableManagerModal(false);
    setShowBackupModal(false);
    setOpenCreateMenuDrawer(false);
    setOpenCreateStaffDrawer(false);
  }, [authToken]);

  const activeShift = useMemo(() => {
    if (!state.activeShiftId) return null;
    return state.shifts.find((s) => s.id === state.activeShiftId && s.status === 'open') ?? null;
  }, [state.activeShiftId, state.shifts]);

  const occupiedCount = useMemo(
    () => state.tables.filter((t) => t.status === 'occupied').length,
    [state.tables]
  );

  const handleSelectTableFromFloor = (tableId: string) => {
    const table = state.tables.find((t) => t.id === tableId);
    if (!table) return;
    if (table.status === 'available') {
      openTable(tableId);
      notify('info', `Đã mở ${table.name}`, 'Chọn món ở thực đơn để thêm vào phiếu.');
    }
    setSelectedTableId(tableId);
    setActiveView('order');
  };

  const handleSelectTableInPos = (tableId: string) => {
    const table = state.tables.find((t) => t.id === tableId);
    if (table && table.status === 'available') {
      openTable(tableId);
    }
    setSelectedTableId(tableId);
  };

  const handleConfirmCheckout = (payload: CheckoutPayload) => {
    const invoice = checkoutOrder(payload);
    if (!invoice) {
      notify('error', 'Không thể thanh toán', 'Đơn hàng trống hoặc không hợp lệ.');
      return;
    }
    setCheckoutTableId(null);
    setReceiptInvoice(invoice);
    notify(
      'success',
      `Thanh toán thành công · ${invoice.code}`,
      `${invoice.tableName} · ${invoice.total.toLocaleString('vi-VN')}₫`
    );
  };

  const tableOpsTarget = useMemo(() => {
    if (!tableOpsTableId) return null;
    const table = state.tables.find((t) => t.id === tableOpsTableId);
    if (!table?.activeOrderId) return null;
    const order = state.orders[table.activeOrderId];
    if (!order) return null;
    return { table, order };
  }, [tableOpsTableId, state.tables, state.orders]);

  const checkoutTarget = useMemo(() => {
    if (!checkoutTableId) return null;
    const table = state.tables.find((t) => t.id === checkoutTableId);
    if (!table?.activeOrderId) return null;
    const order = state.orders[table.activeOrderId];
    if (!order) return null;
    return { table, order };
  }, [checkoutTableId, state.tables, state.orders]);

  const selectedTable = useMemo(
    () => state.tables.find((t) => t.id === selectedTableId) ?? null,
    [state.tables, selectedTableId]
  );

  const safeActiveView: ActiveView =
    activeView === 'staff' && !isManager ? 'floor' : activeView;

  const headerMeta = useMemo(() => {
    switch (safeActiveView) {
      case 'floor':
        return isManager
          ? {
              breadcrumb: 'Mộc Bistro / Sơ đồ bàn',
              actionLabel: 'Quản lý sơ đồ bàn',
              actionIcon: 'sliders' as const,
              onAction: () => setShowTableManagerModal(true),
            }
          : {
              breadcrumb: 'Mộc Bistro / Sơ đồ bàn',
              actionLabel: activeShift ? 'Chốt ca làm' : 'Mở ca làm',
              actionIcon: 'none' as const,
              onAction: () => {
                setActiveView('reports');
                setShiftModalTrigger(activeShift ? 'close' : 'open');
              },
            };
      case 'order':
        return {
          breadcrumb: selectedTable
            ? `Mộc Bistro / Gọi món / ${selectedTable.name}`
            : 'Mộc Bistro / Gọi món',
          actionLabel: 'Về sơ đồ bàn',
          actionIcon: 'none' as const,
          onAction: () => setActiveView('floor'),
        };
      case 'reports':
        return {
          breadcrumb: 'Mộc Bistro / Doanh thu & Ca làm',
          actionLabel: activeShift ? 'Chốt ca làm' : 'Mở ca mới',
          actionIcon: 'none' as const,
          onAction: () => setShiftModalTrigger(activeShift ? 'close' : 'open'),
        };
      case 'menu':
        return isManager
          ? {
              breadcrumb: 'Mộc Bistro / Quản lý thực đơn',
              actionLabel: 'Thêm món mới',
              actionIcon: 'plus' as const,
              onAction: () => setOpenCreateMenuDrawer(true),
            }
          : {
              breadcrumb: 'Mộc Bistro / Thực đơn phục vụ',
              actionLabel: 'Sang gọi món',
              actionIcon: 'none' as const,
              onAction: () => setActiveView('order'),
            };
      case 'staff':
        return {
          breadcrumb: 'Mộc Bistro / Hồ sơ nhân viên',
          actionLabel: 'Thêm nhân viên',
          actionIcon: 'plus' as const,
          onAction: () => setOpenCreateStaffDrawer(true),
        };
    }
  }, [safeActiveView, isManager, activeShift, selectedTable]);

  // Require login before entering the POS workspace
  if (!authToken || !currentUser) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F7F4EE] text-[#231D19]">
      {/* Fixed 240px Desktop Sidebar */}
      <Sidebar
        activeView={safeActiveView}
        onSelectView={setActiveView}
        occupiedCount={occupiedCount}
        totalTables={state.tables.length}
        activeShift={activeShift}
        currentUser={currentUser}
        onOpenBackup={() => setShowBackupModal(true)}
        onLogout={() => void handleLogout()}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar: Contextual Breadcrumb + Single Primary Action */}
        <header className="no-print h-16 px-6 bg-white border-b border-[#E5DDD2] flex items-center justify-between gap-8 shrink-0">
          <div className="text-sm font-medium text-[#6B6056] truncate">
            {headerMeta.breadcrumb}
          </div>

          <button
            type="button"
            onClick={headerMeta.onAction}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {headerMeta.actionIcon === 'plus' && <Plus className="w-3.5 h-3.5" />}
            {headerMeta.actionIcon === 'sliders' && (
              <SlidersHorizontal className="w-3.5 h-3.5" />
            )}
            <span>{headerMeta.actionLabel}</span>
          </button>
        </header>

        {/* Active View Viewport */}
        <main className="no-print flex-1 overflow-y-auto">
          {safeActiveView === 'floor' && (
            <FloorPlanView
              tables={state.tables}
              orders={state.orders}
              onSelectTableForOrder={handleSelectTableFromFloor}
              onOpenTableOps={(tableId) => setTableOpsTableId(tableId)}
              onQuickCheckout={(tableId) => setCheckoutTableId(tableId)}
            />
          )}

          {safeActiveView === 'order' && (
            <OrderPosView
              tables={state.tables}
              orders={state.orders}
              menu={state.menu}
              selectedTableId={selectedTableId}
              defaultVatRate={state.defaultVatRate}
              onSelectTable={handleSelectTableInPos}
              onUpdateGuests={updateTableGuests}
              onAddItem={addItemToTable}
              onUpdateQty={updateOrderItemQuantity}
              onUpdateNote={updateOrderItemNote}
              onRemoveItem={removeOrderItem}
              onClearTable={(tableId) => {
                const table = state.tables.find((t) => t.id === tableId);
                clearTable(tableId);
                notify('info', `Đã giải phóng ${table?.name ?? 'bàn'}`);
              }}
              onOpenTableOps={(tableId) => setTableOpsTableId(tableId)}
              onOpenCheckout={(tableId) => setCheckoutTableId(tableId)}
              onGoToFloor={() => setActiveView('floor')}
            />
          )}

          {safeActiveView === 'reports' && (
            <ReportsView
              invoices={state.invoices}
              shifts={state.shifts}
              activeShift={activeShift}
              canVoidInvoice={isManager}
              defaultCashierName={currentUser.fullName}
              onOpenShift={openShift}
              onCloseShift={closeShift}
              onVoidInvoice={voidInvoice}
              onViewReceipt={(inv) => setReceiptInvoice(inv)}
              onNotify={notify}
              shiftModalTrigger={shiftModalTrigger}
              onClearShiftModalTrigger={() => setShiftModalTrigger(null)}
            />
          )}

          {safeActiveView === 'menu' && (
            <MenuManagerView
              menu={state.menu}
              canManageMenu={isManager}
              openCreateDrawer={openCreateMenuDrawer}
              onCloseCreateDrawer={() => setOpenCreateMenuDrawer(false)}
              onAddMenuItem={addMenuItem}
              onUpdateMenuItem={updateMenuItem}
              onToggleAvailability={toggleMenuAvailability}
              onDeleteMenuItem={deleteMenuItem}
              onNotify={notify}
            />
          )}

          {safeActiveView === 'staff' && isManager && (
            <StaffManagerView
              authToken={authToken}
              currentUser={currentUser}
              openCreateDrawer={openCreateStaffDrawer}
              onCloseCreateDrawer={() => setOpenCreateStaffDrawer(false)}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showTableManagerModal && isManager && (
        <TableManagerModal
          tables={state.tables}
          onAddTable={addTable}
          onUpdateTable={updateTable}
          onDeleteTable={deleteTable}
          onNotify={notify}
          onClose={() => setShowTableManagerModal(false)}
        />
      )}

      {tableOpsTarget && (
        <TableOperationsModal
          sourceTable={tableOpsTarget.table}
          sourceOrder={tableOpsTarget.order}
          tables={state.tables}
          orders={state.orders}
          onTransfer={transferTable}
          onMerge={mergeTables}
          onSplit={splitTable}
          onSuccess={(msg, focusTableId) => {
            notify('success', 'Cập nhật bàn thành công', msg);
            if (focusTableId) setSelectedTableId(focusTableId);
          }}
          onClose={() => setTableOpsTableId(null)}
        />
      )}

      {checkoutTarget && (
        <CheckoutModal
          table={checkoutTarget.table}
          order={checkoutTarget.order}
          defaultVatRate={state.defaultVatRate}
          restaurantName={state.restaurantName}
          onConfirmCheckout={handleConfirmCheckout}
          onClose={() => setCheckoutTableId(null)}
        />
      )}

      {receiptInvoice && (
        <ReceiptPreviewModal
          invoice={receiptInvoice}
          restaurantName={state.restaurantName}
          restaurantAddress={state.restaurantAddress}
          restaurantPhone={state.restaurantPhone}
          onClose={() => setReceiptInvoice(null)}
        />
      )}

      {showBackupModal && isManager && (
        <DataBackupModal
          onExportJson={exportBackupJson}
          onImportJson={importBackupJson}
          onResetSample={() => {
            resetSampleData();
            setActiveView('floor');
          }}
          onClose={() => setShowBackupModal(false)}
          onNotify={notify}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
