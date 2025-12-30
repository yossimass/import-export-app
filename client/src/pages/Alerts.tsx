import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Alerts() {
  const [alertType, setAlertType] = useState<"tariff_change" | "regulation_update" | "license_renewal" | "shipment_status">("tariff_change");
  const [email, setEmail] = useState("");
  const [htsCode, setHtsCode] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const alertsQuery = trpc.alerts.list.useQuery();
  
  const subscribeMutation = trpc.alerts.subscribe.useMutation({
    onSuccess: () => {
      toast.success("Alert subscription created");
      alertsQuery.refetch();
      setEmail("");
      setHtsCode("");
      setCountryCode("");
    },
    onError: (error: any) => {
      toast.error("Failed to create alert: " + error.message);
    },
  });

  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alert deleted");
      alertsQuery.refetch();
    },
  });

  const handleSubscribe = () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    subscribeMutation.mutate({
      alertType,
      email,
      htsCode: htsCode || undefined,
      countryCode: countryCode || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Alert Subscriptions</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Subscribe to automated email alerts for tariff changes, regulations, and more.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Alert Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select value={alertType} onValueChange={(value: any) => setAlertType(value)}>
                  <SelectTrigger className="border-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tariff_change">Tariff Changes</SelectItem>
                    <SelectItem value="regulation_update">Regulation Updates</SelectItem>
                    <SelectItem value="license_renewal">License Renewals</SelectItem>
                    <SelectItem value="shipment_status">Shipment Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-black"
                />
              </div>

              <div className="space-y-2">
                <Label>HTS Code (Optional)</Label>
                <Input
                  placeholder="e.g., 8517.12.00"
                  value={htsCode}
                  onChange={(e) => setHtsCode(e.target.value)}
                  className="border-black"
                />
              </div>

              <div className="space-y-2">
                <Label>Country Code (Optional)</Label>
                <Input
                  placeholder="e.g., USA"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="border-black"
                  maxLength={3}
                />
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={subscribeMutation.isPending}
                className="w-full gap-2"
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Subscribe to Alerts
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-black">
            <CardHeader>
              <CardTitle>Your Alert Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                </div>
              ) : alertsQuery.data && alertsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {alertsQuery.data.map((alert: any) => (
                    <div key={alert.id} className="border border-black p-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-sm mb-1">{alert.title}</div>
                        <div className="text-xs text-muted-foreground">{alert.message}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ alertId: alert.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No alert subscriptions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
