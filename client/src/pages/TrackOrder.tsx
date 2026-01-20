import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock, Package, Truck, Shirt, Search, ArrowLeft, AlertCircle, FlaskConical } from "lucide-react";
import logoImage from "@assets/image_1767220512226.png";

interface TrackOrderData {
  orderNumber: string;
  items: string;
  status: string;
  entryDate: string;
  deliveryType: string | null;
  tagDone: boolean;
  washingDone: boolean;
  packingDone: boolean;
  delivered: boolean;
  urgent: boolean;
  expectedDeliveryAt: string | null;
}

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [searchedOrder, setSearchedOrder] = useState("");

  const { data: order, isLoading, error, isFetching } = useQuery<TrackOrderData>({
    queryKey: ["/api/orders/track", searchedOrder],
    queryFn: async () => {
      if (!searchedOrder) throw new Error("No order number");
      const res = await fetch(`/api/orders/track/${searchedOrder}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Order not found");
      }
      return res.json();
    },
    enabled: !!searchedOrder,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumber.trim()) {
      setSearchedOrder(orderNumber.trim().toUpperCase());
    }
  };

  const handleReset = () => {
    setOrderNumber("");
    setSearchedOrder("");
  };

  const getStatusStep = () => {
    if (!order) return 0;
    if (order.delivered) return 5;
    if (order.packingDone) return 4;
    if (order.washingDone) return 3;
    if (order.tagDone) return 2;
    return 1;
  };

  const statusStep = getStatusStep();

  const getStatusLabel = () => {
    if (!order) return "";
    if (order.delivered) return "Delivered";
    if (order.packingDone) return "Ready for Pickup/Delivery";
    if (order.washingDone) return "Washing Complete";
    if (order.tagDone) return "Tagged & Processing";
    return "Order Received";
  };

  const formatItems = (items: string) => {
    if (!items) return [];
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) {
        return parsed.map((item: { name: string; quantity: number }) => 
          `${item.quantity}x ${item.name}`
        );
      }
    } catch {}
    return items.split(",").map(item => item.trim()).filter(Boolean);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center py-6">
          <img src={logoImage} alt="Liquid Washes" className="h-20 mx-auto mb-3" data-testid="img-track-logo" />
          <h1 className="text-2xl font-bold text-blue-800 dark:text-blue-300">Liquid Washes Laundry</h1>
          <p className="text-muted-foreground mt-1">Track Your Order Status</p>
          <Badge variant="outline" className="mt-2 gap-1">
            <FlaskConical className="h-3 w-3" />
            Experimental Feature
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Order Lookup
            </CardTitle>
            <CardDescription>
              Enter your order number to check the current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="e.g. ORD-001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="flex-1"
                data-testid="input-order-number"
              />
              <Button type="submit" disabled={!orderNumber.trim() || isFetching} data-testid="button-search-order">
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && searchedOrder && !isLoading && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
              <p className="text-lg font-medium text-destructive">Order Not Found</p>
              <p className="text-sm text-muted-foreground mt-1">
                No order found with number "{searchedOrder}". Please check and try again.
              </p>
              <Button variant="outline" className="mt-4" onClick={handleReset} data-testid="button-try-again">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {order && !isLoading && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle>
                  <div className="flex gap-1 flex-wrap">
                    {order.urgent && <Badge variant="destructive">Urgent</Badge>}
                    <Badge variant={order.deliveryType === "Delivery" ? "default" : "secondary"}>
                      {order.deliveryType || "Take Away"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className="text-lg font-semibold text-primary">{getStatusLabel()}</p>
                </div>

                <div className="flex justify-between items-center py-4">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      <Shirt className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 text-center">Received</span>
                  </div>
                  <div className={`flex-1 h-1 ${statusStep >= 2 ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 text-center">Tagged</span>
                  </div>
                  <div className={`flex-1 h-1 ${statusStep >= 3 ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStep >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      <Clock className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 text-center">Washing</span>
                  </div>
                  <div className={`flex-1 h-1 ${statusStep >= 4 ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStep >= 4 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      <Package className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 text-center">Ready</span>
                  </div>
                  <div className={`flex-1 h-1 ${statusStep >= 5 ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStep >= 5 ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {statusStep >= 5 ? <CheckCircle className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                    </div>
                    <span className="text-xs mt-1 text-center">{order.deliveryType === "Delivery" ? "Delivered" : "Picked Up"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Items</p>
                  <div className="mt-1 space-y-1">
                    {formatItems(order.items).map((item, i) => (
                      <p key={i} className="text-sm font-medium">{item}</p>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Date</p>
                    <p className="text-sm font-medium">
                      {order.entryDate ? new Date(order.entryDate).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  {order.expectedDeliveryAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expected</p>
                      <p className="text-sm font-medium">
                        {new Date(order.expectedDeliveryAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full" onClick={handleReset} data-testid="button-search-another">
              <Search className="h-4 w-4 mr-2" />
              Search Another Order
            </Button>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground pb-4">
          <p>Questions? Contact us at</p>
          <p className="font-medium">+971 50 123 4567</p>
        </div>
      </div>
    </div>
  );
}
