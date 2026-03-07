import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HtsSearch from "./pages/HtsSearch";
import TariffCalculator from "./pages/TariffCalculator";
import Regulations from "./pages/Regulations";
import Documents from "./pages/Documents";
import Checklists from "./pages/Checklists";
import ChatAssistant from "./pages/ChatAssistant";
import Utilities from "./pages/Utilities";
import Alerts from "./pages/Alerts";
import MyShipments from "./pages/MyShipments";
import Credits from "./pages/Credits";
import CertificateOfOrigin from "./pages/CertificateOfOrigin";

function Router() {
  return (
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
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
