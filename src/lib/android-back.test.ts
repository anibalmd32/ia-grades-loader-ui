import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBack } from "./android-back";

const actions = () => ({ back: vi.fn(), exit: vi.fn() });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("botón atrás de Android", () => {
  it("cierra primero un diálogo abierto", () => {
    const onClose = vi.fn();
    document.body.innerHTML = `<div class="modal modal-open"><button class="modal-backdrop"></button></div>`;
    document.querySelector("button")?.addEventListener("click", onClose);
    const a = actions();
    handleBack(true, a);
    expect(onClose).toHaveBeenCalled();
    expect(a.back).not.toHaveBeenCalled();
  });

  it("no cierra el diálogo de la contraseña generada (no tiene fondo para cerrar)", () => {
    document.body.innerHTML = `<div class="modal modal-open"></div>`;
    const a = actions();
    handleBack(true, a);
    expect(a.back).not.toHaveBeenCalled();
    expect(a.exit).not.toHaveBeenCalled();
  });

  it("cierra el menú lateral si está abierto", () => {
    document.body.innerHTML = `<input type="checkbox" class="drawer-toggle" checked />`;
    const a = actions();
    handleBack(true, a);
    expect(document.querySelector<HTMLInputElement>(".drawer-toggle")?.checked).toBe(false);
    expect(a.back).not.toHaveBeenCalled();
  });

  it("vuelve a la pantalla anterior o sale de la app si no hay historial", () => {
    const a = actions();
    handleBack(true, a);
    expect(a.back).toHaveBeenCalled();
    handleBack(false, a);
    expect(a.exit).toHaveBeenCalled();
  });
});
