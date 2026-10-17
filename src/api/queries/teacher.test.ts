import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../client";
import { uploadImport } from "./teacher";

afterEach(() => vi.restoreAllMocks());

describe("uploadImport", () => {
  const job = { id: "job-1", status: "pending" };
  const accepted = { data: job, response: new Response(null, { status: 202 }) };

  it("envía el archivo y el lapso como multipart", async () => {
    const post = vi.spyOn(api, "POST").mockResolvedValue(accepted as never);
    const file = new File(["PK"], "notas.xlsx");

    await expect(uploadImport(10, file, 2)).resolves.toEqual(job);

    const [path, init] = post.mock.calls[0] as unknown as [string, { body: FormData }];
    expect(path).toBe("/api/v1/teacher/subjects/{subject_id}/grades/import");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body.get("file") as File).name).toBe("notas.xlsx");
    expect(init.body.get("default_term")).toBe("2");
  });

  it("sin lapso no envía default_term", async () => {
    const post = vi.spyOn(api, "POST").mockResolvedValue(accepted as never);

    await uploadImport(10, new File(["PK"], "notas.xlsx"), null);

    const [, init] = post.mock.calls[0] as unknown as [string, { body: FormData }];
    expect(init.body.has("default_term")).toBe(false);
  });
});
