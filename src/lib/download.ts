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

/** Campo CSV: entre comillas si lleva separador, comillas o saltos de línea */
function csvField(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** CSV en UTF-8 con BOM (para que Excel respete las tildes), una fila por array */
export function toCsv(rows: string[][]): Blob {
  const text = rows.map((row) => row.map(csvField).join(",")).join("\r\n");
  return new Blob([`\uFEFF${text}\r\n`], { type: "text/csv;charset=utf-8" });
}
