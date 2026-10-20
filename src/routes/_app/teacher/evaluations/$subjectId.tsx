import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { Plus, Table } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  downloadTermEvaluationGrades,
  type Evaluation,
  type EvaluationPlan,
  evaluationPlanQuery,
  type TermEvaluationGrades,
  termEvaluationGradesQuery,
} from "@/api/queries/evaluations";
import { type AcademicSettings, useSubjectRules } from "@/api/queries/settings";
import { downloadSubjectGrades } from "@/api/queries/teacher";
import { BackLink } from "@/components/admin/common";
import {
  EvaluationFormModal,
  EvaluationGradesSheet,
  EvaluationList,
  InvalidEvaluationAlert,
  PlanBadge,
  PlanNotice,
  useDeleteEvaluation,
  useEvaluationDrafts,
  useSaveEvaluationGrades,
} from "@/components/teacher/evaluations";
import { useUnsavedChangesGuard } from "@/components/teacher/gradebook";
import { ClosedPeriodNotice } from "@/components/ui/closed-period";
import { DownloadButton } from "@/components/ui/download-button";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { isTerm, termName } from "@/lib/grades";

export const Route = createFileRoute("/_app/teacher/evaluations/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  validateSearch: v.object({
    // Lapso visible; uno fuera de las reglas de la materia se trata como el primero
    term: v.optional(
      v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)), 1),
      1,
    ),
  }),
  search: { middlewares: [stripSearchParams({ term: 1 })] },
  staticData: {
    title: "Plan de evaluación",
    description: "Evaluaciones de cada lapso y sus notas",
  },
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(evaluationPlanQuery(subjectId));

  if (query.error || !query.data) {
    return (
      <>
        <PageHeader title="Plan de evaluación" />
        <PageBody>
          <BackLink to="/teacher/subjects" label="Mis materias" />
          {query.error ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <LoadingState rows={4} />
          )}
        </PageBody>
      </>
    );
  }
  return <Evaluations plan={query.data} />;
}

/** Diálogo abierto: alta (sin evaluación) o edición */
type FormState = { evaluation?: Evaluation } | null;

