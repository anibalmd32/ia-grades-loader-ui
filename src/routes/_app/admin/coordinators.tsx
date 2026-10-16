import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guards";

// Solo el super admin gestiona coordinadores
export const Route = createFileRoute("/_app/admin/coordinators")({
  beforeLoad: ({ context }) => requireRole(context.user, ["super_admin"]),
  component: Outlet,
});
