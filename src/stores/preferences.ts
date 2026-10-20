import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "@/lib/app-storage";

export type Theme = "system" | "light" | "dark";
export type LoginTab = "staff" | "student";

/** Credencial del teléfono para entrar con huella (POST /auth/biometric) */
export type BiometricLogin = {
  deviceId: number;
  credential: string;
  userId: number;
  /** Nombre del usuario, para mostrarlo en el login */
  name: string;
};

type PreferencesState = {
  theme: Theme;
  /** Última pestaña usada en el login */
  loginTab: LoginTab;
  /** Mostrar los avisos de notas nuevas como notificaciones del sistema en este dispositivo */
  systemNotifications: boolean;
  /** Último aviso ya notificado de cada usuario (id del aviso), para no repetirlos */
  lastNotified: Record<string, number>;
  /** Pedir huella o cara al abrir la app (solo móvil) */
  biometricLock: boolean;
  /** Con qué se entra con la huella desde el login, sin usuario ni contraseña (solo móvil) */
  biometricLogin: BiometricLogin | null;
  setTheme: (theme: Theme) => void;
  setLoginTab: (tab: LoginTab) => void;
  setSystemNotifications: (enabled: boolean) => void;
  setLastNotified: (userId: number, notificationId: number) => void;
  setBiometricLock: (enabled: boolean) => void;
  setBiometricLogin: (login: BiometricLogin | null) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      loginTab: "staff",
      systemNotifications: false,
      lastNotified: {},
      biometricLock: false,
      biometricLogin: null,
      setTheme: (theme) => set({ theme }),
      setLoginTab: (loginTab) => set({ loginTab }),
      setSystemNotifications: (systemNotifications) => set({ systemNotifications }),
      setLastNotified: (userId, notificationId) =>
        set((state) => ({ lastNotified: { ...state.lastNotified, [userId]: notificationId } })),
      setBiometricLock: (biometricLock) => set({ biometricLock }),
      setBiometricLogin: (biometricLogin) => set({ biometricLogin }),
    }),
    {
      name: "preferences",
      storage: createJSONStorage(() => appStorage),
    },
  ),
);

/** ¿Se cargaron ya las preferencias guardadas? (en Tauri se leen de un archivo, async) */
export function usePreferencesHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePreferences.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return usePreferences.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

/** Nombre del tema de daisyUI ("system" = sin data-theme, decide prefers-color-scheme) */
export const DAISY_THEME: Record<Exclude<Theme, "system">, string> = {
  light: "notas",
  dark: "notas-dark",
};
