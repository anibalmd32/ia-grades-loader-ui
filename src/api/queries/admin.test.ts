import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../client";
import { importStudents } from "./admin";

afterEach(() => vi.restoreAllMocks());

describe("importStudents", () => {
  const result = { dry_run: true, rows: [], summary: { new: 0, existing: 0, error: 0 } };
  const ok = { data: result, response: new Response(null, { status: 200 }) };

  it.each([
    [true, "true"],
    [false, "false"],
  ])("envía el archivo y dry_run=%s como multipart", async (dryRun, sent) => {
    const post = vi.spyOn(api, "POST").mockResolvedValue(ok as never);

    await expect(importStudents(new File(["PK"], "alumnos.xlsx"), dryRun)).resolves.toEqual(result);

    const [path, init] = post.mock.calls[0] as unknown as [string, { body: FormData }];
    expect(path).toBe("/api/v1/students/import");
    expect((init.body.get("file") as File).name).toBe("alumnos.xlsx");
    expect(init.body.get("dry_run")).toBe(sent);
  });
});
