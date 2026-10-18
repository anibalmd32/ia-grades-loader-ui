import { useQuery } from "@tanstack/react-query";
import { useAcademicSettings } from "@/api/queries/settings";
import { telegramStatusQuery } from "@/api/queries/student";
import { NAV, type NavItem, navItem } from "@/lib/roles";
import type { User } from "@/stores/session";

/**
 * Menú del rol, con las etiquetas según la configuración académica ("Semestres y materias",
 * "Trimestres y materias"…). A los estudiantes se les oculta Telegram si el bot no está
 * configurado.
 */
export function useNav(user: User): NavItem[] {
  const settings = useAcademicSettings();
  const telegram = useQuery({
    ...telegramStatusQuery,
    enabled: user.role === "student",
    staleTime: 5 * 60_000,
  });
  return NAV[user.role]
    .filter((item) => !(item.to === "/student/telegram" && telegram.data?.enabled === false))
    .map((item) => navItem(item, settings));
}
