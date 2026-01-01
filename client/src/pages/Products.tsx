import { useState } from "react";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { Loader2, Search, Shirt, Footprints, Home, Sparkles, Edit2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const getCategoryIcon = (category: string | null) => {
  switch (category) {
    case "Traditional Wear":
    case "Formal Wear":
    case "Tops":
    case "Bottoms":
    case "Outerwear":
    case "Workwear":
    case "Specialty":
      return <Shirt className="w-8 h-8 text-primary" />;
    case "Undergarments":
    case "Accessories":
      return <Sparkles className="w-8 h-8 text-primary" />;
    case "Bedding":
    case "Home Linens":
    case "Bathroom":
    case "Flooring":
      return <Home className="w-8 h-8 text-primary" />;
    case "Footwear":
      return <Footprints className="w-8 h-8 text-primary" />;
    default:
      return <Shirt className="w-8 h-8 text-primary" />;
  }
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const { data: products, isLoading, isError } = useProducts(searchTerm);
  const updateProduct = useUpdateProduct();

  const handleEditImage = (productId: number, currentUrl: string | null) => {
    setEditingImageId(productId);
    setImageUrl(currentUrl || "");
  };

  const handleSaveImage = (productId: number) => {
    updateProduct.mutate({ id: productId, imageUrl }, {
      onSuccess: () => {
        setEditingImageId(null);
        setImageUrl("");
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingImageId(null);
    setImageUrl("");
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="sticky top-0 z-30 w-full bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Price List
          </h1>
          <div className="flex-1 max-w-md relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <Input
              className="pl-10 h-11 rounded-full border-2 border-muted bg-muted/30 focus:bg-white dark:focus:bg-background focus:border-primary/50 transition-all duration-300"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading price list...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p className="font-semibold text-lg">Failed to load products</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="font-bold text-foreground text-base py-4 w-16 text-center">
                    #
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-base py-4 w-20 text-center">
                    Image
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-base py-4">
                    ITEM Name
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-base py-4 text-right">
                    Price (AED)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product, index) => (
                  <TableRow 
                    key={product.id}
                    className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    data-testid={`row-product-${product.id}`}
                  >
                    <TableCell className="font-medium py-3 text-center text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="relative group">
                        {editingImageId === product.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              placeholder="Image URL..."
                              className="h-8 text-xs w-32"
                              data-testid={`input-image-url-${product.id}`}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={() => handleSaveImage(product.id)}
                              disabled={updateProduct.isPending}
                              data-testid={`button-save-image-${product.id}`}
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={handleCancelEdit}
                              data-testid={`button-cancel-image-${product.id}`}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto border border-primary/20 overflow-hidden cursor-pointer"
                            onClick={() => handleEditImage(product.id, product.imageUrl)}
                            title="Click to edit image"
                          >
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getCategoryIcon(product.category)
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <Edit2 className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium py-3" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </TableCell>
                    <TableCell className="text-right py-3 font-bold text-primary text-lg" data-testid={`text-product-price-${product.id}`}>
                      {product.price ? `${parseFloat(product.price).toFixed(0)} AED` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t bg-muted/30 text-sm text-muted-foreground">
              Total Items: <span className="font-semibold text-primary">{products?.length || 0}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
