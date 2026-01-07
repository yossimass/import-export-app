import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { 
  Search, 
  Calculator, 
  FileText, 
  FolderOpen, 
  CheckSquare, 
  MessageSquare, 
  Settings, 
  Bell,
  LogOut,
  Package
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const navItems = [
    { path: "/hts-search", label: "HTS Search", icon: Search },
    { path: "/tariff-calculator", label: "Tariff Calculator", icon: Calculator },
    { path: "/regulations", label: "Regulations", icon: FileText },
    { path: "/documents", label: "Documents", icon: FolderOpen },
    { path: "/checklists", label: "Checklists", icon: CheckSquare },
    { path: "/my-shipments", label: "My Shipments", icon: Package },
    { path: "/chat", label: "AI Assistant", icon: MessageSquare },
    { path: "/utilities", label: "Utilities", icon: Settings },
    { path: "/alerts", label: "Alerts", icon: Bell },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <nav className="border-b border-black bg-white">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/cochitocorp-logo.png" alt="CochitoCorp" className="w-10 h-10" />
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight leading-none">CochitoCorp</span>
                <span className="text-xs text-gray-600 leading-none">iTCP</span>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm font-medium hidden md:block">{user?.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
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
    </nav>
  );
}
