import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function HtsSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [productDescription, setProductDescription] = useState("");
  
  const searchMutation = trpc.hts.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  const recommendMutation = trpc.hts.recommendCode.useMutation({
    onSuccess: () => {
      toast.success("AI recommendations generated successfully");
    },
    onError: (error) => {
      toast.error("Failed to generate recommendations: " + error.message);
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.refetch();
    }
  };

  const handleRecommend = () => {
    if (productDescription.trim()) {
      recommendMutation.mutate({ productDescription });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="container py-12">
        {/* Page Header */}
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">HTS Code Search & Lookup</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground max-w-3xl">
            Search the Harmonized Tariff Schedule database or use AI to recommend codes based on product descriptions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Manual Search */}
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Manual Search
              </CardTitle>
              <CardDescription>
                Search by HTS code, product name, or category
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter HTS code or product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="border-black"
                />
                <Button onClick={handleSearch} disabled={searchMutation.isLoading}>
                  {searchMutation.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {searchMutation.data && searchMutation.data.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchMutation.data.map((code) => (
                    <div
                      key={code.id}
                      className="border border-black p-4 hover:bg-secondary transition-colors"
                    >
                      <div className="font-bold text-lg mb-1">{code.code}</div>
                      <div className="text-sm mb-2">{code.description}</div>
                      {code.category && (
                        <div className="text-xs text-muted-foreground">
                          Category: {code.category}
                        </div>
                      )}
                      {code.unit && (
                        <div className="text-xs text-muted-foreground">
                          Unit: {code.unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchMutation.data && searchMutation.data.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No results found. Try a different search term.
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI-Powered Recommendations
              </CardTitle>
              <CardDescription>
                Describe your product and get HTS code suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your product in detail (e.g., 'Cotton t-shirts for men, 100% cotton, short sleeve')"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={4}
                className="border-black"
              />
              <Button
                onClick={handleRecommend}
                disabled={recommendMutation.isPending}
                className="w-full gap-2"
              >
                {recommendMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Recommendations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Get AI Recommendations
                  </>
                )}
              </Button>

              {recommendMutation.data && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recommendMutation.data.map((rec: any, index: number) => (
                    <div
                      key={index}
                      className="border border-black p-4 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-bold text-lg">{rec.code}</div>
                        <div
                          className={`text-xs px-2 py-1 border border-black ${
                            rec.confidence === "high"
                              ? "bg-primary text-white"
                              : rec.confidence === "medium"
                              ? "bg-secondary"
                              : "bg-white"
                          }`}
                        >
                          {rec.confidence.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-sm mb-2">{rec.description}</div>
                      <div className="text-xs text-muted-foreground">
                        <strong>Why this matches:</strong> {rec.relevance}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Information Section */}
        <div className="border border-black p-8 bg-secondary">
          <h3 className="text-xl font-bold mb-4">About HTS Codes</h3>
          <div className="space-y-2 text-sm">
            <p>
              The Harmonized Tariff Schedule (HTS) provides duty rates for virtually every item that exists. 
              It is a system of names and numbers used to classify traded products.
            </p>
            <p>
              HTS codes are used by customs authorities around the world to identify products when assessing 
              duties and taxes and for gathering statistics.
            </p>
            <p className="font-bold">
              Accurate classification is critical for compliance and cost optimization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
