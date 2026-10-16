import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { UploadForm } from "@/components/teacher/upload-form";
import { PageBody, PageHeader } from "@/components/ui/page-header";

const title = "Importar notas desde Excel";
const description = "La IA lee el archivo y te propone a qué estudiante y lapso va cada nota.";

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
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <UploadForm key={subject} defaultSubject={subject} />
      </PageBody>
    </>
  );
}
