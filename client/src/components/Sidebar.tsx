import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, List, Phone, TrendingUp, LogOut, Shield, UserCog, Wallet, ClipboardList, HardHat, AlertTriangle, CircleDollarSign, Menu, X, Search, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import logoImage from "@assets/image_1767220512226.png";

interface UserInfo {
  id: number;
  username: string;
  role: string;
  name: string;
}

interface SidebarProps {
  user?: UserInfo | null;
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);

  const isInventory = location === "/" || location === "/inventory";
  const isPriceList = location === "/products";
  const isClients = location === "/clients" || location.startsWith("/clients/");
  const isBills = location === "/bills";
  const isOrders = location === "/orders";
  const isWorkers = location === "/workers";
  const isSalesReports = location === "/sales-reports";
  const isIncidents = location === "/incidents";
  const isDueCustomers = location === "/due-customers";
  const isContact = location === "/contact";
  const isTrackOrder = location === "/track";

  const userRole = user?.role || "cashier";
  const isAdmin = userRole === "admin";
  const isManager = userRole === "manager";
  const isAdminOrManager = isAdmin || isManager;

  const allNavItems = [
    { href: "/inventory", icon: Package, label: "Inventory", active: isInventory, testId: "nav-inventory", roles: ["admin", "manager", "cashier"] },
    { href: "/products", icon: List, label: "New Order", active: isPriceList, testId: "nav-new-order", roles: ["admin", "manager", "cashier"] },
    { href: "/clients", icon: Users, label: "Clients", active: isClients, testId: "nav-clients", roles: ["admin", "manager", "cashier"] },
    { href: "/bills", icon: FileText, label: "Bills", active: isBills, testId: "nav-bills", roles: ["admin", "manager", "cashier"] },
    { href: "/orders", icon: ClipboardList, label: "Orders", active: isOrders, testId: "nav-orders", roles: ["admin", "manager", "cashier"] },
    { href: "/workers", icon: HardHat, label: "Staff", active: isWorkers, testId: "nav-workers", roles: ["admin", "manager"] },
    { href: "/sales-reports", icon: TrendingUp, label: "Sales Reports", active: isSalesReports, testId: "nav-sales-reports", roles: ["admin"] },
    { href: "/incidents", icon: AlertTriangle, label: "Incidents", active: isIncidents, testId: "nav-incidents", roles: ["admin", "manager"] },
    { href: "/due-customers", icon: CircleDollarSign, label: "Due Customers", active: isDueCustomers, testId: "nav-due-customers", roles: ["admin", "manager"] },
    { href: "/contact", icon: Phone, label: "Contact", active: isContact, testId: "nav-contact", roles: ["admin", "manager", "cashier"] },
    { href: "/track", icon: FlaskConical, label: "Track Order", active: isTrackOrder, testId: "nav-track-order", experimental: true, roles: ["admin", "manager"] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 lg:hidden h-12 w-12 bg-white shadow-md border"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-menu-toggle"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      )}

      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`
        ${isMobile ? 'fixed left-0 top-0 z-40' : 'relative'} 
        w-64 h-screen bg-white border-r border-border flex flex-col
        transition-transform duration-300 ease-in-out
        ${isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        <div className="p-4 border-b border-border">
          <img 
            src={logoImage} 
            alt="Liquid Washes Laundry" 
            className="w-full h-auto max-h-24 object-contain"
            data-testid="img-logo"
          />
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={item.active ? "default" : "ghost"}
                className={`w-full justify-start rounded-lg font-semibold gap-3 h-12 touch-manipulation ${
                  item.active
                    ? "bg-primary text-white shadow-md"
                    : "text-foreground hover:bg-muted/50"
                }`}
                data-testid={item.testId}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{item.label}</span>
                {"experimental" in item && item.experimental && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1 shrink-0 text-red-500 border-red-500">
                    Beta
                  </Badge>
                )}
              </Button>
            </Link>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {user.role === "admin" ? (
                  <Shield className="w-5 h-5 text-primary" />
                ) : user.role === "manager" ? (
                  <UserCog className="w-5 h-5 text-primary" />
                ) : (
                  <Wallet className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{user.name || user.username}</p>
                <Badge variant="secondary" className="text-xs capitalize">
                  {user.role}
                </Badge>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="default" 
              className="w-full gap-2 h-11 touch-manipulation"
              onClick={onLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}

        <div className="p-4 border-t border-border text-xs text-muted-foreground text-center space-y-1">
          <p className="font-semibold text-foreground">Liquide Washes Laundry</p>
          <p>Centra Market D/109</p>
          <p>Al Dhanna City, Al Ruwais</p>
          <p>Abu Dhabi - UAE</p>
          <p className="pt-1">© 2024</p>
        </div>
      </div>
    </>
  );
}
