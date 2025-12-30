import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Regulations() {
  const [countryCode, setCountryCode] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const regulationsQuery = trpc.regulations.getByCountry.useQuery(
    { countryCode: countryCode.toUpperCase() },
    { enabled: searchTriggered && countryCode.length === 3 }
  );

  const handleSearch = () => {
    if (countryCode.length !== 3) {
      toast.error("Please enter a valid 3-letter country code");
      return;
    }
    setSearchTriggered(true);
    regulationsQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Trade Regulations</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground max-w-3xl">
            Access country-specific trade regulations, import/export restrictions, and compliance requirements.
          </p>
        </div>

        <Card className="border-black mb-8">
          <CardHeader>
            <CardTitle>Search Regulations by Country</CardTitle>
            <CardDescription>
              Enter a 3-letter ISO country code (e.g., USA, CHN, GBR)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Country code (e.g., USA)"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                maxLength={3}
                className="border-black"
              />
              <Button onClick={handleSearch} disabled={regulationsQuery.isLoading}>
                {regulationsQuery.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {regulationsQuery.data && regulationsQuery.data.length > 0 && (
          <div className="space-y-4">
            {regulationsQuery.data.map((regulation) => (
              <Card key={regulation.id} className="border-black">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        {regulation.title}
                      </CardTitle>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs px-2 py-1 border border-black bg-secondary">
                          {regulation.regulationType}
                        </span>
                        <span className="text-xs px-2 py-1 border border-black">
                          {regulation.countryCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-bold mb-2">Description</h4>
                    <p className="text-sm">{regulation.description}</p>
                  </div>

                  <div>
                    <h4 className="font-bold mb-2">Requirements</h4>
                    <p className="text-sm">{regulation.requirements}</p>
                  </div>

                  {regulation.documentationNeeded && (
                    <div>
                      <h4 className="font-bold mb-2">Documentation Needed</h4>
                      <p className="text-sm">{regulation.documentationNeeded}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-black">
                    <div className="text-xs text-muted-foreground">
                      Effective: {new Date(regulation.effectiveDate).toLocaleDateString()}
                    </div>
                    {regulation.sourceUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={regulation.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Source
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {regulationsQuery.data && regulationsQuery.data.length === 0 && searchTriggered && (
          <Card className="border-black">
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No regulations found for {countryCode}</p>
                <p className="text-sm mt-2">Try searching for another country code</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!searchTriggered && (
          <Card className="border-black">
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Enter a country code to search for trade regulations</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
