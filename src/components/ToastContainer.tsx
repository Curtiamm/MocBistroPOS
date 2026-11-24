import { CheckCircle2, Info, X, AlertCircle } from 'lucide-react';
import { ToastMessage } from '../types/pos';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const iconColor =
          toast.type === 'success'
            ? 'text-[#1F6E4A]'
            : toast.type === 'error'
              ? 'text-[#9E2A2B]'
              : 'text-[#1E4D3B]';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-[#E5DDD2] rounded-lg px-4 py-3 shadow-md transition-all duration-150"
          >
            <span className={`mt-0.5 shrink-0 ${iconColor}`}>
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
              {toast.type === 'info' && <Info className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#231D19] leading-snug">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-xs text-[#6B6056] mt-0.5 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-[#6B6056] hover:text-[#231D19] p-1 -mr-1 rounded transition-colors shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
