import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Search, Calculator, FileText, FolderOpen, CheckSquare,
  MessageSquare, Settings, Bell, LogOut, Package, Menu, X,
  Wallet, Stamp, User, ShieldCheck, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = (user as any)?.role === "admin";

  const { data: creditData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const toolItems = [
    { path: "/hts-search", label: "HTS Search", icon: Search },
    { path: "/tariff-calculator", label: "Tariff Calculator", icon: Calculator },
    { path: "/regulations", label: "Regulations", icon: FileText },
    { path: "/documents", label: "Documents", icon: FolderOpen },
    { path: "/checklists", label: "Checklists", icon: CheckSquare },
    { path: "/certificate-of-origin", label: "Certificate of Origin", icon: Stamp },
    { path: "/chat", label: "AI Assistant", icon: MessageSquare },
    { path: "/utilities", label: "Utilities", icon: Settings },
  ];

  const mobileAllItems = [
    ...toolItems,
    { path: "/my-shipments", label: "My Shipments", icon: Package },
    { path: "/alerts", label: "Alerts", icon: Bell },
    { path: "/credits", label: "Credits", icon: Wallet },
    { path: "/profile", label: "Profile", icon: User },
    ...(isAdmin ? [{ path: "/admin", label: "Admin Panel", icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const toolActive = toolItems.some((i) => i.path === location);

  return (
    <nav className="border-b border-black bg-white relative z-40">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" onClick={closeMobileMenu}>
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/93705925/ChEDaPiGwxAxXWSe.png"
                alt="CochitoCorp"
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold tracking-tight leading-none">CochitoCorp</span>
                <span className="text-[10px] sm:text-xs text-gray-600 leading-none">iTCP</span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center gap-1">
              {/* Tools dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={toolActive ? "default" : "ghost"} size="sm" className="gap-1">
                    Tools <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {toolItems.map(({ path, label, icon: Icon }) => (
                    <DropdownMenuItem key={path} asChild>
                      <Link href={path} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="w-4 h-4" /> {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Shipments */}
              <Link href="/my-shipments">
                <Button variant={location === "/my-shipments" ? "default" : "ghost"} size="sm" className="gap-2">
                  <Package className="w-4 h-4" /> Shipments
                </Button>
              </Link>

              {/* Alerts */}
              <Link href="/alerts">
                <Button variant={location === "/alerts" ? "default" : "ghost"} size="sm" className="gap-2">
                  <Bell className="w-4 h-4" /> Alerts
                </Button>
              </Link>

              {/* Credits with balance */}
              <Link href="/credits">
                <Button variant={location === "/credits" ? "default" : "ghost"} size="sm" className="gap-2">
                  <Wallet className="w-4 h-4" />
                  {creditData
                    ? <span className="font-mono text-xs">{Number(creditData.balance).toFixed(1)} cr</span>
                    : "Credits"}
                </Button>
              </Link>

              {/* Admin */}
              {isAdmin && (
                <Link href="/admin">
                  <Button
                    variant={location.startsWith("/admin") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <ShieldCheck className="w-4 h-4" /> Admin
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Right: user dropdown + mobile toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 hidden sm:flex max-w-[180px]">
                      <User className="w-4 h-4 shrink-0" />
                      <span className="truncate text-sm font-medium">{user?.name}</span>
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/credits" className="flex items-center gap-2 cursor-pointer">
                        <Wallet className="w-4 h-4" /> Credits
                        {creditData && (
                          <span className="ml-auto font-mono text-xs text-muted-foreground">
                            {Number(creditData.balance).toFixed(1)}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-red-600">
                            <ShieldCheck className="w-4 h-4" /> Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </>
            ) : (
              <Button asChild variant="default" size="sm">
                <a href={getLoginUrl()}>Login</a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-black shadow-lg z-50">
          <div className="container py-4 space-y-1">
            {mobileAllItems.map(({ path, label, icon: Icon }) => (
              <Link key={path} href={path} onClick={closeMobileMenu}>
                <Button
                  variant={location === path ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start gap-3"
                >
                  <Icon className="w-5 h-5" /> {label}
                </Button>
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { handleLogout(); closeMobileMenu(); }}
                className="w-full justify-start gap-3"
              >
                <LogOut className="w-5 h-5" /> Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
