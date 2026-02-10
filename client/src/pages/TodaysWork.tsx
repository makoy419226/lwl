import { useState, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Order, BillPayment, Bill, Client } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Package, Clock, CheckCircle2, Truck, HandCoins, TrendingUp, AlertCircle, AlertTriangle, Timer } from "lucide-react";
import { format } from "date-fns";
import { UserContext } from "@/App";

type OrderWithClient = Order & { clientName?: string };

const SEGMENTS: Record<string, boolean[]> = {
  "0": [true, true, true, false, true, true, true],
  "1": [false, false, true, false, false, true, false],
  "2": [true, false, true, true, true, false, true],
  "3": [true, false, true, true, false, true, true],
  "4": [false, true, true, true, false, true, false],
  "5": [true, true, false, true, false, true, true],
  "6": [true, true, false, true, true, true, true],
  "7": [true, false, true, false, false, true, false],
  "8": [true, true, true, true, true, true, true],
  "9": [true, true, true, true, false, true, true],
};

function SevenSegmentDigit({ digit, size = 48 }: { digit: string; size?: number }) {
  const segs = SEGMENTS[digit] || SEGMENTS["0"];
  const w = size * 0.6;
  const h = size;
  const t = Math.max(size * 0.14, 4);
  const gap = t * 0.3;
  const onColor = "currentColor";
  const offColor = "currentColor";
  const onOpacity = 1;
  const offOpacity = 0.08;

  const hSeg = (x: number, y: number, on: boolean) => (
    <polygon
      points={`${x + gap},${y} ${x + gap + t / 2},${y - t / 2} ${x + w - gap - t / 2},${y - t / 2} ${x + w - gap},${y} ${x + w - gap - t / 2},${y + t / 2} ${x + gap + t / 2},${y + t / 2}`}
      fill={on ? onColor : offColor}
      opacity={on ? onOpacity : offOpacity}
    />
  );

  const vSeg = (x: number, y: number, on: boolean) => (
    <polygon
      points={`${x},${y + gap} ${x - t / 2},${y + gap + t / 2} ${x - t / 2},${y + h / 2 - gap - t / 2} ${x},${y + h / 2 - gap} ${x + t / 2},${y + h / 2 - gap - t / 2} ${x + t / 2},${y + gap + t / 2}`}
      fill={on ? onColor : offColor}
      opacity={on ? onOpacity : offOpacity}
    />
  );

  return (
    <svg width={w} height={h} viewBox={`${-t} ${-t} ${w + t * 2} ${h + t * 2}`} data-testid={`digit-${digit}`}>
      {hSeg(0, 0, segs[0])}
      {vSeg(0, 0, segs[1])}
      {vSeg(w, 0, segs[2])}
      {hSeg(0, h / 2, segs[3])}
      {vSeg(0, h / 2, segs[4])}
      {vSeg(w, h / 2, segs[5])}
      {hSeg(0, h, segs[6])}
    </svg>
  );
}

function SevenSegmentColon({ size = 48 }: { size?: number }) {
  const h = size;
  const r = Math.max(size * 0.08, 2.5);
  const w = r * 3;
  return (
    <svg width={w} height={h} viewBox={`0 ${-size * 0.1} ${w} ${h + size * 0.2}`} className="animate-pulse">
      <circle cx={w / 2} cy={h * 0.3} r={r} fill="currentColor" />
      <circle cx={w / 2} cy={h * 0.7} r={r} fill="currentColor" />
    </svg>
  );
}

