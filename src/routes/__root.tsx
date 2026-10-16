import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { GeneratedPasswordDialog } from "@/components/admin/generated-password";
import { ApiStatus } from "@/components/api-status";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ErrorState } from "@/components/ui/states";
import { Toaster } from "@/components/ui/toast";
import { DAISY_THEME, usePreferences } from "@/stores/preferences";

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function useThemeAttribute() {
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", DAISY_THEME[theme]);
  }, [theme]);
}

function RootLayout() {
  useThemeAttribute();
  return (
    <>
      <ApiStatus />
      <Outlet />
      <Toaster />
      <ConfirmDialog />
      <GeneratedPasswordDialog />
      <Suspense>
        <RouterDevtools />
      </Suspense>
      <ReactQueryDevtools />
    </>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}

function NotFound() {
  return (
    <CenteredMessage>
      <p className="font-bold text-6xl text-primary">404</p>
      <h1 className="font-bold text-xl">Esta página no existe</h1>
      <Link to="/" className="btn btn-primary">
        Ir al inicio
      </Link>
    </CenteredMessage>
  );
}

function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <CenteredMessage>
      <h1 className="font-bold text-xl">Algo salió mal</h1>
      <div className="w-full max-w-md text-left">
        <ErrorState error={error} onRetry={reset} />
      </div>
      <Link to="/" className="btn btn-ghost">
        Ir al inicio
      </Link>
    </CenteredMessage>
  );
}
