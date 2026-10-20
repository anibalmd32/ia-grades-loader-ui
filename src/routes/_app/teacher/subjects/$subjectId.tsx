import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { ClipboardList, History } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { PAGE_SIZE } from "@/api/queries/admin";
import { useSubjectRules } from "@/api/queries/settings";
import {
  downloadSubjectGrades,
  type SubjectGrades,
  subjectGradesQuery,
} from "@/api/queries/teacher";
import { BackLink } from "@/components/admin/common";
import { GradeHistoryModal } from "@/components/grade-history";
import {
  FinalGrade,
  GradebookStats,
  GradeCell,
  InvalidCellAlert,
  type Standing,
  standingOf,
  useGradeDrafts,
  useSaveGrades,
  useUnsavedChangesGuard,
} from "@/components/teacher/gradebook";
import { ClosedPeriodNotice } from "@/components/ui/closed-period";
import { Pagination } from "@/components/ui/data-table";
import { DownloadButton } from "@/components/ui/download-button";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { isTerm, termName, termNumbers, termsText } from "@/lib/grades";

const SHOW_OPTIONS: { value: "all" | Standing; label: string }[] = [
  { value: "all", label: "Mostrar: Todos" },
  { value: "in_progress", label: "Mostrar: En curso" },
  { value: "passed", label: "Mostrar: Aprobados" },
  { value: "failed", label: "Mostrar: Reprobados" },
];

export const Route = createFileRoute("/_app/teacher/subjects/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  validateSearch: v.object({
    q: v.optional(v.fallback(v.string(), ""), ""),
    show: v.optional(
      v.fallback(v.picklist(["all", "passed", "failed", "in_progress"]), "all"),
      "all",
    ),
    // Lapso visible en móvil (en escritorio se ven todos). El máximo depende de la
    // configuración académica: uno fuera de rango se trata como el primero
    term: v.optional(
      v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)), 1),
      1,
    ),
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ q: "", show: "all", term: 1, offset: 0 })] },
  staticData: {
    title: "Planilla de notas",
    // Sin lapsos ni escala: cada materia se evalúa con las reglas de su periodo (pueden estar
    // congeladas y no coincidir con la configuración vigente); la planilla las muestra
    description: "Notas de la materia",
  },
  component: GradebookPage,
});

function GradebookPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(subjectGradesQuery(subjectId));

  if (query.error) {
    return (
      <>
        <PageHeader title="Planilla de notas" />
        <PageBody>
          <BackLink to="/teacher/subjects" label="Mis materias" />
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </PageBody>
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title="Planilla de notas" />
        <PageBody>
          <LoadingState rows={6} />
        </PageBody>
      </>
    );
  }
  return <Gradebook data={query.data} />;
}

