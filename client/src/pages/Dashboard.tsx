import { useState, useContext } from "react";
import { TopBar } from "@/components/TopBar";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/use-products";
import { Loader2, PackageOpen, Phone, Mail, Globe } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/ProductForm";
import { UserContext } from "@/App";

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: products, isLoading, isError } = useProducts(searchTerm);
  const user = useContext(UserContext);
  const isAdmin = user?.role === "admin";

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-primary text-white overflow-hidden">
        <div className="animate-marquee whitespace-nowrap py-2 flex gap-16">
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4 animate-blink" />
            <span className="animate-blink font-bold">Tel: 026 815 824</span>
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4 animate-blink" />
            <span className="animate-blink font-bold">Phone: +971 56 338 0001</span>
          </span>
          <span className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email: info@lwl.ae
          </span>
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            www.lwl.ae
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4 animate-blink" />
            <span className="animate-blink font-bold">Tel: 026 815 824</span>
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4 animate-blink" />
            <span className="animate-blink font-bold">Phone: +971 56 338 0001</span>
          </span>
          <span className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email: info@lwl.ae
          </span>
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            www.lwl.ae
          </span>
        </div>
      </div>
      <TopBar 
        onSearch={setSearchTerm} 
        searchValue={searchTerm}
        onAddClick={isAdmin ? () => setIsCreateOpen(true) : undefined}
        addButtonLabel={isAdmin ? "Add Product" : undefined}
        pageTitle="Inventory"
      />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <div className="mb-8">
          <p className="text-muted-foreground">Monitor your stock levels.</p>
          <div className="mt-4 text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block">
            Total Items: <span className="text-primary">{products?.length || 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading inventory...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p className="font-semibold text-lg">Failed to load products</p>
            <p className="text-sm opacity-80">Please try refreshing the page.</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
            <PackageOpen className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No products found</h3>
            <p className="max-w-md text-center">
              {searchTerm 
                ? `No products match "${searchTerm}". Try a different search term.` 
                : "Your inventory is empty. Click the 'Add Product' button to get started."}
            </p>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
          >
            {products?.map((product) => (
              <motion.div key={product.id} variants={item}>
                <ProductCard product={product} canEdit={isAdmin} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
      
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Add New Product</DialogTitle>
          </DialogHeader>
          <ProductForm 
            mode="create" 
            onSuccess={() => setIsCreateOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <footer className="bg-primary/5 border-t border-border py-6 px-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6 mb-4">
            <a 
              href="tel:026815824" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-tel"
            >
              <Phone className="w-4 h-4" />
              026 815 824
            </a>
            <a 
              href="tel:+971563380001" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-phone"
            >
              <Phone className="w-4 h-4" />
              +971 56 338 0001
            </a>
            <a 
              href="https://wa.me/971563380001" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors"
              data-testid="footer-whatsapp"
            >
              <SiWhatsapp className="w-4 h-4" />
              WhatsApp
            </a>
            <a 
              href="mailto:info@lwl.ae" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-email"
            >
              <Mail className="w-4 h-4" />
              info@lwl.ae
            </a>
            <a 
              href="https://www.lwl.ae" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-website"
            >
              <Globe className="w-4 h-4" />
              www.lwl.ae
            </a>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            © 2024 Liquid Washes. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
