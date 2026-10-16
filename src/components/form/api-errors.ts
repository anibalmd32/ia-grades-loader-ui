import { isApiError } from "@/api/errors";

type FieldMeta = { errorMap: object };

// Lo mínimo que se usa del FormApi de TanStack Form (el tipo de meta se infiere del formulario)
type FormWithFieldMeta<M extends FieldMeta> = {
  setFieldMeta: (field: never, updater: (meta: M) => M) => void;
};

/**
 * Pone en cada campo los errores 422 de la API (detail[].loc → nombre del campo).
 * Devuelve el mensaje general para mostrar arriba del formulario, o null si todo
 * quedó asignado a campos.
 */
export function applyApiErrors<M extends FieldMeta>(
  form: FormWithFieldMeta<M>,
  error: unknown,
): string | null {
  if (!isApiError(error)) return "Ocurrió un error inesperado.";
  const entries = Object.entries(error.fieldErrors);
  if (error.status !== 422 || entries.length === 0) return error.message;

  let unassigned = false;
  for (const [name, message] of entries) {
    if (name === "_") {
      unassigned = true;
      continue;
    }
    form.setFieldMeta(name as never, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onSubmit: message },
    }));
  }
  return unassigned ? error.message : null;
}
