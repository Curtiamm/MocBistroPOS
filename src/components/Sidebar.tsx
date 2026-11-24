import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Database,
  LayoutGrid,
  LogOut,
  Users,
} from 'lucide-react';
import { ActiveView, ShiftRecord, UserProfile } from '../types/pos';
import { formatTime } from '../utils/format';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  occupiedCount: number;
  totalTables: number;
  activeShift: ShiftRecord | null;
  currentUser: UserProfile;
  onOpenBackup: () => void;
  onLogout: () => void;
}

export function Sidebar({
  activeView,
  onSelectView,
  occupiedCount,
  totalTables,
  activeShift,
  currentUser,
  onOpenBackup,
  onLogout,
}: SidebarProps) {
  const isManager = currentUser.role === 'manager';

  const navItems: Array<{
    id: ActiveView;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    { id: 'floor', label: 'Sơ đồ bàn', icon: LayoutGrid },
    { id: 'order', label: 'Gọi món', icon: ClipboardList },
    { id: 'menu', label: 'Thực đơn', icon: BookOpen },
    { id: 'reports', label: 'Doanh thu & Ca', icon: BarChart3 },
    ...(isManager
      ? [{ id: 'staff' as const, label: 'Hồ sơ nhân viên', icon: Users }]
      : []),
  ];

  return (
    <aside className="no-print w-60 shrink-0 bg-white border-r border-[#E5DDD2] flex flex-col justify-between min-h-screen select-none">
      <div>
        {/* Brand Wordmark */}
        <div className="h-16 px-6 flex items-center border-b border-[#E5DDD2]">
          <span className="font-display text-xl font-bold tracking-tight text-[#231D19] whitespace-nowrap">
            Mộc Bistro
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1E4D3B] text-white'
                    : 'text-[#6B6056] hover:bg-[#F7F4EE] hover:text-[#231D19]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'floor' && (
                  <span
                    className={`font-tabular text-xs shrink-0 ${
                      isActive ? 'text-white/80' : 'text-[#6B6056]'
                    }`}
                  >
                    {occupiedCount}/{totalTables}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Identity, Shift Summary & Actions */}
      <div className="p-4 border-t border-[#E5DDD2] space-y-3">
        {/* Logged-in User Info */}
        <div className="px-1 pb-3 border-b border-[#E5DDD2]/80">
          <p className="text-sm font-semibold text-[#231D19] truncate">
            {currentUser.fullName}
          </p>
          <p className="text-xs text-[#6B6056] truncate mt-0.5">
            <span className={isManager ? 'font-semibold text-[#1E4D3B]' : ''}>
              {isManager ? 'Quản lý' : 'Nhân viên'}
            </span>{' '}
            · <span className="font-tabular">@{currentUser.username}</span>
          </p>
        </div>

        {/* Active Shift Summary */}
        <div className="space-y-0.5 px-1">
          <p className="text-xs font-medium text-[#6B6056]">
            {activeShift ? `Ca đang mở · ${activeShift.code}` : 'Chưa mở ca làm'}
          </p>
          {activeShift ? (
            <p className="text-xs text-[#231D19] truncate">
              {activeShift.cashierName} · Từ{' '}
              <span className="font-tabular">{formatTime(activeShift.openedAt)}</span>
            </p>
          ) : (
            <p className="text-xs text-[#B4691E]">Vào Doanh thu & Ca để mở ca</p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {isManager && (
            <button
              type="button"
              onClick={onOpenBackup}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#6B6056] hover:text-[#231D19] hover:bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg transition-colors whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>Sao lưu dữ liệu</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#9E2A2B] hover:bg-[#9E2A2B]/8 border border-[#E5DDD2] rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
