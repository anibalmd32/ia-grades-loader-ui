import { useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import * as v from "valibot";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type Notification,
  notificationsPageQuery,
} from "@/api/queries/notifications";
import {
  DeviceNotificationsSetting,
  NotificationItem,
  useMarkNotificationsRead,
} from "@/components/student/notifications";
import { Pagination } from "@/components/ui/data-table";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const title = "Avisos";

export const Route = createFileRoute("/_app/student/notifications")({
  validateSearch: v.object({
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ offset: 0 })] },
  staticData: { title, description: "Notas nuevas de tus materias" },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { offset } = Route.useSearch();
  const navigate = useNavigate();
  const query = useQuery(notificationsPageQuery(offset));
  const markRead = useMarkNotificationsRead();
  const unread = query.data?.unread ?? 0;

  const open = (notification: Notification) => {
    if (notification.read_at == null) markRead.mutate([notification.id]);
    if (notification.subject_id) {
      void navigate({
        to: "/student/grades/$subjectId",
        params: { subjectId: notification.subject_id },
      });
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        description="Cada vez que te cargan o corrigen una nota te llega un aviso."
        actions={
          unread > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-primary"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              <CheckCheck className="size-4" />
              Marcar todo como leído
            </button>
          )
        }
      />
      <PageBody>
        <section className="card card-border max-w-3xl bg-base-100">
          <div className="card-body gap-2 py-4">
            <DeviceNotificationsSetting />
          </div>
        </section>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <LoadingState rows={4} />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            title="Aún no tienes avisos"
            description="Cuando un profesor te cargue o corrija una nota, aparecerá aquí."
          />
        ) : (
          <>
            {unread > 0 && (
              <p className="text-base-content/70 text-sm">
                {unread === 1 ? "1 aviso sin leer" : `${unread} avisos sin leer`}
              </p>
            )}
            <ul className="card card-border max-w-3xl divide-y divide-base-300 overflow-hidden bg-base-100">
              {query.data.items.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={open} />
              ))}
            </ul>
            {query.data.total > NOTIFICATIONS_PAGE_SIZE && (
              <Pagination
                page={query.data}
                onPageChange={(next) => navigate({ to: ".", search: { offset: next } })}
              />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
