import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "./states";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

/** Página de resultados de la API: Page{items,total,limit,offset} */
export type PageInfo = { total: number; limit: number; offset: number };

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  /** Tarjeta para móvil (en escritorio se usa la tabla) */
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: PageInfo;
  onPageChange?: (offset: number) => void;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  renderCard,
  onRowClick,
  isLoading,
  error,
  onRetry,
  emptyTitle = "No hay resultados",
  emptyDescription,
  page,
  onPageChange,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading || !rows) return <LoadingState />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-4">
      {page && (
        <p className="font-semibold text-base-content/70 text-sm lg:hidden">{rangeText(page)}</p>
      )}

      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button
                type="button"
                className="card card-border w-full bg-base-100 text-left"
                onClick={() => onRowClick(row)}
              >
                <div className="card-body flex-row items-center gap-2 p-4">
                  <div className="min-w-0 flex-1">{renderCard(row)}</div>
                  <ChevronRight className="size-4 shrink-0 opacity-50" />
                </div>
              </button>
            ) : (
              <div className="card card-border bg-base-100">
                <div className="card-body p-4">{renderCard(row)}</div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
        <table className="table-zebra table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.header} className={column.className}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} className={column.className}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && onPageChange && <Pagination page={page} onPageChange={onPageChange} />}
    </div>
  );
}

function rangeText({ total, limit, offset }: PageInfo): string {
  if (total === 0) return "Sin resultados";
  return `Mostrando ${offset + 1}–${Math.min(offset + limit, total)} de ${total}`;
}

/** Paginación del servidor (limit/offset) */
export function Pagination({
  page,
  onPageChange,
}: {
  page: PageInfo;
  onPageChange: (offset: number) => void;
}) {
  const { total, limit, offset } = page;
  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.floor(offset / limit) + 1;
  // Ventana de hasta 5 páginas alrededor de la actual
  const first = Math.max(1, Math.min(current - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Paginación">
      <p className="hidden text-base-content/70 text-sm lg:block">{rangeText(page)}</p>
      <div className="join">
        <button
          type="button"
          className="btn join-item"
          disabled={current <= 1}
          onClick={() => onPageChange(offset - limit)}
        >
          Anterior
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`btn join-item ${n === current ? "btn-primary" : ""}`}
            aria-current={n === current ? "page" : undefined}
            onClick={() => onPageChange((n - 1) * limit)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="btn join-item"
          disabled={current >= pages}
          onClick={() => onPageChange(offset + limit)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}
