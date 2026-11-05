import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Search, Calculator, FolderOpen, ListChecks, Scale, Stamp, Wrench,
  Package, Bell, MessageSquareText, ShieldCheck, User, Menu, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { AiStatusButton } from "./AiSettings";
import { cn } from "@/lib/utils";

type NavItem = { path: string; label: string; icon: typeof Search; step?: number };

const GROUPS: Array<{ title?: string; items: NavItem[] }> = [
  { items: [{ path: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Shipment workflow",
    items: [
      { path: "/hts-search", label: "Classify", icon: Search, step: 1 },
      { path: "/tariff-calculator", label: "Duties & landed cost", icon: Calculator, step: 2 },
      { path: "/documents", label: "Documents", icon: FolderOpen, step: 3 },
      { path: "/checklists", label: "Compliance checklist", icon: ListChecks, step: 4 },
    ],
  },
  {
    title: "Reference",
    items: [
      { path: "/regulations", label: "Regulations", icon: Scale },
      { path: "/certificate-of-origin", label: "Certificate of origin", icon: Stamp },
      { path: "/utilities", label: "Currency & freight", icon: Wrench },
    ],
  },
  {
    title: "Workspace",
    items: [
      { path: "/my-shipments", label: "Shipments", icon: Package },
      { path: "/assistant", label: "Assistant", icon: MessageSquareText },
      { path: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">iT</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">iTCP</span>
        <span className="block text-[11px] text-muted-foreground">Trade compliance · alpha</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const groups = isAdmin
    ? [...GROUPS, { title: "Admin", items: [{ path: "/admin", label: "Admin panel", icon: ShieldCheck }] }]
    : GROUPS;

  return (
    <nav className="space-y-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>}
          <ul className="space-y-0.5">
            {group.items.map(({ path, label, icon: Icon, step }) => {
              const active = path === "/" ? location === "/" : location.startsWith(path);
              return (
                <li key={path}>
                  <Link
                    href={path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-primary/10 font-medium text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {step && <span className={cn("grid size-5 place-items-center rounded-full text-[10px]", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{step}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

const AUTH_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled",
  not_configured: "Google sign-in isn't set up on this site yet",
  invalid_state: "Sign-in expired. Please try again",
};

function Account({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isSignedIn, signInUrl, logout } = useAuth();
  const { data: providers } = trpc.auth.providers.useQuery();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2">
        <Link href="/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(user?.name || user?.email || "?")[0].toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-medium">{user?.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
          </span>
        </Link>
        <Button variant="ghost" size="icon" className="size-7" onClick={logout} aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Link href="/profile" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
        <User className="size-4" /> Your workspace
      </Link>
      {providers?.google && (
        <a
          href={signInUrl()}
          className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
          title="Keep your shipments across devices. Anything in this browser's workspace comes with you."
        >
          <GoogleIcon /> Sign in with Google
        </a>
      )}
    </>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-2">
      <AiStatusButton />
      <Account onNavigate={onNavigate} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Google sign-in redirects back with ?auth_error=<code> when it fails
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("auth_error");
    if (!code) return;
    toast.error(AUTH_ERRORS[code] ?? "Google sign-in failed. Please try again");
    url.searchParams.delete("auth_error");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5"><Logo /></div>
        <div className="flex-1 overflow-y-auto px-3 py-2"><NavList /></div>
        <div className="border-t p-3"><SidebarFooter /></div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <AiStatusButton compact className="w-auto py-1.5" />
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></Button>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center px-5"><Logo /></div>
          <div className="flex-1 overflow-y-auto px-3 py-2"><NavList onNavigate={() => setOpen(false)} /></div>
          <div className="border-t p-3"><SidebarFooter onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
