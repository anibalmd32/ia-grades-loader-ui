import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openExternal } from "@/lib/open-url";

// Los enlaces se abren fuera de la app: un <a href> normal reemplazaría la app (en Tauri,
// sin forma de volver) y en la web sacaría al estudiante del chat
const components: Components = {
  a: ({ href, children }) => (
    <button
      type="button"
      className="link link-primary"
      onClick={() => {
        if (href) void openExternal(href);
      }}
    >
      {children}
    </button>
  ),
};

/**
 * Respuesta del asistente en Markdown (con tablas y listas de GFM). react-markdown nunca
 * interpreta HTML crudo y con skipHtml además lo descarta, así que la IA no puede inyectar
 * etiquetas. Las imágenes se omiten para que una respuesta no cargue URLs externas.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 break-words [&_code]:rounded [&_code]:bg-base-200 [&_code]:px-1 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:table [&_table]:table-xs [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
