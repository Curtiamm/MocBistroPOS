import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Pencil, Search, Trash2, Unlock, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types/pos';
import { formatShortDate } from '../utils/format';

interface StaffManagerViewProps {
  authToken: string;
  currentUser: UserProfile;
  openCreateDrawer: boolean;
  onCloseCreateDrawer: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export function StaffManagerView({
  authToken,
  currentUser,
  openCreateDrawer,
  onCloseCreateDrawer,
  onNotify,
}: StaffManagerViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [position, setPosition] = useState('Phục vụ bàn');
  const [phone, setPhone] = useState('');
  const [shiftSchedule, setShiftSchedule] = useState('Ca sáng (08:00 - 15:00)');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isDrawerOpen = openCreateDrawer || editingUser !== null;

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        onNotify('error', 'Không thể tải danh sách nhân viên');
        return;
      }
      const data = (await res.json()) as { users: UserProfile[] };
      setUsers(data.users ?? []);
    } catch {
      onNotify('error', 'Lỗi kết nối khi tải hồ sơ nhân viên');
    } finally {
      setLoading(false);
    }
  }, [authToken, onNotify]);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  const resetForm = () => {
    setUsername('');
    setFullName('');
    setRole('staff');
    setPosition('Phục vụ bàn');
    setPhone('');
    setShiftSchedule('Ca sáng (08:00 - 15:00)');
    setPassword('');
    setFormError(null);
  };

  const handleCloseDrawer = () => {
    setEditingUser(null);
    onCloseCreateDrawer();
    resetForm();
  };

  const startEdit = (user: UserProfile) => {
    onCloseCreateDrawer();
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.fullName);
    setRole(user.role);
    setPosition(user.position);
    setPhone(user.phone);
    setShiftSchedule(user.shiftSchedule);
    setPassword('');
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!fullName.trim()) {
      setFormError('Vui lòng nhập họ tên nhân viên.');
      return;
    }
    if (!editingUser && (!username.trim() || password.length < 6)) {
      setFormError('Vui lòng nhập tên đăng nhập và mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    if (editingUser && password.length > 0 && password.length < 6) {
      setFormError('Mật khẩu đặt lại phải có ít nhất 6 ký tự.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/staff/${encodeURIComponent(editingUser.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            role,
            position: position.trim(),
            phone: phone.trim(),
            shiftSchedule: shiftSchedule.trim(),
            newPassword: password || undefined,
          }),
        });
        const data = (await res.json()) as { user?: UserProfile; error?: string };
        if (!res.ok) {
          setFormError(data.error ?? 'Không thể cập nhật hồ sơ.');
          return;
        }
        onNotify('success', 'Đã cập nhật hồ sơ nhân viên', fullName.trim());
      } else {
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            username: username.trim(),
            fullName: fullName.trim(),
            role,
            position: position.trim(),
            phone: phone.trim(),
            shiftSchedule: shiftSchedule.trim(),
            password,
          }),
        });
        const data = (await res.json()) as { user?: UserProfile; error?: string };
        if (!res.ok) {
          setFormError(data.error ?? 'Không thể thêm hồ sơ nhân viên.');
          return;
        }
        onNotify('success', 'Đã tạo hồ sơ nhân viên mới', `${fullName.trim()} (@${username.trim()})`);
      }

      handleCloseDrawer();
      await fetchStaff();
    } catch {
      setFormError('Không thể lưu dữ liệu lên máy chủ.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (user: UserProfile) => {
    const nextStatus = user.status === 'active' ? 'locked' : 'active';
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onNotify('error', 'Không thể thay đổi trạng thái', data.error);
        return;
      }
      onNotify(
        'info',
        nextStatus === 'locked' ? `Đã khóa tài khoản ${user.fullName}` : `Đã mở khóa tài khoản ${user.fullName}`
      );
      await fetchStaff();
    } catch {
      onNotify('error', 'Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async (user: UserProfile) => {
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onNotify('error', 'Không thể xóa nhân viên', data.error);
        return;
      }
      setConfirmDeleteId(null);
      onNotify('info', `Đã xóa hồ sơ ${user.fullName}`);
      await fetchStaff();
    } catch {
      onNotify('error', 'Lỗi kết nối máy chủ');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (
        q &&
        !u.fullName.toLowerCase().includes(q) &&
        !u.username.toLowerCase().includes(q) &&
        !u.phone.toLowerCase().includes(q) &&
        !u.position.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, search]);

  const stats = useMemo(() => {
    const activeCount = users.filter((u) => u.status === 'active').length;
    const managerCount = users.filter((u) => u.role === 'manager').length;
    const staffCount = users.length - managerCount;
    return { total: users.length, activeCount, managerCount, staffCount };
  }, [users]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E5DDD2] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E5DDD2]">
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Tổng hồ sơ nhân sự</p>
          <p className="font-tabular text-2xl font-bold text-[#231D19] mt-1">{stats.total}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Đang hoạt động</p>
          <p className="font-tabular text-2xl font-bold text-[#1F6E4A] mt-1">{stats.activeCount}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B6056]">Phân bổ vai trò</p>
          <p className="text-sm font-semibold text-[#231D19] mt-2">
            <span className="font-tabular">{stats.managerCount}</span> Quản lý ·{' '}
            <span className="font-tabular">{stats.staffCount}</span> Nhân viên
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
          {[
            { id: 'all' as const, label: 'Tất cả' },
            { id: 'manager' as const, label: 'Quản lý' },
            { id: 'staff' as const, label: 'Nhân viên' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRoleFilter(opt.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                roleFilter === opt.id
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search className="w-4 h-4 text-[#6B6056] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm họ tên, tài khoản, SĐT..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-[#E5DDD2] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#6B6056]">
            Đang tải danh sách hồ sơ nhân viên...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#6B6056]">
            Không có hồ sơ nhân viên nào khớp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-[#FAF8F4]">
                  <th className="text-left font-medium px-5 py-3">Nhân sự & Tài khoản</th>
                  <th className="text-left font-medium px-4 py-3">Vai trò</th>
                  <th className="text-left font-medium px-4 py-3">Vị trí & Ca làm</th>
                  <th className="text-left font-medium px-4 py-3">Điện thoại</th>
                  <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                  <th className="text-right font-medium px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDD2]/70">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const canModifySecurity = !u.isPrimaryAdmin && !isSelf;

                  return (
                    <tr key={u.id} className="hover:bg-[#FAF8F4]">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-[#231D19]">
                          {u.fullName}
                          {isSelf && (
                            <span className="text-xs font-normal text-[#6B6056]"> · Bạn</span>
                          )}
                        </p>
                        <p className="text-xs text-[#6B6056] font-tabular mt-0.5">
                          @{u.username} · Tạo {formatShortDate(u.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            u.role === 'manager' ? 'text-[#1E4D3B]' : 'text-[#6B6056]'
                          }`}
                        >
                          {u.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[#231D19]">{u.position}</p>
                        <p className="text-xs text-[#6B6056] mt-0.5">{u.shiftSchedule}</p>
                      </td>
                      <td className="px-4 py-3 font-tabular text-xs text-[#231D19] whitespace-nowrap">
                        {u.phone || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            u.status === 'active' ? 'text-[#1F6E4A]' : 'text-[#9E2A2B]'
                          }`}
                        >
                          {u.status === 'active' ? 'Đang làm việc' : 'Tạm khóa'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {confirmDeleteId === u.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 text-xs text-[#6B6056] border border-[#E5DDD2] rounded hover:bg-[#F7F4EE]"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(u)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#9E2A2B] hover:bg-[#7F2021] rounded"
                            >
                              Xóa hẳn
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(u)}
                              className="p-1.5 text-[#6B6056] hover:text-[#231D19] hover:bg-[#EFEAE0] rounded-md transition-colors"
                              aria-label={`Sửa hồ sơ ${u.fullName}`}
                              title="Chỉnh sửa hồ sơ & đặt lại mật khẩu"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canModifySecurity && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleLock(u)}
                                  className="p-1.5 text-[#6B6056] hover:text-[#B4691E] hover:bg-[#B4691E]/10 rounded-md transition-colors"
                                  aria-label={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                  title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                >
                                  {u.status === 'active' ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Unlock className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(u.id)}
                                  className="p-1.5 text-[#6B6056] hover:text-[#9E2A2B] hover:bg-[#9E2A2B]/8 rounded-md transition-colors"
                                  aria-label={`Xóa ${u.fullName}`}
                                  title="Xóa hồ sơ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLIDE-OVER ADD / EDIT STAFF DRAWER */}
      {isDrawerOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-[#231D19]/40"
          role="dialog"
          aria-modal="true"
          aria-label={editingUser ? 'Chỉnh sửa hồ sơ nhân viên' : 'Thêm hồ sơ nhân viên'}
        >
          <div className="w-full max-w-md bg-white h-full border-l border-[#E5DDD2] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
              <h2 className="font-display text-lg font-bold text-[#231D19]">
                {editingUser ? `Hồ sơ · @${editingUser.username}` : 'Thêm hồ sơ nhân viên mới'}
              </h2>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg hover:bg-[#F7F4EE]"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#231D19]">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: thungan01"
                    className="w-full px-3 py-2 text-sm font-tabular border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Họ và tên *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Thảo Vy"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#231D19]">Phân quyền</label>
                  <select
                    value={role}
                    disabled={Boolean(editingUser?.isPrimaryAdmin)}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B] disabled:bg-[#F7F4EE] disabled:text-[#6B6056]"
                  >
                    <option value="staff">Nhân viên</option>
                    <option value="manager">Quản lý</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#231D19]">Số điện thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0909 123 456"
                    className="w-full px-3 py-2 text-sm font-tabular border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Chức vụ / Vị trí</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="VD: Thu ngân ca tối"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Lịch ca làm việc</label>
                <input
                  type="text"
                  value={shiftSchedule}
                  onChange={(e) => setShiftSchedule(e.target.value)}
                  placeholder="VD: Ca sáng (08:00 - 15:00)"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#E5DDD2]">
                <label className="text-xs font-semibold text-[#231D19]">
                  {editingUser ? 'Đặt lại mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo *'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              {formError && <p className="text-xs font-semibold text-[#9E2A2B]">{formError}</p>}
            </div>

            <div className="px-6 py-4 bg-[#FAF8F4] border-t border-[#E5DDD2] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-4 py-2 text-sm font-medium text-[#6B6056] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-50 rounded-lg"
              >
                {saving ? 'Đang lưu...' : editingUser ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
