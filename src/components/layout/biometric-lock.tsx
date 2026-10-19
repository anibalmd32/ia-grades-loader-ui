import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, LogIn } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { isMobileApp, verifyIdentity } from "@/lib/biometric";
import { usePreferences, usePreferencesHydrated } from "@/stores/preferences";
import { useSession } from "@/stores/session";

/** Tiempo en segundo plano tras el que se vuelve a pedir la huella */
export const RELOCK_AFTER_MS = 5 * 60_000;

/**
 * Si el usuario activó el desbloqueo con huella (solo app del móvil), la app arranca bloqueada
 * y se vuelve a bloquear al volver tras más de 5 minutos en segundo plano.
 */
export function BiometricGate({
  children,
  mobile = isMobileApp(),
}: {
  children: ReactNode;
  /** Para los tests: simula la app del móvil */
  mobile?: boolean;
}) {
  const enabled = usePreferences((s) => s.biometricLock) && mobile;
  const hydrated = usePreferencesHydrated();
  const [locked, setLocked] = useState(false);
  const checkedStart = useRef(false);
  const hiddenAt = useRef<number | null>(null);

  // Arranque en frío: bloquear una sola vez, cuando ya se sabe si está activado
  useEffect(() => {
    if (!hydrated || checkedStart.current) return;
    checkedStart.current = true;
    if (enabled) setLocked(true);
  }, [hydrated, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  // En el móvil no se muestra nada hasta saber si hay que bloquear (son milisegundos)
  if (mobile && !hydrated) return null;
  if (locked && enabled) return <LockScreen onUnlock={() => setLocked(false)} />;
  return children;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    const ok = await verifyIdentity("Desbloquea Notas para ver tus datos");
    setBusy(false);
    if (ok) onUnlock();
    else setFailed(true);
  }, [onUnlock]);

  // Al abrir la app se pide la huella directamente
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void unlock();
  }, [unlock]);

  const enterWithPassword = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
      <section className="card card-border w-full max-w-sm bg-base-100">
        <div className="card-body items-center gap-4 text-center">
          <Fingerprint className="size-14 text-primary" />
          <div>
            <h1 className="font-bold text-2xl">Notas está bloqueada</h1>
            <p className="text-base-content/70 text-sm">
              {user ? `Hola, ${user.first_name}. ` : ""}Usa tu huella, tu cara o el PIN del teléfono
              para entrar.
            </p>
          </div>
          {failed && (
            <p role="alert" className="text-error text-sm">
              No se pudo verificar tu identidad. Inténtalo de nuevo.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => void unlock()}
          >
            {busy ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            Desbloquear
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => void enterWithPassword()}
          >
            <LogIn className="size-4" />
            Entrar con mi contraseña
          </button>
        </div>
      </section>
    </main>
  );
}

/** Ajuste "Desbloqueo con huella" de Mi cuenta (solo si el móvil tiene biometría) */
export function BiometricLockSetting({ available }: { available: boolean }) {
  const enabled = usePreferences((s) => s.biometricLock);
  const setEnabled = usePreferences((s) => s.setBiometricLock);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (checked: boolean) => {
    setError(null);
    if (!checked) {
      setEnabled(false);
      return;
    }
    // Se confirma antes con la huella: así se sabe que funciona en este teléfono
    if (await verifyIdentity("Confirma para activar el desbloqueo con huella")) setEnabled(true);
    else setError("No se pudo verificar tu identidad: el desbloqueo sigue desactivado.");
  };

  if (!available) return null;
  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title">Desbloqueo con huella</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>Pedir la huella, la cara o el PIN al abrir la app</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={enabled}
            onChange={(event) => void toggle(event.target.checked)}
          />
        </label>
        <p className="text-base-content/70 text-sm">
          Si alguien toma tu teléfono con la sesión abierta, no podrá ver tus datos. También se pide
          al volver a la app tras {RELOCK_AFTER_MS / 60_000} minutos.
        </p>
        {error && (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
