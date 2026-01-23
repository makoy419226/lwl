import { useQuery } from "@tanstack/react-query";
import type { Order } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shirt, Package, CalendarCheck, Clock, CheckCircle2, TrendingUp } from "lucide-react";
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

  const pendingWashing = todaysOrders.filter(
    (order) => order.status === "entry" || order.status === "washing" || order.status === "tagging"
  );

  const readyForDelivery = todaysOrders.filter(
    (order) => order.status === "ready" || order.status === "packing"
  );

  const delivered = todaysOrders.filter(
    (order) => order.status === "delivered"
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" data-testid="card-washing-count">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Shirt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Washing</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-washing-count">{pendingWashing.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="card-ready-count">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Ready</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300" data-testid="text-ready-count">{readyForDelivery.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" data-testid="card-delivered-count">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Delivered</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300" data-testid="text-delivered-count">{delivered.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800" data-testid="card-total-count">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300" data-testid="text-total-count">{todaysOrders.length}</p>
            </div>
          </div>
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
              <span className="text-muted-foreground text-sm">Outstanding</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shirt className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-sm text-muted-foreground uppercase">In Washing</h3>
            <Badge variant="secondary" className="ml-auto">{pendingWashing.length}</Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {pendingWashing.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-2">No items in washing</p>
            ) : (
              pendingWashing.map((order) => (
                <div key={order.id} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">#{order.orderNumber}</span>
                    <span className="text-muted-foreground">{parseFloat(order.totalAmount || "0").toFixed(0)} AED</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-muted-foreground uppercase">Ready for Pickup</h3>
            <Badge variant="secondary" className="ml-auto">{readyForDelivery.length}</Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {readyForDelivery.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-2">No items ready</p>
            ) : (
              readyForDelivery.map((order) => (
                <div key={order.id} className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">#{order.orderNumber}</span>
                    <span className="text-muted-foreground">{parseFloat(order.totalAmount || "0").toFixed(0)} AED</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h3 className="font-bold text-sm text-muted-foreground uppercase">Delivered Today</h3>
            <Badge variant="secondary" className="ml-auto">{delivered.length}</Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {delivered.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-2">No deliveries yet</p>
            ) : (
              delivered.map((order) => (
                <div key={order.id} className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">#{order.orderNumber}</span>
                    <span className="text-muted-foreground">{parseFloat(order.totalAmount || "0").toFixed(0)} AED</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
