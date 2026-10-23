import { useQuery } from "@tanstack/react-query";
import { latestNotificationsQuery } from "@/api/queries/notifications";
import { useAcademicSettings } from "@/api/queries/settings";
import { telegramStatusQuery } from "@/api/queries/student";
import { NAV, type NavItem, navItem } from "@/lib/roles";
import type { User } from "@/stores/session";

/**
 * Menú del rol, con las etiquetas que dependen de la configuración académica.
 * A los estudiantes se les oculta el asistente IA si la institución
 * lo desactivó, y Telegram si está desactivado (él o el asistente) o el bot no está configurado.
 * La entrada de avisos lleva el número de avisos sin leer.
 */
export function useNav(user: User): NavItem[] {
  const settings = useAcademicSettings();
  const assistant = settings.assistant_enabled;
  const telegramAllowed = assistant && settings.telegram_enabled;
  const telegram = useQuery({
    ...telegramStatusQuery,
    enabled: user.role === "student" && telegramAllowed,
    staleTime: 5 * 60_000,
  });
  // Misma consulta que el vigilante de avisos del layout (se comparte la caché)
  const notifications = useQuery({
    ...latestNotificationsQuery,
    enabled: user.role === "student",
  });
  const unread = notifications.data?.unread ?? 0;
  const hidden = (to: string) =>
    (to === "/student/assistant" && !assistant) ||
    (to === "/student/telegram" && (!telegramAllowed || telegram.data?.enabled === false));
  return NAV[user.role]
    .filter((item) => !hidden(item.to))
    .map((item) => ({
      ...navItem(item, settings),
      ...(item.to === "/student/notifications" && unread > 0 ? { badge: unread } : {}),
    }));
}
