import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminConsole from "@/pages/AdminConsole";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "@/pages/Home";
import Catalogue from "@/pages/Catalogue";
import Cart from "@/pages/Cart";
import StudyResources from "@/pages/StudyResources";
import { LoginDialog } from "@/components/LoginDialog";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/mock-exams" component={() => <Catalogue />} />
      <Route path="/mock-exam-store" component={() => <Catalogue />} />
      <Route path="/cart" component={Cart} />
      <Route path="/study-resources" component={StudyResources} />
      <Route path="/case-study/:screen" component={Home} />
      <Route path="/objective-tests" component={Home} />
      <Route path="/admin" component={() => <AdminConsole mode="admin" />} />
      <Route path="/instructor" component={() => <AdminConsole mode="instructor" />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          <LoginDialog />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
