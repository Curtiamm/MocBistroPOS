import { useMemo, useState } from 'react';
import { Pencil, Search, Trash2, X } from 'lucide-react';
import { MenuCategory, MenuItem } from '../types/pos';
import { formatVnd } from '../utils/format';

interface MenuManagerViewProps {
  menu: MenuItem[];
  openCreateDrawer: boolean;
  onCloseCreateDrawer: () => void;
  onAddMenuItem: (input: {
    code: string;
    name: string;
    category: MenuCategory;
    price: number;
    description: string;
    available: boolean;
  }) => { ok: boolean; error?: string };
  onUpdateMenuItem: (
    id: string,
    input: {
      code: string;
      name: string;
      category: MenuCategory;
      price: number;
      description: string;
      available: boolean;
    }
  ) => { ok: boolean; error?: string };
  onToggleAvailability: (id: string) => void;
  onDeleteMenuItem: (id: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const CATEGORIES: Array<'Tất cả' | MenuCategory> = [
  'Tất cả',
  'Khai vị',
  'Món chính',
  'Đồ uống',
  'Tráng miệng',
];

const MENU_CATEGORIES_ONLY: MenuCategory[] = [
  'Khai vị',
  'Món chính',
  'Đồ uống',
  'Tráng miệng',
];

export function MenuManagerView({
  menu,
  openCreateDrawer,
  onCloseCreateDrawer,
  onAddMenuItem,
  onUpdateMenuItem,
  onToggleAvailability,
  onDeleteMenuItem,
  onNotify,
}: MenuManagerViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Tất cả' | MenuCategory>('Tất cả');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Drawer form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuCategory>('Món chính');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const isDrawerOpen = openCreateDrawer || editingItem !== null;

  const startEdit = (item: MenuItem) => {
    onCloseCreateDrawer();
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setCategory(item.category);
    setPrice(String(item.price));
    setDescription(item.description);
    setAvailable(item.available);
    setFormError(null);
  };

  const resetDrawerFields = () => {
    setCode('');
    setName('');
    setCategory('Món chính');
    setPrice('');
    setDescription('');
    setAvailable(true);
    setFormError(null);
  };

  const handleCloseDrawer = () => {
    setEditingItem(null);
    onCloseCreateDrawer();
    resetDrawerFields();
  };

  const handleSave = () => {
    setFormError(null);
    const numericPrice = Number(price);
    if (!code.trim() || !name.trim()) {
      setFormError('Vui lòng nhập đầy đủ mã món và tên món.');
      return;
    }
    if (price.trim() === '' || Number.isNaN(numericPrice) || numericPrice < 0) {
      setFormError('Đơn giá phải là số lớn hơn hoặc bằng 0.');
      return;
    }

    const payload = {
      code,
      name,
      category,
      price: numericPrice,
      description,
      available,
    };

    if (editingItem) {
      const res = onUpdateMenuItem(editingItem.id, payload);
      if (!res.ok) {
        setFormError(res.error ?? 'Không thể cập nhật món.');
        return;
      }
      onNotify('success', 'Đã cập nhật món ăn', `${payload.code.toUpperCase()} · ${payload.name}`);
    } else {
      const res = onAddMenuItem(payload);
      if (!res.ok) {
        setFormError(res.error ?? 'Không thể thêm món mới.');
        return;
      }
      onNotify('success', 'Đã thêm món vào thực đơn', `${payload.code.toUpperCase()} · ${payload.name}`);
    }

    handleCloseDrawer();
  };

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [menu, selectedCategory, search]);

  const outOfStockCount = useMemo(
    () => menu.filter((m) => !m.available).length,
    [menu]
  );

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <p className="text-xs text-[#6B6056]">
            Tổng <span className="font-tabular font-semibold text-[#231D19]">{menu.length}</span> món ·{' '}
            <span className="font-tabular font-semibold text-[#9E2A2B]">{outOfStockCount}</span> tạm hết
          </p>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#6B6056] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm món ăn hoặc mã món..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
            />
          </div>
        </div>
      </div>

      {/* High-Density Menu Table */}
      <div className="bg-white border border-[#E5DDD2] rounded-xl overflow-hidden">
        {filteredMenu.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm font-medium text-[#231D19]">
              Không tìm thấy món ăn nào phù hợp.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('Tất cả');
              }}
              className="text-xs font-semibold text-[#1E4D3B] hover:underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DDD2] text-xs text-[#6B6056] bg-[#FAF8F4]">
                  <th className="text-left font-medium px-5 py-3">Mã</th>
                  <th className="text-left font-medium px-4 py-3">Tên món & Mô tả</th>
                  <th className="text-left font-medium px-4 py-3">Danh mục</th>
                  <th className="text-right font-medium px-4 py-3">Đơn giá</th>
                  <th className="text-left font-medium px-4 py-3">Trạng thái phục vụ</th>
                  <th className="text-right font-medium px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDD2]/70">
                {filteredMenu.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F4]">
                    <td className="px-5 py-3 font-tabular text-xs font-semibold text-[#6B6056] whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="font-semibold text-[#231D19]">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-[#6B6056] truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B6056] whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-semibold text-[#231D19] whitespace-nowrap">
                      {formatVnd(item.price)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleAvailability(item.id);
                          onNotify(
                            'info',
                            item.available ? `Đã đánh dấu tạm hết: ${item.name}` : `Đã mở bán lại: ${item.name}`
                          );
                        }}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                          item.available
                            ? 'text-[#1F6E4A] border-[#1F6E4A]/30 bg-[#1F6E4A]/5 hover:bg-[#1F6E4A]/10'
                            : 'text-[#9E2A2B] border-[#9E2A2B]/30 bg-[#9E2A2B]/5 hover:bg-[#9E2A2B]/10'
                        }`}
                      >
                        {item.available ? 'Còn món' : 'Tạm hết'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {confirmDeleteId === item.id ? (
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
                            onClick={() => {
                              onDeleteMenuItem(item.id);
                              setConfirmDeleteId(null);
                              onNotify('info', `Đã xóa món ${item.name}`);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#9E2A2B] hover:bg-[#7F2021] rounded"
                          >
                            Xóa hẳn
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-[#6B6056] hover:text-[#231D19] hover:bg-[#EFEAE0] rounded-md transition-colors"
                            aria-label={`Chỉnh sửa ${item.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 text-[#6B6056] hover:text-[#9E2A2B] hover:bg-[#9E2A2B]/8 rounded-md transition-colors"
                            aria-label={`Xóa ${item.name}`}
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
        )}
      </div>

