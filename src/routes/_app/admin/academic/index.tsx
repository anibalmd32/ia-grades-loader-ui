import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import * as v from "valibot";
import { semestersQuery, subjectsQuery } from "@/api/queries/admin";
import { type AcademicSettings, useAcademicSettings } from "@/api/queries/settings";
import { SemestersPanel } from "@/components/admin/semesters-panel";
import { ClosedBadge, ClosedPeriodNotice } from "@/components/ui/closed-period";
import { DataTable } from "@/components/ui/data-table";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/states";

const title = (settings: AcademicSettings) => `${settings.period_label_plural} y materias`;
const description = (settings: AcademicSettings) =>
  `Cada materia pertenece a un único ${settings.period_label.toLowerCase()}.`;

export const Route = createFileRoute("/_app/admin/academic/")({
  validateSearch: v.object({
    semester: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
    q: v.optional(v.fallback(v.string(), ""), ""),
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ q: "", offset: 0 })] },
  staticData: { title, description },
  component: AcademicPage,
});

function AcademicPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const semesters = useQuery(semestersQuery);
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  // Sin semestre en la URL se muestra el primero
  const semester = semesters.data?.find((s) => s.id === search.semester) ?? semesters.data?.[0];
  const subjects = useQuery({
    ...subjectsQuery({ semester_id: semester?.id, q: search.q, offset: search.offset }),
    enabled: semester !== undefined,
  });

  const newSubject = (
    <Link
      to="/admin/academic/new"
      search={semester && !semester.is_closed ? { semester: semester.id } : {}}
      className="btn btn-primary"
    >
      <Plus className="size-4" />
      Nueva materia
    </Link>
  );

  return (
    <>
      <PageHeader
        title={title(settings)}
        description={description(settings)}
        actions={newSubject}
      />
      <PageBody>
        <div className="grid items-start gap-4 lg:grid-cols-[18rem_1fr]">
          <SemestersPanel
            selectedId={semester?.id}
            onSelect={(id) => navigate({ search: { semester: id, q: "", offset: 0 } })}
          />
          <section className="card card-border bg-base-100">
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="card-title">
                    Materias{semester ? ` · ${semester.name}` : ""}
                    {semester?.is_closed && <ClosedBadge />}
                  </h2>
                  {subjects.data && (
                    <p className="text-base-content/70 text-sm">{subjects.data.total} materias</p>
                  )}
                </div>
                <SearchInput
                  value={search.q}
                  placeholder="Buscar materia"
                  onChange={(q) => navigate({ search: (prev) => ({ ...prev, q, offset: 0 }) })}
                />
              </div>
              {semester?.is_closed && (
                <ClosedPeriodNotice
                  semester={semester}
                  message="sus notas, matrículas y materias solo se pueden consultar. Reábrelo para hacer cambios."
                />
              )}
              {!semester && semesters.data ? (
                <EmptyState
                  title={`Aún no hay ${settings.period_label_plural.toLowerCase()}`}
                  description={`Crea un ${period} para poder añadir materias.`}
                />
              ) : (
                <DataTable
                  rows={subjects.data?.items}
                  isLoading={subjects.isPending}
                  error={subjects.error}
                  onRetry={() => subjects.refetch()}
                  rowKey={(s) => s.id}
                  emptyTitle={
                    search.q
                      ? "Sin resultados para la búsqueda"
                      : `Este ${period} no tiene materias`
                  }
                  page={subjects.data}
                  onPageChange={(offset) => navigate({ search: (prev) => ({ ...prev, offset }) })}
                  onRowClick={(s) =>
                    navigate({
                      to: "/admin/academic/subjects/$subjectId",
                      params: { subjectId: s.id },
                    })
                  }
                  columns={[
                    {
                      header: "Código",
                      cell: (s) => <span className="font-medium">{s.code}</span>,
                    },
                    { header: "Materia", cell: (s) => s.name },
                    {
                      header: "Profesores",
                      cell: (s) => <TeachersCount count={s.teachers_count} />,
                    },
                    { header: "Estudiantes", cell: (s) => s.students_count ?? "" },
                    {
                      header: "Acciones",
                      cell: (s) => (
                        <Link
                          to="/admin/academic/subjects/$subjectId"
                          params={{ subjectId: s.id }}
                          className="link link-primary font-bold no-underline"
                        >
                          Ver detalle
                        </Link>
                      ),
                    },
                  ]}
                  renderCard={(s) => (
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {s.code} · {s.name}
                      </p>
                      <p className="text-base-content/70 text-sm">
                        <TeachersCount count={s.teachers_count} />
                        {s.students_count != null &&
                          ` · ${s.students_count} ${s.students_count === 1 ? "estudiante" : "estudiantes"}`}
                      </p>
                    </div>
                  )}
                />
              )}
            </div>
          </section>
        </div>
      </PageBody>
    </>
  );
}

/** Profesores asignados a la materia; sin ninguno se destaca como pendiente */
function TeachersCount({ count }: { count: number | null | undefined }) {
  if (count == null) return null;
  if (count === 0) return <span className="font-semibold text-warning">Sin asignar</span>;
  return <>{count === 1 ? "1 profesor" : `${count} profesores`}</>;
}
