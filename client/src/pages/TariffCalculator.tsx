import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function TariffCalculator() {
  const [htsCode, setHtsCode] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [value, setValue] = useState("");

  const calculateMutation = trpc.tariff.calculate.useMutation({
    onSuccess: () => {
      toast.success("Tariff calculated successfully");
    },
    onError: (error) => {
      toast.error("Calculation failed: " + error.message);
    },
  });

  const handleCalculate = () => {
    if (!htsCode || !originCountry || !destinationCountry || !value) {
      toast.error("Please fill in all fields");
      return;
    }

    calculateMutation.mutate({
      htsCode,
      originCountry: originCountry.toUpperCase(),
      destinationCountry: destinationCountry.toUpperCase(),
      value: parseFloat(value),
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Tariff Calculator</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground max-w-3xl">
            Calculate import duties, tariffs, and total costs for your shipments.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Calculate Tariff
              </CardTitle>
              <CardDescription>
                Enter shipment details to calculate duties and taxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>HTS Code</Label>
                <Input
                  placeholder="e.g., 6109.10.00"
                  value={htsCode}
                  onChange={(e) => setHtsCode(e.target.value)}
                  className="border-black"
                />
              </div>

              <div className="space-y-2">
                <Label>Origin Country (ISO 3-letter code)</Label>
                <Input
                  placeholder="e.g., CHN"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  className="border-black"
                  maxLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Destination Country (ISO 3-letter code)</Label>
                <Input
                  placeholder="e.g., USA"
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                  className="border-black"
                  maxLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Shipment Value (USD)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10000"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="border-black"
                  min="0"
                  step="0.01"
                />
              </div>

              <Button
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
                className="w-full gap-2"
              >
                {calculateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Calculate Tariff
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div>
            {calculateMutation.data && (
              <Card className="border-black">
                <CardHeader>
                  <CardTitle>Calculation Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border border-black p-4">
                    <div className="text-sm text-muted-foreground mb-1">HTS Code</div>
                    <div className="text-2xl font-bold">{calculateMutation.data.htsCode}</div>
                  </div>

                  <div className="border border-black p-4">
                    <div className="text-sm text-muted-foreground mb-1">Tariff Rate</div>
                    <div className="text-2xl font-bold">{calculateMutation.data.rate}%</div>
                  </div>

                  <div className="border border-black p-4">
                    <div className="text-sm text-muted-foreground mb-1">Duty Amount</div>
                    <div className="text-2xl font-bold">
                      ${calculateMutation.data.dutyAmount.toFixed(2)}
                    </div>
                  </div>

                  <div className="border border-black p-4 bg-primary text-white">
                    <div className="text-sm mb-1">Total Value (including duties)</div>
                    <div className="text-3xl font-bold">
                      ${calculateMutation.data.totalValue.toFixed(2)}
                    </div>
                  </div>

                  {calculateMutation.data.tradeAgreement && (
                    <div className="border border-black p-4 bg-secondary">
                      <div className="text-sm font-bold mb-1">Trade Agreement</div>
                      <div>{calculateMutation.data.tradeAgreement}</div>
                    </div>
                  )}

                  {calculateMutation.data.message && (
                    <div className="text-sm text-muted-foreground p-4 border border-black">
                      {calculateMutation.data.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!calculateMutation.data && (
              <Card className="border-black">
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Enter shipment details to calculate tariffs</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
