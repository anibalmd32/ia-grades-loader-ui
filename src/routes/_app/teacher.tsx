import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guards";

// Área del profesor
export const Route = createFileRoute("/_app/teacher")({
  beforeLoad: ({ context }) => requireRole(context.user, ["teacher"]),
  component: Outlet,
});
