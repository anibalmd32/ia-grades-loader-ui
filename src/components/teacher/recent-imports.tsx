import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  type ImportJobSummary,
  importJobsQuery,
  teacherSubjectsQuery,
} from "@/api/queries/teacher";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { timeAgo } from "@/lib/dates";
import { type ImportReview, useImportReviews } from "@/stores/import-reviews";

type Badge = { label: string; className: string };

/**
 * Estado para mostrar: el de la API (incluida la confirmación, `confirmed_at`) más si se
 * descartó en este dispositivo (descartar no llega a la API).
 */
export function jobBadge(job: ImportJobSummary, review: ImportReview | undefined): Badge {
  switch (job.status) {
    case "pending":
      return { label: "En cola", className: "badge-warning" };
    case "processing":
      return { label: "Procesando", className: "badge-info" };
    case "failed":
      return { label: "Falló", className: "badge-error" };
    case "done":
      if (job.confirmed_at) return { label: "Confirmada", className: "badge-neutral" };
      if (review === "discarded") return { label: "Descartada", className: "badge-ghost" };
      return { label: "Lista para revisar", className: "badge-success" };
  }
}

/** Historial de importaciones del profesor; se actualiza solo mientras alguna esté en curso */
export function RecentImports() {
  const jobs = useQuery(importJobsQuery);
  const subjects = useQuery(teacherSubjectsQuery);
  const reviews = useImportReviews((s) => s.reviews);
  const codeOf = (id: number) => subjects.data?.find((s) => s.id === id)?.code ?? "";

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title">Importaciones recientes</h2>
          <p className="text-base-content/70 text-sm">
            Se procesan en segundo plano: puedes seguir usando la app.
          </p>
        </div>
        {jobs.error ? (
          <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
        ) : !jobs.data ? (
          <LoadingState rows={3} />
        ) : jobs.data.length === 0 ? (
          <EmptyState
            title="Aún no has importado archivos"
            description="Los Excel que subas aparecerán aquí."
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {jobs.data.map((job) => {
              const badge = jobBadge(job, reviews[job.id]);
              const attempts =
                job.attempts > 1
                  ? `${job.attempts} intentos`
                  : job.attempts === 1
                    ? "1 intento"
                    : "";
              const detail = [codeOf(job.subject_id), timeAgo(job.created_at), attempts, job.error]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={job.id}>
                  <Link
                    to="/teacher/imports/$jobId"
                    params={{ jobId: job.id }}
                    className="flex flex-col gap-2 rounded-box p-2 hover:bg-base-200"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-sm">{job.file_name}</p>
                        <p
                          className="truncate text-base-content/70 text-xs"
                          title={new Date(job.created_at).toLocaleString("es")}
                        >
                          {detail}
                        </p>
                      </div>
                      <span
                        className={`badge badge-soft badge-sm shrink-0 font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <ChevronRight className="size-4 shrink-0 opacity-40" />
                    </div>
                    {job.status === "processing" && (
                      <progress
                        className="progress progress-primary h-1.5"
                        aria-label={`Procesando ${job.file_name}`}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
