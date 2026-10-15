import { afterEach, expect, test, vi } from "vitest";
import { identity } from "@/server/auth";
import { one } from "@/server/db";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "fixture-session-token" }) }),
}));
vi.mock("@/server/db", () => ({
  one: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  transaction: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test("private owner configuration rejects previously issued sessions for another account", async () => {
  vi.stubEnv("PILOT_OWNER_EMAIL", "owner@example.test");
  vi.mocked(one).mockReturnValue({ email: "other@example.test" });
  expect(await identity()).toBeNull();
  vi.mocked(one).mockReturnValue({ email: "OWNER@example.test" });
  expect(await identity()).toEqual({ email: "OWNER@example.test" });
  vi.stubEnv("PILOT_OWNER_EMAIL", "");
  vi.mocked(one).mockReturnValue({ email: "other@example.test" });
  expect(await identity()).toEqual({ email: "other@example.test" });
});
