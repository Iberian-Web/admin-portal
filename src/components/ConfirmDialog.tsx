// admin-portal/src/components/ConfirmDialog.tsx
//
// Diálogo de confirmación compartido (clientes, servicios...). Sustituye a
// los `window.confirm()` del navegador para que eliminar o confirmar algo se
// vea y se comporte siempre igual.
import type { ReactNode } from "react";
import { Spinner } from "./icons";
import Modal from "./Modal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        {title}
      </h3>
      <div className="text-sm text-zinc-500 mb-6 space-y-1">{message}</div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Spinner className="w-3.5 h-3.5" />}
          {loading ? "Eliminando…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
