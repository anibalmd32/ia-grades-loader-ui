import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { makeSettings, settingsHandler } from "@/test/handlers";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/server";
import { ConfirmDialog, confirm } from "./confirm";
import { DataTable, Pagination } from "./data-table";
import { formatGrade, GradeBadge } from "./grade-badge";
import { ErrorState } from "./states";
import { Toaster, toast } from "./toast";

describe("GradeBadge", () => {
  it("formatea con los decimales configurados y colorea según la nota aprobatoria", async () => {
    renderWithQuery(<GradeBadge value={9.99} />);
    expect(await screen.findByText("9.99")).toHaveClass("badge-error");
    renderWithQuery(<GradeBadge value={10} />);
    expect(await screen.findByText("10.00")).toHaveClass("badge-success");
    expect(formatGrade(null)).toBe("—");
  });

  it("usa la aprobatoria y los decimales de la configuración", async () => {
    server.use(
      settingsHandler(makeSettings({ passing_grade: 60, max_grade: 100, grade_decimals: 0 })),
    );
    renderWithQuery(<GradeBadge value={59} />);
    expect(await screen.findByText("59")).toHaveClass("badge-error");
  });
});

describe("toasts", () => {
  it("muestra y cierra avisos", async () => {
    render(<Toaster />);
    act(() => toast.success("Guardado"));
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
  });
});

describe("confirm", () => {
  it("resuelve true al confirmar y false al cancelar", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = confirm({ title: "¿Desactivar a Ana?", confirmLabel: "Desactivar", danger: true });
    });
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await expect(answer).resolves.toBe(true);

    act(() => {
      answer = confirm({ title: "¿Borrar?" });
    });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(answer).resolves.toBe(false);
  });
});

describe("Pagination", () => {
  it("calcula el rango y cambia de página por offset", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={{ total: 24, limit: 5, offset: 5 }} onPageChange={onPageChange} />);
    expect(screen.getByText("Mostrando 6–10 de 24")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenCalledWith(10);
  });
});

describe("DataTable", () => {
  it("muestra el estado vacío", () => {
    render(
      <DataTable
        columns={[]}
        rows={[]}
        rowKey={() => 1}
        renderCard={() => null}
        emptyTitle="Aún no hay profesores"
      />,
    );
    expect(screen.getByText("Aún no hay profesores")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("muestra el código del error 500 y permite reintentar", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={new ApiError({ status: 500, message: "Error inesperado", requestId: "req-9" })}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Código: req-9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
