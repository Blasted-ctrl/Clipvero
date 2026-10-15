"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster, toast as sonner } from "sonner";
import type {
  Asset,
  Character,
  Job,
  Pipeline,
  Preset,
  Project,
} from "@/lib/model";
import type { Identity } from "@/server/auth";

export type AppState = {
  me: Identity;
  projects: Project[];
  jobs: Job[];
  assets: Asset[];
  characters: Character[];
  presets: Preset[];
  pipelines: Pipeline[];
  ledger: {
    operation: string;
    amount: number;
    detail: string;
    createdAt: number;
  }[];
  usage: { category: string; units: number }[];
  pipelineErrors: { id: string; error: string }[];
  capabilities: {
    ai: boolean;
    worker: boolean;
    billing: boolean;
    publishing: boolean;
  };
  appName: string;
};
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(method === "POST" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body:
      data == null
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.location.assign(new URL("/login", window.location.origin));
    throw new Error(result.error || "The request failed.");
  }
  return result;
}
const ToastContext = createContext<(text: string, error?: boolean) => void>(
  () => {},
);
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  const notify = useCallback((text: string, error = false) => {
    if (error) sonner.error(text);
    else sonner.success(text);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={notify}>
        {children}
        <Toaster richColors closeButton />
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}
export function useApp() {
  return useQuery<AppState>({
    queryKey: ["state"],
    queryFn: () => api<AppState>("state"),
    refetchInterval: 5000,
  });
}
export function useNotify() {
  return useContext(ToastContext);
}
export function useAction() {
  const client = useQueryClient(),
    notify = useNotify(),
    [busy, setBusy] = useState(false);
  async function act<T>(
    fn: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await fn();
      await client.invalidateQueries({ queryKey: ["state"] });
      if (success) notify(success);
      return result;
    } catch (e) {
      notify(e instanceof Error ? e.message : "The action failed.", true);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { act, busy };
}
