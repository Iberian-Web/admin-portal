// admin-portal/src/components/Toast.tsx
import { Icon } from "./icons";

export type ToastVariant = "success" | "info" | "error";

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success:
    "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
  error:
    "bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300",
  info: "bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/30 text-teal-800 dark:text-teal-300",
};

const VARIANT_ICON: Record<
  ToastVariant,
  "check" | "warningTriangle" | "infoCircle"
> = {
  success: "check",
  error: "warningTriangle",
  info: "infoCircle",
};

export default function Toast({
  message,
  variant = "success",
  onDismiss,
}: {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-sm animate-fade-in ${VARIANT_COLORS[variant]}`}
    >
      <Icon name={VARIANT_ICON[variant]} className="w-4 h-4 shrink-0" />
      {message}
      <button
        onClick={onDismiss}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Cerrar"
      >
        <Icon name="close" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
