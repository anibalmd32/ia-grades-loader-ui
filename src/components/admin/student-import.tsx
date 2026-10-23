import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Info, Link2, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import {
  adminKeys,
  downloadStudentTemplate,
  importStudents,
  type StudentImportResult,
  type StudentImportRow,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { FormError } from "@/components/form/form";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast";
import { saveFile, toCsv } from "@/lib/download";

const isXlsx = (file: File) => file.name.toLowerCase().endsWith(".xlsx");

type Status = StudentImportRow["status"];

const STATUS_LABEL: Record<Status, string> = {
  new: "Nuevo",
  existing: "Ya existe",
  error: "Error",
};
const STATUS_CLASS: Record<Status, string> = {
  new: "badge-success",
  existing: "badge-info",
  error: "badge-error",
};

/** "V-28456123" (o lo que se pudo leer de la fila) */
function documentText(row: StudentImportRow): string {
  if (row.user?.cedula_display) return row.user.cedula_display;
  if (row.cedula == null) return "—";
  return row.nationality ? `${row.nationality}-${row.cedula}` : String(row.cedula);
}

const fullName = (row: StudentImportRow) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto del botón que confirma la importación */
function confirmLabel({ summary }: StudentImportResult): string {
  if (summary.new > 0) return `Crear ${plural(summary.new, "estudiante", "estudiantes")}`;
  if (summary.existing > 0) {
    return `Matricular ${plural(summary.existing, "estudiante existente", "estudiantes existentes")}`;
  }
  return "Crear estudiantes";
}

/**
 * Alta masiva de estudiantes desde Excel: primero se revisa el archivo (dry_run) y luego se
 * crean las cuentas; las contraseñas generadas se muestran una sola vez.
 */
export function StudentImport() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StudentImportResult | null>(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);

  const review = useMutation({
    mutationFn: (selected: File) => importStudents(selected, true),
    onSuccess: setPreview,
  });

  const create = useMutation({
    mutationFn: (selected: File) => importStudents(selected, false),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: adminKeys.users("students") });
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
    },
    onError: (error) => toast.error(error.message),
  });

  const restart = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    review.reset();
    create.reset();
  };

  const pick = (selected: File | undefined) => {
    review.reset();
    setPreview(null);
    if (!selected) return;
    if (!isXlsx(selected)) {
      setFile(null);
      setFileError("Solo se admiten archivos .xlsx. Si es .xls, guárdalo como .xlsx.");
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  if (result) return <ImportDone result={result} onRestart={restart} />;
  if (preview && file) {
    return (
      <ImportPreview
        preview={preview}
        fileName={file.name}
        creating={create.isPending}
        onConfirm={() => create.mutate(file)}
        onRestart={restart}
      />
    );
  }
  return (
    <UploadStep
      file={file}
      error={fileError ?? review.error?.message ?? null}
      reviewing={review.isPending}
      onPick={pick}
      onSubmit={() => file && review.mutate(file)}
    />
  );
}

/** Paso 1: explicación de las columnas, plantilla y archivo */
function UploadStep({
  file,
  error,
  reviewing,
  onPick,
  onSubmit,
}: {
  file: File | null;
  error: string | null;
  reviewing: boolean;
  onPick: (file: File | undefined) => void;
  onSubmit: () => void;
}) {
  const settings = useAcademicSettings();
  const inputId = useId();
  const template = useMutation({
    mutationFn: downloadStudentTemplate,
    onSuccess: (blob) => saveFile(blob, "plantilla-estudiantes.xlsx"),
    onError: (err) => toast.error(err.message),
  });
  const types = settings.document_types.map((t) => `${t.code} (${t.name.toLowerCase()})`);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        className="card card-border bg-base-100"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="card-body gap-4">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-box border-2 border-primary/60 border-dashed bg-primary/5 p-8 text-center"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-base-100 font-bold text-success text-xs shadow-sm">
              XLSX
            </span>
            <span className="font-bold">Elige el archivo con los estudiantes</span>
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
              onChange={(event) => onPick(event.target.files?.[0])}
            />
          </label>
          <FormError message={error} />
          <div role="note" className="alert alert-soft">
            <Info className="size-5 shrink-0" />
            <span>
              Primero verás qué pasará con cada fila. No se crea nada hasta que confirmes.
            </span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!file || reviewing}>
            {reviewing && <span className="loading loading-spinner loading-sm" />}
            Revisar archivo
          </button>
        </div>
      </form>

      <section className="card card-border bg-base-100">
        <div className="card-body gap-3 text-sm">
          <h2 className="card-title text-base">Columnas del Excel</h2>
          <p className="text-base-content/70">
            Se leen de la primera hoja, por el encabezado (el orden da igual):
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Nombre</strong> y <strong>Apellido</strong>, o una sola columna{" "}
              <strong>Nombre completo</strong>.
            </li>
            <li>
              <strong>Tipo</strong> (opcional): {types.join(", ")}.
            </li>
            <li>
              <strong>{settings.document_label}</strong> (o «Documento»): solo el número, sin letras
              ni puntos.
            </li>
            <li>
              <strong>Materias</strong> (opcional): códigos separados por comas, p. ej.{" "}
              <em>MAT-101, FIS-101</em>.
            </li>
            <li>
              <strong>Sección</strong> (opcional): p. ej. <em>A</em>. Se le asigna en el{" "}
              {settings.period_label.toLowerCase()} de sus materias; hace falta para matricularlo si
              aún no tiene sección en ese {settings.period_label.toLowerCase()}.
            </li>
          </ul>
          <p className="text-base-content/70">
            Los estudiantes que ya existen no se duplican: solo se matriculan en las materias
            indicadas.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-primary"
            disabled={template.isPending}
            onClick={() => template.mutate()}
          >
            {template.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Download className="size-4" />
            )}
            Descargar plantilla
          </button>
        </div>
      </section>
    </div>
  );
}

