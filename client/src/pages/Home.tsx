import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import Navigation from "@/components/Navigation";
import { Link } from "wouter";
import { 
  Search, 
  Calculator, 
  FileText, 
  FolderOpen, 
  CheckSquare, 
  MessageSquare,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Search,
      title: "HTS Code Search",
      description: "Search and lookup Harmonized Tariff Schedule codes with detailed product classification.",
      path: "/hts-search",
    },
    {
      icon: Calculator,
      title: "Tariff Calculator",
      description: "Calculate tariff rates, duties, and taxes for imports and exports between countries.",
      path: "/tariff-calculator",
    },
    {
      icon: FileText,
      title: "Trade Regulations",
      description: "Access country-specific trade regulations, requirements, and compliance information.",
      path: "/regulations",
    },
    {
      icon: FolderOpen,
      title: "Document Management",
      description: "Secure cloud storage for trade documents, certificates, invoices, and declarations.",
      path: "/documents",
    },
    {
      icon: CheckSquare,
      title: "Compliance Checklists",
      description: "Generate and manage comprehensive compliance checklists for your shipments.",
      path: "/checklists",
    },
    {
      icon: MessageSquare,
      title: "AI Assistant",
      description: "Get instant answers to trade compliance questions with our intelligent chatbot.",
      path: "/chat",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section - Asymmetric Layout */}
      <section className="border-b border-black">
        <div className="container py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7">
              <div className="relative">
                <div className="absolute -left-8 top-0 w-4 h-4 bg-primary"></div>
                <h1 className="text-6xl font-bold mb-6 leading-tight">
                  International Trade Compliance Platform
                </h1>
              </div>
              <p className="text-xl mb-8 leading-relaxed max-w-2xl">
                Navigate import/export regulations with precision. Access HTS codes, calculate tariffs, 
                manage documents, and ensure compliance with our comprehensive trade platform.
              </p>
              {!isAuthenticated ? (
                <Button asChild size="lg" className="gap-2">
                  <a href={getLoginUrl()}>
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" className="gap-2">
                  <Link href="/hts-search">
                    Start Searching
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              )}
            </div>
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="relative">
                <div className="w-64 h-64 border-4 border-black"></div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="container">
          <div className="mb-16">
            <div className="relative inline-block">
              <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
              <h2 className="text-4xl font-bold">Platform Features</h2>
            </div>
            <div className="w-24 h-1 bg-black mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="border border-black p-8 hover:bg-secondary transition-colors group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mt-2">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  {isAuthenticated && (
                    <Link href={feature.path}>
                      <Button variant="outline" className="gap-2 group-hover:bg-white">
                        Learn More
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="border-t border-black py-24 bg-secondary">
          <div className="container text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Join thousands of businesses streamlining their international trade compliance.
            </p>
            <Button asChild size="lg" className="gap-2">
              <a href={getLoginUrl()}>
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-black py-8">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-primary"></div>
              <span className="font-bold">TRADE COMPLIANCE</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 International Trade Compliance Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
