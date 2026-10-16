import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { requireUser } from "@/lib/guards";
import { useSession } from "@/stores/session";

// Rutas con sesión: guarda de autenticación + layout de la app
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location) }),
  component: AppRoute,
});

function AppRoute() {
  const user = useSession((s) => s.user);
  // Si la sesión caduca (401) o se cierra mientras se usa la app, volver al login
  if (!user) return <Navigate to="/login" />;
  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  );
}
