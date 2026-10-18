import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, toApiError } from "@/api/errors";
import { type ImportJobRead, importJobQuery } from "@/api/queries/teacher";
import { Markdown } from "@/components/student/markdown";

const openExternal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/open-url", () => ({ openExternal }));

describe("límite de preguntas", () => {
  it("un 429 toma la espera de la cabecera Retry-After", () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "15" } });
    expect(toApiError(response, { detail: "Demasiadas preguntas." }).retryAfter).toBe(15);
  });

  it("ya no depende del texto del mensaje", () => {
    const error = toApiError(new Response(null, { status: 429 }), {
      detail: "Demasiadas preguntas. Espera 15 s e inténtalo de nuevo.",
    });
    expect(error.retryAfter).toBeNull();
  });
});

describe("seguimiento de una importación", () => {
  const interval = importJobQuery("job-1").refetchInterval as (query: {
    state: { error: unknown; data?: Partial<ImportJobRead> };
  }) => number | false;

  it("sigue consultando tras un fallo de red o 5xx", () => {
    expect(
      interval({ state: { error: new ApiError({ status: 0, message: "red" }) } }),
    ).toBeGreaterThan(0);
    expect(
      interval({
        state: {
          error: new ApiError({ status: 503, message: "x" }),
          data: { status: "processing" },
        },
      }),
    ).toBeGreaterThan(0);
  });

  it("se detiene ante un 4xx o cuando el trabajo termina", () => {
    expect(interval({ state: { error: new ApiError({ status: 404, message: "x" }) } })).toBe(false);
    expect(interval({ state: { error: null, data: { status: "done" } } })).toBe(false);
    expect(interval({ state: { error: null, data: { status: "failed" } } })).toBe(false);
    expect(interval({ state: { error: null, data: { status: "pending" } } })).toBeGreaterThan(0);
  });
});

describe("Markdown del asistente", () => {
  it("abre los enlaces fuera de la app y no navega", async () => {
    render(<Markdown>{"Mira [la guía](https://example.com/guia)."}</Markdown>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "la guía" }));
    expect(openExternal).toHaveBeenCalledWith("https://example.com/guia");
  });

  it("no muestra imágenes ni HTML crudo", () => {
    const { container } = render(
      <Markdown>{'![x](https://evil.example/p.png)\n\n<b onclick="alert(1)">hola</b>'}</Markdown>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("muestra tablas", () => {
    render(<Markdown>{"| Materia | Nota |\n| --- | --- |\n| Física | 12.50 |"}</Markdown>);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "12.50" })).toBeInTheDocument();
  });
});
