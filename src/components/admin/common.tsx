import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/** "‹ Profesores": vuelve a la pantalla anterior de la sección */
export function BackLink({ label, ...link }: { label: string } & Pick<LinkProps, "to" | "search">) {
  return (
    <Link
      {...link}
      className="link link-primary inline-flex w-fit items-center gap-1 font-bold text-sm no-underline"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge badge-soft ${active ? "badge-success" : "badge-error"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/** Filtro de estado de las listas de cuentas */
export type StatusFilter = "active" | "inactive" | "all";

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Estado: Activos" },
  { value: "inactive", label: "Estado: Inactivos" },
  { value: "all", label: "Estado: Todos" },
];

export function statusToParam(status: StatusFilter): boolean | undefined {
  return status === "all" ? undefined : status === "active";
}

/** Tarjeta blanca con título, usada en los detalles */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title">{title}</h2>
            {description && <p className="text-base-content/70 text-sm">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </section>
  );
}
