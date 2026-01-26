import { useState, useContext, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Truck,
  MapPin,
  Phone,
  Clock,
  Package,
  CheckCircle,
  Eye,
  Search,
  RefreshCw,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserContext } from "@/App";
import type { Order, Client } from "@shared/schema";

export default function DeliveryDashboard() {
  const { toast } = useToast();
  const user = useContext(UserContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pinDialogOrder, setPinDialogOrder] = useState<Order | null>(null);
  const [deliveryPin, setDeliveryPin] = useState("");
  const [itemCountConfirmed, setItemCountConfirmed] = useState(false);
  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: orders, isLoading: ordersLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deliverMutation = useMutation({
    mutationFn: async ({ orderId, pin }: { orderId: number; pin: string }) => {
      return apiRequest("POST", `/api/orders/${orderId}/deliver-by-driver`, { pin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order marked as delivered" });
      setPinDialogOrder(null);
      setDeliveryPin("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getClient = (order: Order) => {
    return clients?.find((c) => c.id === order.clientId);
  };

  const readyForDeliveryOrders = orders?.filter((order) => {
    // Show orders that are packed but not yet delivered
    if (!order.packingDone) return false;
    if (order.delivered) return false;
    return true;
  }) || [];

  const filteredOrders = readyForDeliveryOrders.filter((order) => {
    const client = getClient(order);
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      client?.phone?.toLowerCase().includes(searchLower)
    );
  });

  const pickupOrders = filteredOrders.filter((o) => o.deliveryType === "pickup");
  const deliveryOrders = filteredOrders.filter((o) => o.deliveryType === "delivery");

  const handleDeliveryConfirm = (order: Order) => {
    setPinDialogOrder(order);
  };

  const handlePinSubmit = () => {
    if (!pinDialogOrder || !deliveryPin) return;
    deliverMutation.mutate({ orderId: pinDialogOrder.id, pin: deliveryPin });
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            Delivery Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Orders ready for pickup/delivery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-delivery"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{pickupOrders.length}</div>
          <div className="text-sm text-muted-foreground">Ready for Pickup</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{deliveryOrders.length}</div>
          <div className="text-sm text-muted-foreground">Ready for Delivery</div>
        </Card>
      </div>

      {deliveryOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-600" />
            Delivery Orders ({deliveryOrders.length})
          </h2>
          <div className="grid gap-3">
            {deliveryOrders.map((order) => {
              const client = getClient(order);
              return (
                <Card key={order.id} className="p-4" data-testid={`card-delivery-${order.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg">#{order.orderNumber}</span>
                        <Badge className="bg-green-500 text-white">Delivery</Badge>
                        {order.urgent && <Badge className="bg-red-500 text-white">Urgent</Badge>}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        {client?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                              {client.phone}
                            </a>
                          </div>
                        )}
                        {(order.deliveryAddress || client?.address) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{order.deliveryAddress || client?.address}</span>
                          </div>
                        )}
                        {order.expectedDeliveryAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-blue-600">
                              Expected: {format(new Date(order.expectedDeliveryAt), "dd MMM, h:mm a")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                        data-testid={`button-view-${order.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleDeliveryConfirm(order)}
                        data-testid={`button-deliver-${order.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Deliver
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {pickupOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Pickup Orders ({pickupOrders.length}) - View Only
          </h2>
          <div className="grid gap-3">
            {pickupOrders.map((order) => {
              const client = getClient(order);
              return (
                <Card key={order.id} className="p-4 bg-muted/30" data-testid={`card-pickup-${order.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg">#{order.orderNumber}</span>
                        <Badge variant="outline" className="border-blue-500 text-blue-600">Pickup</Badge>
                        {order.urgent && <Badge className="bg-red-500 text-white">Urgent</Badge>}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        {client?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{client.phone}</span>
                          </div>
                        )}
                        {order.expectedDeliveryAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-blue-600">
                              Expected: {format(new Date(order.expectedDeliveryAt), "dd MMM, h:mm a")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      data-testid={`button-view-pickup-${order.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {filteredOrders.length === 0 && (
        <Card className="p-8 text-center">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No orders ready for delivery/pickup</p>
        </Card>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View order information</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xl">#{selectedOrder.orderNumber}</span>
                <Badge className={selectedOrder.deliveryType === "delivery" ? "bg-green-500" : "bg-blue-500"}>
                  {selectedOrder.deliveryType === "delivery" ? "Delivery" : "Pickup"}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{selectedOrder.customerName}</span>
                </div>
                {getClient(selectedOrder)?.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <a href={`tel:${getClient(selectedOrder)?.phone}`} className="text-blue-600">
                      {getClient(selectedOrder)?.phone}
                    </a>
                  </div>
                )}
                {getClient(selectedOrder)?.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-right max-w-[60%]">{getClient(selectedOrder)?.address}</span>
                  </div>
                )}
                {selectedOrder.expectedDeliveryAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected:</span>
                    <span>{format(new Date(selectedOrder.expectedDeliveryAt), "dd MMM yyyy, h:mm a")}</span>
                  </div>
                )}
                {selectedOrder.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
              {selectedOrder.deliveryType === "delivery" && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setSelectedOrder(null);
                    handleDeliveryConfirm(selectedOrder);
                  }}
                  data-testid="button-confirm-deliver"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Delivery
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pinDialogOrder} onOpenChange={() => { 
        setPinDialogOrder(null); 
        setDeliveryPin(""); 
        setItemCountConfirmed(false);
        setDeliveryPhoto(null);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Confirm Delivery
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">This action cannot be undone</p>
                <p className="text-amber-700 dark:text-amber-300">Order status and delivery type cannot be changed after confirmation.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4" />
                Delivery Photo (Optional)
              </Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setDeliveryPhoto(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {deliveryPhoto ? (
                <div className="relative">
                  <img src={deliveryPhoto} alt="Delivery" className="w-full h-32 object-cover rounded-lg" />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => setDeliveryPhoto(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Tap to open camera
                </Button>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Item Count at Intake</span>
                <Badge variant="outline" className="text-lg px-3">
                  {pinDialogOrder?.items ? JSON.parse(pinDialogOrder.items).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) : 0} items
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirm-items"
                  checked={itemCountConfirmed}
                  onCheckedChange={(checked) => setItemCountConfirmed(checked as boolean)}
                  data-testid="checkbox-confirm-items"
                />
                <label htmlFor="confirm-items" className="text-sm cursor-pointer">
                  I confirm all items are present and match intake
                </label>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </Label>
              <Textarea
                value={pinDialogOrder?.deliveryAddress || getClient(pinDialogOrder!)?.address || "n/a"}
                readOnly
                className="resize-none bg-muted"
                rows={2}
              />
            </div>

            <div>
              <Label className="mb-2 block">Enter Driver PIN</Label>
              <Input
                type="password"
                placeholder="Enter 5-digit PIN"
                value={deliveryPin}
                onChange={(e) => setDeliveryPin(e.target.value)}
                maxLength={5}
                className="text-center text-lg tracking-widest"
                data-testid="input-driver-pin"
              />
              <p className="text-xs text-amber-600 mt-1">Please verify item count before confirming delivery</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPinDialogOrder(null);
                  setDeliveryPin("");
                  setItemCountConfirmed(false);
                  setDeliveryPhoto(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={handlePinSubmit}
                disabled={deliverMutation.isPending || !deliveryPin || !itemCountConfirmed}
                data-testid="button-submit-delivery"
              >
                {deliverMutation.isPending ? "Confirming..." : "Confirm Delivery"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
