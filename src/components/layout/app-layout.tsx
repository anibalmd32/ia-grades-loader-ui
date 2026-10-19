import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Menu, UserRound } from "lucide-react";
import { type ReactNode, useId } from "react";
import { type AcademicSettings, useAcademicSettings } from "@/api/queries/settings";
import { AppVersion } from "@/components/app-version";
import { NotificationBell, useNotificationWatcher } from "@/components/student/notifications";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { userSubtitle } from "@/lib/roles";
import { type User, useSession } from "@/stores/session";
import { useNav } from "./use-nav";

/** Texto fijo o que depende de la configuración académica ("Semestres y materias"…) */
type SettingsText = string | ((settings: AcademicSettings) => string);

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Título de la pantalla (barra superior en móvil) */
    title?: SettingsText;
    description?: SettingsText;
  }
}

const resolve = (text: SettingsText | undefined, settings: AcademicSettings) =>
  typeof text === "function" ? text(settings) : text;

function useSignOut() {
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  return async () => {
    await signOut();
    await navigate({ to: "/login" });
  };
}

function Sidebar({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const handleSignOut = useSignOut();
  const nav = useNav(user);
  const settings = useAcademicSettings();
  return (
    <nav className="flex min-h-full w-64 flex-col bg-neutral p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-neutral-content">
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="font-bold text-xl">Notas</p>
          <p className="truncate text-neutral-content/70 text-xs">{settings.institution_name}</p>
        </div>
        <ThemeToggle className="-mr-2" />
      </div>
      <ul className="menu mt-6 w-full gap-1 p-0">
        {nav.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              activeProps={{ className: "menu-active bg-primary! text-primary-content! font-bold" }}
            >
              {item.label}
              {item.badge != null && (
                <span className="badge badge-error badge-sm ml-auto">
                  {item.badge > 99 ? "99+" : item.badge}
                  <span className="sr-only"> sin leer</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-1">
        <Link
          to="/profile"
          onClick={onNavigate}
          aria-label="Mi cuenta"
          className="flex items-center gap-3 rounded-box bg-white/5 p-3 hover:bg-white/10"
          activeProps={{ className: "ring-2 ring-primary" }}
        >
          <Avatar person={user} />
          <div className="min-w-0">
            <p className="truncate font-bold text-sm">{user.full_name}</p>
            <p className="truncate text-neutral-content/70 text-xs">{userSubtitle(user)}</p>
          </div>
        </Link>
        <ul className="menu w-full p-0">
          <li>
            <Link to="/change-password" onClick={onNavigate}>
              <KeyRound className="size-4" />
              Cambiar contraseña
            </Link>
          </li>
          <li>
            <button type="button" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </li>
        </ul>
        <p className="px-3 pt-2 text-neutral-content/50 text-xs">
          Notas <AppVersion />
        </p>
      </div>
    </nav>
  );
}

/** Layout de la app con sesión: menú lateral en escritorio; barra superior, menú y pestañas en móvil */
export function AppLayout({ user, children }: { user: User; children: ReactNode }) {
  const drawerId = useId();
  const nav = useNav(user);
  const settings = useAcademicSettings();
  // Estudiantes: busca avisos nuevos y los muestra como notificaciones del sistema
  const unread = useNotificationWatcher(user);
  const matches = useMatches();
  const staticData = matches.at(-1)?.staticData ?? {};
  const title = resolve(staticData.title, settings);
  const description = resolve(staticData.description, settings);
  const closeDrawer = () => {
    const toggle = document.getElementById(drawerId) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  };

  return (
    <div className="drawer lg:drawer-open">
      <input id={drawerId} type="checkbox" className="drawer-toggle" aria-label="Abrir menú" />
      <div className="drawer-content flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* pt con safe-area: bajo la barra de estado/notch en Android */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-base-300 border-b bg-base-100 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
          <label htmlFor={drawerId} className="btn btn-ghost btn-square btn-sm" aria-label="Menú">
            <Menu className="size-6" />
          </label>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-lg leading-tight">{title ?? "Notas"}</p>
            {description && <p className="truncate text-base-content/70 text-xs">{description}</p>}
          </div>
          <ThemeToggle />
          {user.role === "student" && <NotificationBell unread={unread} />}
          <Avatar person={user} />
        </header>

        <main className="flex-1">{children}</main>

        <nav className="dock dock-sm z-20 border-base-300 border-t bg-base-100 lg:hidden">
          {nav
            .filter((item) => item.dock !== false)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-base-content/60"
                activeProps={{ className: "dock-active text-primary!" }}
              >
                <item.icon className="size-5" />
                <span className="dock-label">{item.label}</span>
              </Link>
            ))}
          <Link
            to="/profile"
            className="text-base-content/60"
            activeProps={{ className: "dock-active text-primary!" }}
          >
            <UserRound className="size-5" />
            <span className="dock-label">Cuenta</span>
          </Link>
        </nav>
      </div>
      <div className="drawer-side z-30">
        <label htmlFor={drawerId} className="drawer-overlay" aria-label="Cerrar menú" />
        <Sidebar user={user} onNavigate={closeDrawer} />
      </div>
    </div>
  );
}
