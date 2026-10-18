import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferences } from "@/stores/preferences";
import { resolveTheme, ThemeToggle } from "./theme-toggle";

/** Simula prefers-color-scheme del sistema */
function systemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark && query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => usePreferences.setState({ theme: "system" }));
afterEach(() => vi.unstubAllGlobals());

describe("ThemeToggle", () => {
  it("alterna entre claro y oscuro y guarda la preferencia", async () => {
    const user = userEvent.setup();
    usePreferences.setState({ theme: "light" });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(usePreferences.getState().theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(usePreferences.getState().theme).toBe("light");
  });

  it("con el tema del sistema en oscuro, pasa a claro explícito", async () => {
    systemPrefersDark(true);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(usePreferences.getState().theme).toBe("light");
  });

  it("con el tema del sistema en claro, pasa a oscuro explícito", async () => {
    systemPrefersDark(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(usePreferences.getState().theme).toBe("dark");
  });

  it("resuelve el tema efectivo", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
