import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { isApiError } from "@/api/errors";

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Cargando">
      {SKELETON_ROWS.slice(0, rows).map((key) => (
        <div key={key} className="skeleton h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-box border border-base-300 border-dashed bg-base-100 p-10 text-center">
      <Inbox className="size-8 text-base-content/40" />
      <p className="font-semibold">{title}</p>
      {description && <p className="text-base-content/70 text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return (
    <div role="alert" className="alert alert-error alert-soft">
      <CircleAlert className="size-5 shrink-0" />
      {/* min-w-0 + wrap-anywhere: un mensaje largo sin espacios (p. ej. una URL) no empuja el
          botón fuera del aviso */}
      <div className="flex min-w-0 flex-col">
        <span className="wrap-anywhere">{message}</span>
        {isApiError(error) && error.requestId && error.status >= 500 && (
          <span className="text-xs opacity-70">Código: {error.requestId}</span>
        )}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm shrink-0" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
