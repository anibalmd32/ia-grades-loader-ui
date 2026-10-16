import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { API_URL } from "@/lib/config";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/server";
import { ApiStatus } from "./api-status";

describe("ApiStatus", () => {
  it("no muestra nada si la API responde", async () => {
    renderWithQuery(<ApiStatus />);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("avisa si la API no responde", async () => {
    server.use(http.get(`${API_URL}/health`, () => HttpResponse.error()));
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede conectar con la API");
  });

  it("avisa si la API devuelve un error", async () => {
    server.use(http.get(`${API_URL}/health`, () => new HttpResponse(null, { status: 503 })));
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
