import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, List } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();
  const isInventory = location === "/" || location === "/inventory";
  const isPriceList = location === "/products";
  const isClients = location === "/clients" || location.startsWith("/clients/");
  const isBills = location === "/bills";

  return (
    <div className="w-64 h-screen bg-white border-r border-border sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold font-display text-xl">
            L
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Liquid</h2>
            <p className="text-xs text-primary font-semibold">Washes</p>
          </div>
        </div>
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
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground text-center">
        <p>© 2024 Liquid Washes</p>
      </div>
    </div>
  );
}
