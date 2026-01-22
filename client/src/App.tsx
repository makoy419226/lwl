import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { QuickSearch } from "@/components/QuickSearch";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Clients from "@/pages/Clients";
import ClientDetails from "@/pages/ClientDetails";
import Bills from "@/pages/Bills";
import Orders from "@/pages/Orders";
import Workers from "@/pages/Workers";
import SalesReports from "@/pages/SalesReports";
import Incidents from "@/pages/Incidents";
import DueCustomers from "@/pages/DueCustomers";
import Contact from "@/pages/Contact";
import Login, { type UserInfo } from "@/pages/Login";
import PublicOrder from "@/pages/PublicOrder";
import TrackOrder from "@/pages/TrackOrder";
import NotFound from "@/pages/not-found";
import { useState, useEffect, createContext, useContext } from "react";
import logoImage from "@assets/image_1767220512226.png";

const UserContext = createContext<UserInfo | null>(null);

const rolePermissions: Record<string, string[]> = {
  "/": ["admin", "manager", "cashier"],
  "/inventory": ["admin", "manager", "cashier"],
  "/products": ["admin", "manager", "cashier"],
  "/clients": ["admin", "manager", "cashier"],
  "/bills": ["admin", "manager", "cashier"],
  "/orders": ["admin", "manager", "cashier"],
  "/workers": ["admin", "manager"],
  "/sales-reports": ["admin"],
  "/incidents": ["admin", "manager"],
  "/due-customers": ["admin", "manager"],
  "/contact": ["admin", "manager", "cashier"],
  "/track": ["admin", "manager"],
};

function ProtectedRoute({ path, component: Component, allowedRoles }: { 
  path: string; 
  component: React.ComponentType<any>; 
  allowedRoles: string[];
}) {
  const user = useContext(UserContext);
  const userRole = user?.role || "cashier";
  
  if (!allowedRoles.includes(userRole)) {
    return <Redirect to="/" />;
  }
  
  return <Route path={path} component={Component} />;
}

function Router() {
  const user = useContext(UserContext);
  const userRole = user?.role || "cashier";
  
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/inventory" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetails} />
      <Route path="/bills" component={Bills} />
      <Route path="/orders" component={Orders} />
      {rolePermissions["/workers"].includes(userRole) && <Route path="/workers" component={Workers} />}
      {rolePermissions["/sales-reports"].includes(userRole) && <Route path="/sales-reports" component={SalesReports} />}
      {rolePermissions["/incidents"].includes(userRole) && <Route path="/incidents" component={Incidents} />}
      {rolePermissions["/due-customers"].includes(userRole) && <Route path="/due-customers" component={DueCustomers} />}
      <Route path="/contact" component={Contact} />
      {rolePermissions["/track"].includes(userRole) && <Route path="/track" component={TrackOrder} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    const storedUser = localStorage.getItem("user");
    if (loggedIn && storedUser) {
      setIsLoggedIn(true);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData: UserInfo) => {
    setIsLoggedIn(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUser(null);
  };

  if (location.startsWith("/order/") || location === "/track") {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/order/:token" component={PublicOrder} />
            <Route path="/track" component={TrackOrder} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (!isLoggedIn) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Login onLogin={handleLogin} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserContext.Provider value={user}>
          <div className="flex h-screen w-full bg-background">
            <Sidebar user={user} onLogout={handleLogout} />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <header className="h-16 border-b border-border bg-card flex items-center justify-between gap-4 px-4 lg:px-6">
                <div className="w-14 lg:hidden" />
                <div className="flex-1 flex justify-center lg:justify-start">
                  <QuickSearch />
                </div>
                <div className="flex flex-col items-center">
                <img 
                  src={logoImage} 
                  alt="Liquide Washes Laundry" 
                  className="h-8 lg:h-10 object-contain"
                  data-testid="img-header-logo"
                />
                <span className="text-xs font-semibold text-primary mt-0.5">Liquide Washes</span>
              </div>
              <div className="flex-1 lg:hidden" />
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
        <Toaster />
        </UserContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
