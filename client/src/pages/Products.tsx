import { useState, useMemo } from "react";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useClients } from "@/hooks/use-clients";
import { Loader2, Search, Shirt, Footprints, Home, Sparkles, Check, X, Plus, Minus, ShoppingCart, Clock, Package, Truck, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
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
    setShowUrgentDialog(true);
  };

  const submitOrder = (isUrgent: boolean) => {
    const itemsText = orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const finalTotal = isUrgent ? orderTotal * 2 : orderTotal;

    createOrderMutation.mutate({
      clientId: parseInt(selectedClientId),
      orderNumber,
      items: itemsText,
      totalAmount: finalTotal.toFixed(2),
      entryDate: new Date().toISOString(),
      deliveryType: "takeaway",
      urgent: isUrgent,
    });
    setShowUrgentDialog(false);
  };

  const clearOrder = () => {
    setQuantities({});
    setSelectedClientId("");
  };

  return (
    <div className="flex h-screen">
      {/* Left side - Price List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 w-full bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border">
          <div className="h-10 px-2 flex items-center justify-between gap-2">
            <h1 className="text-sm font-display font-bold text-foreground">
              Price List
            </h1>
            <div className="flex-1 max-w-xs relative group">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Search className="w-3 h-3" />
              </div>
              <Input
                className="pl-7 h-7 rounded-full border border-muted bg-muted/30 focus:bg-white dark:focus:bg-background focus:border-primary/50 transition-all text-xs"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
          </div>
        </div>

        <main className="flex-1 flex overflow-hidden">
          <div className={`flex-1 px-2 py-2 overflow-auto ${orderItems.length > 0 ? 'pr-0' : ''}`}>
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
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
              {products?.map((product) => (
                <div
                  key={product.id}
                  className={`relative aspect-square rounded border p-0.5 flex flex-col items-center justify-between cursor-pointer transition-all ${
                    quantities[product.id] 
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30" 
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
                    className="w-5 h-5 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center overflow-hidden flex-shrink-0"
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
                      <Shirt className="w-2.5 h-2.5 text-primary" />
                    )}
                  </div>

                  <div className="text-[11px] leading-tight text-center font-bold text-foreground line-clamp-2 flex-1 flex items-center justify-center px-0.5" data-testid={`text-product-name-${product.id}`}>
                    {product.name}
                  </div>

                  <div className="text-[10px] font-bold text-primary" data-testid={`text-product-price-${product.id}`}>
                    {product.price ? `${parseFloat(product.price).toFixed(0)} AED` : "-"}
                  </div>

                  {quantities[product.id] ? (
                    <div 
                      className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[7px] font-bold flex items-center justify-center shadow"
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
          </div>
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

      {/* Right side - Order Slip or Today's Work List */}
      <div className="w-72 border-l bg-muted/30 flex flex-col">
        {orderItems.length > 0 ? (
          <>
            <div className="h-12 px-3 flex items-center justify-between border-b bg-primary/10">
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Order Slip
              </h2>
              <Badge variant="secondary" className="text-xs font-bold">{orderItems.length} items</Badge>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <div className="border rounded bg-white dark:bg-background p-3 space-y-3">
                <div className="text-center border-b pb-2">
                  <div className="text-sm font-bold text-primary">LIQUID WASHES LAUNDRY</div>
                  <div className="text-xs text-muted-foreground font-semibold">Order Preview</div>
                </div>
                <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-background">
                    <tr className="border-b">
                      <th className="text-left py-1 font-bold">#</th>
                      <th className="text-left py-1 font-bold">Item</th>
                      <th className="text-center py-1 font-bold">Qty</th>
                      <th className="text-right py-1 font-bold">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => (
                      <tr key={item.product.id} className="border-b border-dashed">
                        <td className="py-1 font-bold">{idx + 1}</td>
                        <td className="py-1 font-bold truncate max-w-[100px]" title={item.product.name}>{item.product.name}</td>
                        <td className="py-1 text-center font-bold">{item.quantity}</td>
                        <td className="py-1 text-right font-bold">{(parseFloat(item.product.price || "0") * item.quantity).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Subtotal</span>
                    <span>{orderTotal.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-primary">
                    <span>TOTAL</span>
                    <span>{orderTotal.toFixed(2)} AED</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full h-8 text-xs" data-testid="select-order-client-panel">
                    <SelectValue placeholder="Select Client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={clearOrder}
                    data-testid="button-clear-order-panel"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                  <Button 
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={handleCreateOrder}
                    disabled={createOrderMutation.isPending || !selectedClientId}
                    data-testid="button-create-order-panel"
                  >
                    {createOrderMutation.isPending ? "..." : "CREATE"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
        <div className="h-12 px-3 flex items-center border-b bg-white/80 dark:bg-background/80">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Today's Work
          </h2>
        </div>
        
        <div className="flex-1 overflow-auto p-2 space-y-3">
          {/* Washing Pending */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shirt className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-muted-foreground uppercase">Washing</span>
              <Badge variant="secondary" className="ml-auto text-xs font-bold">{pendingWashing.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingWashing.slice(0, 5).map(order => (
                <div key={order.id} className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-xs">
                  <div className="font-bold text-blue-700 dark:text-blue-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground font-semibold line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingWashing.length === 0 && (
                <div className="text-xs text-muted-foreground italic font-semibold">No pending</div>
              )}
            </div>
          </div>

          {/* Packing Pending */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-muted-foreground uppercase">Packing</span>
              <Badge variant="secondary" className="ml-auto text-xs font-bold">{pendingPacking.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingPacking.slice(0, 5).map(order => (
                <div key={order.id} className="bg-orange-50 dark:bg-orange-900/20 rounded p-2 text-xs">
                  <div className="font-bold text-orange-700 dark:text-orange-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground font-semibold line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingPacking.length === 0 && (
                <div className="text-xs text-muted-foreground italic font-semibold">No pending</div>
              )}
            </div>
          </div>

          {/* Delivery Pending */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold text-muted-foreground uppercase">Delivery</span>
              <Badge variant="secondary" className="ml-auto text-xs font-bold">{pendingDelivery.length}</Badge>
            </div>
            <div className="space-y-1">
              {pendingDelivery.slice(0, 5).map(order => (
                <div key={order.id} className="bg-green-50 dark:bg-green-900/20 rounded p-2 text-xs">
                  <div className="font-bold text-green-700 dark:text-green-300">{order.orderNumber}</div>
                  <div className="text-muted-foreground font-semibold line-clamp-1">{order.items}</div>
                </div>
              ))}
              {pendingDelivery.length === 0 && (
                <div className="text-xs text-muted-foreground italic font-semibold">No pending</div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground font-semibold">
              Today's Orders: <span className="font-bold text-foreground">{todaysOrders.length}</span>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Urgent/Normal Service Dialog */}
      <Dialog open={showUrgentDialog} onOpenChange={setShowUrgentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Select Service Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-4">
              <div className="font-semibold text-foreground text-lg mb-1">
                Order Total: {orderTotal.toFixed(2)} AED
              </div>
              <div className="text-xs">
                Urgent service = Double price ({(orderTotal * 2).toFixed(2)} AED)
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => submitOrder(false)}
                disabled={createOrderMutation.isPending}
                data-testid="button-normal-service"
              >
                <Clock className="w-8 h-8 text-blue-500" />
                <div className="font-semibold">Normal</div>
                <div className="text-xs text-muted-foreground">{orderTotal.toFixed(2)} AED</div>
              </Button>
              <Button
                className="h-24 flex flex-col gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => submitOrder(true)}
                disabled={createOrderMutation.isPending}
                data-testid="button-urgent-service"
              >
                <Zap className="w-8 h-8" />
                <div className="font-semibold">Urgent</div>
                <div className="text-xs">{(orderTotal * 2).toFixed(2)} AED</div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
