import { PageBody, PageHeader } from "./page-header";
import { EmptyState } from "./states";

/** Pantalla aún sin implementar (se completa en su fase del plan) */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <EmptyState
          title="Disponible próximamente"
          description="Esta pantalla está en desarrollo."
        />
      </PageBody>
    </>
  );
}
