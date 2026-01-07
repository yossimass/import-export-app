import Navigation from "@/components/Navigation";
import WorkflowStepper from "@/components/WorkflowStepper";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const WORKFLOW_STEPS = [
  { id: 1, label: "HTS Code", path: "/hts-search" },
  { id: 2, label: "Tariff Calc", path: "/tariff-calculator" },
  { id: 3, label: "Documents", path: "/documents" },
  { id: 4, label: "Compliance", path: "/checklists" },
];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { CheckSquare, Plus, FileDown } from "lucide-react";
import { exportChecklistPDF } from "@/lib/exportUtils";
import { toast } from "sonner";

export default function Checklists() {
  const [htsCode, setHtsCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [checklist, setChecklist] = useState<any>(null);
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  
  // Extract shipmentId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const shipmentIdFromUrl = urlParams.get('shipmentId');
  
  // Load shipment data if shipmentId is in URL
  const { data: shipment } = trpc.shipments.get.useQuery(
    { shipmentId: parseInt(shipmentIdFromUrl || '0') },
    { enabled: !!shipmentIdFromUrl }
  );
  
  useEffect(() => {
    if (shipmentIdFromUrl) {
      setShipmentId(parseInt(shipmentIdFromUrl));
    }
    if (shipment) {
      setHtsCode(shipment.htsCode || '');
      setOrigin(shipment.originCountry || '');
      setDestination(shipment.destinationCountry || '');
    }
  }, [shipmentIdFromUrl, shipment]);
  
  const generateMutation = trpc.checklists.generate.useMutation({
    onSuccess: (data) => {
      setChecklist(data);
      toast.success("Checklist generated!");
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!htsCode.trim() || !origin.trim() || !destination.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    // Use shipmentId from URL or create new one
    generateMutation.mutate({
      shipmentId: shipmentId || 1,
      shipmentType: "import",
      originCountry: origin,
      destinationCountry: destination,
      productCategory: "General",
      htsCode,
    });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <WorkflowStepper currentStep={4} steps={WORKFLOW_STEPS} />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Compliance Checklists</h1>
          <p className="text-muted-foreground">
            AI-generated checklists for your specific trade scenario
          </p>
        </div>

        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Generate Checklist</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">HTS Code</label>
              <Input
                placeholder="e.g., 8471.30"
                value={htsCode}
                onChange={(e) => setHtsCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Origin Country</label>
              <Input
                placeholder="e.g., China"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Destination Country</label>
              <Input
                placeholder="e.g., United States"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Generate Checklist"}
          </Button>
        </Card>

        {checklist && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-8 h-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Compliance Checklist</h2>
                  <p className="text-sm text-muted-foreground">
                    {checklist.items?.length || 0} items • Generated {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!checklist) return;
                  exportChecklistPDF({
                    htsCode,
                    origin,
                    destination,
                    items: checklist.items || [],
                  });
                  toast.success('Checklist exported as PDF');
                }}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            <div className="space-y-4">
              {checklist.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Checkbox id={`item-${i}`} />
                  <div className="flex-1">
                    <label
                      htmlFor={`item-${i}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {item.task || item.title || item}
                    </label>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                    {item.deadline && (
                      <p className="text-xs text-muted-foreground mt-1">Deadline: {item.deadline}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {checklist.notes && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Additional Notes:</p>
                <p className="text-sm text-muted-foreground">{checklist.notes}</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
