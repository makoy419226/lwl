import { useState, useMemo } from "react";
import { useClients } from "@/hooks/use-clients";
import { useBills } from "@/hooks/use-bills";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Loader2,
  Users,
  Phone,
  AlertCircle,
  Search,
  ArrowUpDown,
  CircleDollarSign,
  FileText,
  Package,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Order } from "@shared/schema";

export default function DueCustomers() {
  const { toast } = useToast();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: bills, isLoading: billsLoading } = useBills();
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const isLoading = clientsLoading || billsLoading || ordersLoading;

  // 1. Fix: Only count bills that actually have a remaining balance > 0
  const pendingBillsByClient = useMemo(() => {
    const map: Record<number, { count: number; amount: number }> = {};
    (bills || []).forEach((bill) => {
      // Calculate financial balance first
      const billAmount = parseFloat(bill.amount || "0");
      const paidAmount = parseFloat(bill.paidAmount || "0");
      const billBalance = billAmount - paidAmount;

      // Only add if they owe money (allow for small float variance with 0.01)
      if (billBalance > 0.01 && bill.clientId) {
        if (!map[bill.clientId]) {
          map[bill.clientId] = { count: 0, amount: 0 };
        }
        map[bill.clientId].count += 1;
        map[bill.clientId].amount += billBalance;
      }
    });
    return map;
  }, [bills]);

  // 2. Fix: Only count orders that have a remaining balance > 0
  // We REMOVED the check for (!order.delivered) because delivery status doesn't equal payment status
  const pendingOrdersByClient = useMemo(() => {
    const map: Record<number, { count: number; amount: number }> = {};
    (orders || []).forEach((order) => {
      // Calculate financial balance first
      const orderTotal = parseFloat(order.totalAmount || "0");
      const paidAmount = parseFloat(order.paidAmount || "0");
      const orderBalance = orderTotal - paidAmount;

      console.log({
        orderTotal,
        paidAmount,
        orderBalance,
        clientId: order.clientId,
      });
      // Only add if they actually owe money on this order
      if (orderBalance > 0 && order.clientId) {
        if (!map[order.clientId]) {
          map[order.clientId] = { count: 0, amount: 0 };
        }
        map[order.clientId].count += 1;
        map[order.clientId].amount += orderBalance;
      }
    });
    return map;
  }, [orders]);

  // 3. Fix: Filter the customers list efficiently
  const dueCustomers = (clients || [])
    .filter((client) => {
      const clientBalance = parseFloat(client.balance || "0");
      const pendingBillAmount = pendingBillsByClient[client.id]?.amount || 0;
      const pendingOrderAmount = pendingOrdersByClient[client.id]?.amount || 0;

      const totalDue = clientBalance + pendingBillAmount + pendingOrderAmount;

      // Only return clients who owe more than 0
      return totalDue > 0.01;
    })
    .filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      const totalA =
        parseFloat(a.balance || "0") +
        (pendingBillsByClient[a.id]?.amount || 0) +
        (pendingOrdersByClient[a.id]?.amount || 0);
      const totalB =
        parseFloat(b.balance || "0") +
        (pendingBillsByClient[b.id]?.amount || 0) +
        (pendingOrdersByClient[b.id]?.amount || 0);
      return sortOrder === "desc" ? totalB - totalA : totalA - totalB;
    });

  // Calculate total due from all unpaid bills directly
  const totalDue = useMemo(() => {
    return (bills || []).reduce((sum, bill) => {
      const billAmount = parseFloat(bill.amount || "0");
      const paidAmount = parseFloat(bill.paidAmount || "0");
      const balance = billAmount - paidAmount;
      return balance > 0.01 ? sum + balance : sum;
    }, 0);
  }, [bills]);

  const totalPendingBills = Object.values(pendingBillsByClient).reduce(
    (sum, data) => sum + data.count,
    0,
  );
  const totalPendingOrders = Object.values(pendingOrdersByClient).reduce(
    (sum, data) => sum + data.count,
    0,
  );

  const sendWhatsAppReminder = (client: Client) => {
    const clientBalance = parseFloat(client.balance || "0");
    const pendingBillAmount = pendingBillsByClient[client.id]?.amount || 0;
    const pendingOrderAmount = pendingOrdersByClient[client.id]?.amount || 0;
    const totalClientDue =
      clientBalance + pendingBillAmount + pendingOrderAmount;
    const message = `Dear ${client.name},%0A%0AThis is a friendly reminder that you have an outstanding balance of AED ${totalClientDue.toFixed(2)} at Liquid Washes Laundry.%0A%0APlease visit us at your earliest convenience to settle your account.%0A%0AThank you!%0A%0ALiquid Washes Laundry%0ACentra Market D/109, Al Dhanna City%0AAl Ruwais, Abu Dhabi-UAE`;
    window.open(
      `https://wa.me/${client.phone?.replace(/[^0-9]/g, "")}?text=${message}`,
      "_blank",
    );
  };

  const payBillMutation = useMutation({
    mutationFn: async (data: {
      clientId: number;
      amount: string;
      paymentMethod: string;
      notes?: string;
    }) => {
      // Find the oldest unpaid bill for this client
      const clientUnpaidBills =
        bills?.filter((b) => !b.isPaid && b.clientId === data.clientId) || [];
      if (clientUnpaidBills.length === 0) {
        throw new Error("No unpaid bills found for this client");
      }

      const response = await apiRequest(
        "POST",
        `/api/bills/${clientUnpaidBills[0].id}/pay`,
        {
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowPaymentDialog(false);
      setSelectedClient(null);
      toast({
        title: "Payment Successful",
        description: "Payment has been processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment.",
        variant: "destructive",
      });
    },
  });

  const handlePayNow = (client: Client) => {
    const clientBalance = parseFloat(client.balance || "0");
    const pendingBillAmount = pendingBillsByClient[client.id]?.amount || 0;
    const pendingOrderAmount = pendingOrdersByClient[client.id]?.amount || 0;
    const totalClientDue =
      clientBalance + pendingBillAmount + pendingOrderAmount;

    setSelectedClient(client);
    setPaymentAmount(totalClientDue.toFixed(2));
    setPaymentNotes(`Payment for ${client.name}'s outstanding balance`);
    setPaymentMethod("cash");
    setShowPaymentDialog(true);
  };

  const handleProcessPayment = () => {
    if (!selectedClient || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    payBillMutation.mutate({
      clientId: selectedClient.id,
      amount: paymentAmount,
      paymentMethod,
      notes: paymentNotes,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center gap-4">
          <CircleDollarSign className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Due Customers
            </h1>
            <p className="text-sm text-muted-foreground">
              Customers with outstanding balance
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Due Amount
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-destructive"
                data-testid="text-total-due"
              >
                AED {totalDue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Due Customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-due-count">
                {dueCustomers.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Bills
              </CardTitle>
              <FileText className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-amber-600"
                data-testid="text-pending-bills"
              >
                {totalPendingBills}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Orders
              </CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-blue-600"
                data-testid="text-pending-orders"
              >
                {totalPendingOrders}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unpaid Bills Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Unpaid Bills
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-bills"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                  }
                  data-testid="button-sort"
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  {sortOrder === "desc" ? "Highest First" : "Lowest First"}
                </Button>
                <Link href="/bills">
                  <Button variant="default" data-testid="button-go-to-bills">
                    <FileText className="w-4 h-4 mr-2" />
                    Go to Bills for Payment
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const unpaidBills = (bills || [])
                .filter((bill) => {
                  const billAmount = parseFloat(bill.amount || "0");
                  const paidAmount = parseFloat(bill.paidAmount || "0");
                  return (billAmount - paidAmount) > 0.01;
                })
                .filter((bill) => {
                  if (!searchTerm) return true;
                  const client = clients?.find(c => c.id === bill.clientId);
                  const clientName = client?.name?.toLowerCase() || "";
                  const clientPhone = client?.phone?.toLowerCase() || "";
                  const billRef = bill.referenceNumber?.toLowerCase() || "";
                  const search = searchTerm.toLowerCase();
                  return clientName.includes(search) || clientPhone.includes(search) || billRef.includes(search);
                })
                .sort((a, b) => {
                  const balanceA = parseFloat(a.amount || "0") - parseFloat(a.paidAmount || "0");
                  const balanceB = parseFloat(b.amount || "0") - parseFloat(b.paidAmount || "0");
                  return sortOrder === "desc" ? balanceB - balanceA : balanceA - balanceB;
                });
              
              if (unpaidBills.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No unpaid bills</p>
                    <p className="text-sm">All bills have been paid</p>
                  </div>
                );
              }
              
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Reference</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Bill Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidBills.slice(0, 20).map((bill) => {
                      const billAmount = parseFloat(bill.amount || "0");
                      const paidAmount = parseFloat(bill.paidAmount || "0");
                      const balanceDue = billAmount - paidAmount;
                      const client = clients?.find(c => c.id === bill.clientId);
                      
                      return (
                        <TableRow key={bill.id} data-testid={`row-unpaid-bill-${bill.id}`}>
                          <TableCell className="font-medium">
                            {bill.referenceNumber || `BILL-${bill.id}`}
                          </TableCell>
                          <TableCell>
                            {client ? (
                              <Link href={`/clients/${client.id}`}>
                                <span className="text-primary hover:underline cursor-pointer">
                                  {client.name}
                                </span>
                              </Link>
                            ) : (
                              bill.customerName || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            AED {billAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            AED {paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">
                              AED {balanceDue.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Link href="/bills">
                              <Button size="sm" variant="outline" data-testid={`button-pay-bill-${bill.id}`}>
                                Pay
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
            {(() => {
              const unpaidBills = (bills || []).filter((bill) => {
                const billAmount = parseFloat(bill.amount || "0");
                const paidAmount = parseFloat(bill.paidAmount || "0");
                return (billAmount - paidAmount) > 0.01;
              });
              if (unpaidBills.length > 20) {
                return (
                  <div className="text-center mt-4">
                    <Link href="/bills">
                      <Button variant="ghost" className="text-primary">
                        View all {unpaidBills.length} unpaid bills
                      </Button>
                    </Link>
                  </div>
                );
              }
              return null;
            })()}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open);
            if (!open) {
              setSelectedClient(null);
              setPaymentAmount("");
              setPaymentNotes("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Pay Outstanding Balance
              </DialogTitle>
              <DialogDescription>
                Process payment for {selectedClient?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Payment Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
                {selectedClient && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current Balance: AED{" "}
                    {parseFloat(selectedClient?.balance || "0").toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Payment notes"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProcessPayment}
                  disabled={payBillMutation.isPending}
                >
                  {payBillMutation.isPending ? "Processing..." : "Pay Now"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
