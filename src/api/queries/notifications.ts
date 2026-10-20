import { queryOptions } from "@tanstack/react-query";
import { api, authorizedFetch, unwrap } from "../client";
import type { components } from "../schema";
import { readEvents } from "../sse";

export type Notification = components["schemas"]["NotificationRead"];
export type NotificationPage = components["schemas"]["NotificationPage"];

export const notificationKeys = {
  all: ["student", "notifications"] as const,
  page: (offset: number) => ["student", "notifications", "page", offset] as const,
  latest: ["student", "notifications", "latest"] as const,
};

/** Cada cuánto se buscan avisos nuevos mientras la app está abierta */
export const NOTIFICATIONS_POLL_MS = 60_000;
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** Últimos avisos y el total sin leer; se consulta sola cada minuto (también en segundo plano) */
export const latestNotificationsQuery = queryOptions({
  queryKey: notificationKeys.latest,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/student/notifications", {
        params: { query: { limit: NOTIFICATIONS_PAGE_SIZE } },
        signal,
      }),
    ),
  refetchInterval: NOTIFICATIONS_POLL_MS,
  refetchIntervalInBackground: true,
});

export const notificationsPageQuery = (offset: number) =>
  queryOptions({
    queryKey: notificationKeys.page(offset),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/student/notifications", {
          params: { query: { limit: NOTIFICATIONS_PAGE_SIZE, offset } },
          signal,
        }),
      ),
  });

/** Marca como leídos los avisos indicados (sin ids: todos) */
export function markNotificationsRead(ids?: number[]) {
  return unwrap(api.POST("/api/v1/student/notifications/read", { body: ids ? { ids } : {} }));
}

/**
 * Conexión en tiempo real (SSE) con los avisos nuevos del estudiante. Llama a `onReady` al
 * conectar y a `onNotification` con cada aviso; se resuelve cuando el servidor cierra la
 * conexión (lo hace cada 5 min) y lanza ApiError si no se puede abrir.
 */
export async function listenNotifications(
  { onReady, onNotification }: { onReady: () => void; onNotification: (n: Notification) => void },
  signal: AbortSignal,
): Promise<void> {
  const response = await authorizedFetch("/api/v1/student/notifications/stream", {
    headers: { Accept: "text/event-stream" },
    signal,
  });
  if (!response.headers.get("Content-Type")?.startsWith("text/event-stream")) return;
  await readEvents(
    response,
    ({ event, data }) => {
      if (event === "ready") onReady();
      else if (event === "notification") onNotification(data as Notification);
    },
    signal,
  );
}
