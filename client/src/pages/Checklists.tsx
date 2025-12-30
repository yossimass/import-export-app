import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckSquare, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Checklists() {
  const [originCountry, setOriginCountry] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [productDescription, setProductDescription] = useState("");

  const checklistsQuery = trpc.checklists.list.useQuery();
  const generateMutation = trpc.checklists.generate.useMutation({
    onSuccess: () => {
      toast.success("Checklist generated successfully");
      checklistsQuery.refetch();
      setOriginCountry("");
      setDestinationCountry("");
      setProductDescription("");
    },
    onError: (error) => {
      toast.error("Generation failed: " + error.message);
    },
  });

  const handleGenerate = () => {
    if (!originCountry || !destinationCountry || !productDescription) {
      toast.error("Please fill in all fields");
      return;
    }

    generateMutation.mutate({
      originCountry: originCountry.toUpperCase(),
      destinationCountry: destinationCountry.toUpperCase(),
      productDescription,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Compliance Checklists</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Generate comprehensive compliance checklists for your shipments.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="border-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Generate New Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label>Product Description</Label>
                <Textarea
                  placeholder="Describe your product..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="border-black"
                  rows={4}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Generate Checklist
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-black">
            <CardHeader>
              <CardTitle>Your Checklists</CardTitle>
            </CardHeader>
            <CardContent>
              {checklistsQuery.isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                </div>
              ) : checklistsQuery.data && checklistsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {checklistsQuery.data.map((checklist) => (
                    <div key={checklist.id} className="border border-black p-4">
                      <div className="font-bold text-sm mb-1">{checklist.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Status: {checklist.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No checklists yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
