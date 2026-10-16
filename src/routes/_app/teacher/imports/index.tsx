import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Importaciones";
const description = "Historial de notas importadas desde Excel.";

export const Route = createFileRoute("/_app/teacher/imports/")({
  validateSearch: v.object({
    // Materia preseleccionada al llegar desde "Importar Excel"
    subject: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
  }),
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
