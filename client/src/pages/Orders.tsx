import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, Package, Shirt, CheckCircle2, Truck, Clock, 
  AlertTriangle, Plus, Minus, Search, Bell, Printer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OrderReceipt } from "@/components/OrderReceipt";
import type { Order, Client, Product } from "@shared/schema";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: dueSoonOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders/due-soon"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (dueSoonOrders && dueSoonOrders.length > 0) {
      toast({
        title: "Delivery Alert",
        description: `${dueSoonOrders.length} order(s) due for delivery soon!`,
        variant: "destructive",
      });
    }
  }, [dueSoonOrders?.length]);

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/orders/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order Updated", description: "Status updated successfully" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateOpen(false);
      toast({ title: "Order Created", description: "New order has been created" });
    },
  });

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = !searchTerm || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "entry") return matchesSearch && !order.washingDone;
    if (activeTab === "washing") return matchesSearch && order.washingDone && !order.packingDone;
    if (activeTab === "packing") return matchesSearch && order.packingDone && !order.delivered;
    if (activeTab === "delivered") return matchesSearch && order.delivered;
    return matchesSearch;
  });

  const getStatusBadge = (order: Order) => {
    if (order.delivered) return <Badge className="bg-green-500">Delivered</Badge>;
    if (order.packingDone) return <Badge className="bg-purple-500">Ready</Badge>;
    if (order.washingDone) return <Badge className="bg-blue-500">Packing</Badge>;
    return <Badge className="bg-orange-500">Entry</Badge>;
  };

  const getTimeRemaining = (expectedDeliveryAt: Date | null) => {
    if (!expectedDeliveryAt) return null;
    const now = new Date();
    const diff = new Date(expectedDeliveryAt).getTime() - now.getTime();
    if (diff <= 0) return <Badge variant="destructive" className="animate-pulse">Overdue</Badge>;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return <Badge variant="secondary">{hours}h {minutes % 60}m</Badge>;
    }
    if (minutes <= 30) {
      return <Badge variant="destructive" className="animate-pulse">{minutes}m</Badge>;
    }
    return <Badge variant="secondary">{minutes}m</Badge>;
  };

  const handleStatusUpdate = (orderId: number, field: string, value: boolean) => {
    const updates: any = { [field]: value };
    if (value) {
      updates[field.replace('Done', 'Date').replace('delivered', 'deliveryDate')] = new Date().toISOString();
    }
    updateOrderMutation.mutate({ id: orderId, updates });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Order Tracking
          </h1>
          <div className="flex items-center gap-4">
            {dueSoonOrders && dueSoonOrders.length > 0 && (
              <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                <Bell className="w-4 h-4" />
                {dueSoonOrders.length} Due Soon
              </Badge>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-orders"
              />
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-order">
                  <Plus className="w-4 h-4 mr-2" />
                  New Order
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                </DialogHeader>
                <OrderForm 
                  clients={clients || []} 
                  onSubmit={(data) => createOrderMutation.mutate(data)}
                  isLoading={createOrderMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Shirt className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entry</p>
                  <p className="text-2xl font-bold" data-testid="text-entry-count">
                    {orders?.filter(o => !o.washingDone).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Washing</p>
                  <p className="text-2xl font-bold" data-testid="text-washing-count">
                    {orders?.filter(o => o.washingDone && !o.packingDone).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Packing</p>
                  <p className="text-2xl font-bold" data-testid="text-packing-count">
                    {orders?.filter(o => o.packingDone && !o.delivered).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold" data-testid="text-delivered-count">
                    {orders?.filter(o => o.delivered).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="entry">Entry</TabsTrigger>
            <TabsTrigger value="washing">Washing</TabsTrigger>
            <TabsTrigger value="packing">Ready</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : filteredOrders?.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No orders found</p>
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Client Due</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const groupedOrders = filteredOrders?.reduce((acc, order) => {
                        const clientId = order.clientId;
                        if (!acc[clientId]) {
                          acc[clientId] = [];
                        }
                        acc[clientId].push(order);
                        return acc;
                      }, {} as Record<number, typeof filteredOrders>);

                      return Object.entries(groupedOrders || {}).map(([clientId, clientOrders]) => {
                        const client = clients?.find(c => c.id === parseInt(clientId));
                        const orderCount = clientOrders?.length || 0;
                        
                        return clientOrders?.map((order, idx) => (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell className="font-mono font-bold">{order.orderNumber}</TableCell>
                            {idx === 0 ? (
                              <>
                                <TableCell rowSpan={orderCount} className="align-top font-semibold border-r">
                                  {client?.name || 'Unknown'}
                                </TableCell>
                                <TableCell rowSpan={orderCount} className={`align-top font-semibold border-r ${parseFloat(client?.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`} data-testid={`text-client-due-${order.id}`}>
                                  {parseFloat(client?.balance || "0").toFixed(2)} AED
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell className="max-w-xs truncate">{order.items}</TableCell>
                            <TableCell className="font-semibold">{order.totalAmount} AED</TableCell>
                            <TableCell>
                              {order.deliveryType === 'delivery' ? (
                                <Badge variant="outline" className="gap-1">
                                  <Truck className="w-3 h-3" /> Delivery
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Take Away</Badge>
                              )}
                            </TableCell>
                            <TableCell>{getTimeRemaining(order.expectedDeliveryAt)}</TableCell>
                            <TableCell>{getStatusBadge(order)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => setPrintOrder(order)}
                                  data-testid={`button-print-${order.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {!order.washingDone && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleStatusUpdate(order.id, 'washingDone', true)}
                                    data-testid={`button-washing-${order.id}`}
                                  >
                                    Washing Done
                                  </Button>
                                )}
                                {order.washingDone && !order.packingDone && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleStatusUpdate(order.id, 'packingDone', true)}
                                    data-testid={`button-packing-${order.id}`}
                                  >
                                    Packing Done
                                  </Button>
                                )}
                                {order.packingDone && !order.delivered && (
                                  <Button 
                                    size="sm" 
                                    variant="default"
                                    onClick={() => handleStatusUpdate(order.id, 'delivered', true)}
                                    data-testid={`button-deliver-${order.id}`}
                                  >
                                    Deliver
                                  </Button>
                                )}
                                {order.delivered && (
                                  <Badge variant="outline" className="text-green-600">Completed</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      });
                    })()}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {printOrder && (
        <OrderReceipt
          order={printOrder}
          client={clients?.find(c => c.id === printOrder.clientId)}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}

function OrderForm({ clients, onSubmit, isLoading }: { 
  clients: Client[]; 
  onSubmit: (data: any) => void; 
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    clientId: "",
    deliveryType: "takeaway",
    expectedDeliveryAt: "",
    notes: "",
  });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [productSearch, setProductSearch] = useState("");

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

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
      .filter(Boolean) as { product: Product; quantity: number }[];
  }, [quantities, products]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + (parseFloat(item.product.price || "0") * item.quantity);
    }, 0);
  }, [orderItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || orderItems.length === 0) return;
    
    const itemsText = orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    onSubmit({
      ...formData,
      clientId: parseInt(formData.clientId),
      orderNumber,
      items: itemsText,
      totalAmount: orderTotal.toFixed(2),
      entryDate: new Date().toISOString(),
      expectedDeliveryAt: formData.expectedDeliveryAt || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
          <SelectTrigger data-testid="select-client">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name} - {client.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Select Items</Label>
        <Input
          placeholder="Search items..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="mb-2"
          data-testid="input-product-search"
        />
        <ScrollArea className="h-64 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-1/2">Item</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center w-32">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts?.map((product) => (
                <TableRow key={product.id} className={quantities[product.id] ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium text-sm">{product.name}</TableCell>
                  <TableCell className="text-right text-sm text-primary font-semibold">
                    {product.price ? `${parseFloat(product.price).toFixed(0)}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(product.id, -1)}
                        disabled={!quantities[product.id]}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className={`w-6 text-center text-sm font-bold ${quantities[product.id] ? "text-primary" : "text-muted-foreground"}`}>
                        {quantities[product.id] || 0}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(product.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {orderItems.length > 0 && (
        <div className="p-3 bg-primary/5 rounded-lg border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">{orderItems.length} item(s) selected</span>
            <span className="text-lg font-bold text-primary">{orderTotal.toFixed(2)} AED</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Delivery Type</Label>
          <Select value={formData.deliveryType} onValueChange={(v) => setFormData({ ...formData, deliveryType: v })}>
            <SelectTrigger data-testid="select-delivery-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="takeaway">Take Away</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.deliveryType === 'delivery' && (
          <div className="space-y-2">
            <Label>Expected Delivery</Label>
            <Input
              type="datetime-local"
              value={formData.expectedDeliveryAt}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryAt: e.target.value })}
              data-testid="input-delivery-time"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Any special instructions..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          data-testid="input-notes"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || !formData.clientId || orderItems.length === 0} 
        data-testid="button-submit-order"
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Create Order ({orderTotal.toFixed(2)} AED)
      </Button>
    </form>
  );
}
