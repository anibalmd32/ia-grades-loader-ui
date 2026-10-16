import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guards";

// Área del estudiante
export const Route = createFileRoute("/_app/student")({
  beforeLoad: ({ context }) => requireRole(context.user, ["student"]),
  component: Outlet,
});
