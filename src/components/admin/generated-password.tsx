import { CircleCheck, Copy } from "lucide-react";
import { useState } from "react";
import { create } from "zustand";

type GeneratedPassword = {
  /** Mensaje de éxito: "Profesor creado correctamente." */
  message: string;
  /** "Ramón Díaz · ramon.diaz@uni.edu" */
  account: string;
  password: string;
};

const useGeneratedPassword = create<{ current: GeneratedPassword | null }>()(() => ({
  current: null,
}));

/** Muestra la contraseña que generó la API (solo se ve esta vez) */
export function showGeneratedPassword(data: GeneratedPassword) {
  useGeneratedPassword.setState({ current: data });
}

export function hideGeneratedPassword() {
  useGeneratedPassword.setState({ current: null });
}

export function GeneratedPasswordDialog() {
  const current = useGeneratedPassword((s) => s.current);
  const [copied, setCopied] = useState(false);
  if (!current) return null;

  const close = () => {
    setCopied(false);
    useGeneratedPassword.setState({ current: null });
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(current.password);
    setCopied(true);
  };

  return (
    <div
      className="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
      aria-label="Contraseña generada"
    >
      <div className="modal-box flex flex-col gap-4">
        <div role="status" className="alert alert-success alert-soft">
          <CircleCheck className="size-5 shrink-0" />
          <span>{current.message}</span>
        </div>
        <div>
          <h3 className="font-bold text-xl">Contraseña generada</h3>
          <p className="mt-2 text-base-content/70 text-sm">
            Cópiala y entrégasela al usuario. No volverás a verla: si se pierde, tendrás que
            restablecerla.
          </p>
        </div>
        <div className="rounded-box bg-base-200 p-4">
          <p className="font-semibold text-base-content/70 text-xs">{current.account}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="break-all font-bold text-2xl" data-testid="generated-password">
              {current.password}
            </code>
            <button type="button" className="btn btn-outline btn-primary btn-sm" onClick={copy}>
              <Copy className="size-4" />
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
        </div>
        <button type="button" className="btn btn-primary w-full" onClick={close}>
          Entendido
        </button>
      </div>
    </div>
  );
}
