import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useAcademicSettings } from "@/api/queries/settings";
import { BackLink } from "@/components/admin/common";
import { SubjectCreateForm } from "@/components/admin/subject-form";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/admin/academic/new")({
  validateSearch: v.object({
    semester: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
  }),
  staticData: { title: "Nueva materia" },
  component: NewSubjectPage,
});

function NewSubjectPage() {
  const { semester } = Route.useSearch();
  const settings = useAcademicSettings();
  return (
    <>
      <PageHeader
        title="Nueva materia"
        description={`Cada materia pertenece a un único ${settings.period_label.toLowerCase()}.`}
      />
      <PageBody>
        <BackLink to="/admin/academic" search={semester ? { semester } : {}} label="Volver" />
        <SubjectCreateForm defaultSemesterId={semester} />
      </PageBody>
    </>
  );
}
