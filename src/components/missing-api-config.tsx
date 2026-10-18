import { CircleAlert } from "lucide-react";

/** Se muestra si el build no trae la URL de la API (en lugar de una pantalla en blanco) */
export function MissingApiConfig() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div role="alert" className="alert alert-error alert-soft max-w-md">
        <CircleAlert className="size-5 shrink-0" />
        <div>
          <h1 className="font-bold">Falta configurar la API</h1>
          <p className="text-sm">
            Esta versión de la app no sabe a qué servidor conectarse. Descarga la última versión o
            avisa al responsable del sistema.
          </p>
        </div>
      </div>
    </main>
  );
}