      {/* SLIDE-OVER EDITOR DRAWER */}
      {isDrawerOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-[#231D19]/40"
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món mới'}
        >
          <div className="w-full max-w-md bg-white h-full border-l border-[#E5DDD2] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
              <h2 className="font-display text-lg font-bold text-[#231D19]">
                {editingItem ? `Chỉnh sửa · ${editingItem.code}` : 'Thêm món mới vào thực đơn'}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#231D19]">Mã món *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: MC08"
                    className="w-full px-3 py-2 text-sm font-tabular uppercase border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#231D19]">Danh mục *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MenuCategory)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  >
                    {MENU_CATEGORIES_ONLY.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Tên món ăn *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Cá chẽm áp chảo sốt bơ chanh"
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Đơn giá (VNĐ) *</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="VD: 195000"
                  className="w-full px-3 py-2 text-sm font-tabular border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Thành phần chính hoặc cách chế biến để nhân viên dễ tư vấn..."
                  className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B] resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="w-4 h-4 accent-[#1E4D3B] rounded"
                />
                <span className="text-sm text-[#231D19]">Đang phục vụ (Còn món)</span>
              </label>

              {formError && (
                <p className="text-xs font-semibold text-[#9E2A2B]">{formError}</p>
              )}
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
                onClick={handleSave}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg"
              >
                {editingItem ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
