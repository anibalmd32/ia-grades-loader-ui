import { type ReactNode, useEffect } from "react";
import * as v from "valibot";
import { type AcademicSettings, useAcademicSettings } from "@/api/queries/settings";

// El documento con que entran los estudiantes ("Cédula", "DNI"…) y sus tipos (V, E, P…) los
// configura el super admin; la API rechaza (422) un tipo que no esté configurado.

/** Tipo de documento: uno de los configurados (la API lo vuelve a comprobar) */
export const nationalitySchema = v.pipe(v.string(), v.minLength(1, "Elige el tipo."));

/** Número del documento: solo dígitos */
export const cedulaSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{1,9}$/, "Escribe solo números, sin puntos ni letras."),
);

/** "V = venezolano · E = extranjero" */
export function documentTypesText(settings: Pick<AcademicSettings, "document_types">): string {
  return settings.document_types.map((t) => `${t.code} = ${t.name.toLowerCase()}`).join(" · ");
}

/** Props del selector de tipo y del número, con el nombre del documento configurado */
export function useDocumentFields() {
  const settings = useAcademicSettings();
  const label = settings.document_label;
  const lower = documentNoun(label);
  return {
    label,
    codes: settings.document_types.map((t) => t.code),
    nationality: {
      label,
      "aria-label": `Tipo de ${lower}`,
      options: settings.document_types.map((t) => ({ value: t.code, label: t.code })),
    },
    cedula: {
      label: " ",
      "aria-label": `Número de ${lower}`,
      inputMode: "numeric" as const,
      placeholder: "Número, sin letras ni puntos",
    },
    hint: documentTypesText(settings),
  };
}

/**
 * Si el tipo elegido no está entre los configurados (p. ej. el valor por defecto antes de que
 * llegue la configuración), se pasa al primero.
 */
export function useValidDocumentType(
  value: string,
  codes: string[],
  onChange: (code: string) => void,
) {
  const first = codes[0];
  const valid = codes.includes(value);
  useEffect(() => {
    if (!valid && first) onChange(first);
  }, [valid, first, onChange]);
}

/** Fila del documento: selector de tipo + número (cada uno es un form.AppField) y su ayuda */
export function DocumentRow({
  nationality,
  cedula,
  hint,
}: {
  nationality: ReactNode;
  cedula: ReactNode;
  hint?: string;
}) {
  const settings = useAcademicSettings();
  const [a, b] = settings.document_types;
  return (
    <>
      {/* items-start: alineados por arriba, para que el mensaje de error de un campo no
          desplace al otro (con items-end el campo con error subía) */}
      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
        {nationality}
        {cedula}
      </div>
      <p className="-mt-1 text-base-content/60 text-xs">
        {hint ?? documentTypesText(settings)}
        {hint === undefined && a && b && `. ${a.code}-123 y ${b.code}-123 son personas distintas.`}
      </p>
    </>
  );
}

/** Nombre del documento dentro de una frase: "cédula", pero las siglas igual ("DNI") */
export function documentNoun(label: string): string {
  return /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(label) ? label : label.toLowerCase();
}
