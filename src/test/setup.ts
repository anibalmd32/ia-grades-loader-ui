import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// findBy*/waitFor esperan hasta 3 s (1 s por defecto): con la máquina cargada (CI, primer
// arranque) los flujos con varias peticiones, como el chat en streaming, a veces tardan más
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
