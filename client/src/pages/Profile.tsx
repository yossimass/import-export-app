import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Wallet,
  Package,
  Stamp,
  Crown,
  ShieldCheck,
  ArrowRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Gift,
} from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  const { data: creditData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: transactions } = trpc.credits.getTransactions.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated }
  );

  const { data: shipments } = trpc.shipments.recent.useQuery(
    { limit: 5 },
    { enabled: isAuthenticated }
  );

  const { data: certificates } = trpc.certificate.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to view your profile.</p>
          <Button asChild>
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  const txTypeIcon = (type: string, amount: string) => {
    const n = Number(amount);
    if (n > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (type === "usage") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Gift className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center text-2xl font-bold">
            {(user?.name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{user?.name || "User"}</h1>
              {isAdmin && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <Crown className="w-3 h-3 mr-1" /> Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" /> {user?.email || "—"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Credits</span>
            </div>
            <p className="text-xl font-bold font-mono">
              {creditData ? Number(creditData.balance).toFixed(2) : "—"}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Shipments</span>
            </div>
            <p className="text-xl font-bold">{shipments?.length ?? "—"}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Stamp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Certificates</span>
            </div>
            <p className="text-xl font-bold">{certificates?.length ?? "—"}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-muted-foreground">Member Since</span>
            </div>
            <p className="text-sm font-bold">
              {user ? new Date((user as any).createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
            </p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Tier Status */}
          {creditData?.freeTier && (
            <Card className="p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-green-600" /> Free Tier Status
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Initial HTS Searches</span>
                  <span className="text-sm font-mono">
                    {creditData.freeTier.initialSearchesUsed} / 5 used
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (creditData.freeTier.initialSearchesUsed / 5) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Free Search</span>
                  <Badge variant={creditData.freeTier.monthlySearchesRemaining > 0 ? "default" : "secondary"}>
                    {creditData.freeTier.monthlySearchesRemaining > 0 ? "Available" : "Used this month"}
                  </Badge>
                </div>
              </div>
              <Button
                className="w-full mt-4"
                size="sm"
                onClick={() => setLocation("/credits")}
              >
                <Wallet className="w-4 h-4 mr-2" /> Buy Credits
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/my-shipments")}>
                <Package className="w-4 h-4 mr-3" /> My Shipments
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/certificate-of-origin")}>
                <Stamp className="w-4 h-4 mr-3" /> New Certificate of Origin
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/credits")}>
                <Wallet className="w-4 h-4 mr-3" /> Credits & Billing
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setLocation("/admin")}
                >
                  <ShieldCheck className="w-4 h-4 mr-3" /> Admin Panel
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        {transactions && transactions.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" /> Recent Credit Activity
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/credits")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {txTypeIcon(tx.type, tx.amount)}
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type}</p>
                      {tx.featureUsed && (
                        <p className="text-xs text-muted-foreground capitalize">{tx.featureUsed.replace(/_/g, " ")}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {Number(tx.amount) >= 0 ? "+" : ""}{Number(tx.amount).toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
