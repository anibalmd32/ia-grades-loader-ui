import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, isApiError } from "@/api/errors";
import { askChat, chatKeys, conversationQuery, streamChat } from "@/api/queries/chat";

export type Turn = {
  role: "user" | "assistant";
  content: string;
  /** streaming = escribiéndose; stopped = cancelada; error = no llegó a responder */
  status?: "streaming" | "stopped" | "error";
};

// Sin TextDecoderStream (WebViews antiguas) no se puede leer el stream: respuesta completa
const ask = typeof TextDecoderStream === "undefined" ? askChat : streamChat;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * Estado del chat de una conversación: carga sus mensajes, envía preguntas con la respuesta
 * en streaming, permite detenerla y gestiona el límite de preguntas (429).
 * `onConversation` avisa del id de una conversación recién creada (para ponerlo en la URL).
 */
export function useChat(conversationId: number | undefined, onConversation: (id: number) => void) {
  const queryClient = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  // Conversación cuyos mensajes están en `turns` (para no recargar la que se acaba de crear)
  const loadedId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (conversationId === loadedId.current) return;
    // Cortar la respuesta en curso; al soltar la referencia, su catch no toca la nueva conversación
    controller.current?.abort();
    controller.current = null;
    loadedId.current = conversationId;
    setError(null);
    setTurns([]);
    if (conversationId === undefined) return;
    let cancelled = false;
    setLoading(true);
    queryClient
      .fetchQuery(conversationQuery(conversationId))
      .then((c) => {
        if (!cancelled) setTurns(c.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, queryClient]);

  // Al salir de la pantalla se corta la respuesta en curso (la API guarda lo recibido)
  useEffect(() => () => controller.current?.abort(), []);

  const updateLast = (change: (turn: Turn) => Turn) =>
    setTurns((prev) => {
      const last = prev.at(-1);
      return last ? [...prev.slice(0, -1), change(last)] : prev;
    });

  const send = async (message: string) => {
    const ctrl = new AbortController();
    controller.current = ctrl;
    setError(null);
    setTurns((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "", status: "streaming" },
    ]);
    try {
      await ask(
        { message, conversationId: loadedId.current, signal: ctrl.signal },
        {
          onConversation: ({ id }) => {
            if (loadedId.current === id) return;
            loadedId.current = id;
            onConversation(id);
          },
          onDelta: (text) => updateLast((t) => ({ ...t, content: t.content + text })),
        },
      );
      updateLast((t) => ({ ...t, status: undefined }));
    } catch (e) {
      // Se cambió de conversación mientras respondía: sus mensajes ya no están en pantalla
      if (controller.current !== ctrl) return;
      if (isAbort(e)) {
        updateLast((t) => ({ ...t, status: "stopped" }));
      } else {
        const apiError = isApiError(e)
          ? e
          : new ApiError({ status: 0, message: "El asistente no pudo responder." });
        updateLast((t) => ({ ...t, status: "error" }));
        setError(apiError);
        if (apiError.status === 429) {
          setCooldownUntil(Date.now() + (apiError.retryAfter ?? 60) * 1000);
        }
      }
    } finally {
      if (controller.current === ctrl) controller.current = null;
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    }
  };

  return {
    turns,
    loading,
    error,
    streaming: turns.at(-1)?.status === "streaming",
    cooldownUntil,
    clearCooldown: () => {
      setCooldownUntil(null);
      setError(null);
    },
    send,
    stop: () => controller.current?.abort(),
  };
}