function Evaluations({ plan }: { plan: EvaluationPlan }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { subject } = plan;
  // Reglas del periodo de la materia (congeladas si se cerró alguna vez)
  const settings = useSubjectRules(subject.semester);
  const term = isTerm(search.term, settings) ? search.term : 1;
  const closed = subject.semester.is_closed;
  const termPlan = plan.terms.find((t) => t.term === term);
  const evaluations = plan.evaluations.filter((e) => e.term === term);
  const [form, setForm] = useState<FormState>(null);
  const remove = useDeleteEvaluation(subject.id, settings);

  /** Porcentaje ya repartido en el lapso, sin contar la evaluación indicada */
  const used = (exclude?: Evaluation) =>
    evaluations.filter((e) => e.id !== exclude?.id).reduce((sum, e) => sum + e.weight, 0);

  return (
    <>
      <PageHeader
        title={`${subject.code} · Plan de evaluación`}
        description={`${subject.name} · ${settings.period_label} ${subject.semester.name}${closed ? " (cerrado)" : ""}`}
        actions={
          <>
            <Link
              to="/teacher/subjects/$subjectId"
              params={{ subjectId: subject.id }}
              className="btn btn-outline btn-primary"
            >
              <Table className="size-4" />
              Planilla
            </Link>
            <DownloadButton
              label="Descargar materia"
              download={() => downloadSubjectGrades(subject.id)}
            />
          </>
        }
      />
      <PageBody>
        <BackLink
          to="/teacher/subjects/$subjectId"
          params={{ subjectId: subject.id }}
          label="Planilla de notas"
        />
        <h2 className="font-bold text-xl lg:hidden">
          {subject.code} · {subject.name}
        </h2>
        {closed && (
          <ClosedPeriodNotice
            semester={subject.semester}
            message="su plan de evaluación y sus notas ya no se pueden modificar."
          />
        )}

        <div
          role="tablist"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 *:shrink-0 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {plan.terms.map((t) => (
            <button
              key={t.term}
              type="button"
              role="tab"
              aria-selected={t.term === term}
              className={`btn btn-sm rounded-full ${t.term === term ? "btn-primary" : "btn-outline btn-primary"}`}
              onClick={() =>
                navigate({ search: (prev) => ({ ...prev, term: t.term }), replace: true })
              }
            >
              {termName(settings, t.term)}
              <PlanBadge plan={t} />
            </button>
          ))}
        </div>

        <section className="card card-border bg-base-100">
          <div className="card-body gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title">
                Evaluaciones del {termName(settings, term).toLowerCase()}
              </h2>
              {!closed && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={used() >= 100}
                  onClick={() => setForm({})}
                >
                  <Plus className="size-4" />
                  Añadir evaluación
                </button>
              )}
            </div>
            {termPlan && <PlanNotice plan={termPlan} settings={settings} />}
            {evaluations.length > 0 && (
              <EvaluationList
                evaluations={evaluations}
                readOnly={closed}
                onEdit={(evaluation) => setForm({ evaluation })}
                onDelete={(evaluation) => void remove(evaluation)}
              />
            )}
          </div>
        </section>

        {evaluations.length > 0 && (
          <TermGrades
            key={term}
            subjectId={subject.id}
            term={term}
            settings={settings}
            closed={closed}
          />
        )}
      </PageBody>
      {form && (
        <EvaluationFormModal
          subjectId={subject.id}
          term={term}
          evaluation={form.evaluation}
          available={100 - used(form.evaluation)}
          settings={settings}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}

function TermGrades({
  subjectId,
  term,
  settings,
  closed,
}: {
  subjectId: number;
  term: number;
  settings: AcademicSettings;
  closed: boolean;
}) {
  const query = useQuery(termEvaluationGradesQuery(subjectId, term));
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <LoadingState rows={4} />;
  if (query.data.students.length === 0) {
    return (
      <EmptyState
        title="Aún no hay estudiantes matriculados"
        description="Cuando la coordinación matricule estudiantes en la materia, podrás calificarlos aquí."
      />
    );
  }
  return (
    <GradesEditor
      // Si cambia el plan (alta o baja de evaluaciones) se descartan los borradores
      key={query.data.evaluations.map((e) => e.id).join(",")}
      data={query.data}
      subjectId={subjectId}
      term={term}
      settings={settings}
      closed={closed}
    />
  );
}

function GradesEditor({
  data,
  subjectId,
  term,
  settings,
  closed,
}: {
  data: TermEvaluationGrades;
  subjectId: number;
  term: number;
  settings: AcademicSettings;
  closed: boolean;
}) {
  const drafts = useEvaluationDrafts(data, settings);
  const save = useSaveEvaluationGrades(subjectId, term, drafts);
  useUnsavedChangesGuard(drafts.pending);
  const canSave = drafts.changes.length > 0 && drafts.invalid.length === 0 && !save.isPending;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg">Notas de las evaluaciones</h2>
        <div className="flex flex-wrap gap-2">
          <DownloadButton
            label={`Descargar ${termName(settings, term).toLowerCase()}`}
            download={() => downloadTermEvaluationGrades(subjectId, term)}
          />
          {!closed && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSave}
              onClick={() => save.mutate(drafts.changes)}
            >
              {save.isPending && <span className="loading loading-spinner loading-sm" />}
              Guardar notas{drafts.pending > 0 ? ` (${drafts.pending})` : ""}
            </button>
          )}
        </div>
      </div>
      <InvalidEvaluationAlert drafts={drafts} settings={settings} />
      <EvaluationGradesSheet
        data={data}
        drafts={drafts}
        settings={settings}
        disabled={closed || save.isPending}
      />
      <p className="text-base-content/70 text-xs">
        {settings.summary}. La nota del {termName(settings, term).toLowerCase()} es la suma de cada
        nota por su porcentaje.{!closed && " Deja una celda vacía para borrar la nota."}
      </p>
    </section>
  );
}
