import { createFileRoute, redirect } from "@tanstack/react-router";
import { homePath } from "@/lib/roles";
import { sessionReady, useSession } from "@/stores/session";

// "/" no tiene pantalla propia: lleva a la sección del rol o al login
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await sessionReady;
    const { user } = useSession.getState();
    throw redirect({ to: user ? homePath(user.role) : "/login" });
  },
});
