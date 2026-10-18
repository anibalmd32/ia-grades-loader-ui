import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { create } from "zustand";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastState = {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const DURATION_MS = 5000;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismiss(id), DURATION_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Avisos breves: toast.success("Guardado"), toast.error(error.message) */
export const toast = {
  success: (message: string) => useToasts.getState().push("success", message),
  error: (message: string) => useToasts.getState().push("error", message),
  info: (message: string) => useToasts.getState().push("info", message),
};

const STYLE: Record<ToastKind, { className: string; Icon: typeof Info }> = {
  success: { className: "alert-success", Icon: CircleCheck },
  error: { className: "alert-error", Icon: CircleAlert },
  info: { className: "alert-info", Icon: Info },
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toast toast-top toast-center z-50 w-full max-w-md pt-[env(safe-area-inset-top)] sm:toast-end">
      {toasts.map(({ id, kind, message }) => {
        const { className, Icon } = STYLE[kind];
        return (
          <div key={id} role="status" className={`alert ${className} shadow-lg`}>
            <Icon className="size-5 shrink-0" />
            <span className="whitespace-normal">{message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(id)}
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
