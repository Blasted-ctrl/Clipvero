import "server-only";
import { cookies } from "next/headers";
import type { components } from "@clipvero/shared-types";

export type FoundationIdentity = components["schemas"]["Identity"];

export function usesFastAPI() {
  const mode = process.env.CLIPVERO_BACKEND || "legacy";
  if (!["legacy", "fastapi"].includes(mode))
    throw new Error("CLIPVERO_BACKEND must be legacy or fastapi.");
  return mode === "fastapi";
}

export function backendUrl() {
  const url = new URL(process.env.API_BACKEND_URL || "http://127.0.0.1:8000");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "API_BACKEND_URL must contain an HTTP(S) origin without credentials.",
    );
  return url.origin;
}

export async function currentUser() {
  if (!usesFastAPI()) return (await import("./auth")).identity();
  const token = (await cookies()).get("clipvero_api_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const response = await fetch(`${backendUrl()}/api/v1/auth/me`, {
    headers: { Cookie: `clipvero_api_session=${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error("The workspace service is unavailable. Please retry.");
  return (await response.json()) as FoundationIdentity;
}
