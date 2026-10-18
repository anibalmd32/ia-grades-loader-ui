import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useAcademicSettings } from "@/api/queries/settings";
import { RecentImports } from "@/components/teacher/recent-imports";
import { UploadForm } from "@/components/teacher/upload-form";
import { PageBody, PageHeader } from "@/components/ui/page-header";

const title = "Importar notas desde Excel";

export const Route = createFileRoute("/_app/teacher/imports/")({
  validateSearch: v.object({
    // Materia preseleccionada al llegar desde "Importar Excel"
    subject: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
  }),
  staticData: { title: "Importar Excel", description: "La IA te propone cada nota" },
  component: ImportsPage,
});

function ImportsPage() {
  const { subject } = Route.useSearch();
  const settings = useAcademicSettings();
  const description = `La IA lee el archivo y te propone a qué estudiante y ${settings.term_label.toLowerCase()} va cada nota.`;
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <UploadForm key={subject} defaultSubject={subject} />
          <RecentImports />
        </div>
      </PageBody>
    </>
  );
}
