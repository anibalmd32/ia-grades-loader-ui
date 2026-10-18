import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { academicSettingsQuery } from "@/api/queries/settings";
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
  const settings = useQuery(academicSettingsQuery);
  // Telegram necesita el asistente y su propio interruptor (lo decide la institución)
  const disabled =
    settings.data != null && (!settings.data.assistant_enabled || !settings.data.telegram_enabled);
  const status = useQuery({ ...telegramStatusQuery, enabled: !disabled });
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
        {disabled ? (
          <EmptyState
            title="La institución desactivó el asistente por Telegram"
            description="Por ahora no puedes consultar tus notas desde Telegram. Puedes verlas en Mis notas."
            action={
              <Link to="/student/grades" className="btn btn-primary">
                Ver mis notas
              </Link>
            }
          />
        ) : status.error ? (
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
