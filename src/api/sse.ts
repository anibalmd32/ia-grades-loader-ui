// Lectura de respuestas Server-Sent Events con fetch (EventSource no admite cabeceras, y
// la API necesita el token en Authorization).

export type SseEvent = { event: string; data: unknown };

/** Separa un bloque SSE ("event: delta\ndata: {...}") en evento y datos (JSON) */
export function parseEvent(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Lee los eventos de la respuesta hasta que el servidor cierra la conexión o se aborta
 * `signal`. Los comentarios (": ping") se ignoran.
 */
export async function readEvents(
  response: Response,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    for (const block of (await response.text()).split(/\r?\n\r?\n/)) {
      const parsed = parseEvent(block);
      if (parsed) onEvent(parsed);
    }
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  signal?.addEventListener("abort", () => void reader.cancel().catch(() => {}), { once: true });
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (signal?.aborted) return;
      if (value) buffer += value;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : (blocks.pop() ?? "");
      for (const block of blocks) {
        const parsed = parseEvent(block);
        if (parsed) onEvent(parsed);
      }
      if (done) return;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}
