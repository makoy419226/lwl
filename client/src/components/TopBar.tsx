import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TopBarProps {
  onSearch: (term: string) => void;
  searchValue: string;
  onAddClick?: () => void;
  addButtonLabel?: string;
  pageTitle: string;
}

export function TopBar({ onSearch, searchValue, onAddClick, addButtonLabel, pageTitle }: TopBarProps) {
  return (
    <div className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
      <div className="h-16 lg:h-20 px-4 lg:px-6 flex items-center justify-between gap-3 lg:gap-4">
        <h1 className="text-lg lg:text-2xl font-display font-bold text-foreground hidden md:block whitespace-nowrap">
          {pageTitle}
        </h1>

        <div className="flex-1 max-w-md relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <Input
            className="pl-10 h-12 lg:h-11 rounded-full border-2 border-muted bg-muted/30 focus:bg-background focus:border-primary/50 transition-all duration-300 touch-manipulation"
            placeholder={pageTitle === "Clients" ? "Search by name, phone..." : `Search...`}
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            autoComplete="off"
            data-testid="input-search"
          />
        </div>

        {onAddClick && addButtonLabel && (
          <Button
            size="lg"
            className="rounded-full px-4 lg:px-6 font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 h-12 lg:h-11 touch-manipulation"
            onClick={onAddClick}
            data-testid="button-add"
          >
            <Plus className="w-5 h-5 lg:mr-2" />
            <span className="hidden lg:inline">{addButtonLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
