import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { academicSettingsQuery } from "@/api/queries/settings";
import { AcademicSettingsForm } from "@/components/admin/academic-settings-form";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { requireRole } from "@/lib/guards";

const title = "Configuración";
const description = "Periodos, evaluaciones y escala de notas de la institución.";

// Solo el super admin (los coordinadores, que sí entran en /admin, vuelven a su inicio)
export const Route = createFileRoute("/_app/admin/settings")({
  beforeLoad: ({ context }) => requireRole(context.user, ["super_admin"]),
  staticData: { title, description: "Periodos, evaluaciones y notas" },
  component: SettingsPage,
});

function SettingsPage() {
  const query = useQuery(academicSettingsQuery);
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <LoadingState rows={6} />
        ) : (
          <AcademicSettingsForm settings={query.data} />
        )}
      </PageBody>
    </>
  );
}
