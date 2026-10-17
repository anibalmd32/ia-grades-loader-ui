import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { telegramStatusQuery } from "@/api/queries/student";
import { TelegramSection } from "@/components/student/telegram";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const title = "Telegram";

export const Route = createFileRoute("/_app/student/telegram")({
  staticData: { title, description: "Consulta tus notas desde Telegram" },
  component: TelegramPage,
});

function TelegramPage() {
  const status = useQuery(telegramStatusQuery);
  const bot = status.data?.bot_username;

  return (
    <>
      <PageHeader
        title={title}
        description={
          bot ? `Consulta tus notas desde @${bot}.` : "Consulta tus notas desde Telegram."
        }
      />
      <PageBody>
        {status.error ? (
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        ) : !status.data ? (
          <LoadingState rows={3} />
        ) : !status.data.enabled ? (
          <EmptyState
            title="Telegram no está disponible"
            description="El bot de Telegram no está configurado en el servidor."
          />
        ) : (
          <TelegramSection status={status.data} />
        )}
      </PageBody>
    </>
  );
}
