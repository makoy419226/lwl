import { useState, useEffect, useRef } from "react";
import { Search, X, Package, Users, FileText, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface SearchResult {
  id: number;
  type: "order" | "client" | "product" | "bill";
  title: string;
  subtitle?: string;
  status?: string;
}

export function QuickSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      // Windows+S (Meta+S) - prevent default Windows search
      if (e.metaKey && e.key === "s") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    switch (result.type) {
      case "order":
        setLocation(`/orders?search=${encodeURIComponent(result.title.replace("Order #", ""))}`);
        break;
      case "client":
        setLocation(`/clients/${result.id}`);
        break;
      case "product":
        setLocation(`/products?search=${encodeURIComponent(result.title)}`);
        break;
      case "bill":
        setLocation(`/bills?search=${encodeURIComponent(result.title.replace("Bill #", ""))}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingCart className="w-4 h-4" />;
      case "client":
        return <Users className="w-4 h-4" />;
      case "product":
        return <Package className="w-4 h-4" />;
      case "bill":
        return <FileText className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      order: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      client: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      product: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      bill: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    };
    return variants[type] || "";
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-muted-foreground"
        data-testid="button-quick-search"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⊞</span>S
        </kbd>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20" data-testid="quick-search-overlay">
      <div ref={containerRef} className="w-full max-w-lg bg-card rounded-lg shadow-lg border overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, clients, products, bills..."
            className="border-0 focus-visible:ring-0 flex-1"
            data-testid="input-quick-search"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            data-testid="button-close-search"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          )}
          
          {!loading && query && results.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">No results found</div>
          )}
          
          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((result, idx) => (
                <div
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover-elevate"
                  data-testid={`search-result-${idx}`}
                >
                  <div className="text-muted-foreground">{getIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <Badge variant="secondary" className={getTypeBadge(result.type)}>
                    {result.type}
                  </Badge>
                  {result.status && (
                    <Badge variant="outline" className="text-xs">{result.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && !query && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Start typing to search across orders, clients, products, and bills
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
