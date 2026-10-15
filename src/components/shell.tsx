"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Clapperboard,
  CreditCard,
  FolderClosed,
  GalleryVerticalEnd,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { api, useAction, useApp } from "./app-provider";
import { Button } from "./ui/button";
const nav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: FolderClosed },
  { href: "/characters", label: "Character Studio", icon: Users },
  { href: "/pipelines", label: "Pipelines", icon: Workflow },
  { href: "/automation", label: "Automation", icon: KeyRound },
  { href: "/review", label: "Review Queue", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/assets", label: "Asset Library", icon: GalleryVerticalEnd },
];
const bottom = [
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/help", label: "Help & resources", icon: CircleHelp },
];
export function Logo({ name = "Clipvero" }: { name?: string }) {
  return (
    <span className="logo">
      <span className="logo-mark">
        <AudioLines size={22} strokeWidth={2.5} />
      </span>
      <span>
        {name}
        <span className="logo-dot">.</span>
      </span>
    </span>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const path = usePathname(),
    router = useRouter(),
    { data, error, isLoading, refetch } = useApp(),
    { act, busy } = useAction();
  const current = nav.concat(bottom).find((n) => path.startsWith(n.href));
  const reviewCount =
    data?.projects.filter((p) => p.status === "review").length || 0;
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
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
          <Logo name={data?.appName} />
        </Link>
        <div className="workspace-badge">
          <span className="workspace-avatar">
            {data?.me.workspaceName[0] || "S"}
          </span>
          <span className="workspace-copy">
            <strong>{data?.me.workspaceName || "Your studio"}</strong>
            <small>Personal workspace</small>
          </span>
        </div>
        <Button asChild className="sidebar-create">
          <Link href="/create" onClick={() => setMobile(false)}>
            <Plus size={17} />
            <span>Create video</span>
          </Link>
        </Button>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              aria-current={path.startsWith(item.href) ? "page" : undefined}
              onClick={() => setMobile(false)}
              className={`nav-item ${path.startsWith(item.href) ? "nav-active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.href === "/review" && reviewCount > 0 && (
                <span className="nav-count">{reviewCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="credits-widget">
          <div className="row-between">
            <span>
              <Sparkles size={14} /> Credits available
            </span>
            <strong>{data?.me.credits ?? "—"}</strong>
          </div>
          <small>
            {data?.me.plan === "trial"
              ? "Your one-time starter credits"
              : `${data?.me.plan || "Your"} plan`}
          </small>
          <Link href="/billing">
            Manage your plan <ArrowUpRight size={14} />
          </Link>
        </div>
        <nav aria-label="Account navigation">
          {bottom.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`nav-item ${path === item.href ? "nav-active" : ""}`}
              onClick={() => setMobile(false)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-profile">
          <span className="profile-avatar">
            {data?.me.name.slice(0, 2).toUpperCase() || "CV"}
          </span>
          <span className="profile-copy">
            <strong>{data?.me.name || "Your account"}</strong>
            <small>Creator workspace</small>
          </span>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Sign out"
            onClick={() =>
              act(async () => {
                await api("auth/logout", "POST");
                router.push("/login");
              })
            }
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button desktop-only"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronsRight size={18} />
              ) : (
                <ChevronsLeft size={18} />
              )}
            </button>
            <button
              className="icon-button mobile-only"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {path.startsWith("/editor")
                  ? "Video editor"
                  : current?.label || "Overview"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span
              className={`worker-status ${data?.capabilities.worker ? "online" : ""}`}
            >
              <i />
              {data?.capabilities.worker ? "Worker online" : "Worker offline"}
            </span>
            <span className="topbar-divider" />
            <Link href="/help" className="icon-button" aria-label="Help">
              <CircleHelp size={18} />
            </Link>
            <span className="profile-avatar small">
              {data?.me.name[0] || "C"}
            </span>
          </div>
        </header>
        <main
          id="main"
          className={
            path.startsWith("/editor") ? "editor-main" : "page-content"
          }
        >
          {isLoading ? (
            <div className="page-loading" role="status">
              <Clapperboard className="loading-icon" />
              <p>Opening your studio…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <h1>We couldn’t load your workspace</h1>
              <p>{error.message}</p>
              <Button onClick={() => refetch()}>Try again</Button>
            </div>
          ) : (
            children
          )}
        </main>
        {!path.startsWith("/editor") && (
          <footer className="app-footer">
            <span>Made for your next great idea.</span>
            <span>
              <span className="subtle-dot" /> Your work is saved in your
              workspace
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
