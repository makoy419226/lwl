import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Clients from "@/pages/Clients";
import ClientDetails from "@/pages/ClientDetails";
import Bills from "@/pages/Bills";
import DailySales from "@/pages/DailySales";
import Contact from "@/pages/Contact";
import Login, { type UserInfo } from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import logoImage from "@assets/image_1767220512226.png";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/inventory" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetails} />
      <Route path="/bills" component={Bills} />
      <Route path="/daily-sales" component={DailySales} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

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
        <div className="flex h-screen w-full bg-background">
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 border-b border-border bg-card flex items-center justify-end px-6">
              <div className="flex flex-col items-center">
                <img 
                  src={logoImage} 
                  alt="Liquide Washes Laundry" 
                  className="h-10 object-contain"
                  data-testid="img-header-logo"
                />
                <span className="text-xs font-semibold text-primary mt-0.5">Liquide Washes</span>
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
