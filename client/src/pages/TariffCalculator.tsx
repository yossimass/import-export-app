import Navigation from "@/components/Navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calculator, Info } from "lucide-react";
import { toast } from "sonner";

export default function TariffCalculator() {
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const shipmentId = searchParams.get('shipmentId') ? parseInt(searchParams.get('shipmentId')!) : undefined;
  
  const { data: shipment } = trpc.shipments.get.useQuery(
    { shipmentId: shipmentId! },
    { enabled: !!shipmentId }
  );

  const [formData, setFormData] = useState({
    htsCode: "",
    originCountry: "",
    destinationCountry: "",
    value: "",
    quantity: "",
    weight: "",
    incoterm: "",
    freightCost: "",
    insuranceCost: "",
  });

  // Pre-populate form with shipment data
  useEffect(() => {
    if (shipment) {
      setFormData(prev => ({
        ...prev,
        htsCode: shipment.htsCode || "",
        originCountry: shipment.originCountry || "",
        destinationCountry: shipment.destinationCountry || "",
        value: shipment.value?.toString() || "",
        quantity: shipment.quantity?.toString() || "",
        weight: shipment.weight?.toString() || "",
        incoterm: shipment.incoterm || "",
        freightCost: shipment.freightCost?.toString() || "",
        insuranceCost: shipment.insuranceCost?.toString() || "",
      }));
    }
  }, [shipment]);

  const [result, setResult] = useState<any>(null);

  const calculateMutation = trpc.tariff.calculate.useMutation({
    onSuccess: (data) => {
      console.log('[TariffCalculator] Calculation success, data:', data);
      setResult(data);
      toast.success("Calculation complete!");
    },
    onError: (error) => {
      console.error('[TariffCalculator] Calculation error:', error);
      toast.error(error.message);
    },
  });
  const handleCalculate = () => {
    console.log('[TariffCalculator] handleCalculate called');
    console.log('[TariffCalculator] formData:', formData);
    
    if (!formData.htsCode || !formData.originCountry || !formData.destinationCountry || !formData.value) {
      toast.error("Please fill in all required fields");
      console.log('[TariffCalculator] Missing required fields');
      return;
    }

    console.log('[TariffCalculator] Calling mutation with params:', {
      htsCode: formData.htsCode,
      originCountry: formData.originCountry,
      destinationCountry: formData.destinationCountry,
      value: formData.value,
      quantity: formData.quantity,
      weight: formData.weight,
      incoterm: formData.incoterm,
      freightCost: formData.freightCost,
      insuranceCost: formData.insuranceCost,
      shipmentId: shipmentId,
    });

    calculateMutation.mutate({
      htsCode: formData.htsCode,
      originCountry: formData.originCountry,
      destinationCountry: formData.destinationCountry,
      value: parseFloat(formData.value),
      quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      incoterm: formData.incoterm || undefined,
      freightCost: formData.freightCost ? parseFloat(formData.freightCost) : undefined,
      insuranceCost: formData.insuranceCost ? parseFloat(formData.insuranceCost) : undefined,
      shipmentId: shipmentId,
    });
  };

  console.log('[TariffCalculator] Current result:', result, 'isPending:', calculateMutation.isPending);

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Tariff Calculator</h1>
          <p className="text-muted-foreground">
            Calculate duties with MFN rates, trade agreements, and landed cost breakdown
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Shipment Details</h2>
            
            <div className="space-y-4">
              <div>
                <Label>HTS Code *</Label>
                <Input
                  placeholder="e.g., 8471.30.01"
                  value={formData.htsCode}
                  onChange={(e) => setFormData({ ...formData, htsCode: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Origin Country *</Label>
                  <Input
                    placeholder="e.g., CHN"
                    value={formData.originCountry}
                    onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Destination Country *</Label>
                  <Input
                    placeholder="e.g., USA"
                    value={formData.destinationCountry}
                    onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Merchandise Value (USD) *</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    placeholder="500"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Incoterm</Label>
                <Select value={formData.incoterm} onValueChange={(val) => setFormData({ ...formData, incoterm: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select incoterm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                    <SelectItem value="CIF">CIF - Cost, Insurance, Freight</SelectItem>
                    <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                    <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                    <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Freight Cost (USD)</Label>
                  <Input
                    type="number"
                    placeholder="500"
                    value={formData.freightCost}
                    onChange={(e) => setFormData({ ...formData, freightCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Insurance Cost (USD)</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={formData.insuranceCost}
                    onChange={(e) => setFormData({ ...formData, insuranceCost: e.target.value })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleCalculate} 
                disabled={calculateMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Calculator className="w-4 h-4 mr-2" />
                {calculateMutation.isPending ? "Calculating..." : "Calculate Tariff"}
              </Button>
            </div>
          </Card>

          {result && (
            <div className="space-y-6">
              <Card className="p-6 bg-primary text-primary-foreground">
                <h3 className="text-sm font-bold mb-2">LANDED COST</h3>
                <p className="text-4xl font-bold">${result.landedCost?.toFixed(2) || "0.00"}</p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold mb-4">Duty Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MFN Rate</span>
                    <span className="font-mono font-bold">{result.mfnRate}%</span>
                  </div>
                  {result.preferentialRate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preferential Rate</span>
                      <span className="font-mono font-bold text-green-600">{result.preferentialRate}%</span>
                    </div>
                  )}
                  {result.additionalDuties > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Additional Duties</span>
                      <span className="font-mono font-bold text-red-600">{result.additionalDuties}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-bold">Applied Rate</span>
                    <span className="font-mono font-bold text-lg">{result.appliedRate}%</span>
                  </div>
                </div>
              </Card>

              {result.tradeAgreement && (
                <Card className="p-6 bg-green-50">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-green-600 mt-1" />
                    <div>
                      <p className="font-bold text-green-900">Trade Agreement Applied</p>
                      <p className="text-sm text-green-700">{result.tradeAgreement}</p>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="font-bold mb-4">Cost Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Duty Amount</span>
                    <span className="font-mono">${result.dutyAmount?.toFixed(2)}</span>
                  </div>
                  {result.mpf > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>MPF</span>
                      <span className="font-mono">${result.mpf?.toFixed(2)}</span>
                    </div>
                  )}
                  {result.hmf > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>HMF</span>
                      <span className="font-mono">${result.hmf?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total Duties & Fees</span>
                    <span className="font-mono">${result.totalDuties?.toFixed(2)}</span>
                  </div>
                </div>
              </Card>

              {result.rationale && (
                <Card className="p-6">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-bold mb-2">Calculation Rationale</p>
                      <p className="text-sm text-muted-foreground">{result.rationale}</p>
                      {result.rateSource && (
                        <p className="text-xs text-muted-foreground mt-2">Source: {result.rateSource}</p>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
