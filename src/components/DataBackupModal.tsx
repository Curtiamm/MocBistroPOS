import { ChangeEvent, useRef, useState } from 'react';
import { Download, RotateCcw, Upload, X } from 'lucide-react';

interface DataBackupModalProps {
  onExportJson: () => string;
  onImportJson: (raw: string) => { ok: boolean; error?: string };
  onResetSample: () => void;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export function DataBackupModal({
  onExportJson,
  onImportJson,
  onResetSample,
  onClose,
  onNotify,
}: DataBackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleDownload = () => {
    const content = onExportJson();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `moc-bistro-pos-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onNotify('success', 'Đã xuất tệp sao lưu', `moc-bistro-pos-backup-${dateStamp}.json`);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportJson(text);
      if (res.ok) {
        onNotify('success', 'Đã khôi phục dữ liệu', `Nhập thành công từ ${file.name}`);
        onClose();
      } else {
        setImportError(res.error ?? 'Tệp sao lưu không hợp lệ.');
      }
    };
    reader.onerror = () => {
      setImportError('Không thể đọc tệp đã chọn.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmReset = () => {
    onResetSample();
    onNotify('info', 'Đã khôi phục dữ liệu mẫu', 'Toàn bộ bàn, thực đơn và ca làm đã trở về trạng thái ban đầu.');
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231D19]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sao lưu và khôi phục dữ liệu cục bộ"
    >
      <div className="bg-white border border-[#E5DDD2] rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DDD2]">
          <div>
            <h2 className="font-display text-lg font-bold text-[#231D19]">
              Dữ liệu cục bộ trên máy
            </h2>
            <p className="text-xs text-[#6B6056] mt-0.5">
              Lưu tự động trên trình duyệt · Xuất tệp JSON để sao lưu an toàn
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

        <div className="p-6 space-y-5">
          {/* Export */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#E5DDD2]">
            <div>
              <h3 className="text-sm font-semibold text-[#231D19]">
                Xuất bản sao lưu (.json)
              </h3>
              <p className="text-xs text-[#6B6056] mt-1 leading-relaxed">
                Tải xuống toàn bộ thực đơn, sơ đồ bàn, hóa đơn và lịch sử ca làm hiện tại về máy tính.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Xuất JSON</span>
            </button>
          </div>

          {/* Import */}
          <div className="pb-5 border-b border-[#E5DDD2]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#231D19]">
                  Khôi phục từ tệp sao lưu
                </h3>
                <p className="text-xs text-[#6B6056] mt-1 leading-relaxed">
                  Nạp lại dữ liệu từ tệp <span className="font-tabular">.json</span> đã xuất trước đó. Dữ liệu hiện tại sẽ được thay thế.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#231D19] bg-white hover:bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Chọn tệp</span>
              </button>
            </div>
            {importError && (
              <p className="mt-2.5 text-xs text-[#9E2A2B] font-medium">
                {importError}
              </p>
            )}
          </div>

          {/* Reset */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#231D19]">
                Khôi phục dữ liệu mẫu Bistro
              </h3>
              <p className="text-xs text-[#6B6056] mt-1 leading-relaxed">
                Đưa hệ thống về 14 bàn, 18 món mẫu và dữ liệu ca làm khởi tạo ban đầu.
              </p>
            </div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#9E2A2B] hover:bg-[#9E2A2B]/8 border border-[#9E2A2B]/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-2 text-xs font-medium text-[#6B6056] border border-[#E5DDD2] rounded-lg hover:bg-[#F7F4EE] whitespace-nowrap"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-3 py-2 text-xs font-medium text-white bg-[#9E2A2B] hover:bg-[#7F2021] rounded-lg whitespace-nowrap"
                >
                  Xác nhận đặt lại
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
