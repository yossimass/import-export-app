import Navigation from "@/components/Navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Search, Globe, AlertTriangle, FileText, Shield, FileDown } from "lucide-react";
import { exportRegulationsPDF } from "@/lib/exportUtils";
import { toast } from "sonner";

export default function Regulations() {
  const [country, setCountry] = useState("");
  const [htsCode, setHtsCode] = useState("");
  
  const { data: regulations, isLoading, refetch } = trpc.regulations.search.useQuery(
    { countryCode: country, regulationType: "all" as const, htsCode: htsCode || undefined },
    { enabled: false }
  );

  const handleSearch = () => {
    if (!country.trim()) {
      toast.error("Please enter a country");
      return;
    }
    refetch();
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Trade Regulations</h1>
          <p className="text-muted-foreground">
            AI-powered lookup of country-specific trade regulations and requirements
          </p>
        </div>

        <Card className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Input
                placeholder="e.g., United States, China, Germany"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">HTS Code (Optional)</label>
              <Input
                placeholder="e.g., 8471.30"
                value={htsCode}
                onChange={(e) => setHtsCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="mt-4">
            <Search className="w-4 h-4 mr-2" />
            {isLoading ? "Searching..." : "Search Regulations"}
          </Button>
        </Card>

        {regulations && regulations.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">{country}</h2>
                  <p className="text-sm text-muted-foreground">
                    Found {regulations.length} regulations • Current as of {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!regulations) return;
                  exportRegulationsPDF({
                    country,
                    regulations,
                  });
                  toast.success('Regulations exported as PDF');
                }}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {regulations.map((reg: any, i: number) => (
              <Card key={i} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    {reg.category === "import" && <FileText className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                    {reg.category === "export" && <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                    {reg.category === "restriction" && <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2">{reg.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{reg.description}</p>
                    </div>
                  </div>
                  <Badge className={getRiskColor(reg.riskLevel)}>
                    {reg.riskLevel}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {reg.requirements && reg.requirements.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Requirements:</h4>
                      <ul className="text-sm space-y-1 pl-4">
                        {reg.requirements.map((req: string, j: number) => (
                          <li key={j} className="list-disc">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reg.documentation && reg.documentation.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Required Documents:</h4>
                      <ul className="text-sm space-y-1 pl-4">
                        {reg.documentation.map((doc: string, j: number) => (
                          <li key={j} className="list-disc">{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                  {reg.authority && (
                    <span><strong>Authority:</strong> {reg.authority}</span>
                  )}
                  {reg.source && (
                    <span><strong>Source:</strong> {reg.source}</span>
                  )}
                  {reg.effectiveDate && (
                    <span><strong>Effective:</strong> {reg.effectiveDate}</span>
                  )}
                  {reg.penalties && (
                    <span className="text-red-600"><strong>Penalties:</strong> {reg.penalties}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {regulations && regulations.length === 0 && (
          <Card className="p-12 text-center">
            <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No regulations found for this search</p>
          </Card>
        )}
      </div>
    </div>
  );
}
