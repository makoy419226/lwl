import { useState, useMemo } from "react";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useClients } from "@/hooks/use-clients";
import { Loader2, Search, Shirt, Footprints, Home, Sparkles, Check, X, Plus, Minus, ShoppingCart, Clock, Package, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

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
  const { data: allOrders } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todaysOrders = useMemo(() => {
    if (!allOrders) return [];
    const today = format(new Date(), 'yyyy-MM-dd');
    return allOrders.filter(order => {
      const orderDate = order.entryDate ? format(new Date(order.entryDate), 'yyyy-MM-dd') : null;
      return orderDate === today;
    });
  }, [allOrders]);

  const pendingWashing = todaysOrders.filter(o => !o.washingDone);
  const pendingPacking = todaysOrders.filter(o => o.washingDone && !o.packingDone);
  const pendingDelivery = todaysOrders.filter(o => o.packingDone && !o.delivered);

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
    <div className="flex h-screen">
      {/* Left side - Price List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 w-full bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
          <div className="h-14 px-3 flex items-center justify-between gap-2">
            <h1 className="text-lg font-display font-bold text-foreground">
              Price List
            </h1>
            <div className="flex-1 max-w-xs relative group">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Search className="w-4 h-4" />
              </div>
              <Input
                className="pl-8 h-8 rounded-full border border-muted bg-muted/30 focus:bg-white dark:focus:bg-background focus:border-primary/50 transition-all text-sm"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
          </div>
        </div>

        <main className="flex-1 px-1 py-2 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
              <p>Loading...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-destructive">
              <p className="font-semibold text-lg">Failed to load</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-1">
              {products?.map((product) => (
                <div
                  key={product.id}
                  className={`relative aspect-square rounded-md border-2 p-1 flex flex-col items-center justify-between cursor-pointer transition-all ${
                    quantities[product.id] 
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30" 
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  onClick={() => handleQuantityChange(product.id, 1)}
                  data-testid={`box-product-${product.id}`}
                >
                  {editingImageId === product.id ? (
                    <div className="absolute inset-0 bg-card z-10 p-1 flex flex-col gap-1">
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="URL..."
                        className="h-5 text-[10px] px-1"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`input-image-url-${product.id}`}
                      />
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-5 w-5 flex-1"
                          onClick={(e) => { e.stopPropagation(); handleSaveImage(product.id); }}
                          disabled={updateProduct.isPending}
                          data-testid={`button-save-image-${product.id}`}
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-5 w-5 flex-1"
                          onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                          data-testid={`button-cancel-image-${product.id}`}
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div 
                    className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-primary/10 overflow-hidden flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleEditImage(product.id, product.imageUrl); }}
                    title="Click to edit image"
                  >
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Shirt className="w-3 h-3 text-primary" />
                    )}
                  </div>

                  <div className="text-[8px] leading-tight text-center font-medium text-foreground line-clamp-2 flex-1 flex items-center" data-testid={`text-product-name-${product.id}`}>
                    {product.name}
                  </div>

                  <div className="text-[10px] font-bold text-primary" data-testid={`text-product-price-${product.id}`}>
                    {product.price ? `${parseFloat(product.price).toFixed(0)}` : "-"}
                  </div>

                  {quantities[product.id] ? (
                    <div 
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center shadow"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span data-testid={`text-qty-${product.id}`}>{quantities[product.id]}</span>
                    </div>
                  ) : null}

                  {quantities[product.id] ? (
                    <Button
                      size="icon"
                      variant="destructive"
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full"
                    onClick={(e) => { e.stopPropagation(); handleQuantityChange(product.id, -1); }}
                    data-testid={`button-qty-minus-${product.id}`}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        </main>

        {/* Order Summary Bar - Highlighted */}
        {orderItems.length > 0 && (
          <div className="sticky bottom-0 z-40 mx-1 mb-1 p-2 border-2 border-primary shadow-2xl bg-primary/5 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                  <ShoppingCart className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {orderItems.length} items
                  </p>
                  <p className="text-sm font-bold text-primary" data-testid="text-order-total">
                    {orderTotal.toFixed(2)} AED
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 flex-wrap">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-order-client">
                    <SelectValue placeholder="Client" />
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
                  size="sm"
                  onClick={clearOrder}
                  data-testid="button-clear-order"
                >
                  <X className="w-3 h-3" />
                </Button>
                
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 text-xs"
                  onClick={handleCreateOrder}
                  disabled={createOrderMutation.isPending || !selectedClientId}
                  data-testid="button-create-order"
                >
                  {createOrderMutation.isPending ? "..." : "CREATE"}
                </Button>
              </div>
            </div>
            
            <div className="mt-1 pt-1 border-t border-primary/20 text-[10px] text-muted-foreground line-clamp-1">
              {orderItems.map((item, idx) => (
                <span key={item.product.id} className="font-medium">
                  {item.quantity}x {item.product.name}
                  {idx < orderItems.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right side - Today's Work List */}
      <div className="w-56 border-l bg-muted/30 flex flex-col">
        <div className="h-14 px-3 flex items-center border-b bg-white/80 dark:bg-background/80">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Today's Work
          </h2>
        </div>
        
        <div className="flex-1 overflow-auto p-2 space-y-3">
          {/* Washing Pending */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Shirt className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Washing</span>
              <Badge variant="secondary" className="ml-auto text-[10px] px-1 h-4">{pendingWashing.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingWashing.slice(0, 5).map(order => (
                <div key={order.id} className="bg-blue-50 dark:bg-blue-900/20 rounded p-1 text-[10px]">
                  <div className="font-semibold text-blue-700 dark:text-blue-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingWashing.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic">No pending</div>
              )}
            </div>
          </div>

          {/* Packing Pending */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Package className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Packing</span>
              <Badge variant="secondary" className="ml-auto text-[10px] px-1 h-4">{pendingPacking.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingPacking.slice(0, 5).map(order => (
                <div key={order.id} className="bg-orange-50 dark:bg-orange-900/20 rounded p-1 text-[10px]">
                  <div className="font-semibold text-orange-700 dark:text-orange-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingPacking.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic">No pending</div>
              )}
            </div>
          </div>

          {/* Delivery Pending */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Truck className="w-3 h-3 text-green-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Delivery</span>
              <Badge variant="secondary" className="ml-auto text-[10px] px-1 h-4">{pendingDelivery.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingDelivery.slice(0, 5).map(order => (
                <div key={order.id} className="bg-green-50 dark:bg-green-900/20 rounded p-1 text-[10px]">
                  <div className="font-semibold text-green-700 dark:text-green-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingDelivery.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic">No pending</div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 border-t">
            <div className="text-[10px] text-muted-foreground">
              Today's Orders: <span className="font-bold text-foreground">{todaysOrders.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
