import { create } from "zustand";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva (borrar, desactivar): botón en rojo */
  danger?: boolean;
};

type ConfirmState = {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  close: (ok: boolean) => void;
};

const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  close: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  },
}));

/** `if (await confirm({ title: "¿Desactivar?", danger: true })) { … }` */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...options, resolve } });
  });
}

export function ConfirmDialog() {
  const { request, close } = useConfirmStore();
  if (!request) return null;

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{request.title}</h3>
        {request.message && <p className="py-3 text-base-content/80">{request.message}</p>}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
            {request.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            className={`btn ${request.danger ? "btn-error" : "btn-primary"}`}
            onClick={() => close(true)}
          >
            {request.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Cerrar diálogo"
        tabIndex={-1}
        onClick={() => close(false)}
      />
    </div>
  );
}
