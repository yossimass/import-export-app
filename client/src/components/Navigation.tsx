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
  Package,
  Menu,
  X,
  Wallet,
  Stamp
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/hts-search", label: "HTS Search", icon: Search },
    { path: "/tariff-calculator", label: "Tariff Calculator", icon: Calculator },
    { path: "/regulations", label: "Regulations", icon: FileText },
    { path: "/documents", label: "Documents", icon: FolderOpen },
    { path: "/checklists", label: "Checklists", icon: CheckSquare },
    { path: "/my-shipments", label: "My Shipments", icon: Package },
    { path: "/chat", label: "AI Assistant", icon: MessageSquare },
    { path: "/certificate-of-origin", label: "Certificate of Origin", icon: Stamp },
    { path: "/credits", label: "Credits", icon: Wallet },
    { path: "/utilities", label: "Utilities", icon: Settings },
    { path: "/alerts", label: "Alerts", icon: Bell },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="border-b border-black bg-white relative">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" onClick={closeMobileMenu}>
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/93705925/ChEDaPiGwxAxXWSe.png" alt="CochitoCorp" className="w-8 h-8 sm:w-10 sm:h-10" />
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold tracking-tight leading-none">CochitoCorp</span>
                <span className="text-[10px] sm:text-xs text-gray-600 leading-none">iTCP</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
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

          {/* Auth Section + Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-xs sm:text-sm font-medium hidden md:block">{user?.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2 hidden sm:flex"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
                {/* Mobile Menu Toggle */}
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

      {/* Mobile Menu Dropdown */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-black shadow-lg z-50">
          <div className="container py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path} onClick={closeMobileMenu}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-3"
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleLogout();
                  closeMobileMenu();
                }}
                className="w-full justify-start gap-3"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
