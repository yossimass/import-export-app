import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Search, Calculator, FolderOpen, ListChecks, Scale, Stamp, Wrench,
  Package, Bell, MessageSquareText, ShieldCheck, User, Menu,
} from "lucide-react";
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

function SidebarFooter() {
  return (
    <div className="space-y-2">
      <AiStatusButton />
      <Link href="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
        <User className="size-4" /> Your workspace
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
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
          <div className="border-t p-3"><SidebarFooter /></div>
        </SheetContent>
      </Sheet>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
