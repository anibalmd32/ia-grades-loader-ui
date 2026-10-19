import { Lock } from "lucide-react";
import type { SemesterRead } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";

/**
 * Etiqueta "Cerrado" de un periodo cuyas notas, matrículas y materias ya no se modifican.
 * Con colores de base-content (no `neutral`, que en el tema oscuro es más oscuro que las
 * tarjetas y casi no se ve) y sin encogerse ni partirse en filas estrechas.
 */
export function ClosedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`badge badge-sm shrink-0 gap-1 whitespace-nowrap border-base-content/25 bg-base-content/10 font-semibold text-base-content/80 ${className}`}
    >
      <Lock className="size-3" />
      Cerrado
    </span>
  );
}

/** Aviso de periodo cerrado: "El semestre 2025-II está cerrado: …" */
export function ClosedPeriodNotice({
  semester,
  message,
}: {
  semester: Pick<SemesterRead, "name">;
  message: string;
}) {
  const settings = useAcademicSettings();
  return (
    <div role="note" className="alert alert-info alert-soft">
      <Lock className="size-5 shrink-0" />
      <span>
        El {settings.period_label.toLowerCase()} {semester.name} está cerrado: {message}
      </span>
    </div>
  );
}
