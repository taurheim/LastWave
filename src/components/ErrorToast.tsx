import { useEffect } from 'react';
import { useLastWaveStore, type Toast } from '@/store/appStore';

const AUTO_DISMISS_MS = 8000;
const SUPPORT_FOOTER =
  'If this keeps happening, please email niko@savas.ca or open a GitHub issue.';

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useLastWaveStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const borderColor =
    toast.type === 'error'
      ? 'border-red-500/60'
      : toast.type === 'warning'
        ? 'border-orange-500/60'
        : 'border-lw-accent/60';

  const iconColor =
    toast.type === 'error'
      ? 'text-red-400'
      : toast.type === 'warning'
        ? 'text-orange-400'
        : 'text-lw-accent';

  const icon = toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ';

  return (
    <div
      className={`border bg-lw-surface ${borderColor} w-full max-w-sm animate-[slideIn_0.2s_ease-out] rounded-lg p-4 shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <span className={`${iconColor} mt-0.5 shrink-0 text-sm`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-lw-text">{toast.message}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-lw-muted/60">{SUPPORT_FOOTER}</p>
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          className="ml-1 shrink-0 text-xs text-lw-muted hover:text-lw-text"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ErrorToast() {
  const toasts = useLastWaveStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
}
