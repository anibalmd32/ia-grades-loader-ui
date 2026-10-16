import type { ReactNode } from "react";

/** Diálogo modal controlado (abajo en móvil, centrado en escritorio) */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-box">
        <h3 className="mb-4 font-bold text-lg">{title}</h3>
        {children}
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Cerrar diálogo"
        tabIndex={-1}
        onClick={onClose}
      />
    </div>
  );
}
