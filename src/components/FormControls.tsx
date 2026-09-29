// admin-portal/src/components/FormControls.tsx
import type { ReactNode } from "react";
import { Icon } from "./icons";

/** Pie de modal de formulario compartido: Cancelar (auxiliar) + acción
 *  principal (positiva, a la derecha). */
export function ModalFormFooter({
  onCancel,
  onSubmit,
  submitLabel,
  submitting = false,
  submittingLabel,
  submitDisabled = false,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  submittingLabel?: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || submitDisabled}
        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {submitting ? (submittingLabel ?? "Guardando…") : submitLabel}
      </button>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
      {children}
    </h2>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
        {label}
        {required && (
          <span className="text-teal-700 dark:text-teal-400 ml-0.5">*</span>
        )}
        {hint && <span className="text-zinc-600 ml-1 font-normal">{hint}</span>}
      </label>
      {children}
      {typeof error === "string" && error && (
        <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
          <Icon name="warningCircle" className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
