import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guards";

// Administración: super admin y coordinadores
export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => requireRole(context.user, ["super_admin", "coordinator"]),
  component: Outlet,
});
