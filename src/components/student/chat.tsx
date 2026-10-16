import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Square, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { chatKeys, conversationsQuery, deleteConversation } from "@/api/queries/chat";
import { studentOverviewQuery } from "@/api/queries/student";
import { confirm } from "@/components/ui/confirm";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { dayLabel } from "@/lib/dates";
import { Markdown } from "./markdown";
import type { Turn, useChat } from "./use-chat";

const MAX_LENGTH = 1000;

/** Lista de conversaciones: abrir y borrar */
export function ConversationList({
  activeId,
  onSelect,
  onDeleted,
}: {
  activeId: number | undefined;
  onSelect: (id: number) => void;
  /** Se borró la conversación abierta */
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const conversations = useQuery(conversationsQuery);

  const remove = useMutation({
    mutationFn: deleteConversation,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: chatKeys.conversation(id) });
      await queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      if (id === activeId) onDeleted();
      toast.success("Conversación borrada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleDelete = async (id: number, title: string) => {
    const ok = await confirm({
      title: "¿Borrar la conversación?",
      message: `«${title}» se borrará para siempre.`,
      confirmLabel: "Borrar",
      danger: true,
    });
    if (ok) remove.mutate(id);
  };

  if (conversations.error) {
    return <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />;
  }
  if (!conversations.data) return <LoadingState rows={3} />;
  if (conversations.data.items.length === 0) {
    return <p className="text-base-content/60 text-sm">Aún no tienes conversaciones.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {conversations.data.items.map((c) => {
        const title = c.title || "Conversación sin título";
        const active = c.id === activeId;
        return (
          <li key={c.id} className="group flex items-center gap-1">
            <button
              type="button"
              aria-current={active ? "true" : undefined}
              className={`flex min-w-0 flex-1 flex-col rounded-field px-3 py-2 text-left ${
                active ? "bg-primary/10 text-primary" : "hover:bg-base-200"
              }`}
              onClick={() => onSelect(c.id)}
            >
              <span className="truncate font-semibold text-sm">{title}</span>
              <span className="text-base-content/60 text-xs">{dayLabel(c.updated_at)}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square opacity-60 hover:text-error hover:opacity-100"
              aria-label={`Borrar «${title}»`}
              onClick={() => handleDelete(c.id, title)}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Preguntas de ejemplo; usa una materia en curso del estudiante si la hay */
function useSuggestions(): string[] {
  const overview = useQuery(studentOverviewQuery);
  const pending = overview.data?.subjects.find((s) => s.projection.standing === "in_progress");
  return [
    "¿En qué materia voy peor?",
    pending ? `¿Cuánto necesito en ${pending.subject.name}?` : "¿Qué necesito para aprobar?",
    "Resumen del semestre",
  ];
}

/** Segundos que faltan para una fecha; se actualiza cada segundo */
function useSecondsLeft(until: number | null, onEnd: () => void) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (until == null) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const left = until == null ? 0 : Math.ceil((until - Date.now()) / 1000);
  useEffect(() => {
    if (until != null && left <= 0) onEnd();
  }, [until, left, onEnd]);
  return Math.max(0, left);
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-box rounded-br-sm bg-primary px-4 py-2 text-primary-content">
          {turn.content}
        </p>
      </div>
    );
  }
  if (turn.status === "streaming" && !turn.content) {
    return (
      <div className="w-fit rounded-box border border-base-300 bg-base-100 px-4 py-3">
        <span className="loading loading-dots loading-sm" aria-hidden="true" />
        <span className="sr-only">El asistente está escribiendo</span>
      </div>
    );
  }
  if (turn.status === "error" && !turn.content) return null;
  return (
    <div className="max-w-[85%] rounded-box rounded-bl-sm border border-base-300 bg-base-100 px-4 py-3">
      <Markdown>{turn.content}</Markdown>
      {turn.status === "stopped" && (
        <p className="mt-1 text-base-content/50 text-xs italic">Respuesta detenida.</p>
      )}
    </div>
  );
}

/** Mensajes, sugerencias y caja para preguntar */
export function ChatPanel({
  chat,
  initialMessage = "",
}: {
  chat: ReturnType<typeof useChat>;
  initialMessage?: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const suggestions = useSuggestions();
  const bottom = useRef<HTMLDivElement>(null);
  const secondsLeft = useSecondsLeft(chat.cooldownUntil, chat.clearCooldown);
  const blocked = secondsLeft > 0;
  const lastContent = chat.turns.at(-1)?.content;

  // Seguir el final de la conversación mientras llega la respuesta
  // biome-ignore lint/correctness/useExhaustiveDependencies: se desplaza al cambiar el contenido
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [chat.turns.length, lastContent]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || chat.streaming || blocked) return;
    setMessage("");
    void chat.send(clean);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(message);
  };

  return (
    <section className="card card-border flex min-h-[28rem] flex-col bg-base-100 lg:h-[calc(100dvh-12rem)]">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 lg:p-6" aria-live="polite">
        {chat.loading ? (
          <LoadingState rows={3} />
        ) : chat.turns.length === 0 ? (
          <EmptyState
            title="Pregunta por tus notas"
            description="El asistente solo ve tus notas. Prueba con una de las sugerencias."
          />
        ) : (
          chat.turns.map((turn, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los mensajes no tienen id y solo se añaden al final
            <Bubble key={i} turn={turn} />
          ))
        )}
        <div ref={bottom} />
      </div>

      <div className="flex flex-col gap-3 border-base-300 border-t p-4 lg:p-6">
        {chat.error && (
          <div role="alert" className="alert alert-error alert-soft">
            <CircleAlert className="size-5 shrink-0" />
            <span>
              {chat.error.status === 429 && blocked
                ? `Has hecho muchas preguntas seguidas. Espera ${secondsLeft} s para volver a preguntar.`
                : chat.error.message}
            </span>
          </div>
        )}
        {!chat.streaming && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-outline btn-primary btn-sm rounded-full"
                disabled={blocked}
                onClick={() => submit(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={onSubmit}>
          <input
            className="input flex-1"
            placeholder="Pregunta algo sobre tus notas…"
            aria-label="Tu pregunta"
            maxLength={MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          {chat.streaming ? (
            <button type="button" className="btn btn-outline btn-error" onClick={chat.stop}>
              <Square className="size-4" />
              Detener
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={!message.trim() || blocked}>
              {blocked ? `Espera ${secondsLeft} s` : "Enviar"}
            </button>
          )}
        </form>
        <p className="text-base-content/60 text-xs">
          Hay un límite de preguntas por minuto (sumando la app y Telegram).
        </p>
      </div>
    </section>
  );
}
