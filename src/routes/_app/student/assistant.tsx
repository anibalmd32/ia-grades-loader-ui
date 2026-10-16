import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, Plus } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { ChatPanel, ConversationList } from "@/components/student/chat";
import { useChat } from "@/components/student/use-chat";
import { Modal } from "@/components/ui/modal";
import { PageBody, PageHeader } from "@/components/ui/page-header";

const title = "Asistente IA";
const description = "Pregunta por tus notas en lenguaje natural. Solo ve tus notas.";

export const Route = createFileRoute("/_app/student/assistant")({
  validateSearch: v.object({
    // Conversación abierta
    c: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
    // Pregunta sugerida desde otra pantalla (se escribe en la caja, no se envía sola)
    q: v.optional(v.fallback(v.optional(v.string()), undefined)),
  }),
  staticData: { title, description: "Pregunta por tus notas" },
  component: AssistantPage,
});

function AssistantPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [listOpen, setListOpen] = useState(false);

  const open = (c: number | undefined) => navigate({ search: c === undefined ? {} : { c } });
  // La conversación recién creada pasa a la URL sin recargar sus mensajes
  const chat = useChat(search.c, (id) => navigate({ search: { c: id }, replace: true }));

  const actions = (
    <>
      <button
        type="button"
        className="btn btn-outline btn-primary lg:hidden"
        onClick={() => setListOpen(true)}
      >
        <MessagesSquare className="size-4" />
        Conversaciones
      </button>
      <button type="button" className="btn btn-outline btn-primary" onClick={() => open(undefined)}>
        <Plus className="size-4" />
        Nueva conversación
      </button>
    </>
  );

  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <PageBody>
        <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="card card-border hidden bg-base-100 lg:flex">
            <div className="card-body gap-3 p-4">
              <h2 className="font-bold">Conversaciones</h2>
              <ConversationList
                activeId={search.c}
                onSelect={open}
                onDeleted={() => open(undefined)}
              />
              <p className="text-base-content/60 text-xs">Puedes borrar cualquier conversación.</p>
            </div>
          </aside>
          <ChatPanel key={search.q} chat={chat} initialMessage={search.q} />
        </div>
      </PageBody>
      <Modal open={listOpen} title="Conversaciones" onClose={() => setListOpen(false)}>
        <ConversationList
          activeId={search.c}
          onSelect={(id) => {
            setListOpen(false);
            open(id);
          }}
          onDeleted={() => open(undefined)}
        />
      </Modal>
    </>
  );
}
