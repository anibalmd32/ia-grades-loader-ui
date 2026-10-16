export const PASSING_GRADE = 10;

/** 15.5 → "15.50"; null → "—" */
export function formatGrade(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}

/** Nota con color: rojo si es menor que 10, verde si aprueba */
export function GradeBadge({ value }: { value: number | null | undefined }) {
  const color =
    value == null ? "badge-ghost" : value >= PASSING_GRADE ? "badge-success" : "badge-error";
  return (
    <span className={`badge badge-soft font-semibold tabular-nums ${color}`}>
      {formatGrade(value)}
    </span>
  );
}
