import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, List, Phone, TrendingUp, LogOut, Shield, UserCog, Wallet, ClipboardList, HardHat, AlertTriangle, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="w-64 h-screen bg-white border-r border-border sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="p-4 border-b border-border">
        <img 
          src={logoImage} 
          alt="Liquid Washes Laundry" 
          className="w-full h-auto max-h-24 object-contain"
          data-testid="img-logo"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/inventory">
          <Button
            variant={isInventory ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isInventory
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-inventory"
          >
            <Package className="w-5 h-5" />
            Inventory
          </Button>
        </Link>

        <Link href="/products">
          <Button
            variant={isPriceList ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isPriceList
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-price-list"
          >
            <List className="w-5 h-5" />
            Price List
          </Button>
        </Link>

        <Link href="/clients">
          <Button
            variant={isClients ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isClients
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-clients"
          >
            <Users className="w-5 h-5" />
            Clients
          </Button>
        </Link>

        <Link href="/bills">
          <Button
            variant={isBills ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isBills
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-bills"
          >
            <FileText className="w-5 h-5" />
            Bills
          </Button>
        </Link>

        <Link href="/orders">
          <Button
            variant={isOrders ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isOrders
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-orders"
          >
            <ClipboardList className="w-5 h-5" />
            Orders
          </Button>
        </Link>

        <Link href="/workers">
          <Button
            variant={isWorkers ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isWorkers
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-workers"
          >
            <HardHat className="w-5 h-5" />
            Staff
          </Button>
        </Link>

        <Link href="/sales-reports">
          <Button
            variant={isSalesReports ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isSalesReports
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-sales-reports"
          >
            <TrendingUp className="w-5 h-5" />
            Sales Reports
          </Button>
        </Link>

        <Link href="/incidents">
          <Button
            variant={isIncidents ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isIncidents
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-incidents"
          >
            <AlertTriangle className="w-5 h-5" />
            Incidents
          </Button>
        </Link>

        <Link href="/due-customers">
          <Button
            variant={isDueCustomers ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isDueCustomers
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-due-customers"
          >
            <CircleDollarSign className="w-5 h-5" />
            Due Customers
          </Button>
        </Link>

        <Link href="/contact">
          <Button
            variant={isContact ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isContact
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-contact"
          >
            <Phone className="w-5 h-5" />
            Contact
          </Button>
        </Link>
      </nav>

      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
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
            size="sm" 
            className="w-full gap-2"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground text-center space-y-1">
        <p className="font-semibold text-foreground">Liquide Washes Laundry</p>
        <p>Centra Market D/109</p>
        <p>Al Dhanna City, Al Ruwais</p>
        <p>Abu Dhabi - UAE</p>
        <p className="pt-1">© 2024</p>
      </div>
    </div>
  );
}
