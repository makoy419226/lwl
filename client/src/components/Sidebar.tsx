import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, Users, FileText, List, Phone, TrendingUp, LogOut, Shield, UserCog, Wallet, ClipboardList, HardHat, AlertTriangle, CircleDollarSign, Menu, X, FlaskConical, Settings, ChevronDown } from "lucide-react";
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
  const [settingsExpanded, setSettingsExpanded] = useState(false);

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

  const isDashboard = location === "/" || location === "/dashboard";
  const isInventory = location === "/inventory";
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
  const isAdminSettings = location === "/admin-settings";

  const userRole = user?.role || "cashier";
  const isAdmin = userRole === "admin";
  const isManager = userRole === "manager";
  const isAdminOrManager = isAdmin || isManager;

  const navGroups = [
    {
      label: "Operations",
      collapsible: false,
      items: [
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", active: isDashboard, testId: "nav-dashboard", roles: ["admin", "manager", "cashier"] },
        { href: "/products", icon: List, label: "New Order", active: isPriceList, testId: "nav-new-order", roles: ["admin", "manager", "cashier"] },
        { href: "/orders", icon: ClipboardList, label: "Order Tracking", active: isOrders, testId: "nav-orders", roles: ["admin", "manager", "cashier"] },
      ]
    },
    {
      label: "Business",
      collapsible: false,
      items: [
        { href: "/inventory", icon: Package, label: "Inventory", active: isInventory, testId: "nav-inventory", roles: ["admin", "manager", "cashier"] },
        { href: "/clients", icon: Users, label: "Clients", active: isClients, testId: "nav-clients", roles: ["admin", "manager", "cashier"] },
        { href: "/bills", icon: FileText, label: "Bills", active: isBills, testId: "nav-bills", roles: ["admin", "manager", "cashier"] },
        { href: "/due-customers", icon: CircleDollarSign, label: "Due Customers", active: isDueCustomers, testId: "nav-due-customers", roles: ["admin", "manager"] },
      ]
    },
    {
      label: "Reports",
      collapsible: false,
      items: [
        { href: "/sales-reports", icon: TrendingUp, label: "Sales Reports", active: isSalesReports, testId: "nav-sales-reports", roles: ["admin"] },
        { href: "/incidents", icon: AlertTriangle, label: "Incidents", active: isIncidents, testId: "nav-incidents", roles: ["admin", "manager"] },
      ]
    },
    {
      label: "Settings",
      collapsible: true,
      items: [
        { href: "/workers", icon: HardHat, label: "Staff", active: isWorkers, testId: "nav-workers", roles: ["admin"] },
        { href: "/contact", icon: Phone, label: "Contact", active: isContact, testId: "nav-contact", roles: ["admin", "manager", "cashier"] },
        { href: "/track", icon: FlaskConical, label: "Public Tracking", active: isTrackOrder, testId: "nav-track-order", roles: ["admin", "manager"] },
        { href: "/admin-settings", icon: Settings, label: "Admin Settings", active: isAdminSettings, testId: "nav-admin-settings", roles: ["admin"] },
      ]
    },
  ];

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0);

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
        <div className="p-3 border-b border-border">
          <img 
            src={logoImage} 
            alt="Liquid Washes Laundry" 
            className="w-full h-auto max-h-16 object-contain"
            data-testid="img-logo"
          />
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {filteredGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {group.collapsible ? (
                <>
                  <button
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1 hover:text-foreground transition-colors"
                    data-testid="button-toggle-settings"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-3 h-3" />
                      {group.label}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${settingsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`space-y-1 overflow-hidden transition-all duration-200 ${settingsExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={item.active ? "default" : "ghost"}
                          className={`w-full justify-start rounded-lg font-medium gap-3 h-9 touch-manipulation pl-6 transition-all duration-200 group ${
                            item.active
                              ? "bg-primary text-white shadow-md"
                              : "text-foreground hover:bg-primary/10 hover:translate-x-1 hover:text-primary"
                          }`}
                          data-testid={item.testId}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                          <span className="truncate flex-1 text-left text-sm">{item.label}</span>
                        </Button>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={item.active ? "default" : "ghost"}
                        className={`w-full justify-start rounded-lg font-medium gap-3 h-10 touch-manipulation transition-all duration-200 group ${
                          item.active
                            ? "bg-primary text-white shadow-md"
                            : "text-foreground hover:bg-primary/10 hover:translate-x-1 hover:text-primary"
                        }`}
                        data-testid={item.testId}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                        <span className="truncate flex-1 text-left text-sm">{item.label}</span>
                      </Button>
                    </Link>
                  ))}
                </>
              )}
            </div>
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

        <div className="p-3 border-t border-border text-[10px] text-muted-foreground text-center">
          <p className="font-medium text-foreground text-xs">Liquide Washes Laundry</p>
          <p>Al Dhanna City, Al Ruwais · Abu Dhabi</p>
          <p>© 2024</p>
        </div>
      </div>
    </>
  );
}
