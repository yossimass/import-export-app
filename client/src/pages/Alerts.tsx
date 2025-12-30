import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function Alerts() {
  const prefsQuery = trpc.alerts.getPreferences.useQuery();
  const alertsQuery = trpc.alerts.list.useQuery({ unreadOnly: false });
  
  const updatePrefsMutation = trpc.alerts.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferences updated");
      prefsQuery.refetch();
    },
  });

  const markReadMutation = trpc.alerts.markRead.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updatePrefsMutation.mutate({ [key]: value } as any);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Alerts & Notifications</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Manage your notification preferences and view alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prefsQuery.isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                </div>
              ) : prefsQuery.data ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Tariff Changes</Label>
                    <Switch
                      checked={prefsQuery.data.tariffChanges}
                      onCheckedChange={(checked) => handleToggle("tariffChanges", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Regulation Updates</Label>
                    <Switch
                      checked={prefsQuery.data.regulationUpdates}
                      onCheckedChange={(checked) => handleToggle("regulationUpdates", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>License Renewals</Label>
                    <Switch
                      checked={prefsQuery.data.licenseRenewals}
                      onCheckedChange={(checked) => handleToggle("licenseRenewals", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Shipment Updates</Label>
                    <Switch
                      checked={prefsQuery.data.shipmentUpdates}
                      onCheckedChange={(checked) => handleToggle("shipmentUpdates", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch
                      checked={prefsQuery.data.emailNotifications}
                      onCheckedChange={(checked) => handleToggle("emailNotifications", checked)}
                    />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-black">
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                </div>
              ) : alertsQuery.data && alertsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {alertsQuery.data.map((alert) => (
                    <div
                      key={alert.id}
                      className={`border border-black p-4 ${alert.isRead ? "bg-white" : "bg-secondary"}`}
                      onClick={() => !alert.isRead && markReadMutation.mutate({ id: alert.id })}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-sm mb-1">{alert.title}</div>
                          <div className="text-xs text-muted-foreground">{alert.message}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.sentAt).toLocaleString()}
                          </div>
                        </div>
                        {alert.isRead && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No alerts yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
