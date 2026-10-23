import { type AcademicSettings, useAcademicSettings } from "@/api/queries/settings";
import { ABSENT_LABEL, ABSENT_SHORT, formatGrade, isPassing } from "@/lib/grades";

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

/**
 * Inasistencia (no se presentó): cuenta con la nota mínima, que se indica al pasar el ratón.
 * `short` muestra solo "I" (celdas estrechas de las planillas). `rules`: las del periodo de la
 * materia (`useSubjectRules`); por defecto, la configuración vigente.
 */
export function AbsentBadge({
  short = false,
  rules,
}: {
  short?: boolean;
  rules?: Pick<AcademicSettings, "min_grade" | "grade_decimals">;
}) {
  const current = useAcademicSettings();
  const settings = rules ?? current;
  return (
    <span
      className="badge badge-soft badge-warning font-semibold"
      title={`${ABSENT_LABEL}: cuenta como ${formatGrade(settings.min_grade, settings)}`}
    >
      {short ? ABSENT_SHORT : ABSENT_LABEL}
    </span>
  );
}
