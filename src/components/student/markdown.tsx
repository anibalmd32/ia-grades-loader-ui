import ReactMarkdown from "react-markdown";

/**
 * Respuesta del asistente en Markdown. react-markdown nunca interpreta HTML crudo y con
 * skipHtml además lo descarta, así que el contenido de la IA no puede inyectar etiquetas.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 break-words [&_a]:link [&_a]:link-primary [&_code]:rounded [&_code]:bg-base-200 [&_code]:px-1 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:table [&_table]:table-xs [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
