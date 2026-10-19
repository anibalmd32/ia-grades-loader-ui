import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { type DownloadedFile, saveFile } from "@/lib/download";

/** Botón que pide un archivo a la API y lo guarda en el equipo (p. ej. un Excel de notas) */
export function DownloadButton({
  label,
  download,
  className = "btn btn-outline btn-primary",
}: {
  label: string;
  download: () => Promise<DownloadedFile>;
  className?: string;
}) {
  const mutation = useMutation({
    mutationFn: download,
    onSuccess: ({ blob, fileName }) => saveFile(blob, fileName),
    onError: (error) => toast.error(error.message),
  });
  return (
    <button
      type="button"
      className={className}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        <FileSpreadsheet className="size-4" />
      )}
      {label}
    </button>
  );
}
