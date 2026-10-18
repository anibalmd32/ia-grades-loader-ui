import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationRead, ConversationSummary } from "@/api/queries/chat";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

type SseEvent = [event: string, data: unknown];
const sse = (events: SseEvent[]) =>
  events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
const sseResponse = (body: string | ReadableStream) =>
  new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });

const now = new Date().toISOString();
const summary = (id: number, title: string): ConversationSummary => ({
  id,
  title,
  created_at: now,
  updated_at: now,
});

let conversations: ConversationSummary[] = [];

beforeEach(() => {
  localStorage.clear();
  conversations = [];
  signedInAs(
    makeUser({
      id: 7,
      role: "student",
      full_name: "María Pérez",
      email: null,
      nationality: "V",
      cedula: 28456123,
      cedula_display: "V-28456123",
    }),
  );
  server.use(
    http.get(`${API_URL}/student/subjects`, () =>
      HttpResponse.json({ subjects: [], average: null }),
    ),
    http.get(`${API_URL}/student/conversations`, () =>
      HttpResponse.json({
        items: conversations,
        total: conversations.length,
        limit: 50,
        offset: 0,
      }),
    ),
  );
});

describe("asistente", () => {
  it("muestra la respuesta en streaming y guarda la conversación en la URL", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/student/chat/stream`, async ({ request }) => {
        body = await request.json();
        conversations = [summary(42, "¿En qué materia voy peor?")];
        return sseResponse(
          sse([
            ["conversation", { id: 42, title: "¿En qué materia voy peor?" }],
            ["delta", { text: "Tu nota más baja es **Química I**" }],
            ["delta", { text: " con 3.50." }],
            ["done", {}],
          ]),
        );
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/student/assistant");

    await user.click(await screen.findByRole("button", { name: "¿En qué materia voy peor?" }));

    expect(await screen.findByText("Química I")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText(/con 3\.50\./)).toBeInTheDocument();
    expect(body).toEqual({ message: "¿En qué materia voy peor?", conversation_id: null });
    await waitFor(() => expect(router.state.location.search).toEqual({ c: 42 }));
    // La conversación nueva aparece en la lista
    expect(
      await screen.findAllByRole(
        "button",
        { name: /¿En qué materia voy peor\?\s*Hoy/ },
        { timeout: 3000 },
      ),
    ).not.toHaveLength(0);
  });

  it("continúa una conversación existente con sus mensajes", async () => {
    conversations = [summary(5, "Cuánto necesito en Física")];
    const detail: ConversationRead = {
      ...summary(5, "Cuánto necesito en Física"),
      messages: [
        { role: "user", content: "¿Cuánto necesito en Física?", created_at: now },
        { role: "assistant", content: "Necesitas 12.50 en el Lapso 3.", created_at: now },
      ],
    };
    let body: unknown;
    server.use(
      http.get(`${API_URL}/student/conversations/5`, () => HttpResponse.json(detail)),
      http.post(`${API_URL}/student/chat/stream`, async ({ request }) => {
        body = await request.json();
        return sseResponse(
          sse([
            ["conversation", { id: 5, title: "Cuánto necesito en Física" }],
            ["delta", { text: "Llevas 17.50 puntos." }],
            ["done", {}],
          ]),
        );
      }),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant?c=5");

    expect(await screen.findByText("Necesitas 12.50 en el Lapso 3.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tu pregunta"), "¿Y cuántos puntos llevo?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Llevas 17.50 puntos.")).toBeInTheDocument();
    expect(body).toEqual({ message: "¿Y cuántos puntos llevo?", conversation_id: 5 });
  });

  it("con el límite de preguntas (evento error) bloquea el envío y muestra la espera", async () => {
    server.use(
      http.post(`${API_URL}/student/chat/stream`, () =>
        sseResponse(
          sse([
            ["conversation", { id: 9, title: "Hola" }],
            [
              "error",
              {
                detail: "Has hecho muchas preguntas seguidas. Espera 30 s e inténtalo de nuevo.",
                retry_after: 30,
              },
            ],
          ]),
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant");

    await user.type(await screen.findByLabelText("Tu pregunta"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Espera (30|29) s para volver/);
    expect(screen.getByRole("button", { name: /Espera \d+ s/ })).toBeDisabled();
  });

  it("con un 429 antes de empezar usa Retry-After", async () => {
    server.use(
      http.post(`${API_URL}/student/chat/stream`, () =>
        HttpResponse.json(
          { detail: "Has hecho muchas preguntas seguidas. Espera 12 s e inténtalo de nuevo." },
          { status: 429, headers: { "Retry-After": "12" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant");

    await user.type(await screen.findByLabelText("Tu pregunta"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Espera (12|11) s para volver/);
  });

  it("muestra el error si el asistente no está disponible", async () => {
    server.use(
      http.post(`${API_URL}/student/chat/stream`, () =>
        HttpResponse.json({ detail: "El asistente no está disponible" }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant");

    await user.type(await screen.findByLabelText("Tu pregunta"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El asistente no está disponible");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled(); // caja vacía
  });

  it("permite detener la respuesta", async () => {
    server.use(
      http.post(`${API_URL}/student/chat/stream`, () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                sse([
                  ["conversation", { id: 3, title: "Resumen" }],
                  ["delta", { text: "Empiezo el resumen" }],
                ]),
              ),
            );
            // No se cierra: la respuesta sigue "escribiéndose"
          },
        });
        return sseResponse(stream);
      }),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant");

    await user.click(await screen.findByRole("button", { name: "Resumen del semestre" }));
    expect(await screen.findByText("Empiezo el resumen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Detener" }));

    expect(await screen.findByText("Respuesta detenida.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });

  it("escribe la pregunta sugerida desde otra pantalla", async () => {
    renderApp(`/student/assistant?${new URLSearchParams({ q: "¿Cuánto necesito en Física?" })}`);
    expect(await screen.findByLabelText("Tu pregunta")).toHaveValue("¿Cuánto necesito en Física?");
  });

  it("borra una conversación con confirmación", async () => {
    conversations = [summary(5, "Cuánto necesito en Física")];
    let deleted = false;
    server.use(
      http.delete(`${API_URL}/student/conversations/5`, () => {
        deleted = true;
        conversations = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/student/assistant");

    const [trash] = await screen.findAllByRole("button", {
      name: "Borrar «Cuánto necesito en Física»",
    });
    await user.click(trash as HTMLElement);
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Borrar" }),
    );

    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText("Conversación borrada.")).toBeInTheDocument();
  });
});
