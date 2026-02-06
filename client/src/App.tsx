import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";
import { QuickSearch } from "@/components/QuickSearch";
import Dashboard from "@/pages/Dashboard";
import TodaysWork from "@/pages/TodaysWork";
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
import AdminSettings from "@/pages/AdminSettings";
import DeliveryDashboard from "@/pages/DeliveryDashboard";
import DeliveryHistory from "@/pages/DeliveryHistory";
import NotFound from "@/pages/not-found";
import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import logoImage from "@assets/image_1767220512226.png";

export const UserContext = createContext<UserInfo | null>(null);

const rolePermissions: Record<string, string[]> = {
  "/": ["admin", "counter", "section", "driver"],
  "/dashboard": ["admin", "counter", "reception", "section"],
  "/delivery": ["driver"],
  "/inventory": ["admin", "counter", "reception"],
  "/products": ["admin", "counter", "reception", "driver"],
  "/clients": ["admin", "counter", "reception", "driver"],
  "/bills": ["admin", "counter", "reception", "driver"],
  "/orders": ["admin", "counter", "reception", "section", "driver"],
  "/workers": ["admin"],
  "/sales-reports": ["admin"],
  "/incidents": ["admin", "counter", "reception", "section", "driver"],
  "/due-customers": ["admin", "counter", "reception"],
  "/contact": ["admin", "counter", "reception", "section", "driver"],
  "/track": ["admin", "counter", "reception", "section", "driver"],
  "/admin-settings": ["admin"],
};

function ProtectedRoute({ path, component: Component, allowedRoles }: { 
  path: string; 
  component: React.ComponentType<any>; 
  allowedRoles: string[];
}) {
  const user = useContext(UserContext);
  const userRole = user?.role || "counter";
  
  if (!allowedRoles.includes(userRole)) {
    return <Redirect to="/" />;
  }
  
  return <Route path={path} component={Component} />;
}

function Router() {
  const user = useContext(UserContext);
  const userRole = user?.role || "counter";
  
  // Driver users should be redirected to delivery dashboard as home
  if (userRole === "driver") {
    return (
      <Switch>
        <Route path="/" component={DeliveryDashboard} />
        <Route path="/delivery" component={DeliveryDashboard} />
        <Route path="/delivery-history" component={DeliveryHistory} />
        <Route path="/products" component={Products} />
        <Route path="/orders" component={Orders} />
        <Route path="/bills" component={Bills} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetails} />
        <Route path="/incidents" component={Incidents} />
        <Route path="/contact" component={Contact} />
        <Route path="/track" component={TrackOrder} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={TodaysWork} />
      <Route path="/dashboard" component={TodaysWork} />
      <Route path="/todays-work" component={TodaysWork} />
      {rolePermissions["/delivery"]?.includes(userRole) && <Route path="/delivery" component={DeliveryDashboard} />}
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
      {rolePermissions["/admin-settings"].includes(userRole) && <Route path="/admin-settings" component={AdminSettings} />}
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    localStorage.removeItem("lastActivity");
    setIsLoggedIn(false);
    setUser(null);
  }, []);

  // Session timeout after 2 hours of inactivity
  const TIMEOUT_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateLastActivity = useCallback(() => {
    if (isLoggedIn) {
      localStorage.setItem("lastActivity", Date.now().toString());
    }
  }, [isLoggedIn]);

  // Send heartbeat to server to track online status
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    
    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/auth/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, username: user.username }),
        });
        const data = await response.json();
        
        // Check if admin has forced logout
        if (data.forceLogout) {
          handleLogout();
          // Force browser refresh to ensure clean state
          window.location.reload();
        }
      } catch {
        // Ignore network errors
      }
    };
    
    // Send immediately on login
    sendHeartbeat();
    
    // Then send every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);
    
    return () => clearInterval(interval);
  }, [isLoggedIn, user, handleLogout]);

  // Listen for instant logout via Server-Sent Events
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    
    const eventSource = new EventSource(`/api/auth/logout-stream?userId=${user.id}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "forceLogout") {
          handleLogout();
          window.location.reload();
        }
      } catch {
        // Ignore parse errors
      }
    };
    
    eventSource.onerror = () => {
      // Reconnect will happen automatically
    };
    
    return () => {
      eventSource.close();
    };
  }, [isLoggedIn, user, handleLogout]);

  const checkSessionTimeout = useCallback(() => {
    const lastActivity = localStorage.getItem("lastActivity");
    if (lastActivity && isLoggedIn) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed >= TIMEOUT_DURATION) {
        handleLogout();
      }
    }
  }, [isLoggedIn, handleLogout]);

  // Set up activity tracking and timeout checking
  useEffect(() => {
    if (!isLoggedIn) return;

    // Initialize last activity on login
    updateLastActivity();

    // Activity events to track
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    // Throttle activity updates to once per minute
    let lastUpdate = Date.now();
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate >= 60000) { // Update at most once per minute
        lastUpdate = now;
        updateLastActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, throttledUpdate, { passive: true });
    });

    // Check for timeout every minute
    activityTimeoutRef.current = setInterval(checkSessionTimeout, 60000);

    // Check immediately on mount (in case user returns to inactive tab)
    checkSessionTimeout();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledUpdate);
      });
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
    };
  }, [isLoggedIn, updateLastActivity, checkSessionTimeout]);

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
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;