export default function TodaysWork() {
  const user = useContext(UserContext);
  const isSection = user?.role === "section";
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<OrderWithClient[]>([]);
  const [dialogTitle, setDialogTitle] = useState("");
  const [uaeTime, setUaeTime] = useState(() => new Date(Date.now() + 4 * 60 * 60 * 1000));

  useEffect(() => {
    const tick = setInterval(() => {
      setUaeTime(new Date(Date.now() + 4 * 60 * 60 * 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const checkForDayReset = () => {
      const nowEpoch = Date.now();
      const uaeNowMs = nowEpoch + 4 * 60 * 60 * 1000;
      const uaeNowDate = new Date(uaeNowMs);
      const uaeHour = uaeNowDate.getUTCHours();
      const uaeMinute = uaeNowDate.getUTCMinutes();
      if (uaeHour === 23 && uaeMinute >= 59) {
        window.location.reload();
      }
    };
    const interval = setInterval(checkForDayReset, 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: billPayments = [] } = useQuery<BillPayment[]>({
    queryKey: ["/api/bill-payments"],
  });

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const getClientName = (order: Order): string => {
    if (order.customerName) return order.customerName;
    if (order.clientId) {
      const client = clients.find(c => c.id === order.clientId);
      return client?.name || "Unknown";
    }
    return "Walk-in";
  };

  const uaeOffsetHours = 4;
  const getUaeStartOfDay = (date: Date) => {
    const uaeMs = date.getTime() + uaeOffsetHours * 60 * 60 * 1000;
    const uaeDate = new Date(uaeMs);
    return Date.UTC(uaeDate.getUTCFullYear(), uaeDate.getUTCMonth(), uaeDate.getUTCDate()) - uaeOffsetHours * 60 * 60 * 1000;
  };

  const todayStartEpoch = getUaeStartOfDay(new Date());
  const tomorrowStartEpoch = todayStartEpoch + 24 * 60 * 60 * 1000;
  const todaysOrders = orders.filter((order) => {
    const orderTime = new Date(order.entryDate).getTime();
    return orderTime >= todayStartEpoch && orderTime < tomorrowStartEpoch;
  });

  const pendingOrders = todaysOrders.filter(
    (order) => ["pending", "tagging", "packing"].includes(order.status || "")
  );

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

  const expectedToday = orders.filter((order) => {
    if (!order.expectedDeliveryAt) return false;
    const expectedTime = new Date(order.expectedDeliveryAt).getTime();
    return expectedTime >= todayStartEpoch && expectedTime < tomorrowStartEpoch && order.status !== "delivered";
  });

  const overdueOrders = orders.filter((order) => {
    if (!order.expectedDeliveryAt) return false;
    const expectedTime = new Date(order.expectedDeliveryAt).getTime();
    return expectedTime < todayStartEpoch && order.status !== "delivered";
  });

  const totalRevenue = todaysOrders.reduce((sum, order) => {
    return sum + parseFloat(order.totalAmount || "0");
  }, 0);

  const paidAmount = billPayments.filter((payment) => {
    const paymentTime = new Date(payment.paymentDate).getTime();
    return paymentTime >= todayStartEpoch && paymentTime < tomorrowStartEpoch;
  }).reduce((sum, payment) => {
    return sum + parseFloat(payment.amount || "0");
  }, 0);

  const todaysBillIds = Array.from(new Set(todaysOrders.map(o => o.billId).filter((id): id is number => id !== null && id !== undefined)));
  const todaysUnpaidBills = bills.filter((bill) => todaysBillIds.includes(bill.id) && !bill.isPaid);
  const todaysUnpaidAmount = todaysUnpaidBills.reduce((sum, bill) => {
    const billTotal = parseFloat(bill.amount || "0");
    const billPaid = parseFloat(bill.paidAmount || "0");
    return sum + (billTotal - billPaid);
  }, 0);

  const statusCounts = {
    pending: todaysOrders.filter(o => o.status === "pending").length,
    tagging: todaysOrders.filter(o => o.status === "tagging").length,
    packing: todaysOrders.filter(o => o.status === "packing").length,
    delivered: todaysOrders.filter(o => o.status === "delivered").length,
  };

  const totalStatusCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const openCardDialog = (title: string, orderList: Order[]) => {
    setDialogTitle(title);
    setSelectedOrders(orderList.map(o => ({ ...o, clientName: getClientName(o) })));
    setSelectedCard(title);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-blue-500";
      case "tagging": return "bg-amber-500";
      case "packing": return "bg-orange-500";
      case "delivered": return "bg-green-500";
      default: return "bg-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <Card className="p-6 md:p-8" data-testid="card-digital-clock">
        <div className="flex items-center justify-center gap-1 md:gap-3 text-foreground" data-testid="text-live-clock">
          {String(uaeTime.getUTCHours()).padStart(2, "0").split("").map((d, i) => (
            <SevenSegmentDigit key={`h${i}`} digit={d} size={90} />
          ))}
          <SevenSegmentColon size={90} />
          {String(uaeTime.getUTCMinutes()).padStart(2, "0").split("").map((d, i) => (
            <SevenSegmentDigit key={`m${i}`} digit={d} size={90} />
          ))}
          <SevenSegmentColon size={90} />
          {String(uaeTime.getUTCSeconds()).padStart(2, "0").split("").map((d, i) => (
            <SevenSegmentDigit key={`s${i}`} digit={d} size={90} />
          ))}
        </div>
        <p className="text-base md:text-lg font-semibold text-muted-foreground mt-4 text-center" data-testid="text-clock-date">
          {format(new Date(todayStartEpoch + 12 * 60 * 60 * 1000), "EEEE, MMMM d, yyyy")} — UAE Time (GMT+4)
        </p>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground" data-testid="heading-todays-work">Today's Work</h1>
        <Badge variant="outline" className="border-blue-500 text-blue-600" data-testid="badge-live-updates">
          <Clock className="w-3 h-3 mr-1" />
          Live Updates
        </Badge>
      </div>

      {overdueOrders.length > 0 && (
        <Card className="p-4 border-red-500 bg-red-50 dark:bg-red-950/20" data-testid="card-overdue-alert">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div className="flex-1">
              <h3 className="font-bold text-red-700 dark:text-red-400" data-testid="heading-overdue-alert">Overdue Orders Alert</h3>
              <p className="text-sm text-red-600 dark:text-red-300" data-testid="text-overdue-description">
                {overdueOrders.length} order{overdueOrders.length !== 1 ? 's' : ''} past expected pickup/delivery date
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-red-500 text-red-600"
              onClick={() => openCardDialog("Overdue Orders", overdueOrders)}
              data-testid="button-view-overdue"
            >
              View All
            </Button>
          </div>
        </Card>
      )}

      {totalStatusCount > 0 && (
        <Card className="p-4" data-testid="card-progress-bar">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-foreground" data-testid="heading-progress">Order Progress Today</h3>
            <span className="text-sm text-muted-foreground ml-auto" data-testid="text-total-status-count">{totalStatusCount} orders</span>
          </div>
          <div className="flex h-6 rounded-full overflow-hidden bg-muted">
            {Object.entries(statusCounts).map(([status, count]) => {
              if (count === 0) return null;
              const percentage = (count / totalStatusCount) * 100;
              return (
                <div 
                  key={status}
                  className={`${getStatusColor(status)} flex items-center justify-center text-[10px] text-white font-medium`}
                  style={{ width: `${percentage}%` }}
                  title={`${status}: ${count}`}
                  data-testid={`progress-segment-${status}`}
                >
                  {percentage > 8 && count}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3" data-testid="progress-legend">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs" data-testid={`legend-item-${status}`}>
                <div className={`w-3 h-3 rounded ${getStatusColor(status)}`} />
                <span className="capitalize text-muted-foreground">{status}</span>
                <span className="font-medium" data-testid={`legend-count-${status}`}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Pending Orders", pendingOrders)}
          data-testid="card-pending-orders"
        >
          <div className="flex items-center justify-between mb-2">
            <Timer className="w-5 h-5 text-blue-500" />
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-pending-count">
              {pendingOrders.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">IN PROGRESS</h3>
          <p className="text-xs text-muted-foreground">Being processed</p>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Ready for Pickup", readyForPickup)}
          data-testid="card-ready-pickup"
        >
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-amber-500" />
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" data-testid="badge-pickup-count">
              {readyForPickup.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">READY PICKUP</h3>
          <p className="text-xs text-muted-foreground">Awaiting customer</p>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Ready for Delivery", readyForDelivery)}
          data-testid="card-ready-delivery"
        >
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-5 h-5 text-orange-500" />
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" data-testid="badge-delivery-count">
              {readyForDelivery.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">READY DELIVERY</h3>
          <p className="text-xs text-muted-foreground">To be delivered</p>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Expected Today", expectedToday)}
          data-testid="card-expected-today"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-purple-500" />
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" data-testid="badge-expected-count">
              {expectedToday.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">EXPECTED TODAY</h3>
          <p className="text-xs text-muted-foreground">Scheduled pickup/delivery</p>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Picked Up Today", pickedUpToday)}
          data-testid="card-picked-up-today"
        >
          <div className="flex items-center justify-between mb-2">
            <HandCoins className="w-5 h-5 text-teal-500" />
            <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" data-testid="badge-pickedup-count">
              {pickedUpToday.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">PICKED UP</h3>
          <p className="text-xs text-muted-foreground">Collected today</p>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover-elevate" 
          onClick={() => openCardDialog("Delivered Today", deliveredToday)}
          data-testid="card-delivered-today"
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-delivered-count">
              {deliveredToday.length}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-foreground">DELIVERED</h3>
          <p className="text-xs text-muted-foreground">Completed today</p>
        </Card>

        {!isSection && (
          <Card 
            className="p-4" 
            data-testid="card-unpaid-bills"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" data-testid="text-unpaid-amount">
                {todaysUnpaidAmount.toFixed(0)} AED
              </Badge>
            </div>
            <h3 className="font-semibold text-sm text-foreground">UNPAID BILLS</h3>
            <p className="text-xs text-muted-foreground" data-testid="text-unpaid-count">{todaysUnpaidBills.length} bills pending</p>
          </Card>
        )}

        {!isSection && (
          <Card 
            className="p-4 cursor-pointer hover-elevate" 
            onClick={() => openCardDialog("Today's Orders", todaysOrders)}
            data-testid="card-total-sales"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-sales-amount">
                {totalRevenue.toFixed(0)} AED
              </Badge>
            </div>
            <h3 className="font-semibold text-sm text-foreground">TOTAL SALES</h3>
            <p className="text-xs text-muted-foreground">{todaysOrders.length} orders today</p>
          </Card>
        )}
      </div>

      <div className={`grid grid-cols-1 ${isSection ? '' : 'lg:grid-cols-2'} gap-4`}>
        {!isSection && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h2 className="font-bold text-foreground">Today's Summary</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Orders Billed Today</span>
                <span className="font-bold text-lg" data-testid="text-orders-billed">{totalRevenue.toFixed(0)} AED</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Payments Received Today</span>
                <span className="font-bold text-lg text-green-600" data-testid="text-payments-received">{paidAmount.toFixed(0)} AED</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground text-sm">Today's Outstanding</span>
                <span className="font-bold text-lg text-red-600" data-testid="text-total-outstanding">{todaysUnpaidAmount.toFixed(0)} AED</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground text-sm">Orders Count</span>
                <span className="font-bold text-lg" data-testid="text-orders-count">{todaysOrders.length}</span>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-foreground">Recent Orders</h2>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {todaysOrders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4" data-testid="text-no-orders">No orders yet today</p>
            ) : (
              todaysOrders.slice(0, 8).map((order, index) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-2" data-testid={`row-recent-order-${order.id}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs shrink-0 ${
                        order.status === "delivered" ? "border-green-500 text-green-600" :
                        order.status === "ready" ? "border-amber-500 text-amber-600" :
                        "border-blue-500 text-blue-600"
                      }`}
                      data-testid={`badge-status-${order.id}`}
                    >
                      {order.status}
                    </Badge>
                    <span className="text-sm font-medium shrink-0" data-testid={`text-order-number-${order.id}`}>
                      #{order.orderNumber}
                    </span>
                    <span className="text-xs text-muted-foreground truncate" data-testid={`text-client-name-${order.id}`}>
                      {getClientName(order)}
                    </span>
                  </div>
                  {!isSection && <span className="text-sm font-bold shrink-0" data-testid={`text-order-amount-${order.id}`}>{parseFloat(order.totalAmount || "0").toFixed(0)} AED</span>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Dialog open={selectedCard !== null} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between" data-testid="dialog-title-orders">
              <span>{dialogTitle}</span>
              <Badge variant="outline" data-testid="badge-order-count">{selectedOrders.length} orders</Badge>
            </DialogTitle>
            <DialogDescription>View and manage orders in this category</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8" data-testid="text-no-category-orders">No orders in this category</p>
            ) : (
              selectedOrders.map((order) => (
                <Card key={order.id} className="p-3" data-testid={`card-dialog-order-${order.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold" data-testid={`text-dialog-order-number-${order.id}`}>#{order.orderNumber}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            order.status === "delivered" ? "border-green-500 text-green-600" :
                            order.status === "ready" ? "border-amber-500 text-amber-600" :
                            "border-blue-500 text-blue-600"
                          }`}
                          data-testid={`badge-dialog-status-${order.id}`}
                        >
                          {order.status}
                        </Badge>
                        {(order.urgent || (order.items && order.items.includes('[URG]'))) && <Badge className="bg-orange-500 text-white text-xs" data-testid={`badge-urgent-${order.id}`}>Urgent</Badge>}
                      </div>
                      <p className="text-sm font-medium" data-testid={`text-dialog-client-${order.id}`}>{order.clientName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span data-testid={`text-delivery-type-${order.id}`}>{order.deliveryType === "pickup" ? "Pickup" : "Delivery"}</span>
                        {order.expectedDeliveryAt && (
                          <span className="text-blue-600 dark:text-blue-400" data-testid={`text-expected-date-${order.id}`}>
                            Expected: {format(new Date(order.expectedDeliveryAt), "dd MMM, h:mm a")}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isSection && (
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg" data-testid={`text-dialog-amount-${order.id}`}>{parseFloat(order.totalAmount || "0").toFixed(0)} AED</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
