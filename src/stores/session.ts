import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api, configureApiAuth, unwrap } from "@/api/client";
import { isApiError } from "@/api/errors";
import type { components } from "@/api/schema";
import { appStorage } from "@/lib/app-storage";
import { queryClient } from "@/lib/query-client";

export type User = components["schemas"]["UserRead"];
export type Role = components["schemas"]["Role"];

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionState = {
  token: string | null;
  user: User | null;
  status: SessionStatus;
  /** La última sesión terminó por caducidad (401), para avisarlo en el login */
  expired: boolean;
  /** Guarda el token del login y carga el usuario (GET /auth/me) */
  signIn: (token: string) => Promise<User>;
  /** Vuelve a pedir el usuario (p. ej. tras cambiar la contraseña) */
  refreshUser: () => Promise<void>;
  /** Cierra la sesión en la API y en la app, aunque la llamada falle */
  signOut: () => Promise<void>;
  /** La API rechazó el token (401): limpiar y marcar como caducada */
  expire: () => void;
};

const anonymous = { token: null, user: null, status: "anonymous" as const };

function clearCache() {
  queryClient.clear();
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: "loading",
      expired: false,

      signIn: async (token) => {
        set({ token, expired: false });
        try {
          const user = await unwrap(api.GET("/api/v1/auth/me"));
          set({ user, status: "authenticated", expired: false });
          return user;
        } catch (error) {
          set(anonymous);
          throw error;
        }
      },

      refreshUser: async () => {
        const user = await unwrap(api.GET("/api/v1/auth/me"));
        set({ user });
      },

      signOut: async () => {
        if (get().token) {
          await unwrap(api.POST("/api/v1/auth/logout")).catch(() => {});
        }
        set({ ...anonymous, expired: false });
        clearCache();
      },

      expire: () => {
        if (!get().token) return;
        set({ ...anonymous, expired: true });
        clearCache();
      },
    }),
    {
      name: "session",
      storage: createJSONStorage(() => appStorage),
      // Solo se persiste el token; el usuario se vuelve a pedir al arrancar
      partialize: (state) => ({ token: state.token }),
    },
  ),
);

configureApiAuth({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => useSession.getState().expire(),
});

/** Valida el token guardado contra GET /auth/me y deja la sesión lista */
export async function restoreSession(): Promise<void> {
  const { token } = useSession.getState();
  if (!token) {
    useSession.setState({ status: "anonymous" });
    return;
  }
  try {
    const user = await unwrap(api.GET("/api/v1/auth/me"));
    useSession.setState({ user, status: "authenticated" });
  } catch (error) {
    // 401 ya lo gestiona expire(); otros errores (API caída): sin sesión, sin borrar el token
    if (!isApiError(error) || error.status !== 401) {
      useSession.setState({ user: null, status: "anonymous" });
    }
  }
}

/** Se resuelve cuando la sesión guardada se ha cargado y validado (para las guardas de ruta) */
export const sessionReady: Promise<void> = new Promise((resolve) => {
  const start = () => void restoreSession().finally(resolve);
  if (useSession.persist.hasHydrated()) start();
  else useSession.persist.onFinishHydration(start);
});
