// Descarga de archivos generados en el cliente o recibidos de la API. Se usa el enlace
// <a download> de la web, que también funciona en el WebView de la app de escritorio.

/** Guarda un archivo en el equipo con el nombre indicado */
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Dar tiempo al navegador a empezar la descarga antes de liberar el archivo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Archivo recibido de la API, con el nombre que propone (Content-Disposition) */
export type DownloadedFile = { blob: Blob; fileName: string };

/** Nombre del archivo según la cabecera Content-Disposition, o el de reserva */
export function fileNameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("Content-Disposition") ?? "";
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? fallback;
}

/** Lee la respuesta de una descarga de la API */
export async function readDownload(response: Response, fallback: string): Promise<DownloadedFile> {
  return { blob: await response.blob(), fileName: fileNameFrom(response, fallback) };
}

/** Campo CSV: entre comillas si lleva separador, comillas o saltos de línea */
function csvField(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** CSV en UTF-8 con BOM (para que Excel respete las tildes), una fila por array */
export function toCsv(rows: string[][]): Blob {
  const text = rows.map((row) => row.map(csvField).join(",")).join("\r\n");
  return new Blob([`\uFEFF${text}\r\n`], { type: "text/csv;charset=utf-8" });
}
