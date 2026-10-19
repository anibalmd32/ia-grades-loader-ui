const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const dayFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/** "Hoy", "Ayer" o "12 oct" (para listas como las conversaciones) */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return dayFormat.format(date).replace(".", "");
}

/** "hace 1 minuto", "ayer", "hace 3 días"; menos de un minuto = "ahora" */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "ahora";
}

/** Fecha sin hora de la API: "2026-11-02" → "2 nov" (se lee en la zona local, sin desfase) */
export function dueDateText(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return dayFormat.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)).replace(".", "");
}
