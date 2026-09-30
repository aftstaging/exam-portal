import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminConsole from "@/pages/AdminConsole";
import { Route, Router as BasePathRouter, Switch } from "wouter";
import { APP_BASE_PATH } from "@/lib/basePath";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "@/pages/Home";
import Catalogue from "@/pages/Catalogue";
import Cart from "@/pages/Cart";
import StudyResources from "@/pages/StudyResources";
import { LoginDialog } from "@/components/LoginDialog";

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/shop" component={() => <Catalogue kind="shop" />} />
      <Route path="/mock-exams" component={() => <Catalogue kind="exams" />} />
      <Route path="/mock-exam-store" component={() => <Catalogue kind="shop" />} />
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
      {/* `base` makes every route below it relative to the prefix, so `navigate("/admin")` and
          `<Link href="/dashboard">` resolve to `/exam/admin` and `/exam/dashboard`. Without it a
          login redirect would push `/admin` and land outside the portal. */}
      <BasePathRouter base={APP_BASE_PATH}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Routes />
            <LoginDialog />
          </TooltipProvider>
        </ThemeProvider>
      </BasePathRouter>
    </ErrorBoundary>
  );
}
