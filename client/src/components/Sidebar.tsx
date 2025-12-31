import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, List, Phone, TrendingUp } from "lucide-react";
import logoImage from "@assets/image_1767220512226.png";

export function Sidebar() {
  const [location] = useLocation();
  const isInventory = location === "/" || location === "/inventory";
  const isPriceList = location === "/products";
  const isClients = location === "/clients" || location.startsWith("/clients/");
  const isBills = location === "/bills";
  const isDailySales = location === "/daily-sales";
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

        <Link href="/daily-sales">
          <Button
            variant={isDailySales ? "default" : "ghost"}
            className={`w-full justify-start rounded-lg font-semibold gap-3 h-11 ${
              isDailySales
                ? "bg-primary text-white shadow-md"
                : "text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-daily-sales"
          >
            <TrendingUp className="w-5 h-5" />
            Daily Sales
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
