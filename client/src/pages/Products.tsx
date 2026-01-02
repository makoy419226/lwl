import { useState, useMemo } from "react";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useClients } from "@/hooks/use-clients";
import { Loader2, Search, Shirt, Footprints, Home, Sparkles, Edit2, Check, X, Plus, Minus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
      return <Shirt className="w-5 h-5 text-primary" />;
    case "Undergarments":
    case "Accessories":
      return <Sparkles className="w-5 h-5 text-primary" />;
    case "Bedding":
    case "Home Linens":
    case "Bathroom":
    case "Flooring":
      return <Home className="w-5 h-5 text-primary" />;
    case "Footwear":
      return <Footprints className="w-5 h-5 text-primary" />;
    default:
      return <Shirt className="w-5 h-5 text-primary" />;
  }
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedClientId, setSelectedClientId] = useState("");
  const { data: products, isLoading, isError } = useProducts(searchTerm);
  const { data: clients } = useClients();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const handleQuantityChange = (productId: number, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const orderItems = useMemo(() => {
    if (!products) return [];
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products.find(p => p.id === parseInt(productId));
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as { product: typeof products[0]; quantity: number }[];
  }, [quantities, products]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + (parseFloat(item.product.price || "0") * item.quantity);
    }, 0);
  }, [orderItems]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setQuantities({});
      setSelectedClientId("");
      toast({ title: "Order created", description: "Order has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
    }
  });

  const handleCreateOrder = () => {
    if (!selectedClientId) {
      toast({ title: "Select client", description: "Please select a client first.", variant: "destructive" });
      return;
    }
    if (orderItems.length === 0) {
      toast({ title: "No items", description: "Please add items to the order.", variant: "destructive" });
      return;
    }

    const itemsText = orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    createOrderMutation.mutate({
      clientId: parseInt(selectedClientId),
      orderNumber,
      items: itemsText,
      totalAmount: orderTotal.toFixed(2),
      entryDate: new Date().toISOString(),
      deliveryType: "takeaway",
    });
  };

  const clearOrder = () => {
    setQuantities({});
    setSelectedClientId("");
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
                  <TableHead className="font-bold text-foreground text-base py-4 text-center w-40">
                    Quantity
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
                            className="w-12 h-12 rounded-sm bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto border border-primary/10 overflow-hidden cursor-pointer"
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
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                              <Edit2 className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-base py-3" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </TableCell>
                    <TableCell className="text-right py-3 font-bold text-primary text-lg" data-testid={`text-product-price-${product.id}`}>
                      {product.price ? `${parseFloat(product.price).toFixed(0)} AED` : "-"}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleQuantityChange(product.id, -1)}
                          disabled={!quantities[product.id]}
                          data-testid={`button-qty-minus-${product.id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className={`w-8 text-center font-bold ${quantities[product.id] ? "text-primary" : "text-muted-foreground"}`} data-testid={`text-qty-${product.id}`}>
                          {quantities[product.id] || 0}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleQuantityChange(product.id, 1)}
                          data-testid={`button-qty-plus-${product.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
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

      {/* Order Summary Bar */}
      {orderItems.length > 0 && (
        <Card className="sticky bottom-0 z-40 mx-4 mb-4 p-4 border-t-2 border-primary shadow-lg bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {orderItems.length} item(s) selected
                </p>
                <p className="text-xl font-bold text-primary" data-testid="text-order-total">
                  {orderTotal.toFixed(2)} AED
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-48" data-testid="select-order-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={clearOrder}
                data-testid="button-clear-order"
              >
                Clear
              </Button>
              
              <Button 
                onClick={handleCreateOrder}
                disabled={createOrderMutation.isPending || !selectedClientId}
                data-testid="button-create-order"
              >
                {createOrderMutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            <span className="font-medium">Items: </span>
            {orderItems.map((item, idx) => (
              <span key={item.product.id}>
                {item.quantity}x {item.product.name}
                {idx < orderItems.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
