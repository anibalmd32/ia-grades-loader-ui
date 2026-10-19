import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as v from "valibot";
import { percentText } from "@/api/queries/evaluations";
import {
  type AcademicSettings,
  useAcademicSettings,
  useSubjectRules,
} from "@/api/queries/settings";
import { type StudentSubjectGrades, studentSubjectQuery } from "@/api/queries/student";
import { BackLink } from "@/components/admin/common";
import { StandingBadge, standingSentence } from "@/components/student/projection";
import { gradeColor } from "@/components/student/subject-grades-card";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { dueDateText } from "@/lib/dates";
import { formatGrade, termName, termsText } from "@/lib/grades";

export const Route = createFileRoute("/_app/student/grades/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  staticData: { title: "Detalle de materia" },
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(studentSubjectQuery(subjectId));
  const settings = useAcademicSettings();
  const item = query.data;

  return (
    <>
      <PageHeader
        title={item ? `${item.subject.code} · ${item.subject.name}` : "Materia"}
        description={
          item
            ? [
                `${settings.period_label} ${item.subject.semester.name}${item.subject.semester.is_closed ? " (cerrado)" : ""}`,
                ...item.teachers.map((t) => `Prof. ${t}`),
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />
      <PageBody>
        <BackLink to="/student/grades" label="Mis notas" />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !item ? (
          <LoadingState rows={3} />
        ) : (
          <SubjectDetail item={item} />
        )}
      </PageBody>
    </>
  );
}

function SubjectDetail({ item }: { item: StudentSubjectGrades }) {
  // Reglas del periodo de la materia (congeladas si se cerró alguna vez)
  const settings = useSubjectRules(item.subject.semester);
  const { subject, projection } = item;
  const final = projection.final_grade;
  const pending = projection.pending_terms;

  return (
    <>
      <div className="lg:hidden">
        <h2 className="font-bold text-xl">{subject.name}</h2>
        <p className="text-base-content/70 text-sm">
          {subject.code}
          {item.teachers.length > 0 && ` · Prof. ${item.teachers.join(", ")}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {item.grades.map((g) => (
          <div key={g.term} className="card card-border bg-base-100">
            <div className="card-body items-center gap-1 p-4 text-center">
              <p className="text-base-content/70 text-sm">{termName(settings, g.term)}</p>
              <p
                className={`font-bold text-3xl tabular-nums lg:text-4xl ${gradeColor(g.value, settings)}`}
              >
                {formatGrade(g.value, settings)}
              </p>
              <p className="text-base-content/60 text-xs">
                {g.value == null ? "Pendiente" : "Cargada"}
              </p>
            </div>
          </div>
        ))}
        <div className="card bg-neutral text-neutral-content">
          <div className="card-body items-center gap-1 p-4 text-center">
            <p className="text-neutral-content/70 text-sm">
              {final != null ? "Definitiva" : "Promedio actual"}
            </p>
            <p className="font-bold text-3xl tabular-nums lg:text-4xl">
              {formatGrade(final ?? item.average, settings)}
            </p>
            <p className="text-neutral-content/70 text-xs">
              {final != null
                ? "Materia cerrada"
                : `${pending.length === 1 ? "Pendiente" : "Pendientes"}: ${termsText(settings, pending)}`}
            </p>
          </div>
        </div>
      </div>

      {(item.evaluations ?? []).length > 0 && <EvaluationPlan item={item} settings={settings} />}

      <section className="card card-border bg-base-100">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title">¿Qué necesito para aprobar?</h2>
            <StandingBadge projection={projection} settings={settings} />
          </div>
          {projection.standing === "in_progress" && projection.needed_average != null ? (
            <>
              <p className="text-base-content/70">
                {pending.length === 1 ? "Necesitas al menos" : "Necesitas un promedio de al menos"}
              </p>
              <p className="font-bold text-2xl text-primary lg:text-3xl">
                {formatGrade(projection.needed_average, settings)} en {termsText(settings, pending)}
              </p>
            </>
          ) : (
            <p className="text-lg">{standingSentence(projection, settings)}</p>
          )}
        </div>
      </section>

      {settings.assistant_enabled && (
        <section className="card bg-primary/10">
          <div className="card-body flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="font-bold text-lg">¿Dudas sobre esta materia?</h2>
              <p className="text-base-content/70 text-sm">
                Pregúntale al asistente, por ejemplo: «¿cuánto necesito para aprobar {subject.name}
                ?»
              </p>
            </div>
            <Link
              to="/student/assistant"
              search={{ q: `¿Cuánto necesito para aprobar ${subject.name}?` }}
              className="btn btn-primary"
            >
              Abrir asistente
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

/** Evaluaciones de cada lapso que las tiene, con su porcentaje, fecha y la nota obtenida */
function EvaluationPlan({
  item,
  settings,
}: {
  item: StudentSubjectGrades;
  settings: AcademicSettings;
}) {
  const evaluations = item.evaluations ?? [];
  const terms = [...new Set(evaluations.map((e) => e.term))].sort((a, b) => a - b);
  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title">Plan de evaluación</h2>
        <p className="text-base-content/70 text-sm">
          La nota de {terms.length === 1 ? "este" : "estos"}{" "}
          {(terms.length === 1 ? settings.term_label : settings.term_label_plural).toLowerCase()} es
          la suma de cada evaluación por su porcentaje. Aparece cuando todas tienen nota.
        </p>
        {terms.map((term) => (
          <div key={term} className="flex flex-col gap-1">
            <h3 className="font-bold">{termName(settings, term)}</h3>
            <ul className="divide-y divide-base-300">
              {evaluations
                .filter((e) => e.term === term)
                .map((evaluation) => (
                  <li
                    key={`${evaluation.term}-${evaluation.name}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <span className="badge badge-primary badge-soft w-16 shrink-0 font-bold tabular-nums">
                      {percentText(evaluation.weight)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{evaluation.name}</p>
                      {evaluation.due_date && (
                        <p className="text-base-content/70 text-xs">
                          {dueDateText(evaluation.due_date)}
                        </p>
                      )}
                    </div>
                    {evaluation.value == null ? (
                      <span className="font-semibold text-base-content/60 text-sm">Pendiente</span>
                    ) : (
                      <span
                        className={`font-bold tabular-nums ${gradeColor(evaluation.value, settings)}`}
                      >
                        {formatGrade(evaluation.value, settings)}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
