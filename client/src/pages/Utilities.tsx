import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { DollarSign, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Utilities() {
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");

  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [shipOrigin, setShipOrigin] = useState("");
  const [shipDest, setShipDest] = useState("");

  const convertMutation = trpc.utils.convertCurrency.useMutation({
    onError: (error) => toast.error("Conversion failed: " + error.message),
  });

  const estimateMutation = trpc.utils.estimateShipping.useMutation({
    onError: (error) => toast.error("Estimation failed: " + error.message),
  });

  const handleConvert = () => {
    if (!amount) {
      toast.error("Please enter an amount");
      return;
    }
    convertMutation.mutate({
      amount: parseFloat(amount),
      from: fromCurrency,
      to: toCurrency,
    });
  };

  const handleEstimate = () => {
    if (!weight || !length || !width || !height || !shipOrigin || !shipDest) {
      toast.error("Please fill in all fields");
      return;
    }
    estimateMutation.mutate({
      weight: parseFloat(weight),
      length: parseFloat(length),
      width: parseFloat(width),
      height: parseFloat(height),
      originCountry: shipOrigin.toUpperCase(),
      destinationCountry: shipDest.toUpperCase(),
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Trade Utilities</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Currency converter and shipping cost estimator.
          </p>
        </div>

        <Tabs defaultValue="currency" className="w-full">
          <TabsList className="border border-black mb-8">
            <TabsTrigger value="currency">Currency Converter</TabsTrigger>
            <TabsTrigger value="shipping">Shipping Estimator</TabsTrigger>
          </TabsList>

          <TabsContent value="currency">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-black">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Convert Currency
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input
                        placeholder="USD"
                        value={fromCurrency}
                        onChange={(e) => setFromCurrency(e.target.value.toUpperCase())}
                        className="border-black"
                        maxLength={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input
                        placeholder="EUR"
                        value={toCurrency}
                        onChange={(e) => setToCurrency(e.target.value.toUpperCase())}
                        className="border-black"
                        maxLength={3}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleConvert}
                    disabled={convertMutation.isPending}
                    className="w-full"
                  >
                    {convertMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Convert"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {convertMutation.data && (
                <Card className="border-black">
                  <CardHeader>
                    <CardTitle>Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold mb-4">
                      {convertMutation.data.converted.toFixed(2)} {convertMutation.data.to}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Rate: 1 {convertMutation.data.from} = {convertMutation.data.rate.toFixed(4)} {convertMutation.data.to}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shipping">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-black">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Estimate Shipping Cost
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="border-black"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Length (cm)</Label>
                      <Input
                        type="number"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        className="border-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Width (cm)</Label>
                      <Input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        className="border-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (cm)</Label>
                      <Input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="border-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Origin</Label>
                      <Input
                        placeholder="CHN"
                        value={shipOrigin}
                        onChange={(e) => setShipOrigin(e.target.value)}
                        className="border-black"
                        maxLength={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Destination</Label>
                      <Input
                        placeholder="USA"
                        value={shipDest}
                        onChange={(e) => setShipDest(e.target.value)}
                        className="border-black"
                        maxLength={3}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleEstimate}
                    disabled={estimateMutation.isPending}
                    className="w-full"
                  >
                    {estimateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Estimate"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {estimateMutation.data && (
                <Card className="border-black">
                  <CardHeader>
                    <CardTitle>Estimate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold mb-4">
                      ${estimateMutation.data.estimatedCost.toFixed(2)}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Chargeable Weight: {estimateMutation.data.chargeableWeight} kg</div>
                      <div className="text-muted-foreground">{estimateMutation.data.note}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