function Summary({ summary }: { summary: StudentImportResult["summary"] }) {
  const stats = [
    { label: "Nuevos", value: summary.new, className: "text-success" },
    { label: "Ya existen", value: summary.existing, className: "text-info" },
    { label: "Con error", value: summary.error, className: "text-error" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card card-border bg-base-100">
          <div className="card-body gap-0 p-4">
            <p className={`font-bold text-2xl tabular-nums lg:text-3xl ${stat.className}`}>
              {stat.value}
            </p>
            <p className="text-base-content/70 text-sm">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-soft badge-sm font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Paso 2: qué pasará con cada fila y confirmación */
function ImportPreview({
  preview,
  fileName,
  creating,
  onConfirm,
  onRestart,
}: {
  preview: StudentImportResult;
  fileName: string;
  creating: boolean;
  onConfirm: () => void;
  onRestart: () => void;
}) {
  const settings = useAcademicSettings();
  const { summary } = preview;
  const nothing = summary.new + summary.existing === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base-content/70 text-sm">
        {fileName} · {plural(preview.rows.length, "fila leída", "filas leídas")}
      </p>
      <Summary summary={summary} />
      {summary.error > 0 && (
        <div role="note" className="alert alert-warning alert-soft">
          <TriangleAlert className="size-5 shrink-0" />
          <span>
            Las filas con error se omitirán. Corrígelas en el Excel y vuelve a subirlo si quieres
            incluirlas.
          </span>
        </div>
      )}
      <DataTable
        rows={preview.rows}
        rowKey={(row) => row.row}
        emptyTitle="El archivo no tiene filas con estudiantes"
        columns={[
          { header: "Fila", cell: (row) => row.row, className: "w-16" },
          { header: "Estudiante", cell: fullName },
          { header: settings.document_label, cell: documentText },
          { header: "Materias", cell: (row) => row.subject_codes.join(", ") || "—" },
          { header: "Sección", cell: (row) => row.section ?? "—" },
          { header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
          {
            header: "Observaciones",
            cell: (row) => (
              <span className={row.status === "error" ? "text-error" : ""}>
                {row.issues.join(" · ")}
              </span>
            ),
          },
        ]}
        renderCard={(row) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-bold">{fullName(row)}</p>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-base-content/70 text-sm">
              Fila {row.row} · {documentText(row)}
              {row.subject_codes.length > 0 && ` · ${row.subject_codes.join(", ")}`}
              {row.section && ` · Sección ${row.section}`}
            </p>
            {row.issues.length > 0 && (
              <p className={`text-sm ${row.status === "error" ? "text-error" : ""}`}>
                {row.issues.join(" · ")}
              </p>
            )}
          </div>
        )}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-outline btn-primary" onClick={onRestart}>
          Elegir otro archivo
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={nothing || creating}
          onClick={onConfirm}
        >
          {creating && <span className="loading loading-spinner loading-sm" />}
          {confirmLabel(preview)}
        </button>
      </div>
    </div>
  );
}

/** Paso 3: cuentas creadas con su contraseña (solo se ven ahora) */
function ImportDone({ result, onRestart }: { result: StudentImportResult; onRestart: () => void }) {
  const settings = useAcademicSettings();
  const created = result.rows.filter((row) => row.generated_password);
  const { summary } = result;

  const downloadCsv = () => {
    const rows = created.map((row) => [
      row.user?.first_name ?? row.first_name,
      row.user?.last_name ?? row.last_name,
      documentText(row),
      row.generated_password ?? "",
    ]);
    saveFile(
      toCsv([["Nombre", "Apellido", settings.document_label, "Contraseña"], ...rows]),
      "credenciales-estudiantes.csv",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="alert alert-success alert-soft">
        <span>
          {plural(summary.new, "estudiante creado", "estudiantes creados")}
          {summary.existing > 0 &&
            `; ${plural(summary.existing, "ya existía", "ya existían")} y solo se matricularon`}
          {summary.error > 0 && `; ${plural(summary.error, "fila omitida", "filas omitidas")}`}.
        </span>
      </div>

      {created.length > 0 && (
        <>
          <div role="alert" className="alert alert-warning alert-soft">
            <TriangleAlert className="size-5 shrink-0" />
            <span>
              Estas contraseñas solo se muestran ahora. Descárgalas o cópialas y entrégaselas a cada
              estudiante: si se pierden, habrá que restablecerlas una a una.
            </span>
          </div>
          <DataTable
            rows={created}
            rowKey={(row) => row.row}
            columns={[
              { header: "Estudiante", cell: (row) => row.user?.full_name ?? fullName(row) },
              { header: settings.document_label, cell: documentText },
              {
                header: "Contraseña",
                cell: (row) => <code className="font-bold">{row.generated_password}</code>,
              },
            ]}
            renderCard={(row) => (
              <div className="flex flex-col gap-1">
                <p className="font-bold">{row.user?.full_name ?? fullName(row)}</p>
                <p className="text-base-content/70 text-sm">{documentText(row)}</p>
                <code className="font-bold">{row.generated_password}</code>
              </div>
            )}
          />
        </>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-outline btn-primary" onClick={onRestart}>
          Importar otro archivo
        </button>
        <Link to="/admin/students" className="btn btn-outline btn-primary">
          Ir a estudiantes
        </Link>
        {created.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={downloadCsv}>
            <Download className="size-4" />
            Descargar credenciales (CSV)
          </button>
        )}
      </div>
    </div>
  );
}
