import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, CreditCard, TrendingUp, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Credits() {
  const { data: balanceData, isLoading: balanceLoading } = trpc.credits.getBalance.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.credits.getTransactions.useQuery({ limit: 50 });
  const { data: usageStats, isLoading: statsLoading } = trpc.credits.getUsageStats.useQuery({ days: 30 });

  const balance = balanceData?.balance || 0;
  const freeTier = balanceData?.freeTier;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCredits = (amount: number) => {
    return amount.toFixed(4);
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "purchase":
      case "subscription_refill":
        return "bg-green-100 text-green-800 border-green-200";
      case "usage":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "refund":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getFeatureDisplayName = (feature: string) => {
    const names: Record<string, string> = {
      hts_search: "HTS Search",
      tariff_calc: "Tariff Calculator",
      regulations: "Regulations Lookup",
      checklist: "Compliance Checklist",
      chat: "AI Chat Assistant",
    };
    return names[feature] || feature;
  };

  // Check if balance is low (< 10% of typical usage)
  const isLowBalance = balance < 0.1 && balance > 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Credits Dashboard</h1>
          <p className="text-muted-foreground">
            Track your credit balance, usage history, and free tier status
          </p>
        </div>

        {/* Balance Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Current Balance */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div>
                  <div className="text-3xl font-bold mb-2">{formatCredits(balance)}</div>
                  <p className="text-sm text-muted-foreground">credits available</p>
                  {isLowBalance && (
                    <div className="mt-3 flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <p className="text-xs text-yellow-800">Low balance - consider purchasing more credits</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Free Tier Status */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Free Tier Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : freeTier ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Initial Searches</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold">{freeTier.initialSearchesRemaining}</div>
                      <span className="text-sm text-muted-foreground">/ 5 remaining</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Monthly Search</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold">{freeTier.monthlySearchesRemaining}</div>
                      <span className="text-sm text-muted-foreground">/ 1 remaining</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No free tier data</p>
              )}
            </CardContent>
          </Card>

          {/* 30-Day Usage */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                30-Day Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div>
                  <div className="text-3xl font-bold mb-2">{formatCredits(usageStats?.totalSpent || 0)}</div>
                  <p className="text-sm text-muted-foreground">credits spent</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Usage by Feature */}
        {usageStats && Object.keys(usageStats.byFeature).length > 0 && (
          <Card className="mb-8 border-2">
            <CardHeader>
              <CardTitle>Usage by Feature</CardTitle>
              <CardDescription>Credits spent on each feature in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(usageStats.byFeature)
                  .sort(([, a], [, b]) => b - a)
                  .map(([feature, amount]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="font-medium">{getFeatureDisplayName(feature)}</span>
                      <span className="text-muted-foreground">{formatCredits(amount)} credits</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Credits */}
        <Card className="mb-8 border-2 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Purchase Credits
            </CardTitle>
            <CardDescription>
              Choose a credit package to continue using AI-powered features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" disabled>
              View Pricing Plans (Coming Soon)
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Credit packages starting at $10/month with volume discounts
            </p>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent credit transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm mt-2">Your credit usage will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-semibold">Date</th>
                      <th className="text-left py-3 px-2 font-semibold">Type</th>
                      <th className="text-left py-3 px-2 font-semibold">Description</th>
                      <th className="text-left py-3 px-2 font-semibold">Feature</th>
                      <th className="text-right py-3 px-2 font-semibold">Amount</th>
                      <th className="text-right py-3 px-2 font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const amount = parseFloat(tx.amount as any) || 0;
                      const balanceAfter = parseFloat(tx.balanceAfter as any) || 0;
                      const isPositive = amount > 0;

                      return (
                        <tr key={tx.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 text-sm">{formatDate(tx.createdAt)}</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className={getTransactionTypeColor(tx.type)}>
                              {tx.type.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-sm">{tx.description}</td>
                          <td className="py-3 px-2 text-sm">
                            {tx.featureUsed ? getFeatureDisplayName(tx.featureUsed) : "-"}
                          </td>
                          <td className={`py-3 px-2 text-sm text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                            {isPositive ? "+" : ""}{formatCredits(amount)}
                          </td>
                          <td className="py-3 px-2 text-sm text-right text-muted-foreground">
                            {formatCredits(balanceAfter)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
