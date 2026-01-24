import { Product } from "@shared/schema";
import { Edit2, Trash2, Package, Shirt, Footprints, Home, Sparkles } from "lucide-react";
import { getProductImage } from "@/lib/productImages";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductForm } from "./ProductForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDeleteProduct } from "@/hooks/use-products";

const getCategoryIcon = (category: string | null) => {
  switch (category) {
    case "Traditional Wear":
    case "Formal Wear":
    case "Tops":
    case "Bottoms":
    case "Outerwear":
    case "Workwear":
    case "Specialty":
      return <Shirt size={40} strokeWidth={1.5} />;
    case "Undergarments":
    case "Accessories":
      return <Sparkles size={40} strokeWidth={1.5} />;
    case "Bedding":
    case "Home Linens":
    case "Bathroom":
    case "Flooring":
      return <Home size={40} strokeWidth={1.5} />;
    case "Footwear":
      return <Footprints size={40} strokeWidth={1.5} />;
    default:
      return <Shirt size={40} strokeWidth={1.5} />;
  }
};

interface ProductCardProps {
  product: Product;
  canEdit?: boolean;
}

const activeColors = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-pink-500 to-pink-600",
  "from-indigo-500 to-indigo-600",
  "from-cyan-500 to-cyan-600",
  "from-teal-500 to-teal-600",
  "from-orange-500 to-orange-600",
  "from-emerald-500 to-emerald-600",
];

export function ProductCard({ product, canEdit = true }: ProductCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [colorIndex, setColorIndex] = useState(() => Math.floor(Math.random() * activeColors.length));
  const deleteProduct = useDeleteProduct();

  const handleCardClick = () => {
    setIsActive(!isActive);
    if (!isActive) {
      setColorIndex((prev) => (prev + 1) % activeColors.length);
    }
  };

  const placeholderGradient = isActive 
    ? `bg-gradient-to-br ${activeColors[colorIndex]}` 
    : "bg-gradient-to-br from-blue-100 to-blue-50";

  return (
    <div 
      className={`group relative bg-card rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-visible flex flex-col h-full cursor-pointer ${
        isActive 
          ? "border-primary border-2 ring-4 ring-primary/40 animate-pulse" 
          : "border-border hover:border-primary/20"
      }`}
      onClick={handleCardClick}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image / Icon Area */}
      <div className={`h-36 sm:h-40 w-full ${placeholderGradient} flex items-center justify-center overflow-hidden relative rounded-t-2xl`}>
        {(() => {
          const imageSrc = product.imageUrl || getProductImage(product.name);
          if (imageSrc) {
            return (
              <img 
                src={imageSrc} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
            );
          }
          return null;
        })()}
        <div className={`fallback-icon flex-col items-center justify-center ${
          isActive ? "text-white" : "text-primary/40 group-hover:text-primary/60"
        } transition-colors`} style={{ display: (product.imageUrl || getProductImage(product.name)) ? 'none' : 'flex' }}>
          {getCategoryIcon(product.category)}
        </div>
        
        {/* Quick Action Overlay (visible on hover) - only for admins */}
        {canEdit && (
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="secondary" className="rounded-full shadow-lg hover:scale-110 transition-transform bg-white text-primary hover:bg-white hover:text-primary">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display text-primary">Edit Product</DialogTitle>
                </DialogHeader>
                <ProductForm 
                  defaultValues={product} 
                  onSuccess={() => setIsEditOpen(false)}
                  mode="edit"
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="destructive" className="rounded-full shadow-lg hover:scale-110 transition-transform">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the product from your inventory.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteProduct.mutate(product.id)}
                  >
                    {deleteProduct.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-3 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {product.category || "General"}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-bold text-primary font-display">
              AED {product.price ? Number(product.price).toFixed(2) : '0.00'}
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              DC: {product.dryCleanPrice ? Number(product.dryCleanPrice).toFixed(2) : '-'}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-bold text-foreground mb-1 font-display line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-grow">
          {product.description || "No description provided."}
        </p>

        <div className="pt-4 border-t border-border flex items-center justify-between mt-auto">
          <div className="flex items-center text-sm text-muted-foreground">
            <Package className="w-4 h-4 mr-1.5" />
            <span className={product.stockQuantity && product.stockQuantity < 10 ? "text-amber-500 font-semibold" : ""}>
              {product.stockQuantity || 0} in stock
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {product.sku || "NO-SKU"}
          </div>
        </div>
      </div>
    </div>
  );
}
