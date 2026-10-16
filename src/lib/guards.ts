import { redirect } from "@tanstack/react-router";
import { homePath } from "@/lib/roles";
import { type Role, sessionReady, type User, useSession } from "@/stores/session";

/** Exige sesión; si hay que cambiar la contraseña, solo deja ir a /change-password */
export async function requireUser(location: { href: string; pathname: string }): Promise<User> {
  await sessionReady;
  const { status, user } = useSession.getState();
  if (status !== "authenticated" || !user) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  if (user.must_change_password && location.pathname !== "/change-password") {
    throw redirect({ to: "/change-password" });
  }
  return user;
}

/** Si el rol no puede entrar en esta sección, lo manda a su pantalla de inicio */
export function requireRole(user: User, roles: Role[]): void {
  if (!roles.includes(user.role)) throw redirect({ to: homePath(user.role) });
}
