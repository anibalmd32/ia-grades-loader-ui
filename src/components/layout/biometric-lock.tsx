import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, LogIn } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/api/client";
import { isApiError } from "@/api/errors";
import { isMobileApp, verifyIdentity } from "@/lib/biometric";
import { usePreferences, usePreferencesHydrated } from "@/stores/preferences";
import { type User, useSession } from "@/stores/session";

/** Tiempo en segundo plano tras el que se vuelve a pedir la huella */
export const RELOCK_AFTER_MS = 5 * 60_000;

// El usuario acaba de iniciar sesión en esta ejecución de la app: no se le pide la huella otra vez
let signedInNow = false;

/** Llamar al terminar el login (con contraseña o con huella) */
export function markSignedIn() {
  signedInNow = true;
}

/**
 * Da de alta este teléfono en la API para entrar con huella. Sin contraseña solo vale justo
 * después de iniciar sesión (la API responde 403 si la sesión tiene más de 10 minutos).
 */
export async function enableBiometricLogin(user: User, currentPassword?: string): Promise<void> {
  const { device_id, credential } = await unwrap(
    api.POST("/api/v1/auth/biometric", {
      body: currentPassword ? { current_password: currentPassword } : undefined,
    }),
  );
  usePreferences.getState().setBiometricLogin({
    deviceId: device_id,
    credential,
    userId: user.id,
    name: user.full_name,
  });
}

/** Olvida la credencial del teléfono y la borra en la API (si falla, se ignora) */
export async function disableBiometricLogin(): Promise<void> {
  const current = usePreferences.getState().biometricLogin;
  usePreferences.getState().setBiometricLogin(null);
  if (!current) return;
  await unwrap(
    api.DELETE("/api/v1/auth/biometric/{device_id}", {
      params: { path: { device_id: current.deviceId } },
    }),
  ).catch(() => {});
}

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
  const user = useSession((s) => s.user);
  const biometricLogin = usePreferences((s) => s.biometricLogin);
  const registering = useRef(false);

  // Arranque en frío con la sesión guardada: bloquear una sola vez, cuando ya se sabe si está
  // activado (si acaba de iniciar sesión, ya se identificó)
  useEffect(() => {
    if (!hydrated || checkedStart.current) return;
    checkedStart.current = true;
    if (enabled && !signedInNow) setLocked(true);
  }, [hydrated, enabled]);

  // Sin credencial para el login con huella (se activó antes de existir, caducó al cambiar la
  // contraseña o es de otro usuario): se pide una nueva para el usuario actual
  useEffect(() => {
    if (!enabled || !hydrated || locked || !user || biometricLogin?.userId === user.id) return;
    if (registering.current) return;
    registering.current = true;
    void enableBiometricLogin(user)
      .catch(() => {})
      .finally(() => {
        registering.current = false;
      });
  }, [enabled, hydrated, locked, user, biometricLogin]);

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

/** Ajuste "Entrar con huella" de Mi cuenta (solo si el móvil tiene biometría) */
export function BiometricLockSetting({ available }: { available: boolean }) {
  const enabled = usePreferences((s) => s.biometricLock);
  const setEnabled = usePreferences((s) => s.setBiometricLock);
  const user = useSession((s) => s.user);
  const [error, setError] = useState<string | null>(null);
  // La sesión es de hace rato: la API pide la contraseña para activarlo
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const activate = async (currentPassword?: string) => {
    if (!user) return;
    setSaving(true);
    try {
      await enableBiometricLogin(user, currentPassword);
      setEnabled(true);
      setAskPassword(false);
      setPassword("");
    } catch (err) {
      if (isApiError(err) && err.status === 403 && !currentPassword) {
        setAskPassword(true);
      } else if (isApiError(err) && (err.status === 400 || err.status === 429)) {
        setError(err.message);
      } else {
        setError("No se pudo activar el inicio con huella. Inténtalo de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (checked: boolean) => {
    setError(null);
    if (!checked) {
      setAskPassword(false);
      setEnabled(false);
      await disableBiometricLogin();
      return;
    }
    // Se confirma antes con la huella: así se sabe que funciona en este teléfono
    if (!(await verifyIdentity("Confirma para activar el inicio con huella"))) {
      setError("No se pudo verificar tu identidad: el inicio con huella sigue desactivado.");
      return;
    }
    await activate();
  };

  if (!available) return null;
  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title">Entrar con huella</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>Entrar con la huella, la cara o el PIN del teléfono</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={enabled || askPassword}
            disabled={saving}
            onChange={(event) => void toggle(event.target.checked)}
          />
        </label>
        {askPassword && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (password) void activate(password);
            }}
          >
            <label htmlFor="biometric-password" className="font-semibold text-sm">
              Confirma tu contraseña para activarlo
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="biometric-password"
                type="password"
                autoComplete="current-password"
                className="input min-w-0 flex-1"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={!password || saving}>
                {saving && <span className="loading loading-spinner loading-sm" />}
                Activar
              </button>
            </div>
          </form>
        )}
        <p className="text-base-content/70 text-sm">
          Podrás iniciar sesión sin escribir tu usuario ni tu contraseña. Si alguien toma tu
          teléfono con la sesión abierta, tampoco podrá ver tus datos: se pide al abrir la app y al
          volver a ella tras {RELOCK_AFTER_MS / 60_000} minutos.
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
