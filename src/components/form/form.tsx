import { createFormHook, createFormHookContexts, useStore } from "@tanstack/react-form";
import { type ComponentProps, type ReactNode, useState } from "react";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

/** Mensajes de error del campo: issues de Valibot (Standard Schema) o textos de la API */
function errorMessages(errors: unknown[]): string[] {
  return errors
    .map((error) =>
      typeof error === "string" ? error : (error as { message?: string } | null)?.message,
    )
    .filter((message): message is string => Boolean(message));
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const field = useFieldContext<unknown>();
  const errors = useStore(field.store, (state) => errorMessages(state.meta.errors));
  const touched = useStore(field.store, (state) => state.meta.isTouched);
  const error = touched || field.form.state.submissionAttempts > 0 ? errors[0] : undefined;

  return (
    <div className="fieldset">
      <label htmlFor={field.name} className="fieldset-legend text-sm">
        {label}
      </label>
      {children}
      {error ? (
        <p className="label text-error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="label">{hint}</p>
      )}
    </div>
  );
}

type InputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "name">;

/**
 * Campo de texto. Si es de contraseña (`type="password"`), debajo lleva la casilla
 * "Mostrar contraseña" (desmarcada por defecto) para ver lo que se escribe.
 */
export function TextField({
  label,
  hint,
  type,
  ...props
}: { label: string; hint?: string } & InputProps) {
  const field = useFieldContext<string>();
  const invalid = useStore(field.store, (state) => state.meta.errors.length > 0);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <FieldShell label={label} hint={hint}>
      <input
        {...props}
        type={isPassword && showPassword ? "text" : type}
        id={field.name}
        name={field.name}
        className={`input w-full ${invalid ? "input-error" : ""}`}
        value={field.state.value ?? ""}
        aria-invalid={invalid}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {isPassword && (
        <label className="label mt-1 cursor-pointer gap-2 text-base-content/80">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Mostrar contraseña
        </label>
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  options,
  ...props
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
} & Omit<ComponentProps<"select">, "value" | "onChange" | "onBlur" | "name">) {
  const field = useFieldContext<string>();
  return (
    <FieldShell label={label} hint={hint}>
      <select
        {...props}
        id={field.name}
        name={field.name}
        className="select w-full"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SubmitButton({ label, className = "" }: { label: string; className?: string }) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <button type="submit" className={`btn btn-primary ${className}`} disabled={isSubmitting}>
      {isSubmitting && <span className="loading loading-spinner loading-sm" />}
      {label}
    </button>
  );
}

/** Formulario con los campos del proyecto: form.AppField → field.TextField, etc. */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField },
  formComponents: { SubmitButton },
});

/** Error general del formulario (no ligado a un campo) */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="alert alert-error alert-soft">
      <span>{message}</span>
    </div>
  );
}
