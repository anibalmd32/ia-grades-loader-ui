import type { ReactNode } from "react";
import * as v from "valibot";

// Nombre y apellido por separado (la API compone `full_name` y ordena las listas por apellido)

export const firstNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Escribe el nombre."),
  v.maxLength(100, "Máximo 100 caracteres."),
);

export const lastNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Escribe el apellido."),
  v.maxLength(100, "Máximo 100 caracteres."),
);

export const FIRST_NAME_FIELD = { label: "Nombre", autoComplete: "given-name" };
export const LAST_NAME_FIELD = { label: "Apellido", autoComplete: "family-name" };

/** Nombre y apellido en una fila (en dos en móvil); cada uno es un form.AppField */
export function PersonNameRow({
  firstName,
  lastName,
}: {
  firstName: ReactNode;
  lastName: ReactNode;
}) {
  return (
    <div className="grid gap-x-3 sm:grid-cols-2">
      {firstName}
      {lastName}
    </div>
  );
}