function Gradebook({ data }: { data: SubjectGrades }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { subject, students } = data;
  // Reglas del periodo de la materia: las congeladas al cerrarlo o, si no, las vigentes
  const settings = useSubjectRules(subject.semester);
  const terms = termNumbers(settings);
  const currentTerm = isTerm(search.term, settings) ? search.term : 1;
  // Periodo cerrado: la planilla es de solo lectura (la API rechazaría los cambios con un 409)
  const closed = subject.semester.is_closed;
  // Lapsos con plan de evaluación: su nota la calcula la API a partir de las evaluaciones
  const computed = new Set(data.computed_terms ?? []);
  const drafts = useGradeDrafts(data);
  const save = useSaveGrades(subject.id, drafts);
  useUnsavedChangesGuard(drafts.pending);
  // Historial abierto: de toda la materia (null) o de un estudiante
  const [history, setHistory] = useState<{ id: number; full_name: string } | null | undefined>();

  const filter = search.q.trim().toLowerCase();
  const filtered = students.filter(
    (s) =>
      (search.show === "all" || standingOf(s) === search.show) &&
      (!filter ||
        s.student.full_name.toLowerCase().includes(filter) ||
        (s.student.cedula_display ?? "").toLowerCase().includes(filter)),
  );
  const offset = search.offset < filtered.length ? search.offset : 0;
  const rows = filtered.slice(offset, offset + PAGE_SIZE);

  const canSave = drafts.changes.length > 0 && drafts.invalid.length === 0 && !save.isPending;
  const historyButton = (
    <button type="button" className="btn btn-outline btn-primary" onClick={() => setHistory(null)}>
      <History className="size-4" />
      Historial
    </button>
  );
  const evaluationsLink = (
    <Link
      to="/teacher/evaluations/$subjectId"
      params={{ subjectId: subject.id }}
      search={computed.size > 0 ? { term: Math.min(...computed) } : {}}
      className="btn btn-outline btn-primary"
    >
      <ClipboardList className="size-4" />
      Evaluaciones
    </Link>
  );
  // Toda la materia: planilla y una hoja por lapso con evaluaciones (también si está cerrada)
  const downloadButton = (
    <DownloadButton label="Descargar Excel" download={() => downloadSubjectGrades(subject.id)} />
  );
  const actions = closed ? (
    <>
      {historyButton}
      {evaluationsLink}
      {downloadButton}
    </>
  ) : (
    <>
      {historyButton}
      {evaluationsLink}
      {downloadButton}
      <Link
        to="/teacher/imports"
        search={{ subject: subject.id }}
        className="btn btn-outline btn-primary"
      >
        Importar Excel
      </Link>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canSave}
        onClick={() => save.mutate(drafts.changes)}
      >
        {save.isPending && <span className="loading loading-spinner loading-sm" />}
        Guardar cambios{drafts.pending > 0 ? ` (${drafts.pending})` : ""}
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title={`${subject.code} · ${subject.name}`}
        description={`${settings.period_label} ${subject.semester.name}${closed ? " (cerrado)" : ""} · ${students.length} estudiantes`}
        actions={actions}
      />
      <PageBody>
        <BackLink to="/teacher/subjects" label="Mis materias" />
        <h2 className="font-bold text-xl lg:hidden">
          {subject.code} · {subject.name}
        </h2>
        {closed && (
          <ClosedPeriodNotice
            semester={subject.semester}
            message="sus notas ya no se pueden cargar, corregir ni importar. Si hace falta un cambio, pide a coordinación que lo reabra."
          />
        )}

        {students.length === 0 ? (
          <EmptyState
            title="Aún no hay estudiantes matriculados"
            description="Cuando la coordinación matricule estudiantes en la materia, aparecerán aquí."
          />
        ) : (
          <>
            <GradebookStats students={students} />
            <InvalidCellAlert invalid={drafts.invalid} settings={settings} />

            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput
                value={search.q}
                placeholder="Buscar estudiante"
                onChange={(q) =>
                  navigate({ search: (prev) => ({ ...prev, q, offset: 0 }), replace: true })
                }
              />
              <select
                className="select w-full sm:max-w-56"
                aria-label="Filtrar estudiantes"
                value={search.show}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      show: event.target.value as typeof search.show,
                      offset: 0,
                    }),
                    replace: true,
                  })
                }
              >
                {SHOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {rows.length === 0 ? (
              <EmptyState title="Ningún estudiante coincide con el filtro" />
            ) : (
              <>
                {/* Móvil: un lapso a la vez, una tarjeta por estudiante */}
                <div className="flex flex-col gap-3 lg:hidden">
                  <div
                    role="tablist"
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(terms.length, 3)}, minmax(0, 1fr))`,
                    }}
                  >
                    {terms.map((term) => (
                      <button
                        key={term}
                        type="button"
                        role="tab"
                        aria-selected={currentTerm === term}
                        className={`btn btn-sm rounded-full ${currentTerm === term ? "btn-primary" : "btn-outline btn-primary"}`}
                        onClick={() =>
                          navigate({ search: (prev) => ({ ...prev, term }), replace: true })
                        }
                      >
                        {termName(settings, term)}
                      </button>
                    ))}
                  </div>
                  {computed.has(currentTerm) && (
                    <p className="text-base-content/70 text-sm">
                      La nota del {termName(settings, currentTerm).toLowerCase()} se calcula con su
                      plan de evaluación: califícala en Evaluaciones.
                    </p>
                  )}
                  <ul className="card card-border divide-y divide-base-300 bg-base-100">
                    {rows.map((row) => (
                      <li key={row.student.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{row.student.full_name}</p>
                          <p className="text-base-content/70 text-xs">
                            {row.student.cedula_display}
                          </p>
                        </div>
                        <GradeCell
                          className="input-md w-24 shrink-0"
                          label={`${row.student.full_name} · ${termName(settings, currentTerm)}`}
                          value={drafts.text(row, currentTerm)}
                          edited={drafts.isEdited(row, currentTerm)}
                          invalid={drafts.isInvalid(row, currentTerm)}
                          onChange={(value) => drafts.set(row, currentTerm, value)}
                          disabled={closed || save.isPending || computed.has(currentTerm)}
                        />
                        <HistoryButton
                          name={row.student.full_name}
                          onClick={() => setHistory(row.student)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Escritorio: todos los lapsos configurados y la definitiva */}
                <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
                  <table className="table-zebra table">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        {terms.map((term) => (
                          <th key={term} className="w-32 min-w-28">
                            {termName(settings, term)}
                            {computed.has(term) && (
                              <span className="block font-normal text-base-content/60 text-xs">
                                Por evaluaciones
                              </span>
                            )}
                          </th>
                        ))}
                        <th className="w-32 min-w-28">Definitiva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.student.id}>
                          <td className="min-w-52">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold">{row.student.full_name}</p>
                                {row.student.cedula_display && (
                                  <p className="text-base-content/70 text-xs">
                                    {row.student.cedula_display}
                                  </p>
                                )}
                              </div>
                              <HistoryButton
                                name={row.student.full_name}
                                onClick={() => setHistory(row.student)}
                              />
                            </div>
                          </td>
                          {terms.map((term) => (
                            <td key={term}>
                              <GradeCell
                                label={`${row.student.full_name} · ${termName(settings, term)}`}
                                value={drafts.text(row, term)}
                                edited={drafts.isEdited(row, term)}
                                invalid={drafts.isInvalid(row, term)}
                                onChange={(value) => drafts.set(row, term, value)}
                                disabled={closed || save.isPending || computed.has(term)}
                              />
                            </td>
                          ))}
                          <td>
                            <FinalGrade row={row} settings={settings} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-base-content/70 text-xs">
                  {settings.summary}.{!closed && " Deja una celda vacía para borrar la nota."}
                  {computed.size > 0 &&
                    ` ${termsText(settings, [...computed].sort())}: la nota se calcula con su plan de evaluación (se califica en Evaluaciones).`}
                </p>

                {filtered.length > PAGE_SIZE && (
                  <Pagination
                    page={{ total: filtered.length, limit: PAGE_SIZE, offset }}
                    onPageChange={(next) =>
                      navigate({ search: (prev) => ({ ...prev, offset: next }), replace: true })
                    }
                  />
                )}
              </>
            )}
          </>
        )}
      </PageBody>
      {history !== undefined && (
        <GradeHistoryModal
          scope="teacher"
          subject={subject}
          student={history ?? undefined}
          onClose={() => setHistory(undefined)}
        />
      )}
    </>
  );
}

/** Abre el historial de cambios de notas de un estudiante */
function HistoryButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-square"
      aria-label={`Historial de ${name}`}
      title="Historial de notas"
      onClick={onClick}
    >
      <History className="size-4" />
    </button>
  );
}
