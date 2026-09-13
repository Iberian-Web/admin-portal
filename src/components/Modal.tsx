// admin-portal/src/components/Modal.tsx
//
// Shell compartido (overlay + backdrop + tarjeta) para diálogos modales.
// Clic fuera de la tarjeta cierra el modal; clic dentro no se propaga.
import type { MouseEvent, ReactNode } from "react";

export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg w-full max-w-sm p-6 shadow-lg"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
