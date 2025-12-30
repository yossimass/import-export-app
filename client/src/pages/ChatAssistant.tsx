import { useState } from "react";
import Navigation from "@/components/Navigation";
import { AIChatBox } from "@/components/AIChatBox";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function ChatAssistant() {
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const historyQuery = trpc.chat.history.useQuery({ sessionId });
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    },
  });

  const handleSend = (message: string) => {
    setMessages(prev => [...prev, { role: "user", content: message }]);
    sendMutation.mutate({ message, sessionId });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">AI Trade Assistant</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Get instant answers to trade compliance questions with our intelligent AI assistant.
          </p>
        </div>

        <Card className="border-black p-6">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={sendMutation.isPending}
            placeholder="Ask about HTS codes, tariffs, regulations, documentation..."
            height="600px"
          />
        </Card>
      </div>
    </div>
  );
}
