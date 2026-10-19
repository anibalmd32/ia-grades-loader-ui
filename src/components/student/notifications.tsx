import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import {
  latestNotificationsQuery,
  markNotificationsRead,
  type Notification,
  notificationKeys,
} from "@/api/queries/notifications";
import { studentKeys } from "@/api/queries/student";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/dates";
import {
  type NotificationAccess,
  notificationAccess,
  requestNotificationAccess,
  showSystemNotification,
} from "@/lib/system-notifications";
import { usePreferences, usePreferencesHydrated } from "@/stores/preferences";
import type { User } from "@/stores/session";

/** Notificaciones del sistema a la vez como máximo; con más se agrupan en una */
const MAX_SYSTEM_NOTIFICATIONS = 3;

/**
 * Busca avisos nuevos del estudiante cada minuto. Los que llegan (id mayor que el último ya
 * notificado en este dispositivo) se muestran como notificación del sistema si el estudiante
 * las activó, y se refrescan sus notas. La primera vez solo se toma nota de los que ya había.
 */
export function useNotificationWatcher(user: User) {
  const isStudent = user.role === "student";
  const hydrated = usePreferencesHydrated();
  const query = useQuery({ ...latestNotificationsQuery, enabled: isStudent });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lastSeen = usePreferences((s) => s.lastNotified[user.id]);
  const enabled = usePreferences((s) => s.systemNotifications);
  const setLastNotified = usePreferences((s) => s.setLastNotified);
  const items = query.data?.items;

  useEffect(() => {
    if (!isStudent || !hydrated || !items) return;
    const newest = Math.max(0, ...items.map((n) => n.id));
    if (lastSeen === undefined) {
      setLastNotified(user.id, newest);
      return;
    }
    if (newest <= lastSeen) return;
    setLastNotified(user.id, newest);
    const fresh = items.filter((n) => n.id > lastSeen && n.read_at == null);
    if (fresh.length === 0) return;
    // Notas nuevas: lo que ve el estudiante tiene que estar al día
    void queryClient.invalidateQueries({ queryKey: studentKeys.all });
    if (!enabled) return;
    const open = (n: Notification) =>
      n.subject_id
        ? navigate({ to: "/student/grades/$subjectId", params: { subjectId: n.subject_id } })
        : navigate({ to: "/student/notifications" });
    if (fresh.length > MAX_SYSTEM_NOTIFICATIONS) {
      void showSystemNotification({
        title: "Tienes notas nuevas",
        body: `${fresh.length} avisos nuevos de tus materias. Ábrelos en Notas.`,
        onClick: () => void navigate({ to: "/student/notifications" }),
      });
      return;
    }
    for (const n of [...fresh].reverse()) {
      void showSystemNotification({ title: n.title, body: n.body, onClick: () => void open(n) });
    }
  }, [
    isStudent,
    hydrated,
    items,
    lastSeen,
    enabled,
    user.id,
    setLastNotified,
    queryClient,
    navigate,
  ]);

  return query.data?.unread ?? 0;
}

/** Campana con el número de avisos sin leer (barra superior del móvil) */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      to="/student/notifications"
      className="btn btn-ghost btn-square btn-sm indicator"
      aria-label={unread > 0 ? `Avisos: ${unread} sin leer` : "Avisos"}
    >
      {unread > 0 && (
        <span className="indicator-item badge badge-error badge-xs">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      <Bell className="size-5" />
    </Link>
  );
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(error.message),
  });
}

/** Un aviso: título, notas y cuándo llegó; resaltado mientras no se ha leído */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const unread = notification.read_at == null;
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-start gap-3 p-4 text-left hover:bg-base-200 ${unread ? "bg-primary/5" : ""}`}
        onClick={() => onOpen(notification)}
      >
        <span
          className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className={`block ${unread ? "font-bold" : "font-semibold"}`}>
            {notification.title}
            {unread && <span className="sr-only"> (sin leer)</span>}
          </span>
          <span className="block text-base-content/80 text-sm">{notification.body}</span>
          <time className="block text-base-content/60 text-xs" dateTime={notification.created_at}>
            {timeAgo(notification.created_at)}
          </time>
        </span>
      </button>
    </li>
  );
}

const ACCESS_HELP: Record<"denied" | "unsupported", string> = {
  denied:
    "Bloqueaste las notificaciones de Notas. Para recibirlas, permítelas en los ajustes del navegador o del teléfono y vuelve a activarlas aquí.",
  unsupported:
    "Este navegador no permite notificaciones. Los avisos seguirán apareciendo en la campana de la app.",
};

/**
 * Casilla "Avisarme en este dispositivo": al marcarla pide permiso al sistema o al navegador
 * y, si lo da, envía una notificación de prueba.
 */
export function DeviceNotificationsSetting() {
  const enabled = usePreferences((s) => s.systemNotifications);
  const setEnabled = usePreferences((s) => s.setSystemNotifications);
  const [access, setAccess] = useState<NotificationAccess | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void notificationAccess().then(setAccess);
  }, []);

  const toggle = async (checked: boolean) => {
    if (!checked) {
      setEnabled(false);
      return;
    }
    setBusy(true);
    try {
      const result = await requestNotificationAccess();
      setAccess(result);
      if (result !== "granted") return;
      setEnabled(true);
      await showSystemNotification({
        title: "Notificaciones activadas",
        body: "Te avisaremos aquí cada vez que te carguen o corrijan una nota.",
      });
    } finally {
      setBusy(false);
    }
  };

  const blocked = access === "denied" || access === "unsupported";
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>Avisarme en este dispositivo cuando tenga notas nuevas</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={enabled && access === "granted"}
          disabled={busy || access === "unsupported" || access === null}
          onChange={(event) => void toggle(event.target.checked)}
        />
      </label>
      {blocked && <p className="text-base-content/70 text-sm">{ACCESS_HELP[access]}</p>}
    </div>
  );
}
