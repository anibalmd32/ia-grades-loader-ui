import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Asistente IA";
const description = "Pregúntale por tus notas.";

export const Route = createFileRoute("/_app/student/assistant")({
  validateSearch: v.object({
    // Pregunta sugerida desde otra pantalla (se escribe en la caja, no se envía sola)
    q: v.optional(v.fallback(v.optional(v.string()), undefined)),
  }),
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
