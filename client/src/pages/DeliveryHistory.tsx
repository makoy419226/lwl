import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  History,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  User,
  Package,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { UserContext } from "@/App";
import type { Order, Client } from "@shared/schema";

export default function DeliveryHistory() {
  const user = useContext(UserContext);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const getClient = (order: Order) => {
    return clients?.find((c) => c.id === order.clientId);
  };

  const deliveredOrders = orders?.filter((order) => {
    if (!order.delivered) return false;
    if (user?.role === "admin" || user?.role === "driver") return true;
    return order.deliveredByWorkerId === user?.id;
  }).sort((a, b) => {
    const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
    const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
    return dateB - dateA;
  }) || [];

  const filteredOrders = deliveredOrders.filter((order) => {
    const client = getClient(order);
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      client?.name?.toLowerCase().includes(searchLower) ||
      client?.phone?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
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
            <History className="w-7 h-7 text-primary" />
            Delivery History
          </h1>
          <p className="text-muted-foreground text-sm">
            {(user?.role === "admin" || user?.role === "driver") ? "All delivery history" : "Your delivery history"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search deliveries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-history"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="p-4 text-center w-fit">
        <div className="text-3xl font-bold text-blue-600">{filteredOrders.length}</div>
        <div className="text-sm text-muted-foreground">Total Deliveries</div>
      </Card>

      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          <div className="grid gap-3">
            {filteredOrders.map((order) => {
              const client = getClient(order);
              return (
                <Card key={order.id} className="p-4" data-testid={`card-history-${order.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg">#{order.orderNumber}</span>
                        <Badge className="bg-blue-500 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Delivered
                        </Badge>
                        {order.items?.includes('[URG]') && <Badge className="bg-red-600 text-white">Urgent</Badge>}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{order.customerName || client?.name || "Unknown"}</span>
                        </div>
                        {client?.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{client.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {order.finalAmount || order.totalAmount} AED
                          </span>
                        </div>
                        {order.deliveryDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-green-600">
                              {format(new Date(order.deliveryDate), "dd MMM yyyy, h:mm a")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No delivery history found</p>
        </Card>
      )}
    </div>
  );
}
