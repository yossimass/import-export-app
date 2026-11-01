import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Route-level code splitting: each page loads only when visited
const HtsSearch = lazy(() => import("./pages/HtsSearch"));
const TariffCalculator = lazy(() => import("./pages/TariffCalculator"));
const Regulations = lazy(() => import("./pages/Regulations"));
const Documents = lazy(() => import("./pages/Documents"));
const Checklists = lazy(() => import("./pages/Checklists"));
const ChatAssistant = lazy(() => import("./pages/ChatAssistant"));
const Utilities = lazy(() => import("./pages/Utilities"));
const Alerts = lazy(() => import("./pages/Alerts"));
const MyShipments = lazy(() => import("./pages/MyShipments"));
const Credits = lazy(() => import("./pages/Credits"));
const CertificateOfOrigin = lazy(() => import("./pages/CertificateOfOrigin"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Profile = lazy(() => import("./pages/Profile"));

function Router() {
  return (
    <Suspense fallback={null}>
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/hts-search"} component={HtsSearch} />
      <Route path={"/tariff-calculator"} component={TariffCalculator} />
      <Route path={"/regulations"} component={Regulations} />
      <Route path={"/documents"} component={Documents} />
      <Route path={"/checklists"} component={Checklists} />
      <Route path={"/chat"} component={ChatAssistant} />
      <Route path={"/utilities"} component={Utilities} />
      <Route path={"/alerts"} component={Alerts} />
      <Route path={"/my-shipments"} component={MyShipments} />
      <Route path={"/credits"} component={Credits} />
      <Route path={"/certificate-of-origin"} component={CertificateOfOrigin} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
