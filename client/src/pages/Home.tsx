import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Search, Calculator, FileText, CheckSquare, MessageSquare, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { data: recentShipments } = trpc.shipments.recent.useQuery({ limit: 3 });

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container py-8 sm:py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/93705925/ChEDaPiGwxAxXWSe.png" alt="CochitoCorp" className="w-12 h-12 sm:w-16 sm:h-16" />
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">CochitoCorp</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">International Trade Compliance Platform</p>
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
                iTCP: Intelligent Trade Compliance
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
                Navigate import/export regulations with precision. Access HTS codes, calculate tariffs, manage documents, and ensure compliance—powered by AI and built for global trade professionals.
              </p>
              <Link href="/hts-search">
                <Button size="lg" className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto">
                  Start Searching →
                </Button>
              </Link>
            </div>
            
            {/* Decorative elements - hidden on mobile to prevent overlap */}
            <div className="relative hidden lg:block">
              <div className="absolute top-0 right-0 w-48 h-48 xl:w-64 xl:h-64 border-4 border-border"></div>
              <div className="absolute bottom-0 left-12 w-48 h-48 xl:w-64 xl:h-64 bg-primary"></div>
            </div>
          </div>
        </section>

        {/* Recent Shipments */}
        {recentShipments && recentShipments.length > 0 && (
          <section className="container py-12 border-t-2 border-border">
            <h2 className="text-2xl font-bold mb-6">My Workflows</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {recentShipments.map((shipment) => {
                const workflowSteps = [
                  { id: 1, label: "HTS Code", path: "/hts-search" },
                  { id: 2, label: "Tariff Calc", path: "/tariff-calculator" },
                  { id: 3, label: "Documents", path: "/documents" },
                  { id: 4, label: "Compliance", path: "/checklists" },
                ];
                const currentStep = shipment.workflowStep || 1;
                const nextStepPath = workflowSteps.find(s => s.id === currentStep)?.path || "/hts-search";
                const progress = (currentStep / 4) * 100;
                
                return (
                  <Card key={shipment.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-bold">{shipment.shipmentName}</h3>
                      <span className={`px-2 py-1 text-xs font-mono ${
                        shipment.status === 'complete' ? 'bg-green-100 text-green-800' :
                        shipment.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {shipment.status}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Step {currentStep} of 4</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    
                    {shipment.htsCode && (
                      <p className="text-sm text-muted-foreground mb-2">HTS: {shipment.htsCode}</p>
                    )}
                    {shipment.originCountry && shipment.destinationCountry && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {shipment.originCountry} → {shipment.destinationCountry}
                      </p>
                    )}
                    <Link href={`${nextStepPath}?shipmentId=${shipment.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        Continue Workflow →
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Features Grid */}
        <section className="container py-8 sm:py-12 md:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <Link href="/hts-search">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <Search className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">HTS Code Search</h3>
                <p className="text-muted-foreground">
                  AI-powered search with detailed product classification and risk assessment
                </p>
              </Card>
            </Link>

            <Link href="/tariff-calculator">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <Calculator className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Tariff Calculator</h3>
                <p className="text-muted-foreground">
                  Calculate duties with MFN rates, trade agreements, and landed cost breakdown
                </p>
              </Card>
            </Link>

            <Link href="/regulations">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <FileText className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Trade Regulations</h3>
                <p className="text-muted-foreground">
                  Current import/export requirements and compliance standards by country
                </p>
              </Card>
            </Link>

            <Link href="/documents">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <FileText className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Document Management</h3>
                <p className="text-muted-foreground">
                  Secure cloud storage for trade documents with shipment linking
                </p>
              </Card>
            </Link>

            <Link href="/checklists">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <CheckSquare className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Compliance Checklists</h3>
                <p className="text-muted-foreground">
                  AI-generated requirements for your specific shipment and route
                </p>
              </Card>
            </Link>

            <Link href="/chat-assistant">
              <Card className="p-4 sm:p-6 md:p-8 hover:shadow-lg transition-shadow cursor-pointer">
                <MessageSquare className="w-12 h-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">AI Assistant</h3>
                <p className="text-muted-foreground">
                  Get expert answers on trade compliance, regulations, and documentation
                </p>
              </Card>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
