import type { components } from "@clipvero/shared-types";

export type FoundationIdentity = components["schemas"]["Identity"];
export type NameUpdate = components["schemas"]["NameUpdate"];

export async function foundationApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.location.assign(new URL("/login", window.location.origin));
    const message =
      result.error?.message || "The workspace service is unavailable.";
    throw new Error(
      `${message}${result.requestId ? ` (Reference: ${result.requestId})` : ""}`,
    );
  }
  return result as T;
}
