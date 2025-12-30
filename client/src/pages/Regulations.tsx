import Navigation from "@/components/Navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Search, Globe, AlertTriangle } from "lucide-react";
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

        {regulations && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <Globe className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-2xl font-bold mb-2">{regulations.country}</h2>
                  <p className="text-sm text-muted-foreground">
                    Current as of {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {regulations.importRequirements && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3">Import Requirements</h3>
                  <div className="space-y-2 pl-4 border-l-2 border-primary">
                    {regulations.importRequirements.map((req: string, i: number) => (
                      <p key={i} className="text-sm">{req}</p>
                    ))}
                  </div>
                </div>
              )}

              {regulations.prohibitedItems && regulations.prohibitedItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Prohibited Items
                  </h3>
                  <div className="space-y-2">
                    {regulations.prohibitedItems.map((item: string, i: number) => (
                      <Badge key={i} variant="destructive">{item}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {regulations.certifications && regulations.certifications.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3">Required Certifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {regulations.certifications.map((cert: string, i: number) => (
                      <Card key={i} className="p-3">
                        <p className="text-sm font-medium">{cert}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {regulations.customsProcedures && (
                <div>
                  <h3 className="font-bold text-lg mb-3">Customs Procedures</h3>
                  <p className="text-sm text-muted-foreground">{regulations.customsProcedures}</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
