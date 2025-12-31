import { useState, useEffect } from "react";
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
import { 
  Loader2, Package, Shirt, CheckCircle2, Truck, Clock, 
  AlertTriangle, Plus, Search, Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Order, Client } from "@shared/schema";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
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
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders?.map((order) => {
                      const client = clients?.find(c => c.id === order.clientId);
                      return (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-mono font-bold">{order.orderNumber}</TableCell>
                          <TableCell>{client?.name || 'Unknown'}</TableCell>
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
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
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
    items: "",
    totalAmount: "",
    deliveryType: "takeaway",
    expectedDeliveryAt: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    onSubmit({
      ...formData,
      clientId: parseInt(formData.clientId),
      orderNumber,
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
        <Label>Items</Label>
        <Textarea
          placeholder="Enter items (e.g., 2x Kandoora, 3x Shirts)"
          value={formData.items}
          onChange={(e) => setFormData({ ...formData, items: e.target.value })}
          data-testid="input-items"
        />
      </div>

      <div className="space-y-2">
        <Label>Total Amount (AED)</Label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.totalAmount}
          onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
          data-testid="input-amount"
        />
      </div>

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
          <Label>Expected Delivery Time</Label>
          <Input
            type="datetime-local"
            value={formData.expectedDeliveryAt}
            onChange={(e) => setFormData({ ...formData, expectedDeliveryAt: e.target.value })}
            data-testid="input-delivery-time"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Any special instructions..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          data-testid="input-notes"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-order">
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Create Order
      </Button>
    </form>
  );
}
