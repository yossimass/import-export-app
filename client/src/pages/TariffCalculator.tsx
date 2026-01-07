import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import WorkflowStepper from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calculator, Info, TrendingUp, DollarSign, Package, FileDown, FileSpreadsheet } from "lucide-react";
import { exportTariffPDF, exportTariffCSV } from "@/lib/exportUtils";
import { toast } from "sonner";
import { COUNTRIES } from "@/../../shared/countries";

const WORKFLOW_STEPS = [
  { id: 1, label: "HTS Code", path: "/hts-search" },
  { id: 2, label: "Tariff Calc", path: "/tariff-calculator" },
  { id: 3, label: "Documents", path: "/documents" },
  { id: 4, label: "Compliance", path: "/checklists" },
];

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
    value: "10000",
    quantity: "100",
    weight: "500",
    incoterm: "FOB",
    freightCost: "500",
    insuranceCost: "100",
  });

  // Pre-populate form with shipment data
  useEffect(() => {
    if (shipment) {
      setFormData(prev => ({
        ...prev,
        htsCode: shipment.htsCode || prev.htsCode,
        originCountry: shipment.originCountry || prev.originCountry,
        destinationCountry: shipment.destinationCountry || prev.destinationCountry,
        value: shipment.value?.toString() || prev.value,
        quantity: shipment.quantity?.toString() || prev.quantity,
        weight: shipment.weight?.toString() || prev.weight,
        incoterm: shipment.incoterm || prev.incoterm,
        freightCost: shipment.freightCost?.toString() || prev.freightCost,
        insuranceCost: shipment.insuranceCost?.toString() || prev.insuranceCost,
      }));
    }
  }, [shipment]);

  const [result, setResult] = useState<any>(null);

  // Auto-save mutation
  const updateShipmentMutation = trpc.shipments.update.useMutation();

  // Auto-save form data with debounce
  useEffect(() => {
    if (!shipmentId) return;
    
    const timer = setTimeout(() => {
      updateShipmentMutation.mutate({
        shipmentId,
        data: {
          htsCode: formData.htsCode || undefined,
          originCountry: formData.originCountry || undefined,
          destinationCountry: formData.destinationCountry || undefined,
          value: formData.value ? parseFloat(formData.value) : undefined,
          quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
          weight: formData.weight ? parseFloat(formData.weight) : undefined,
          incoterm: formData.incoterm || undefined,
          freightCost: formData.freightCost ? parseFloat(formData.freightCost) : undefined,
          insuranceCost: formData.insuranceCost ? parseFloat(formData.insuranceCost) : undefined,
          workflowStep: 2,
          status: "calculating",
        },
      });
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [formData, shipmentId]);

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

    console.log('[TariffCalculator] Calling mutation with params');

    calculateMutation.mutate({
      htsCode: formData.htsCode,
      originCountry: formData.originCountry,
      destinationCountry: formData.destinationCountry,
      value: parseFloat(formData.value),
      quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      incoterm: formData.incoterm || undefined,
      freightCost: formData.freightCost ? parseFloat(formData.freightCost) : undefined,
      insuranceCost: formData.insuranceCost ? parseFloat(formData.insuranceCost) : undefined,
    });
  };

  console.log('[TariffCalculator] Current result:', result, 'isPending:', calculateMutation.isPending);

  return (
    <div className="min-h-screen">
      <Navigation />
      <WorkflowStepper currentStep={2} steps={WORKFLOW_STEPS} />
      <div className="container mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Tariff Calculator</h1>
        <p className="text-gray-600">
          Calculate duties with MFN rates, trade agreements, and landed cost breakdown
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
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
                  <Select
                    value={formData.originCountry}
                    onValueChange={(value) => setFormData({ ...formData, originCountry: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destination Country *</Label>
                  <Select
                    value={formData.destinationCountry}
                    onValueChange={(value) => setFormData({ ...formData, destinationCountry: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Merchandise Value (USD) *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Incoterm</Label>
                <Select
                  value={formData.incoterm}
                  onValueChange={(value) => setFormData({ ...formData, incoterm: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select incoterm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                    <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                    <SelectItem value="FOB">FOB - Free on Board</SelectItem>
                    <SelectItem value="CFR">CFR - Cost and Freight</SelectItem>
                    <SelectItem value="CIF">CIF - Cost, Insurance and Freight</SelectItem>
                    <SelectItem value="DAP">DAP - Delivered at Place</SelectItem>
                    <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Freight Cost (USD)</Label>
                  <Input
                    type="number"
                    value={formData.freightCost}
                    onChange={(e) => setFormData({ ...formData, freightCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Insurance Cost (USD)</Label>
                  <Input
                    type="number"
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
                <Calculator className="mr-2 h-4 w-4" />
                {calculateMutation.isPending ? "Calculating..." : "Calculate Tariff"}
              </Button>
            </div>
          </Card>
        </div>

        <div>
          {calculateMutation.isPending && (
            <Card className="p-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Calculating tariffs...</p>
                </div>
              </div>
            </Card>
          )}

          {result && !calculateMutation.isPending && (
            <div className="space-y-4">
              <Card className="p-6 bg-red-50 border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">Total Landed Cost</h3>
                  <DollarSign className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-3xl font-bold text-red-600">
                  ${result.landedCost?.toLocaleString() || 'N/A'}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-red-600" />
                  Duty Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Duty Rate</span>
                    <span className="font-semibold">{result.appliedRate || result.mfnRate || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Duty Amount</span>
                    <span className="font-semibold">${result.dutyAmount?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Additional Duties</span>
                    <span className="font-semibold">${result.additionalDuties?.toLocaleString() || '0'}</span>
                  </div>
                  {result.tradeAgreement && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Trade Agreement</span>
                      <span className="font-semibold text-green-600">{result.tradeAgreement}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center">
                  <Package className="mr-2 h-5 w-5 text-red-600" />
                  Cost Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Merchandise Value</span>
                    <span className="font-semibold">${parseFloat(formData.value).toLocaleString()}</span>
                  </div>
                  {formData.freightCost && parseFloat(formData.freightCost) > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Freight</span>
                      <span className="font-semibold">${parseFloat(formData.freightCost).toLocaleString()}</span>
                    </div>
                  )}
                  {formData.insuranceCost && parseFloat(formData.insuranceCost) > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Insurance</span>
                      <span className="font-semibold">${parseFloat(formData.insuranceCost).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Duties</span>
                    <span className="font-semibold text-red-600">
                      ${((result.dutyAmount || 0) + (result.additionalDuties || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              {result.explanation && (
                <Card className="p-6 bg-blue-50 border-blue-200">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold mb-2">Explanation</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{result.explanation}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Export Buttons */}
              <div className="flex gap-3 mb-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!result) return;
                    exportTariffPDF({
                      htsCode: formData.htsCode,
                      origin: formData.originCountry,
                      destination: formData.destinationCountry,
                      value: parseFloat(formData.value),
                      freight: parseFloat(formData.freightCost),
                      insurance: parseFloat(formData.insuranceCost),
                      appliedRate: result.appliedRate || 'N/A',
                      dutyAmount: result.dutyAmount || 0,
                      additionalDuties: result.additionalDuties || 0,
                      totalDuties: (result.dutyAmount || 0) + (result.additionalDuties || 0),
                      landedCost: result.landedCost || 0,
                      tradeAgreement: result.tradeAgreement,
                      calculationDate: new Date().toISOString(),
                    });
                    toast.success('PDF exported successfully');
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!result) return;
                    exportTariffCSV({
                      htsCode: formData.htsCode,
                      origin: formData.originCountry,
                      destination: formData.destinationCountry,
                      value: parseFloat(formData.value),
                      freight: parseFloat(formData.freightCost),
                      insurance: parseFloat(formData.insuranceCost),
                      appliedRate: result.appliedRate || 'N/A',
                      dutyAmount: result.dutyAmount || 0,
                      additionalDuties: result.additionalDuties || 0,
                      totalDuties: (result.dutyAmount || 0) + (result.additionalDuties || 0),
                      landedCost: result.landedCost || 0,
                      tradeAgreement: result.tradeAgreement,
                    });
                    toast.success('CSV exported successfully');
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              {/* Save & Continue Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (shipmentId) {
                    updateShipmentMutation.mutate(
                      {
                        shipmentId,
                        data: {
                          workflowStep: 3,
                          status: "documenting",
                          lastCalculation: result,
                        },
                      },
                      {
                        onSuccess: () => {
                          window.location.href = `/documents?shipmentId=${shipmentId}`;
                        },
                      }
                    );
                  } else {
                    window.location.href = "/documents";
                  }
                }}
              >
                Save & Continue to Documents →
              </Button>
            </div>
          )}

          {!result && !calculateMutation.isPending && (
            <Card className="p-6">
              <div className="text-center py-12 text-gray-400">
                <Calculator className="h-12 w-12 mx-auto mb-4" />
                <p>Enter shipment details and click Calculate to see results</p>
              </div>
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
