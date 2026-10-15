// @vitest-environment node
import { expect, test, vi, afterEach } from "vitest";
import { POST, GET } from "@/app/api/v1/[...path]/route";
import { usesFastAPI } from "@/server/backend";

vi.mock("@/server/backend", () => ({
  usesFastAPI: vi.fn(() => true),
  backendUrl: () => "http://127.0.0.1:8000",
}));
afterEach(() => vi.restoreAllMocks());

test("deadline cancels an unfinished request body before contacting the backend", async () => {
  const controller = new AbortController(),
    cancel = vi.fn();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const fetch = vi.spyOn(globalThis, "fetch");
  const body = new ReadableStream({
    start(stream) {
      stream.enqueue(new Uint8Array([123]));
    },
    cancel,
  });
  const request = new Request("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  const response = POST(request, {
    params: Promise.resolve({ path: ["auth", "login"] }),
  });
  controller.abort();
  expect((await response).status).toBe(504);
  expect(cancel).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test("legacy deployment cannot call the foundation proxy", async () => {
  vi.mocked(usesFastAPI).mockReturnValueOnce(false);
  const response = await GET(
    new Request("http://localhost:3000/api/v1/auth/me"),
    { params: Promise.resolve({ path: ["auth", "me"] }) },
  );
  expect(response.status).toBe(404);
});
