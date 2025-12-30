import Navigation from "@/components/Navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { DollarSign, Package, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Utilities() {
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  
  const [weight, setWeight] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const convertQuery = trpc.utilities.convertCurrency.useQuery(
    { amount: parseFloat(amount) || 0, from: fromCurrency, to: toCurrency },
    { enabled: false }
  );

  const estimateQuery = trpc.utilities.estimateShipping.useQuery(
    { originCountry: origin, destinationCountry: destination, weight: parseFloat(weight) || 0 },
    { enabled: false }
  );

  const handleConvert = async () => {
    if (!amount) {
      toast.error("Please enter an amount");
      return;
    }
    try {
      const result = await convertQuery.refetch();
      if (result.data) {
        toast.success(`${amount} ${fromCurrency} = ${result.data.convertedAmount} ${toCurrency}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEstimate = async () => {
    if (!weight || !origin || !destination) {
      toast.error("Please fill in all shipping fields");
      return;
    }
    try {
      const result = await estimateQuery.refetch();
      if (result.data) {
        toast.success(`Estimated shipping cost: $${result.data.estimatedCost || result.data}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Trade Utilities</h1>
          <p className="text-muted-foreground">
            Currency converter and shipping cost estimator
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Currency Converter */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-bold">Currency Converter</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">From</label>
                  <Input
                    placeholder="USD"
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">To</label>
                  <Input
                    placeholder="EUR"
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <Button onClick={handleConvert} disabled={convertQuery.isFetching} className="w-full">
                <TrendingUp className="w-4 h-4 mr-2" />
                {convertQuery.isFetching ? "Converting..." : "Convert"}
              </Button>
            </div>
          </Card>

          {/* Shipping Estimator */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Package className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-bold">Shipping Estimator</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Weight (kg)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Origin</label>
                <Input
                  placeholder="China"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Destination</label>
                <Input
                  placeholder="United States"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <Button onClick={handleEstimate} disabled={estimateQuery.isFetching} className="w-full">
                <Package className="w-4 h-4 mr-2" />
                {estimateQuery.isFetching ? "Estimating...": "Estimate Cost"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
