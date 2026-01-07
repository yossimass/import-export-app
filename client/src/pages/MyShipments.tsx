import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Package, ArrowRight, Trash2, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MyShipments() {
  const [, setLocation] = useLocation();
  const { data: shipments, isLoading, refetch } = trpc.shipments.list.useQuery();
  const deleteMutation = trpc.shipments.delete.useMutation({
    onSuccess: () => {
      toast.success("Shipment deleted");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete shipment");
    },
  });

  const getStepRoute = (step: number) => {
    switch (step) {
      case 1: return "/hts-search";
      case 2: return "/tariff-calculator";
      case 3: return "/documents";
      case 4: return "/checklists";
      default: return "/hts-search";
    }
  };

  const getStepName = (step: number) => {
    switch (step) {
      case 1: return "HTS Code Search";
      case 2: return "Tariff Calculation";
      case 3: return "Documents";
      case 4: return "Compliance Review";
      default: return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "bg-green-100 text-green-800";
      case "reviewing": return "bg-blue-100 text-blue-800";
      case "documenting": return "bg-yellow-100 text-yellow-800";
      case "calculating": return "bg-orange-100 text-orange-800";
      case "draft": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleResume = (shipmentId: number, workflowStep: number) => {
    const route = getStepRoute(workflowStep);
    setLocation(`${route}?shipmentId=${shipmentId}`);
  };

  const handleDelete = (shipmentId: number) => {
    if (confirm("Are you sure you want to delete this shipment?")) {
      deleteMutation.mutate({ shipmentId });
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">My Shipments</h1>
          <p className="text-muted-foreground">
            View and manage all your saved trade compliance workflows
          </p>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading shipments...</p>
          </div>
        )}

        {!isLoading && (!shipments || shipments.length === 0) && (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold mb-2">No shipments yet</h3>
            <p className="text-muted-foreground mb-6">
              Start a new workflow to create your first shipment
            </p>
            <Button onClick={() => setLocation("/hts-search")}>
              Start HTS Search
            </Button>
          </Card>
        )}

        {shipments && shipments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shipments.map((shipment: any) => (
              <Card key={shipment.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="font-bold text-lg">
                        {shipment.htsCode || "Draft Shipment"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        ID: {shipment.id}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(shipment.status)}>
                    {shipment.status}
                  </Badge>
                </div>

                {shipment.originCountry && shipment.destinationCountry && (
                  <div className="mb-4 text-sm">
                    <p>
                      <span className="font-semibold">Route:</span>{" "}
                      {shipment.originCountry} → {shipment.destinationCountry}
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">
                      Step {shipment.workflowStep} of 4 ({(shipment.workflowStep / 4 * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(shipment.workflowStep / 4) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Current: {getStepName(shipment.workflowStep)}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Updated {new Date(shipment.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleResume(shipment.id, shipment.workflowStep)}
                    className="flex-1"
                  >
                    Resume
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(shipment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
