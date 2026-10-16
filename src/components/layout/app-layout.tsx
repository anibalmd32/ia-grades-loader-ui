import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Menu } from "lucide-react";
import { type ReactNode, useId } from "react";
import { AppVersion } from "@/components/app-version";
import { Avatar } from "@/components/ui/avatar";
import { NAV, userSubtitle } from "@/lib/roles";
import { type User, useSession } from "@/stores/session";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Título de la pantalla (barra superior en móvil) */
    title?: string;
    description?: string;
  }
}

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
  return (
    <nav className="flex min-h-full w-64 flex-col bg-neutral p-4 text-neutral-content">
      <div className="px-3 py-2">
        <p className="font-bold text-xl">IA Grades Loader</p>
        <p className="text-neutral-content/70 text-xs">Cargador de notas</p>
      </div>
      <ul className="menu mt-6 w-full gap-1 p-0">
        {NAV[user.role].map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              activeProps={{ className: "menu-active bg-primary! text-primary-content! font-bold" }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-1">
        <div className="flex items-center gap-3 rounded-box bg-white/5 p-3">
          <Avatar name={user.full_name} />
          <div className="min-w-0">
            <p className="truncate font-bold text-sm">{user.full_name}</p>
            <p className="truncate text-neutral-content/70 text-xs">{userSubtitle(user)}</p>
          </div>
        </div>
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
  const matches = useMatches();
  const { title, description } = matches.at(-1)?.staticData ?? {};
  const closeDrawer = () => {
    const toggle = document.getElementById(drawerId) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  };

  return (
    <div className="drawer lg:drawer-open">
      <input id={drawerId} type="checkbox" className="drawer-toggle" aria-label="Abrir menú" />
      <div className="drawer-content flex min-h-dvh flex-col pb-16 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-base-300 border-b bg-base-100 px-4 py-3 lg:hidden">
          <label htmlFor={drawerId} className="btn btn-ghost btn-square btn-sm" aria-label="Menú">
            <Menu className="size-6" />
          </label>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-lg leading-tight">{title ?? "Notas"}</p>
            {description && <p className="truncate text-base-content/70 text-xs">{description}</p>}
          </div>
          <Avatar name={user.full_name} />
        </header>

        <main className="flex-1">{children}</main>

        <nav className="dock dock-sm z-20 border-base-300 border-t bg-base-100 lg:hidden">
          {NAV[user.role].map((item) => (
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
        </nav>
      </div>
      <div className="drawer-side z-30">
        <label htmlFor={drawerId} className="drawer-overlay" aria-label="Cerrar menú" />
        <Sidebar user={user} onNavigate={closeDrawer} />
      </div>
    </div>
  );
}
