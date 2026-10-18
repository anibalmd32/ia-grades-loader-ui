import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as v from "valibot";
import { subjectQuery } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { BackLink } from "@/components/admin/common";
import {
  DeleteSubjectButton,
  SubjectStudents,
  SubjectTeachers,
} from "@/components/admin/subject-detail";
import { EditSubjectModal } from "@/components/admin/subject-form";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_app/admin/academic/subjects/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  staticData: { title: "Materia" },
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(subjectQuery(subjectId));
  const settings = useAcademicSettings();
  const subject = query.data;
  const [editing, setEditing] = useState(false);

  const actions = subject && (
    <>
      <button
        type="button"
        className="btn btn-outline btn-primary"
        onClick={() => setEditing(true)}
      >
        Editar materia
      </button>
      <DeleteSubjectButton subject={subject} />
    </>
  );

  return (
    <>
      <PageHeader
        title={subject ? `${subject.code} · ${subject.name}` : "Materia"}
        description={subject ? `${settings.period_label} ${subject.semester.name}` : undefined}
        actions={actions}
      />
      <PageBody>
        <BackLink
          to="/admin/academic"
          search={subject ? { semester: subject.semester.id } : {}}
          label={`${settings.period_label_plural} y materias`}
        />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !subject ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <h2 className="font-bold text-xl lg:hidden">
              {subject.code} · {subject.name}
            </h2>
            <SubjectTeachers subject={subject} />
            <SubjectStudents subject={subject} />
            {editing && <EditSubjectModal subject={subject} onClose={() => setEditing(false)} />}
          </>
        )}
      </PageBody>
    </>
  );
}
