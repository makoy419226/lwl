import { useQuery } from "@tanstack/react-query";
import type { Order } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Clock, CheckCircle2, Truck, HandCoins, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function TodaysWork() {
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysOrders = orders.filter((order) => {
    const orderDate = new Date(order.entryDate);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  });

  const readyForPickup = todaysOrders.filter(
    (order) => (order.status === "ready" || order.status === "packing") && order.deliveryType === "pickup"
  );

  const readyForDelivery = todaysOrders.filter(
    (order) => (order.status === "ready" || order.status === "packing") && order.deliveryType === "delivery"
  );

  const pickedUpToday = todaysOrders.filter(
    (order) => order.status === "delivered" && order.deliveryType === "pickup"
  );

  const deliveredToday = todaysOrders.filter(
    (order) => order.status === "delivered" && order.deliveryType === "delivery"
  );

  const totalRevenue = todaysOrders.reduce((sum, order) => {
    return sum + parseFloat(order.totalAmount || "0");
  }, 0);

  const paidAmount = todaysOrders.reduce((sum, order) => {
    return sum + parseFloat(order.paidAmount || "0");
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Today's Work</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          <Clock className="w-3 h-3 mr-1" />
          Live Updates
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-6" data-testid="card-ready-pickup">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-foreground">READY FOR PICKUP</h3>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary" data-testid="text-ready-pickup-count">
              {readyForPickup.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {readyForPickup.length === 0 ? "No items ready" : `${readyForPickup.length} order${readyForPickup.length !== 1 ? 's' : ''} ready`}
          </p>
        </Card>

        <Card className="p-6" data-testid="card-ready-delivery">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-foreground">READY FOR DELIVERY</h3>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary" data-testid="text-ready-delivery-count">
              {readyForDelivery.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {readyForDelivery.length === 0 ? "No items ready" : `${readyForDelivery.length} order${readyForDelivery.length !== 1 ? 's' : ''} ready`}
          </p>
        </Card>

        <Card className="p-6" data-testid="card-delivered-today">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-foreground">DELIVERED TODAY</h3>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary" data-testid="text-delivered-count">
              {deliveredToday.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {deliveredToday.length === 0 ? "No deliveries yet" : `${deliveredToday.length} order${deliveredToday.length !== 1 ? 's' : ''} delivered`}
          </p>
        </Card>

        <Card className="p-6" data-testid="card-picked-up-today">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-teal-500" />
              <h3 className="font-semibold text-foreground">PICKED UP TODAY</h3>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary" data-testid="text-pickedup-count">
              {pickedUpToday.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {pickedUpToday.length === 0 ? "No pickups yet" : `${pickedUpToday.length} order${pickedUpToday.length !== 1 ? 's' : ''} picked up`}
          </p>
        </Card>

        <Card className="p-6" data-testid="card-total-sales">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">TOTAL SALES TODAY</h3>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="text-total-sales">
              {totalRevenue.toFixed(0)} AED
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {todaysOrders.length === 0 ? "No orders yet" : `${todaysOrders.length} order${todaysOrders.length !== 1 ? 's' : ''} today`}
          </p>
        </Card>

        <Card className="p-6" data-testid="card-unpaid-bills">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-foreground">UNPAID BILLS TODAY</h3>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" data-testid="text-unpaid-bills">
              {(totalRevenue - paidAmount).toFixed(0)} AED
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            {todaysOrders.filter(o => parseFloat(o.totalAmount || "0") > parseFloat(o.paidAmount || "0")).length === 0 
              ? "All bills paid" 
              : `${todaysOrders.filter(o => parseFloat(o.totalAmount || "0") > parseFloat(o.paidAmount || "0")).length} unpaid bill${todaysOrders.filter(o => parseFloat(o.totalAmount || "0") > parseFloat(o.paidAmount || "0")).length !== 1 ? 's' : ''}`}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Today's Revenue</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Total Billed</span>
              <span className="font-bold text-lg">{totalRevenue.toFixed(0)} AED</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Amount Received</span>
              <span className="font-bold text-lg text-green-600">{paidAmount.toFixed(0)} AED</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-muted-foreground text-sm">Unpaid</span>
              <span className="font-bold text-lg text-amber-600">{(totalRevenue - paidAmount).toFixed(0)} AED</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Recent Orders</h2>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {todaysOrders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No orders yet today</p>
            ) : (
              todaysOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        order.status === "delivered" ? "border-green-500 text-green-600" :
                        order.status === "ready" ? "border-amber-500 text-amber-600" :
                        "border-blue-500 text-blue-600"
                      }`}
                    >
                      {order.status}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      #{order.orderNumber}
                    </span>
                  </div>
                  <span className="text-sm font-bold">{parseFloat(order.totalAmount || "0").toFixed(0)} AED</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
