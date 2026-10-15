"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Settings2,
  LogOut,
  Menu,
  X,
  SunMoon,
} from "lucide-react";
import { foundationApi, type FoundationIdentity } from "@/lib/foundation-api";
import { Logo } from "./shell";
import { Button } from "./ui/button";

function useIdentity() {
  return useQuery({
    queryKey: ["foundation", "me"],
    queryFn: () => foundationApi<FoundationIdentity>("auth/me"),
    retry: false,
  });
}

export function FoundationShell({ children }: { children: ReactNode }) {
  const { data } = useIdentity();
  const path = usePathname(),
    router = useRouter(),
    client = useQueryClient();
  const [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      document.documentElement.dataset.theme =
        localStorage.getItem("clipvero-theme") || "dark";
    } catch {
      /* Storage can be disabled. */
    }
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);
  return (
    <div className="app-shell foundation-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <Link
          href="/overview"
          className="sidebar-logo"
          aria-label="Clipvero overview"
        >
          <Logo />
        </Link>
        <div className="workspace-badge">
          <span className="workspace-avatar">
            {data?.workspaceName[0] || "S"}
          </span>
          <span className="workspace-copy">
            <strong>{data?.workspaceName || "Your workspace"}</strong>
            <small>{data?.role || "Loading membership"}</small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          {[
            { href: "/overview", label: "Overview", icon: LayoutDashboard },
            { href: "/settings", label: "Settings", icon: Settings2 },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${path === item.href ? "nav-active" : ""}`}
              aria-current={path === item.href ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="foundation-sidebar-actions">
          <Button
            variant="ghost"
            onClick={() => {
              const theme =
                document.documentElement.dataset.theme === "light"
                  ? "dark"
                  : "light";
              document.documentElement.dataset.theme = theme;
              try {
                localStorage.setItem("clipvero-theme", theme);
              } catch {
                /* Theme still works for this visit. */
              }
            }}
          >
            <SunMoon size={18} />
            Switch theme
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await foundationApi("auth/logout", "POST", {});
                client.clear();
                router.replace("/login");
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not sign out.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Button
            variant="ghost"
            className="mobile-toggle"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </Button>
          <span>{path === "/settings" ? "Settings" : "Overview"}</span>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
});
function NameForm({
  name,
  workspaceId,
}: {
  name: string;
  workspaceId?: string;
}) {
  const client = useQueryClient();
  const [failure, setFailure] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name },
  });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (body) => {
        setFailure("");
        try {
          await foundationApi(
            workspaceId ? `workspaces/${workspaceId}` : "settings/profile",
            "PATCH",
            body,
          );
          await client.invalidateQueries({ queryKey: ["foundation", "me"] });
          toast.success(
            workspaceId ? "Workspace name saved." : "Your name was saved.",
          );
        } catch (error) {
          setFailure(
            error instanceof Error ? error.message : "Could not save.",
          );
        }
      })}
    >
      <label>
        {workspaceId ? "Workspace name" : "Your name"}
        <input
          {...register("name")}
          maxLength={80}
          required
          aria-invalid={!!errors.name}
        />
      </label>
      {errors.name && (
        <p role="alert" className="inline-error">
          {errors.name.message}
        </p>
      )}
      {failure && (
        <p role="alert" className="inline-error">
          {failure}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Saving…"
          : workspaceId
            ? "Save workspace"
            : "Save profile"}
      </Button>
    </form>
  );
}

export function FoundationPage({
  section,
}: {
  section: "overview" | "settings";
}) {
  const { data, error, isPending, refetch } = useIdentity();
  if (isPending) return <p role="status">Loading your workspace…</p>;
  if (error || !data)
    return (
      <div role="alert">
        <h1>Your workspace could not load.</h1>
        <p>{error?.message}</p>
        <Button onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  return (
    <div className="foundation-content">
      <span className="eyebrow">YOUR WORKSPACE</span>
      <h1>
        {section === "settings"
          ? "Make it yours."
          : `Welcome, ${data.name.split(" ")[0]}.`}
      </h1>
      {section === "overview" ? (
        <>
          <p className="muted">
            Your account is ready. Keep your workspace details up to date here.
          </p>
          <dl className="foundation-facts">
            <div>
              <dt>Workspace</dt>
              <dd>{data.workspaceName}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{data.role}</dd>
            </div>
            <div>
              <dt>Trial credits</dt>
              <dd>{data.credits}</dd>
            </div>
          </dl>
          <div className="foundation-notice">
            <h2>Video tools are being migrated.</h2>
            <p>
              Projects, uploads and rendering are not available in this
              workspace yet. The existing development studio uses a separate
              local data store.
            </p>
            <Button asChild>
              <Link href="/settings">Workspace settings</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="foundation-settings">
          <section>
            <h2>Your profile</h2>
            <p className="muted">{data.email}</p>
            <NameForm key={data.userId} name={data.name} />
          </section>
          <section>
            <h2>Workspace</h2>
            {["owner", "admin"].includes(data.role) ? (
              <NameForm
                key={data.workspaceId}
                name={data.workspaceName}
                workspaceId={data.workspaceId}
              />
            ) : (
              <p>Only owners and admins can change the workspace name.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
