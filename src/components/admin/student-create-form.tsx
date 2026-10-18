import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as v from "valibot";
import {
  adminKeys,
  allSubjectsQuery,
  createStudent,
  enrollStudentInSubjects,
  groupBySemester,
  subjectLabel,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import {
  cedulaSchema,
  DocumentRow,
  nationalitySchema,
  useDocumentFields,
  useValidDocumentType,
} from "@/components/form/document-fields";
import { FormError, useAppForm } from "@/components/form/form";
import {
  FIRST_NAME_FIELD,
  firstNameSchema,
  LAST_NAME_FIELD,
  lastNameSchema,
  PersonNameRow,
} from "@/components/form/person-name";
import { toast } from "@/components/ui/toast";
import { GeneratedPasswordNotice } from "./accounts";
import { showGeneratedPassword } from "./generated-password";

const StudentSchema = v.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  nationality: nationalitySchema,
  cedula: cedulaSchema,
});

/** Alta de estudiante (nombre, tipo y número de documento) con matrícula opcional en materias */
export function StudentCreateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjects = useQuery(allSubjectsQuery);
  const settings = useAcademicSettings();
  const documentFields = useDocumentFields();
  const [subjectIds, setSubjectIds] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const form = useAppForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      nationality: documentFields.codes[0] ?? "",
      cedula: "",
    },
    validators: { onSubmit: StudentSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      let created: Awaited<ReturnType<typeof createStudent>>;
      try {
        created = await createStudent({
          first_name: value.first_name.trim(),
          last_name: value.last_name.trim(),
          nationality: value.nationality,
          cedula: Number(value.cedula.trim()),
        });
      } catch (error) {
        setFormError(applyApiErrors(form, error));
        return;
      }

      const { user, generated_password } = created;
      if (subjectIds.size > 0) {
        try {
          await enrollStudentInSubjects(user.id, [...subjectIds]);
        } catch (error) {
          toast.error(
            `El estudiante se creó, pero no se pudo matricular: ${(error as Error).message}`,
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.users("students") });
      showGeneratedPassword({
        message: "Estudiante creado correctamente.",
        account: `${user.full_name} · ${settings.document_label} ${user.cedula_display}`,
        password: generated_password,
      });
      await navigate({ to: "/admin/students" });
    },
  });
  const nationality = useStore(form.store, (state) => state.values.nationality);
  useValidDocumentType(nationality, documentFields.codes, (code) =>
    form.setFieldValue("nationality", code),
  );

  return (
    <form
      noValidate
      className="card card-border w-full max-w-xl bg-base-100"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="card-body gap-2">
        <FormError message={formError} />
        <PersonNameRow
          firstName={
            <form.AppField name="first_name">
              {(field) => <field.TextField {...FIRST_NAME_FIELD} placeholder="Ej. María" />}
            </form.AppField>
          }
          lastName={
            <form.AppField name="last_name">
              {(field) => <field.TextField {...LAST_NAME_FIELD} placeholder="Ej. Pérez" />}
            </form.AppField>
          }
        />
        <DocumentRow
          nationality={
            <form.AppField name="nationality">
              {(field) => <field.SelectField {...documentFields.nationality} />}
            </form.AppField>
          }
          cedula={
            <form.AppField name="cedula">
              {(field) => <field.TextField {...documentFields.cedula} />}
            </form.AppField>
          }
        />

        {subjects.data && subjects.data.items.length > 0 && (
          <fieldset className="mt-2 flex flex-col gap-3">
            <legend className="mb-2 font-semibold text-sm">
              Matricular en materias (opcional)
            </legend>
            {groupBySemester(subjects.data.items).map(({ semester, subjects: list }) => (
              <div key={semester.id} className="flex flex-col gap-2">
                <p className="text-base-content/60 text-xs">
                  {settings.period_label} {semester.name}
                  {semester.is_closed && " · cerrado: no admite matrículas"}
                </p>
                {list.map((subject) => (
                  <label
                    key={subject.id}
                    className={`flex items-center gap-3 ${semester.is_closed ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      disabled={semester.is_closed}
                      checked={subjectIds.has(subject.id)}
                      onChange={() => toggle(subject.id)}
                    />
                    <span>{subjectLabel(subject)}</span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>
        )}

        <GeneratedPasswordNotice />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/admin/students" className="btn btn-outline btn-primary">
            Cancelar
          </Link>
          <form.AppForm>
            <form.SubmitButton label="Crear estudiante" />
          </form.AppForm>
        </div>
      </div>
    </form>
  );
}
