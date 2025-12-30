import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function ChatAssistant() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">AI Trade Assistant</h1>
          <p className="text-muted-foreground">
            Get instant answers to your trade compliance questions
          </p>
        </div>

        <Card className="p-12 text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium mb-2">AI Chat Assistant</p>
          <p className="text-sm text-muted-foreground">
            This feature will provide real-time trade compliance guidance
          </p>
        </Card>
      </div>
    </div>
  );
}
