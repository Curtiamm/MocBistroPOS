import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { TableEntity, ZoneName } from '../types/pos';

interface TableManagerModalProps {
  tables: TableEntity[];
  onAddTable: (input: { name: string; zone: ZoneName; capacity: number }) => {
    ok: boolean;
    error?: string;
  };
  onUpdateTable: (
    id: string,
    input: { name: string; zone: ZoneName; capacity: number }
  ) => { ok: boolean; error?: string };
  onDeleteTable: (id: string) => { ok: boolean; error?: string };
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  onClose: () => void;
}

const ZONES: ZoneName[] = ['Tầng 1', 'Ban công', 'Phòng riêng'];

export function TableManagerModal({
  tables,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onNotify,
  onClose,
}: TableManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [zone, setZone] = useState<ZoneName>('Tầng 1');
  const [capacity, setCapacity] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setZone('Tầng 1');
    setCapacity('4');
    setError(null);
  };

  const startEdit = (t: TableEntity) => {
    setEditingId(t.id);
    setName(t.name);
    setZone(t.zone);
    setCapacity(String(t.capacity));
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    const cap = Number(capacity);
    if (!name.trim()) {
      setError('Vui lòng nhập tên bàn.');
      return;
    }
    if (Number.isNaN(cap) || cap < 1 || cap > 30) {
      setError('Sức chứa bàn phải từ 1 đến 30 khách.');
      return;
    }

    if (editingId) {
      const res = onUpdateTable(editingId, { name, zone, capacity: cap });
      if (!res.ok) {
        setError(res.error ?? 'Không thể cập nhật bàn.');
        return;
      }
      onNotify('success', 'Đã cập nhật thông tin bàn', `${name.trim()} · ${zone}`);
      resetForm();
    } else {
      const res = onAddTable({ name, zone, capacity: cap });
      if (!res.ok) {
        setError(res.error ?? 'Không thể thêm bàn mới.');
        return;
      }
      onNotify('success', 'Đã thêm bàn mới vào sơ đồ', `${name.trim()} · ${zone}`);
      resetForm();
    }
  };

  const handleDelete = (t: TableEntity) => {
    const res = onDeleteTable(t.id);
    if (!res.ok) {
      setError(res.error ?? 'Không thể xóa bàn.');
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(null);
    if (editingId === t.id) resetForm();
    onNotify('info', `Đã xóa ${t.name} khỏi sơ đồ bàn`);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quản lý sơ đồ bàn"
    >
      <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
          <div>
            <h2 className="font-display text-lg font-bold text-[#231D19]">
              Quản lý sơ đồ bàn ({tables.length} bàn)
            </h2>
            <p className="text-xs text-[#6B6056] mt-0.5">
              Thêm mới, đổi khu vực, chỉnh sức chứa hoặc xóa bàn trống
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B6056] hover:text-[#231D19] rounded-lg hover:bg-[#F7F4EE]"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add / Edit Inline Bar */}
        <div className="px-6 py-4 bg-[#FAF8F4] border-b border-[#E5DDD2] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-[#231D19]">Tên bàn *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Bàn 07 hoặc VIP 05"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs font-semibold text-[#231D19]">Khu vực</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as ZoneName)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-[#231D19]">Số chỗ</label>
              <input
                type="number"
                min={1}
                max={30}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-tabular bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg whitespace-nowrap"
              >
                {!editingId && <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Lưu bàn' : 'Thêm bàn'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-2.5 py-2 text-xs font-medium text-[#6B6056] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
                >
                  Hủy
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-[#9E2A2B]">{error}</p>}
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-white sticky top-0">
                <th className="text-left font-medium px-6 py-3">Tên bàn</th>
                <th className="text-left font-medium px-4 py-3">Khu vực</th>
                <th className="text-right font-medium px-4 py-3">Sức chứa</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-right font-medium px-6 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DDD2]/70">
              {tables.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-[#FAF8F4] ${editingId === t.id ? 'bg-[#1E4D3B]/5' : ''}`}
                >
                  <td className="px-6 py-2.5 font-semibold text-[#231D19]">{t.name}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6B6056]">{t.zone}</td>
                  <td className="px-4 py-2.5 text-right font-tabular text-[#231D19]">
                    {t.capacity} chỗ
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span
                      className={`font-semibold ${
                        t.status === 'occupied' ? 'text-[#B4691E]' : 'text-[#1F6E4A]'
                      }`}
                    >
                      {t.status === 'occupied' ? 'Đang phục vụ' : 'Bàn trống'}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 text-right whitespace-nowrap">
                    {confirmDeleteId === t.id ? (
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
                          onClick={() => handleDelete(t)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#9E2A2B] hover:bg-[#7F2021] rounded"
                        >
                          Xác nhận xóa
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="p-1.5 text-[#6B6056] hover:text-[#231D19] hover:bg-[#EFEAE0] rounded-md transition-colors"
                          aria-label={`Sửa ${t.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={t.status === 'occupied'}
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="p-1.5 text-[#6B6056] hover:text-[#9E2A2B] hover:bg-[#9E2A2B]/8 disabled:opacity-35 disabled:cursor-not-allowed rounded-md transition-colors"
                          aria-label={`Xóa ${t.name}`}
                          title={
                            t.status === 'occupied'
                              ? 'Không thể xóa bàn đang có khách'
                              : `Xóa ${t.name}`
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF8F4] border-t border-[#E5DDD2] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-[#231D19] bg-white border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE]"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
}
