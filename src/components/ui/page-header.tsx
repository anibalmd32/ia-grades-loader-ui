import type { ReactNode } from "react";

/**
 * Cabecera de página. En escritorio muestra título, descripción y acciones; en móvil el
 * título va en la barra superior (staticData de la ruta) y las acciones ocupan todo el ancho.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <header className="hidden flex-wrap items-center justify-between gap-4 border-base-300 border-b bg-base-100 px-8 py-5 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate font-bold text-2xl">{title}</h1>
          {description && <p className="text-base-content/70 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      {actions && <div className="flex flex-col gap-2 px-4 pt-4 *:w-full lg:hidden">{actions}</div>}
    </>
  );
}

const WIDTH = {
  form: "max-w-xl", // formularios cortos (altas)
  medium: "max-w-3xl", // formularios largos y listas de una columna
  wide: "max-w-4xl", // rejillas de dos columnas (Mi cuenta)
} as const;

/**
 * Contenido de una página con el margen del diseño. Con `width`, el contenido se limita a ese
 * ancho y se centra: en escritorio no queda pegado a la izquierda con un hueco a la derecha;
 * en móvil no cambia nada (ya ocupa todo el ancho).
 */
export function PageBody({ children, width }: { children: ReactNode; width?: keyof typeof WIDTH }) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      {width ? (
        <div className={`mx-auto flex w-full flex-col gap-4 ${WIDTH[width]}`}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
