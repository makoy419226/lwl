import { useState, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { Loader2, Users, Trash2, Edit, MessageCircle, Plus, History, Receipt, Wallet, Calendar, Search, Printer, Lock, Download, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Invoice } from "@/components/Invoice";
import type { Client, ClientTransaction, Bill } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [transactionClient, setTransactionClient] = useState<Client | null>(null);
  const [billAmount, setBillAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [billDescription, setBillDescription] = useState("");
  const [depositDescription, setDepositDescription] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterType, setFilterType] = useState<"all" | "bill" | "deposit">("all");
  const [showDueClientsOnly, setShowDueClientsOnly] = useState(false);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [billPaymentMethod, setBillPaymentMethod] = useState("cash");
  const [showCashierPinDialog, setShowCashierPinDialog] = useState(false);
  const [cashierPin, setCashierPin] = useState("");
  const [cashierPinError, setCashierPinError] = useState("");
  const [pendingCashPayment, setPendingCashPayment] = useState<{ billId: number; amount: string } | null>(null);
  const [invoiceData, setInvoiceData] = useState<{
    invoiceNumber: string;
    date: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    totalAmount: number;
    paidAmount: number;
    paymentMethod?: string;
  } | null>(null);
  const { data: clients, isLoading, isError } = useClients(searchTerm);
  const { mutate: deleteClient } = useDeleteClient();
  const { toast } = useToast();

  const { data: transactions } = useQuery<ClientTransaction[]>({
    queryKey: ['/api/clients', transactionClient?.id, 'transactions'],
    enabled: !!transactionClient,
  });

  const { data: unpaidBills } = useQuery<Bill[]>({
    queryKey: ['/api/clients', transactionClient?.id, 'unpaid-bills'],
    enabled: !!transactionClient,
  });

  const payBillMutation = useMutation({
    mutationFn: async ({ billId, amount, paymentMethod }: { billId: number; amount: string; paymentMethod: string }) => {
      return apiRequest("POST", `/api/bills/${billId}/pay`, { amount, paymentMethod });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', transactionClient?.id, 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', transactionClient?.id, 'unpaid-bills'] });
      setPayingBillId(null);
      setBillPaymentAmount("");
      setBillPaymentMethod("cash");
      setPendingCashPayment(null);
      toast({ title: "Payment recorded", description: "Bill payment has been recorded successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Payment failed", description: error.message || "Failed to record payment", variant: "destructive" });
    },
  });

  const verifyCashierPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/workers/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && pendingCashPayment) {
        payBillMutation.mutate({
          billId: pendingCashPayment.billId,
          amount: pendingCashPayment.amount,
          paymentMethod: "cash",
        });
        setShowCashierPinDialog(false);
        setCashierPin("");
        setCashierPinError("");
      }
    },
    onError: () => {
      setCashierPinError("Invalid PIN. Please try again.");
    },
  });

  const handlePayBill = (billId: number, amount: string, method: string) => {
    if (method === "cash") {
      setPendingCashPayment({ billId, amount });
      setShowCashierPinDialog(true);
      setCashierPin("");
      setCashierPinError("");
    } else {
      payBillMutation.mutate({ billId, amount, paymentMethod: method });
    }
  };

  const handleCashierPinSubmit = () => {
    if (cashierPin.length !== 5) {
      setCashierPinError("PIN must be 5 digits");
      return;
    }
    verifyCashierPinMutation.mutate(cashierPin);
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      
      if (filterFromDate || filterToDate) {
        const txDate = new Date(tx.date);
        if (filterFromDate && txDate < startOfDay(new Date(filterFromDate))) return false;
        if (filterToDate && txDate > endOfDay(new Date(filterToDate))) return false;
      }
      
      return true;
    });
  }, [transactions, filterFromDate, filterToDate, filterType]);

  const filteredTotals = useMemo(() => {
    const bills = filteredTransactions.filter(tx => tx.type === 'bill').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const deposits = filteredTransactions.filter(tx => tx.type === 'deposit').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    return { bills, deposits, due: bills - deposits };
  }, [filteredTransactions]);

  const addBillMutation = useMutation({
    mutationFn: async ({ clientId, amount, description }: { clientId: number; amount: string; description: string }) => {
      return apiRequest("POST", `/api/clients/${clientId}/bill`, { amount, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', transactionClient?.id, 'transactions'] });
      setBillAmount("");
      setBillDescription("");
      toast({ title: "Bill added", description: "Amount added to client's total." });
    },
  });

  const addDepositMutation = useMutation({
    mutationFn: async ({ clientId, amount, description }: { clientId: number; amount: string; description: string }) => {
      return apiRequest("POST", `/api/clients/${clientId}/deposit`, { amount, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', transactionClient?.id, 'transactions'] });
      
      if (transactionClient) {
        const newDepositAmount = parseFloat(depositAmount);
        const totalBillAmount = parseFloat(transactionClient.amount || "0");
        const previousDeposits = parseFloat(transactionClient.deposit || "0");
        const totalPaidToDate = previousDeposits + newDepositAmount;
        
        setInvoiceData({
          invoiceNumber: `REC-${Date.now().toString().slice(-8)}`,
          date: new Date().toISOString(),
          clientName: transactionClient.name,
          clientPhone: transactionClient.phone || undefined,
          clientAddress: transactionClient.address || undefined,
          totalAmount: totalBillAmount,
          paidAmount: totalPaidToDate,
          paymentMethod: "Cash",
        });
      }
      
      setDepositAmount("");
      setDepositDescription("");
      toast({ title: "Deposit added", description: "Deposit recorded successfully. Receipt is ready to print." });
    },
  });

  const handleDelete = (client: Client) => {
    if (confirm(`Are you sure you want to delete ${client.name}?`)) {
      deleteClient(client.id, {
        onSuccess: () => {
          toast({
            title: "Client deleted",
            description: `${client.name} has been removed.`,
          });
        },
      });
    }
  };

  const openWhatsApp = (contact: string | null) => {
    if (contact) {
      window.open(contact, "_blank");
    }
  };

  const downloadClientPDF = (client: Client) => {
    const totalBill = parseFloat(client.amount || "0");
    const totalDeposit = parseFloat(client.deposit || "0");
    const balance = parseFloat(client.balance || "0");
    
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e88e5; margin: 0;">LIQUID WASHES LAUNDRY</h2>
          <p style="margin: 5px 0; font-size: 12px;">Centra Market D/109, Al Dhanna City</p>
          <p style="margin: 5px 0; font-size: 12px;">Al Ruwais, Abu Dhabi-UAE</p>
        </div>
        <hr style="border: 1px solid #ddd;"/>
        <h3 style="text-align: center; margin: 15px 0;">CLIENT SUMMARY</h3>
        <hr style="border: 1px solid #ddd;"/>
        <table style="width: 100%; margin: 15px 0; font-size: 14px;">
          <tr><td style="padding: 8px 0;"><strong>Client Name:</strong></td><td style="text-align: right;">${client.name}</td></tr>
          ${client.phone ? `<tr><td style="padding: 8px 0;"><strong>Phone:</strong></td><td style="text-align: right;">${client.phone}</td></tr>` : ''}
          ${client.address ? `<tr><td style="padding: 8px 0;"><strong>Address:</strong></td><td style="text-align: right;">${client.address}</td></tr>` : ''}
          ${client.billNumber ? `<tr><td style="padding: 8px 0;"><strong>Bill Number:</strong></td><td style="text-align: right;">${client.billNumber}</td></tr>` : ''}
        </table>
        <hr style="border: 1px solid #ddd;"/>
        <table style="width: 100%; margin: 15px 0; font-size: 14px;">
          <tr><td style="padding: 8px 0;"><strong>Total Bills:</strong></td><td style="text-align: right; color: #2196f3;">${totalBill.toFixed(2)} AED</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Total Deposits:</strong></td><td style="text-align: right; color: #4caf50;">${totalDeposit.toFixed(2)} AED</td></tr>
          <tr style="font-size: 16px;"><td style="padding: 12px 0; border-top: 2px solid #333;"><strong>BALANCE DUE:</strong></td><td style="text-align: right; border-top: 2px solid #333; color: ${balance > 0 ? '#f44336' : '#4caf50'}; font-weight: bold;">${balance.toFixed(2)} AED</td></tr>
        </table>
        <hr style="border: 1px solid #ddd;"/>
        <p style="text-align: center; font-size: 11px; color: #666; margin-top: 20px;">
          Generated on ${format(new Date(), "dd/MM/yyyy HH:mm")}
        </p>
      </div>
    `;
    
    const opt = {
      margin: 5,
      filename: `${client.name.replace(/\s+/g, '_')}_Summary.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: [80, 150] as [number, number], orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(content).save();
    toast({ title: "PDF Downloaded", description: `Summary for ${client.name} saved` });
  };

  const downloadClientExcel = (client: Client) => {
    const totalBill = parseFloat(client.amount || "0");
    const totalDeposit = parseFloat(client.deposit || "0");
    const balance = parseFloat(client.balance || "0");
    
    const data = [
      ["LIQUID WASHES LAUNDRY - CLIENT SUMMARY"],
      [],
      ["Client Name", client.name],
      ["Phone", client.phone || "-"],
      ["Address", client.address || "-"],
      ["Bill Number", client.billNumber || "-"],
      [],
      ["Financial Summary"],
      ["Total Bills", `${totalBill.toFixed(2)} AED`],
      ["Total Deposits", `${totalDeposit.toFixed(2)} AED`],
      ["Balance Due", `${balance.toFixed(2)} AED`],
      [],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
    XLSX.writeFile(wb, `${client.name.replace(/\s+/g, '_')}_Summary.xlsx`);
    toast({ title: "Excel Downloaded", description: `Summary for ${client.name} saved` });
  };

  const totalAmount = clients?.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0) || 0;
  const totalDeposit = clients?.reduce((sum, c) => sum + parseFloat(c.deposit || "0"), 0) || 0;
  const totalBalance = clients?.reduce((sum, c) => sum + parseFloat(c.balance || "0"), 0) || 0;

  const displayedClients = useMemo(() => {
    if (!clients) return [];
    if (showDueClientsOnly) {
      return clients.filter(c => parseFloat(c.balance || "0") > 0);
    }
    return clients;
  }, [clients, showDueClientsOnly]);

  const dueClientsCount = clients?.filter(c => parseFloat(c.balance || "0") > 0).length || 0;

  return (
    <div className="flex flex-col h-screen">
      <TopBar 
        onSearch={setSearchTerm} 
        searchValue={searchTerm}
        onAddClick={() => setIsCreateOpen(true)}
        addButtonLabel="Add Client"
        pageTitle="Clients"
      />

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-clients">{clients?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-total-amount">{totalAmount.toFixed(2)} AED</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deposits</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-deposit">{totalDeposit.toFixed(2)} AED</p>
              </div>
            </div>
          </div>

          <div 
            className={`bg-card rounded-lg border p-4 cursor-pointer transition-all hover-elevate ${showDueClientsOnly ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setShowDueClientsOnly(!showDueClientsOnly)}
            data-testid="card-total-due"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Due ({dueClientsCount} clients)</p>
                <p className="text-2xl font-bold text-destructive" data-testid="text-total-balance">{totalBalance.toFixed(2)} AED</p>
                {showDueClientsOnly && (
                  <p className="text-xs text-destructive mt-1">Click to show all</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {showDueClientsOnly && (
          <div className="mb-4 p-3 bg-destructive/10 rounded-lg flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">
              Showing {dueClientsCount} clients with outstanding balance
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDueClientsOnly(false)}
              className="text-destructive"
            >
              Show All Clients
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading clients...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p className="font-semibold text-lg">Failed to load clients</p>
            <p className="text-sm opacity-80">Please try refreshing the page.</p>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50">
            <Users className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No clients found</h3>
            <p className="max-w-md text-center">
              {showDueClientsOnly
                ? "No clients with outstanding balance."
                : searchTerm 
                  ? `No clients match "${searchTerm}". Try a different search term.` 
                  : "Your client list is empty. Click the 'Add Client' button to get started."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="font-bold text-foreground w-16">No.</TableHead>
                  <TableHead className="font-bold text-foreground">Client Name</TableHead>
                  <TableHead className="font-bold text-foreground">Contact / Address</TableHead>
                  <TableHead className="font-bold text-foreground text-right">Total Bill</TableHead>
                  <TableHead className="font-bold text-foreground text-right">Deposit</TableHead>
                  <TableHead className="font-bold text-foreground text-right">Due</TableHead>
                  <TableHead className="font-bold text-foreground text-center w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedClients.map((client, index) => (
                  <TableRow 
                    key={client.id}
                    className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell className="font-medium text-muted-foreground" data-testid={`text-serial-${client.id}`}>
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-semibold" data-testid={`text-client-name-${client.id}`}>
                      {client.name}
                      {client.billNumber && (
                        <span className="ml-2 text-xs text-muted-foreground">({client.billNumber})</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-client-contact-${client.id}`}>
                      <div className="space-y-1">
                        {client.phone && (
                          <p className="text-sm">{client.phone}</p>
                        )}
                        {client.address && (
                          <p className="text-sm text-muted-foreground">{client.address}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-600" data-testid={`text-client-amount-${client.id}`}>
                      {parseFloat(client.amount || "0").toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600" data-testid={`text-client-deposit-${client.id}`}>
                      {parseFloat(client.deposit || "0").toFixed(2)}
                    </TableCell>
                    <TableCell 
                      className={`text-right font-bold ${parseFloat(client.balance || "0") > 0 ? "text-destructive" : "text-primary"}`}
                      data-testid={`text-client-balance-${client.id}`}
                    >
                      {parseFloat(client.balance || "0").toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary"
                          onClick={() => setTransactionClient(client)}
                          data-testid={`button-history-${client.id}`}
                          title="Add Bill/Deposit"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => downloadClientPDF(client)}
                          data-testid={`button-pdf-${client.id}`}
                          title="Download PDF Summary"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => downloadClientExcel(client)}
                          data-testid={`button-excel-${client.id}`}
                          title="Download Excel Summary"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        {client.contact && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            onClick={() => openWhatsApp(client.contact)}
                            data-testid={`button-whatsapp-${client.id}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingClient(client)}
                          data-testid={`button-edit-${client.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(client)}
                          data-testid={`button-delete-${client.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            mode="create" 
            onSuccess={() => setIsCreateOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Edit Client</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm 
              mode="edit"
              client={editingClient}
              onSuccess={() => setEditingClient(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!transactionClient} onOpenChange={(open) => !open && setTransactionClient(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">
              {transactionClient?.name} - Transaction History
            </DialogTitle>
          </DialogHeader>
          
          {transactionClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Bill</p>
                  <p className="text-xl font-bold text-blue-600">{parseFloat(transactionClient.amount || "0").toFixed(2)} AED</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Deposit</p>
                  <p className="text-xl font-bold text-green-600">{parseFloat(transactionClient.deposit || "0").toFixed(2)} AED</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Due</p>
                  <p className="text-xl font-bold text-destructive">{parseFloat(transactionClient.balance || "0").toFixed(2)} AED</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-semibold text-blue-600 flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Add Bill
                  </h4>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (AED)"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    data-testid="input-bill-amount"
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={billDescription}
                    onChange={(e) => setBillDescription(e.target.value)}
                    data-testid="input-bill-description"
                  />
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (billAmount && transactionClient) {
                        addBillMutation.mutate({
                          clientId: transactionClient.id,
                          amount: billAmount,
                          description: billDescription,
                        });
                      }
                    }}
                    disabled={!billAmount || addBillMutation.isPending}
                    data-testid="button-add-bill"
                  >
                    {addBillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Bill
                  </Button>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-semibold text-green-600 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Add Deposit
                  </h4>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (AED)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    data-testid="input-deposit-amount"
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={depositDescription}
                    onChange={(e) => setDepositDescription(e.target.value)}
                    data-testid="input-deposit-description"
                  />
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      if (depositAmount && transactionClient) {
                        addDepositMutation.mutate({
                          clientId: transactionClient.id,
                          amount: depositAmount,
                          description: depositDescription,
                        });
                      }
                    }}
                    disabled={!depositAmount || addDepositMutation.isPending}
                    data-testid="button-add-deposit"
                  >
                    {addDepositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Deposit
                  </Button>
                </div>
              </div>

              {unpaidBills && unpaidBills.length > 0 && (
                <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                    <Receipt className="w-4 h-4" /> Unpaid Bills ({unpaidBills.length})
                  </h4>
                  <div className="space-y-2">
                    {unpaidBills.map((bill) => {
                      const remaining = parseFloat(bill.amount) - parseFloat(bill.paidAmount || "0");
                      return (
                        <div key={bill.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Bill #{bill.id}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(bill.billDate), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{bill.description || "No description"}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span>Total: <strong className="text-blue-600">{parseFloat(bill.amount).toFixed(2)} AED</strong></span>
                              <span>Paid: <strong className="text-green-600">{parseFloat(bill.paidAmount || "0").toFixed(2)} AED</strong></span>
                              <span>Due: <strong className="text-destructive">{remaining.toFixed(2)} AED</strong></span>
                            </div>
                          </div>
                          {payingBillId === bill.id ? (
                            <div className="flex items-center gap-2 ml-4">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Amount"
                                value={billPaymentAmount}
                                onChange={(e) => setBillPaymentAmount(e.target.value)}
                                className="w-24"
                                data-testid={`input-pay-amount-${bill.id}`}
                              />
                              <Select value={billPaymentMethod} onValueChange={setBillPaymentMethod}>
                                <SelectTrigger className="w-24" data-testid={`select-pay-method-${bill.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="card">Card</SelectItem>
                                  <SelectItem value="bank">Bank</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (billPaymentAmount) {
                                    handlePayBill(bill.id, billPaymentAmount, billPaymentMethod);
                                  }
                                }}
                                disabled={!billPaymentAmount || payBillMutation.isPending}
                                data-testid={`button-confirm-pay-${bill.id}`}
                              >
                                {payBillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPayingBillId(null);
                                  setBillPaymentAmount("");
                                }}
                                data-testid={`button-cancel-pay-${bill.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-4"
                              onClick={() => {
                                setPayingBillId(bill.id);
                                setBillPaymentAmount(remaining.toFixed(2));
                              }}
                              data-testid={`button-pay-bill-${bill.id}`}
                            >
                              <Wallet className="w-4 h-4 mr-1" /> Pay
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" /> Transaction History
                </h4>
                {transactions && transactions.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">
                              {format(new Date(tx.date), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${tx.type === 'bill' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {tx.type === 'bill' ? 'Bill' : 'Deposit'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {tx.description}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${tx.type === 'bill' ? 'text-blue-600' : 'text-green-600'}`}>
                              {tx.type === 'bill' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {parseFloat(tx.runningBalance).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No transactions yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {invoiceData && (
        <Invoice
          invoiceNumber={invoiceData.invoiceNumber}
          date={invoiceData.date}
          clientName={invoiceData.clientName}
          clientPhone={invoiceData.clientPhone}
          clientAddress={invoiceData.clientAddress}
          totalAmount={invoiceData.totalAmount}
          paidAmount={invoiceData.paidAmount}
          paymentMethod={invoiceData.paymentMethod}
          onClose={() => setInvoiceData(null)}
        />
      )}

      {/* Cashier PIN Dialog for Cash Payments */}
      <Dialog open={showCashierPinDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCashierPinDialog(false);
          setCashierPin("");
          setCashierPinError("");
          setPendingCashPayment(null);
        }
      }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Cashier PIN Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-center text-muted-foreground">
              Enter your 5-digit cashier PIN to accept this cash payment.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cashier-pin">PIN</Label>
              <Input
                id="cashier-pin"
                type="password"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={cashierPin}
                onChange={(e) => {
                  setCashierPin(e.target.value.replace(/\D/g, '').slice(0, 5));
                  setCashierPinError("");
                }}
                className="text-center text-2xl tracking-widest"
                data-testid="input-cashier-pin"
              />
              {cashierPinError && (
                <p className="text-sm text-destructive text-center">{cashierPinError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCashierPinDialog(false);
                  setCashierPin("");
                  setCashierPinError("");
                  setPendingCashPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCashierPinSubmit}
                disabled={cashierPin.length !== 5 || verifyCashierPinMutation.isPending}
                data-testid="button-verify-cashier-pin"
              >
                {verifyCashierPinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
