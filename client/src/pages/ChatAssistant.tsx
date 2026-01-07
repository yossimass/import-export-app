import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function ChatAssistant() {
  const [conversationId, setConversationId] = useState<string>(`conv-${Date.now()}`);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are a trade compliance expert assistant. I can help you with HTS codes, tariff calculations, regulations, and documentation requirements."
    }
  ]);

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      // Add AI response to messages
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message
      }]);
      
      // Update conversation ID if it changed
      if (data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      }
    },
    onError: (error) => {
      // Add error message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`
      }]);
    }
  });

  const handleSendMessage = (content: string) => {
    // Add user message to UI immediately
    setMessages(prev => [...prev, {
      role: "user",
      content
    }]);

    // Send to backend
    sendMutation.mutate({
      message: content,
      conversationId
    });
  };

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

        <Card className="p-6">
          <AIChatBox
            messages={messages.filter(m => m.role !== "system")}
            onSendMessage={handleSendMessage}
            isLoading={sendMutation.isPending}
            placeholder="Ask about HTS codes, tariffs, regulations, or compliance requirements..."
            height="600px"
          />
        </Card>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Example Questions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• What HTS code should I use for cotton t-shirts?</li>
            <li>• What are the import duties for electronics from China to USA?</li>
            <li>• What documents do I need for exporting machinery to Canada?</li>
            <li>• Are there any trade agreements between USA and Mexico?</li>
            <li>• What are the compliance requirements for food imports?</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
