import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { type ImportJobRead, importJobQuery, teacherSubjectsQuery } from "@/api/queries/teacher";
import { BackLink } from "@/components/admin/common";
import { ImportReview } from "@/components/teacher/import-review";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_app/teacher/imports/$jobId")({
  staticData: { title: "Importación", description: "La IA te propone cada nota" },
  component: ImportJobPage,
});

function ImportJobPage() {
  const { jobId } = Route.useParams();
  const job = useQuery(importJobQuery(jobId));

  if (job.data?.status === "done" && job.data.result) {
    return <ImportReview job={job.data} preview={job.data.result} />;
  }

  return (
    <>
      <PageHeader title="Importación" description={job.data?.file_name} />
      <PageBody>
        <BackLink to="/teacher/imports" label="Importaciones" />
        {job.error && !job.data ? (
          <ErrorState error={job.error} onRetry={() => job.refetch()} />
        ) : !job.data ? (
          <LoadingState rows={2} />
        ) : job.data.status === "failed" || job.data.status === "done" ? (
          // "done" sin resultado no debería pasar; se trata como fallo para no quedarse esperando
          <FailedJob job={job.data} />
        ) : (
          <>
            {job.error && (
              <div role="alert" className="alert alert-warning alert-soft">
                <CircleAlert className="size-5 shrink-0" />
                <span>
                  No se pudo actualizar el estado. Se volverá a intentar en unos segundos.
                </span>
              </div>
            )}
            <JobProgress job={job.data} />
          </>
        )}
      </PageBody>
    </>
  );
}

function useSubjectLabel(job: ImportJobRead) {
  const subjects = useQuery(teacherSubjectsQuery);
  const subject = subjects.data?.find(
    (s) => s.id === job.subject_id && s.section.id === job.section_id,
  );
  return subject ? `${subject.code} · ${subject.name} · Sección ${subject.section.name}` : null;
}

/** En cola o procesando: la página se actualiza sola */
function JobProgress({ job }: { job: ImportJobRead }) {
  const subject = useSubjectLabel(job);
  const processing = job.status === "processing";
  return (
    <section className="card card-border bg-base-100" aria-live="polite">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="card-title truncate">{job.file_name}</h2>
            {subject && <p className="text-base-content/70 text-sm">{subject}</p>}
          </div>
          <span className={`badge badge-soft ${processing ? "badge-info" : "badge-warning"}`}>
            {processing ? "Procesando" : "En cola"}
          </span>
        </div>
        <progress className="progress progress-primary" aria-label="Progreso de la importación" />
        <ul className="steps steps-vertical sm:steps-horizontal">
          <li className="step step-primary">Archivo subido</li>
          <li className={`step ${processing ? "step-primary" : ""}`}>La IA lee el Excel</li>
          <li className="step">Revisa y confirma</li>
        </ul>
        <p className="text-base-content/70 text-sm">
          {processing
            ? "La IA está leyendo el archivo. Puede tardar un poco si es grande."
            : "Tu archivo está en cola y empezará a procesarse en breve."}{" "}
          Puedes seguir usando la app: la encontrarás en Importaciones.
        </p>
      </div>
    </section>
  );
}

function FailedJob({ job }: { job: ImportJobRead }) {
  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title truncate">{job.file_name}</h2>
        <div role="alert" className="alert alert-error alert-soft">
          <CircleAlert className="size-5 shrink-0" />
          <span>{job.error ?? "No se pudo procesar el archivo."}</span>
        </div>
        <p className="text-base-content/70 text-sm">
          Revisa el archivo (que sea .xlsx y que tenga las notas de la materia) y vuelve a subirlo.
        </p>
        <Link
          to="/teacher/imports"
          search={{ subject: job.subject_id, section: job.section_id }}
          className="btn btn-primary w-fit"
        >
          Volver a intentar
        </Link>
      </div>
    </section>
  );
}
