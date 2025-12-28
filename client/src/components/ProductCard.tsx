import { Product } from "@shared/schema";
import { Edit2, Trash2, Package, Droplets } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductForm } from "./ProductForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDeleteProduct } from "@/hooks/use-products";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const deleteProduct = useDeleteProduct();

  // Fresh blue gradient for placeholder if no image
  const placeholderGradient = "bg-gradient-to-br from-blue-100 to-blue-50";

  return (
    <div className="group relative bg-card rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden flex flex-col h-full">
      {/* Image / Icon Area */}
      <div className={`h-48 w-full ${placeholderGradient} flex items-center justify-center overflow-hidden relative`}>
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-primary/40 group-hover:text-primary/60 transition-colors">
            <Droplets size={64} strokeWidth={1.5} />
          </div>
        )}
        
        {/* Quick Action Overlay (visible on hover) */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="secondary" className="rounded-full shadow-lg hover:scale-110 transition-transform bg-white text-primary hover:bg-white hover:text-primary">
                <Edit2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
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
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {product.category || "General"}
          </span>
          <span className="text-lg font-bold text-primary font-display">
            ${product.price ? Number(product.price).toFixed(2) : '0.00'}
          </span>
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
