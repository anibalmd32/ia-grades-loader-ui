import { useQuery } from "@tanstack/react-query";
import { telegramStatusQuery } from "@/api/queries/student";
import { NAV, type NavItem } from "@/lib/roles";
import type { User } from "@/stores/session";

/** Menú del rol; a los estudiantes se les oculta Telegram si el bot no está configurado */
export function useNav(user: User): NavItem[] {
  const telegram = useQuery({
    ...telegramStatusQuery,
    enabled: user.role === "student",
    staleTime: 5 * 60_000,
  });
  return NAV[user.role].filter(
    (item) => !(item.to === "/student/telegram" && telegram.data?.enabled === false),
  );
}
