import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Search, Info } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function HtsSearch() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { data: results, isLoading, refetch } = trpc.hts.search.useQuery(
    { query, limit: 10 },
    { enabled: false }
  );

  const createShipmentMutation = trpc.shipments.create.useMutation({
    onSuccess: (data) => {
      toast.success("Shipment created! Redirecting...");
      setLocation(`/tariff-calculator?shipmentId=${data.shipmentId}`);
    },
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }
    refetch();
  };

  const handleCreateShipment = async (htsCode: string, description: string) => {
    createShipmentMutation.mutate({
      shipmentName: `Shipment - ${htsCode}`,
      productDescription: description,
      htsCode: htsCode,
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "high": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">HTS Code Search</h1>
          <p className="text-muted-foreground">
            AI-powered search with detailed product classification and risk assessment
          </p>
        </div>

        <div className="flex gap-4 mb-8">
          <Input
            placeholder="Search by product description (e.g., 'laptop computer')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="w-4 h-4 mr-2" />
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>

        {results && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {results.length} results • All data is current as of {new Date().toLocaleDateString()}
            </p>
            {results.map((result: any, idx: number) => (
              <Card key={idx} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold font-mono">{result.code}</h3>
                      <Badge className={getRiskColor(result.riskLevel)}>
                        {result.riskLevel} risk
                      </Badge>
                      {result.confidence && (
                        <span className="text-sm text-muted-foreground">
                          {Math.round(result.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-lg mb-3">{result.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Estimated duty rate: <span className="font-mono font-bold">{result.dutyRate}</span>
                    </p>
                  </div>
                  <Button onClick={() => handleCreateShipment(result.code, result.description)}>
                    Start Workflow →
                  </Button>
                </div>

                {result.reasoning && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-start gap-2 mb-2">
                      <Info className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm mb-1">Why this code?</p>
                        <p className="text-sm text-muted-foreground">{result.reasoning}</p>
                      </div>
                    </div>
                  </div>
                )}

                {result.alternatives && result.alternatives.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="font-bold text-sm mb-2">Alternative Classifications:</p>
                    <div className="space-y-2">
                      {result.alternatives.slice(0, 2).map((alt: any, i: number) => (
                        <div key={i} className="text-sm pl-4 border-l-2 border-border">
                          <span className="font-mono font-bold">{alt.code}</span>
                          {alt.reason && <span className="text-muted-foreground"> - {alt.reason}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
