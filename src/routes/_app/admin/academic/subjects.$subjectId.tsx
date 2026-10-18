import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as v from "valibot";
import { subjectQuery } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { BackLink } from "@/components/admin/common";
import {
  DeleteSubjectButton,
  SubjectGradeHistory,
  SubjectStudents,
  SubjectTeachers,
} from "@/components/admin/subject-detail";
import { EditSubjectModal } from "@/components/admin/subject-form";
import { ClosedPeriodNotice } from "@/components/ui/closed-period";
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
        description={
          subject
            ? `${settings.period_label} ${subject.semester.name}${subject.semester.is_closed ? " (cerrado)" : ""}`
            : undefined
        }
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
            {subject.semester.is_closed && (
              <ClosedPeriodNotice
                semester={subject.semester}
                message={`no se pueden matricular ni retirar estudiantes de esta materia ni moverla a otro ${settings.period_label.toLowerCase()}. Sus notas solo se pueden consultar.`}
              />
            )}
            <SubjectTeachers subject={subject} />
            <SubjectStudents subject={subject} />
            <SubjectGradeHistory subject={subject} />
            {editing && <EditSubjectModal subject={subject} onClose={() => setEditing(false)} />}
          </>
        )}
      </PageBody>
    </>
  );
}
