import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, authorizedFetch, unwrap } from "../client";
import { ApiError } from "../errors";
import type { components } from "../schema";
import { parseEvent } from "../sse";

export type ConversationSummary = components["schemas"]["ConversationSummary"];
export type ConversationRead = components["schemas"]["ConversationRead"];
export type ChatMessage = components["schemas"]["MessageRead"];

export const chatKeys = {
  conversations: ["student", "conversations"] as const,
  conversation: (id: number) => ["student", "conversations", "item", id] as const,
};

/** Conversaciones de la app, de la más reciente a la más antigua */
export const conversationsQuery = queryOptions({
  queryKey: chatKeys.conversations,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/student/conversations", { params: { query: { limit: 50 } }, signal })),
  placeholderData: keepPreviousData,
});

export const conversationQuery = (id: number) =>
  queryOptions({
    queryKey: chatKeys.conversation(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/student/conversations/{conversation_id}", {
          params: { path: { conversation_id: id } },
          signal,
        }),
      ),
  });

export function deleteConversation(id: number) {
  return unwrap(
    api.DELETE("/api/v1/student/conversations/{conversation_id}", {
      params: { path: { conversation_id: id } },
    }),
  );
}

type StreamHandlers = {
  /** Primera respuesta: la conversación (nueva o la que se continúa) */
  onConversation: (conversation: { id: number; title: string }) => void;
  /** Fragmento de la respuesta; se concatenan según llegan */
  onDelta: (text: string) => void;
};

export type ChatRequest = { message: string; conversationId?: number; signal?: AbortSignal };

/**
 * Error de un evento `error` del stream. El límite de preguntas llega así (con HTTP 200) y
 * trae `retry_after` (segundos): se trata como un 429. En cualquier otro error es null.
 */
function streamError(detail: string, retryAfter?: unknown): ApiError {
  return typeof retryAfter === "number"
    ? new ApiError({ status: 429, message: detail, retryAfter })
    : new ApiError({ status: 503, message: detail });
}

/**
 * Pregunta al asistente con la respuesta en streaming (Server-Sent Events sobre POST).
 * EventSource no admite POST ni cabeceras, así que se lee el cuerpo con fetch.
 * Se resuelve con el id de la conversación cuando llega `done`; lanza ApiError si falla.
 */
export async function streamChat(
  { message, conversationId, signal }: ChatRequest,
  { onConversation, onDelta }: StreamHandlers,
): Promise<number> {
  const response = await authorizedFetch("/api/v1/student/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, conversation_id: conversationId ?? null }),
    signal,
  });

  let id = conversationId;
  /** Procesa un evento; devuelve true cuando la respuesta terminó */
  const handle = (block: string): boolean => {
    const parsed = parseEvent(block);
    if (!parsed) return false;
    const data = parsed.data as Record<string, unknown>;
    switch (parsed.event) {
      case "conversation":
        id = data.id as number;
        onConversation({ id, title: String(data.title ?? "") });
        return false;
      case "delta":
        onDelta(String(data.text ?? ""));
        return false;
      case "error":
        throw streamError(
          String(data.detail ?? "El asistente no pudo responder."),
          data.retry_after,
        );
      case "done":
        return true;
      default:
        return false;
    }
  };
  const finish = (): number => {
    if (id === undefined) throw streamError("El asistente no pudo responder.");
    return id;
  };

  // Sin cuerpo legible por partes (entornos sin streams): se procesa la respuesta entera
  if (!response.body) {
    for (const block of (await response.text()).split(/\r?\n\r?\n/)) {
      if (handle(block)) return finish();
    }
    throw new ApiError({ status: 0, message: "Se cortó la conexión con el asistente." });
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // Detener: cortar también la lectura (no todos los entornos la cortan al abortar el fetch)
  signal?.addEventListener("abort", () => void reader.cancel().catch(() => {}), { once: true });
  const stopped = () => new DOMException("Respuesta detenida", "AbortError");
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (signal?.aborted) throw stopped();
      if (value) buffer += value;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : (blocks.pop() ?? "");
      for (const block of blocks) {
        // No seguir pintando bloques ya leídos si se detuvo la respuesta
        if (signal?.aborted) throw stopped();
        if (handle(block)) return finish();
      }
      if (done) break;
    }
    throw new ApiError({ status: 0, message: "Se cortó la conexión con el asistente." });
  } finally {
    // Liberar la conexión siempre (al terminar, ante un evento error o al detener), sin esperar
    void reader.cancel().catch(() => {});
  }
}

/** Igual que streamChat pero con la respuesta completa (POST /student/chat) */
export async function askChat(
  { message, conversationId, signal }: ChatRequest,
  { onConversation, onDelta }: StreamHandlers,
): Promise<number> {
  const result = await unwrap(
    api.POST("/api/v1/student/chat", {
      body: { message, conversation_id: conversationId ?? null },
      signal,
    }),
  );
  onConversation({ id: result.conversation_id, title: message.slice(0, 60) });
  onDelta(result.answer);
  return result.conversation_id;
}
