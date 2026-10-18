import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, Info, Link2 } from "lucide-react";
import { type DragEvent, useId, useState } from "react";
import { useAcademicSettings } from "@/api/queries/settings";
import { teacherKeys, teacherSubjectsQuery, uploadImport } from "@/api/queries/teacher";
import { FormError } from "@/components/form/form";
import { termName, termNumbers } from "@/lib/grades";

const isXlsx = (file: File) => file.name.toLowerCase().endsWith(".xlsx");

/** Subir un Excel de notas: materia, lapso opcional y archivo .xlsx */
export function UploadForm({ defaultSubject }: { defaultSubject?: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjects = useQuery(teacherSubjectsQuery);
  const settings = useAcademicSettings();
  const inputId = useId();
  const [subjectId, setSubjectId] = useState(defaultSubject ? String(defaultSubject) : "");
  // Las materias de periodos cerrados no admiten notas nuevas: no se pueden elegir
  const selected = subjects.data?.find((s) => String(s.id) === subjectId);
  const closedSubject = selected?.semester.is_closed ? selected : undefined;
  const anyClosed = subjects.data?.some((s) => s.semester.is_closed) ?? false;
  const [term, setTerm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Selecciona un archivo .xlsx.");
      return uploadImport(Number(subjectId), file, term ? Number(term) : null);
    },
    onSuccess: async (job) => {
      await queryClient.invalidateQueries({ queryKey: teacherKeys.jobs });
      await navigate({ to: "/teacher/imports/$jobId", params: { jobId: job.id } });
    },
  });

  const pick = (selected: File | undefined) => {
    upload.reset();
    if (!selected) return;
    if (!isXlsx(selected)) {
      setFile(null);
      setFileError("Solo se admiten archivos .xlsx. Si es .xls, guárdalo como .xlsx.");
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  return (
    <form
      className="card card-border bg-base-100"
      onSubmit={(event) => {
        event.preventDefault();
        upload.mutate();
      }}
    >
      <div className="card-body gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-sm">Materia</span>
            <select
              className="select w-full"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              disabled={!subjects.data}
            >
              <option value="">Selecciona una materia…</option>
              {subjects.data?.map((subject) => (
                <option key={subject.id} value={subject.id} disabled={subject.semester.is_closed}>
                  {subject.code} · {subject.name}
                  {subject.semester.is_closed
                    ? ` (${settings.period_label.toLowerCase()} cerrado)`
                    : ""}
                </option>
              ))}
            </select>
            {closedSubject ? (
              <span className="text-error text-xs" role="alert">
                {closedSubject.code} es de un {settings.period_label.toLowerCase()} cerrado: ya no
                se le pueden importar notas.
              </span>
            ) : (
              anyClosed && (
                <span className="text-base-content/60 text-xs">
                  Las materias de {settings.period_label_plural.toLowerCase()} cerrados no admiten
                  importaciones.
                </span>
              )
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-sm">{settings.term_label}</span>
            <select
              className="select w-full"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            >
              <option value="">Lo indica el archivo</option>
              {termNumbers(settings).map((t) => (
                <option key={t} value={t}>
                  {termName(settings, t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-box border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-primary/15" : "border-primary/60 bg-primary/5"
          }`}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-base-100 font-bold text-success text-xs shadow-sm">
            XLSX
          </span>
          <span className="font-bold">
            <span className="hidden lg:inline">Arrastra tu archivo aquí</span>
            <span className="lg:hidden">Toca para elegir el archivo</span>
          </span>
          <span className="text-base-content/70 text-sm">
            Solo .xlsx · No necesita un formato fijo
          </span>
          <span className="input pointer-events-none mt-1 w-full max-w-sm">
            {file ? (
              <FileSpreadsheet className="size-4 text-success" />
            ) : (
              <Link2 className="size-4 opacity-60" />
            )}
            <span className={`truncate ${file ? "font-semibold" : "text-base-content/60"}`}>
              {file ? file.name : "Seleccionar archivo"}
            </span>
          </span>
          <input
            id={inputId}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Archivo Excel"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </label>

        <FormError message={fileError ?? upload.error?.message ?? null} />

        <div role="note" className="alert alert-soft">
          <Info className="size-5 shrink-0" />
          <span>Nada se guarda hasta que revises y confirmes la previsualización.</span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!subjectId || closedSubject != null || !file || upload.isPending}
        >
          {upload.isPending && <span className="loading loading-spinner loading-sm" />}
          Subir y procesar
        </button>
      </div>
    </form>
  );
}
