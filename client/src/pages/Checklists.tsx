import { Card } from "@/components/ui/card";

export default function Checklists() {
  return (
    <div className="min-h-screen">
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Checklists</h1>
          <p className="text-muted-foreground">
            This page is under construction.
          </p>
        </div>
        <Card className="p-12 text-center">
          <p className="text-lg text-muted-foreground">Checklists functionality coming soon.</p>
        </Card>
      </div>
    </div>
  );
}
