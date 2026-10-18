import { useAcademicSettings } from "@/api/queries/settings";
import { formatGrade, isPassing } from "@/lib/grades";

export { formatGrade };

/** Nota con color: rojo si no llega a la aprobatoria configurada, verde si la alcanza */
export function GradeBadge({ value }: { value: number | null | undefined }) {
  const settings = useAcademicSettings();
  const color =
    value == null ? "badge-ghost" : isPassing(value, settings) ? "badge-success" : "badge-error";
  return (
    <span className={`badge badge-soft font-semibold tabular-nums ${color}`}>
      {formatGrade(value, settings)}
    </span>
  );
}
