import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/TopBar";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import {
  Loader2,
  Users,
  Trash2,
  Edit,
  MessageCircle,
  Plus,
  History,
  Receipt,
  Wallet,
  Calendar,
  Search,
  Printer,
  Lock,
  Download,
  FileSpreadsheet,
  ShoppingBag,
  ExternalLink,
  Package,
  Eye,
  Check,
  X,
  Pencil,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientForm } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Invoice } from "@/components/Invoice";
import type { Client, ClientTransaction, Bill, Order } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";

export default function Clients() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [transactionClient, setTransactionClient] = useState<Client | null>(
    null,
  );
  const [billAmount, setBillAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [billDescription, setBillDescription] = useState("");
  const [depositDescription, setDepositDescription] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterType, setFilterType] = useState<"all" | "bill" | "deposit">(
    "all",
  );
  const [showDueClientsOnly, setShowDueClientsOnly] = useState(false);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [billPaymentMethod, setBillPaymentMethod] = useState("cash");
  const [showPayAllDialog, setShowPayAllDialog] = useState(false);
  const [payAllAmount, setPayAllAmount] = useState("");
  const [payAllMethod, setPayAllMethod] = useState("cash");
  const [showCashierPinDialog, setShowCashierPinDialog] = useState(false);
  const [cashierPin, setCashierPin] = useState("");
  const [cashierPinError, setCashierPinError] = useState("");
  const [pendingCashPayment, setPendingCashPayment] = useState<{
    billId: number;
    amount: string;
  } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<ClientTransaction | null>(null);
  const [editTransactionAmount, setEditTransactionAmount] = useState("");
  const [editTransactionDescription, setEditTransactionDescription] = useState("");
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
  const [combinedInvoiceData, setCombinedInvoiceData] = useState<{
    invoiceNumber: string;
    date: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    bills: Array<{
      billId: number;
      date: string;
      description: string;
      amount: number;
      paid: number;
      due: number;
    }>;
    totalDue: number;
  } | null>(null);
  const { data: clients, isLoading, isError } = useClients(searchTerm);
  const { mutate: deleteClient } = useDeleteClient();
  const { toast } = useToast();

  const { data: allOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchOnMount: "always",
  });

  const { data: transactions } = useQuery<ClientTransaction[]>({
    queryKey: ["/api/clients", transactionClient?.id, "transactions"],
    enabled: !!transactionClient,
  });

  const { data: unpaidBills } = useQuery<Bill[]>({
    queryKey: ["/api/clients", transactionClient?.id, "unpaid-bills"],
    enabled: !!transactionClient,
  });

  const { data: clientOrders, isLoading: clientOrdersLoading } = useQuery<Order[]>({
    queryKey: ["/api/clients", viewingClient?.id, "orders"],
    enabled: !!viewingClient,
  });

  // Transactions for the viewing client popup
  const { data: viewingClientTransactions } = useQuery<ClientTransaction[]>({
    queryKey: ["/api/clients", viewingClient?.id, "transactions"],
    enabled: !!viewingClient,
  });

  const payBillMutation = useMutation({
    mutationFn: async ({
      billId,
      amount,
      paymentMethod,
    }: {
      billId: number;
      amount: string;
      paymentMethod: string;
    }) => {
      return apiRequest("POST", `/api/bills/${billId}/pay`, {
        amount,
        paymentMethod,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "unpaid-bills"],
      });
      setPayingBillId(null);
      setBillPaymentAmount("");
      setBillPaymentMethod("cash");
      setPendingCashPayment(null);
      toast({
        title: "Payment recorded",
        description: "Bill payment has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const payAllBillsMutation = useMutation({
    mutationFn: async ({
      clientId,
      amount,
      paymentMethod,
      notes,
    }: {
      clientId: number;
      amount: string;
      paymentMethod: string;
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/pay-all-bills`, {
        amount,
        paymentMethod,
        notes,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "unpaid-bills"],
      });
      setShowPayAllDialog(false);
      setPayAllAmount("");
      setPayAllMethod("cash");
      toast({
        title: "Payment recorded",
        description: data.message || "All bills have been paid successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
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
        if (filterFromDate && txDate < startOfDay(new Date(filterFromDate)))
          return false;
        if (filterToDate && txDate > endOfDay(new Date(filterToDate)))
          return false;
      }

      return true;
    });
  }, [transactions, filterFromDate, filterToDate, filterType]);

  const filteredTotals = useMemo(() => {
    const bills = filteredTransactions
      .filter((tx) => tx.type === "bill")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const deposits = filteredTransactions
      .filter((tx) => tx.type === "deposit")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    return { bills, deposits, due: bills - deposits };
  }, [filteredTransactions]);

  const addBillMutation = useMutation({
    mutationFn: async ({
      clientId,
      amount,
      description,
    }: {
      clientId: number;
      amount: string;
      description: string;
    }) => {
      return apiRequest("POST", `/api/clients/${clientId}/bill`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "transactions"],
      });
      setBillAmount("");
      setBillDescription("");
      toast({
        title: "Bill added",
        description: "Amount added to client's total.",
      });
    },
  });

  const addDepositMutation = useMutation({
    mutationFn: async ({
      clientId,
      amount,
      description,
    }: {
      clientId: number;
      amount: string;
      description: string;
    }) => {
      return apiRequest("POST", `/api/clients/${clientId}/deposit`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", transactionClient?.id, "transactions"],
      });

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
      toast({
        title: "Deposit added",
        description:
          "Deposit recorded successfully. Receipt is ready to print.",
      });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      return apiRequest("DELETE", `/api/transactions/${transactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", viewingClient?.id, "transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", viewingClient?.id, "orders"],
      });
      toast({
        title: "Transaction deleted",
        description: "Transaction has been removed and balance updated.",
      });
    },
  });

  const deleteClientOrdersMutation = useMutation({
    mutationFn: async (clientId: number) => {
      return apiRequest("DELETE", `/api/clients/${clientId}/orders`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", viewingClient?.id, "orders"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", viewingClient?.id, "transactions"],
      });
      toast({
        title: "Orders deleted",
        description: "All order history for this client has been removed.",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({
      transactionId,
      amount,
      description,
    }: {
      transactionId: number;
      amount: string;
      description: string;
    }) => {
      return apiRequest("PATCH", `/api/transactions/${transactionId}`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", viewingClient?.id, "transactions"],
      });
      setEditingTransaction(null);
      setEditTransactionAmount("");
      setEditTransactionDescription("");
      toast({
        title: "Transaction updated",
        description: "Transaction has been updated and balance recalculated.",
      });
    },
  });

  const handleDeleteTransaction = (tx: ClientTransaction) => {
    if (confirm(`Are you sure you want to delete this ${tx.type} of ${parseFloat(tx.amount).toFixed(2)} AED?`)) {
      deleteTransactionMutation.mutate(tx.id);
    }
  };

  const handleEditTransaction = (tx: ClientTransaction) => {
    setEditingTransaction(tx);
    setEditTransactionAmount(tx.amount);
    setEditTransactionDescription(tx.description || "");
  };

  const handleSaveTransaction = () => {
    if (editingTransaction && editTransactionAmount) {
      updateTransactionMutation.mutate({
        transactionId: editingTransaction.id,
        amount: editTransactionAmount,
        description: editTransactionDescription,
      });
    }
  };

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


  const downloadClientPDF = async (client: Client) => {
    const totalBill = getClientTotalBills(client);
    const totalDeposit = getClientTotalDeposits(client);
    const balance = getClientBalanceDue(client);

    // Fetch all transactions for this client
    let transactionRows = "";
    try {
      const res = await fetch(`/api/clients/${client.id}/transactions`);
      if (res.ok) {
        const clientTransactions: ClientTransaction[] = await res.json();
        if (clientTransactions && clientTransactions.length > 0) {
          // Sort by date (oldest first)
          const sortedTransactions = [...clientTransactions].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
          transactionRows = sortedTransactions
            .map(
              (t, idx) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 8px; text-align: center;">${idx + 1}</td>
              <td style="padding: 10px 8px;">${format(new Date(t.date), "dd/MM/yyyy")}</td>
              <td style="padding: 10px 8px;">${format(new Date(t.date), "HH:mm")}</td>
              <td style="padding: 10px 8px; text-transform: capitalize; font-weight: 500; color: ${t.type === "deposit" ? "#4caf50" : "#2196f3"};">${t.type}</td>
              <td style="padding: 10px 8px;">${t.description || "-"}</td>
              <td style="padding: 10px 8px; text-align: right; color: ${t.type === "deposit" ? "#4caf50" : "#2196f3"};">${t.type === "deposit" ? "+" : ""}${parseFloat(t.amount).toFixed(2)} AED</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: 500; color: #f44336;">${balance.toFixed(2)} AED</td>
            </tr>
          `,
            )
            .join("");
        }
      }
    } catch (e) {
      console.log("Could not fetch transactions");
    }

    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e88e5; padding-bottom: 20px;">
          <h1 style="color: #1e88e5; margin: 0; font-size: 28px;">LIQUID WASHES LAUNDRY</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">Centra Market D/109, Al Dhanna City, Al Ruwais, Abu Dhabi-UAE</p>
        </div>

        <h2 style="text-align: center; margin: 20px 0; color: #333; font-size: 22px;">CLIENT ACCOUNT SUMMARY</h2>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; width: 50%;"><strong>Client Name:</strong> ${client.name}</td>
              <td style="padding: 8px 0;"><strong>Phone:</strong> ${client.phone || "-"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Address:</strong> ${client.address || "-"}</td>
              <td style="padding: 8px 0;"><strong>Account Number:</strong> ${client.billNumber || "-"}</td>
            </tr>
          </table>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 25px;">
          <div style="flex: 1; background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #1565c0;">Total Bills</p>
            <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #1e88e5;">${totalBill.toFixed(2)} AED</p>
          </div>
          <div style="flex: 1; background: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #2e7d32;">Total Deposits</p>
            <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #4caf50;">${totalDeposit.toFixed(2)} AED</p>
          </div>
          <div style="flex: 1; background: #ffebee; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #c62828;">Due Balance</p>
            <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #f44336;">${balance.toFixed(2)} AED</p>
          </div>
        </div>

        <h3 style="margin: 25px 0 15px 0; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px;">Transaction History</h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #1e88e5; color: white;">
              <th style="padding: 12px 8px; text-align: center; width: 40px;">#</th>
              <th style="padding: 12px 8px; text-align: left;">Date</th>
              <th style="padding: 12px 8px; text-align: left;">Time</th>
              <th style="padding: 12px 8px; text-align: left;">Type</th>
              <th style="padding: 12px 8px; text-align: left;">Description</th>
              <th style="padding: 12px 8px; text-align: right;">Amount</th>
              <th style="padding: 12px 8px; text-align: right;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows || '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">No transaction history found</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center;">
          <p style="font-size: 11px; color: #666; margin: 0;">
            Generated on ${format(new Date(), "dd/MM/yyyy 'at' HH:mm")} | Thank you for your business!
          </p>
          <p style="font-size: 13px; font-weight: bold; color: #000; margin: 8px 0 0 0;">
            For Orders/Delivery: +971 50 123 4567
          </p>
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `${client.name.replace(/\s+/g, "_")}_Summary.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm",
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };

    html2pdf().set(opt).from(content).save();
    toast({
      title: "PDF Downloaded",
      description: `Full summary for ${client.name} saved`,
    });
  };

  const downloadClientExcel = async (client: Client) => {
    const totalBill = getClientTotalBills(client);
    const totalDeposit = getClientTotalDeposits(client);
    const balance = getClientBalanceDue(client);

    // Fetch all transactions for this client
    let transactionData: any[][] = [];
    try {
      const res = await fetch(`/api/clients/${client.id}/transactions`);
      if (res.ok) {
        const clientTransactions: ClientTransaction[] = await res.json();
        if (clientTransactions && clientTransactions.length > 0) {
          // Sort by date (oldest first)
          const sortedTransactions = [...clientTransactions].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
          transactionData = sortedTransactions.map((t, idx) => [
            idx + 1,
            format(new Date(t.date), "dd/MM/yyyy"),
            format(new Date(t.date), "HH:mm"),
            t.type.toUpperCase(),
            t.description || "-",
            `${t.type === "deposit" ? "+" : ""}${parseFloat(t.amount).toFixed(2)} AED`,
            `${balance.toFixed(2)} AED`,
          ]);
        }
      }
    } catch (e) {
      console.log("Could not fetch transactions");
    }

    const data = [
      ["LIQUID WASHES LAUNDRY - CLIENT ACCOUNT SUMMARY"],
      [],
      ["Client Name", client.name],
      ["Phone", client.phone || "-"],
      ["Address", client.address || "-"],
      ["Account Number", client.billNumber || "-"],
      [],
      ["Financial Summary"],
      ["Total Bills", `${totalBill.toFixed(2)} AED`],
      ["Total Deposits", `${totalDeposit.toFixed(2)} AED`],
      ["Due Balance", `${balance.toFixed(2)} AED`],
      [],
      ["TRANSACTION HISTORY"],
      ["#", "Date", "Time", "Type", "Description", "Amount", "Balance"],
      ...transactionData,
      [],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 5 }, // #
      { wch: 12 }, // Date
      { wch: 8 }, // Time
      { wch: 10 }, // Type
      { wch: 30 }, // Description
      { wch: 15 }, // Amount
      { wch: 15 }, // Balance
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
    XLSX.writeFile(wb, `${client.name.replace(/\s+/g, "_")}_Summary.xlsx`);
    toast({
      title: "Excel Downloaded",
      description: `Full summary for ${client.name} saved`,
    });
  };

  const getItemCount = (itemsString: string | null): number => {
    if (!itemsString) return 0;
    const trimmed = itemsString.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        }
      } catch (e) {}
    }
    return itemsString.split(", ").reduce((count, item) => {
      const quantityFirstMatch = item.match(/^(\d+)x\s+.+$/);
      if (quantityFirstMatch) return count + parseInt(quantityFirstMatch[1]);
      const nameFirstMatch = item.match(/^.+\s+x(\d+)$/);
      if (nameFirstMatch) return count + parseInt(nameFirstMatch[1]);
      return count + 1;
    }, 0);
  };

  // Calculate Total Bills = sum of paid amounts from orders (what was actually paid)
  const getClientTotalBills = (client: Client): number => {
    if (!allOrders) return 0;
    const clientOrders = allOrders.filter(order => order.clientId === client.id);
    return clientOrders.reduce((sum, order) => {
      return sum + parseFloat(order.paidAmount || "0");
    }, 0);
  };

  // Calculate Total Deposits = sum of deposit transactions (money customer gave)
  const getClientTotalDeposits = (client: Client): number => {
    return parseFloat(client.deposit || "0");
  };

  // Calculate Balance Due = unpaid order amounts (total - paid)
  const getClientBalanceDue = (client: Client): number => {
    if (!allOrders) return 0;
    const clientOrders = allOrders.filter(order => order.clientId === client.id);
    return clientOrders.reduce((sum, order) => {
      const total = parseFloat(order.totalAmount || "0");
      const paid = parseFloat(order.paidAmount || "0");
      return sum + (total - paid);
    }, 0);
  };

  // Generate combined invoice for all unpaid bills
  const generateCombinedInvoice = () => {
    if (!transactionClient || !unpaidBills || unpaidBills.length === 0) return;
    
    const billItems = unpaidBills.map((bill) => ({
      billId: bill.id,
      date: format(new Date(bill.billDate), "dd/MM/yyyy"),
      description: bill.description || `Bill #${bill.id}`,
      amount: parseFloat(bill.amount || "0"),
      paid: parseFloat(bill.paidAmount || "0"),
      due: parseFloat(bill.amount || "0") - parseFloat(bill.paidAmount || "0"),
    }));
    
    const totalDue = billItems.reduce((sum, item) => sum + item.due, 0);
    
    setCombinedInvoiceData({
      invoiceNumber: `DUE-${transactionClient.id}-${Date.now().toString().slice(-6)}`,
      date: format(new Date(), "dd/MM/yyyy"),
      clientName: transactionClient.name,
      clientPhone: transactionClient.phone || undefined,
      clientAddress: transactionClient.address || undefined,
      bills: billItems,
      totalDue,
    });
  };

  const totalAmount =
    clients?.reduce((sum, c) => sum + getClientTotalBills(c), 0) || 0;
  const totalDeposit =
    clients?.reduce((sum, c) => sum + getClientTotalDeposits(c), 0) || 0;
  const totalBalance =
    clients?.reduce((sum, c) => sum + getClientBalanceDue(c), 0) || 0;

  const displayedClients = useMemo(() => {
    if (!clients) return [];
    if (showDueClientsOnly) {
      return clients.filter((c) => getClientBalanceDue(c) > 0);
    }
    return clients;
  }, [clients, showDueClientsOnly, allOrders]);

  const dueClientsCount =
    clients?.filter((c) => getClientBalanceDue(c) > 0).length || 0;

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
                <p
                  className="text-2xl font-bold text-foreground"
                  data-testid="text-total-clients"
                >
                  {clients?.length || 0}
                </p>
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
                <p
                  className="text-2xl font-bold text-blue-600"
                  data-testid="text-total-amount"
                >
                  {totalAmount.toFixed(2)} AED
                </p>
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
                <p
                  className="text-2xl font-bold text-green-600"
                  data-testid="text-total-deposit"
                >
                  {totalDeposit.toFixed(2)} AED
                </p>
              </div>
            </div>
          </div>

          <div
            className={`bg-card rounded-lg border p-4 cursor-pointer transition-all hover-elevate ${showDueClientsOnly ? "ring-2 ring-destructive" : ""}`}
            onClick={() => setShowDueClientsOnly(!showDueClientsOnly)}
            data-testid="card-total-due"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Due ({dueClientsCount} clients)
                </p>
                <p
                  className="text-2xl font-bold text-destructive"
                  data-testid="text-total-balance"
                >
                  {totalBalance.toFixed(2)} AED
                </p>
                {showDueClientsOnly && (
                  <p className="text-xs text-destructive mt-1">
                    Click to show all
                  </p>
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
            <p className="text-sm opacity-80">
              Please try refreshing the page.
            </p>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50">
            <Users className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              No clients found
            </h3>
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
                  <TableHead className="font-bold text-foreground w-16">
                    No.
                  </TableHead>
                  <TableHead className="font-bold text-foreground">
                    Client Name
                  </TableHead>
                  <TableHead className="font-bold text-foreground">
                    Phone / Address
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-right">
                    Total Bill
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-right">
                    Deposit
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-right">
                    Due
                  </TableHead>
                  <TableHead className="font-bold text-foreground text-center w-40">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedClients.map((client, index) => (
                  <TableRow
                    key={client.id}
                    className={
                      index % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell
                      className="font-medium text-muted-foreground"
                      data-testid={`text-serial-${client.id}`}
                    >
                      {index + 1}
                    </TableCell>
                    <TableCell
                      className="font-semibold cursor-pointer hover:text-primary hover:underline"
                      data-testid={`text-client-name-${client.id}`}
                      onClick={() => setTransactionClient(client)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{client.name}</span>
                        {client.billNumber && (
                          <span className="text-xs text-muted-foreground">
                            ({client.billNumber})
                          </span>
                        )}
                        <Wallet className="w-3 h-3 opacity-50" />
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-client-contact-${client.id}`}>
                      <div className="space-y-1">
                        {client.phone && (
                          <p className="text-sm">{client.phone}</p>
                        )}
                        {client.address && (
                          <p className="text-sm text-muted-foreground">
                            {client.address}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right font-medium text-blue-600"
                      data-testid={`text-client-amount-${client.id}`}
                    >
                      {getClientTotalBills(client).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className="text-right font-medium text-green-600"
                      data-testid={`text-client-deposit-${client.id}`}
                    >
                      {getClientTotalDeposits(client).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${getClientBalanceDue(client) > 0 ? "text-destructive" : "text-primary"}`}
                      data-testid={`text-client-balance-${client.id}`}
                    >
                      {getClientBalanceDue(client).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
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
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">
              Add New Client
            </DialogTitle>
          </DialogHeader>
          <ClientForm mode="create" onSuccess={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">
              Edit Client
            </DialogTitle>
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

      <Dialog
        open={!!transactionClient}
        onOpenChange={(open) => !open && setTransactionClient(null)}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">
              {transactionClient?.name} - Transaction History
            </DialogTitle>
          </DialogHeader>

          {transactionClient && (
            <div className="space-y-6">
              {(() => {
                // Calculate actual unpaid bills due
                const clientUnpaidTotal = unpaidBills?.reduce((sum, bill) => {
                  const total = parseFloat(bill.amount || "0");
                  const paid = parseFloat(bill.paidAmount || "0");
                  return sum + (total - paid);
                }, 0) || 0;
                
                // Calculate credit balance from transactions (deposit - deposit_used)
                const creditBalance = transactions?.reduce((sum, tx) => {
                  if (tx.type === "deposit") {
                    return sum + parseFloat(tx.amount || "0");
                  } else if (tx.type === "deposit_used") {
                    return sum - parseFloat(tx.amount || "0");
                  }
                  return sum;
                }, 0) || 0;
                
                // Credit Available = credit balance (what's been added minus what's been used)
                const availableCredit = Math.max(0, creditBalance);
                
                return (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Unpaid Bills</p>
                      <p className="text-xl font-bold text-blue-600">
                        {clientUnpaidTotal.toFixed(2)} AED
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Credit Available</p>
                      <p className="text-xl font-bold text-green-600">
                        {availableCredit.toFixed(2)} AED
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 p-4 border rounded-lg">
                <h4 className="font-semibold text-green-600 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Add Credit to Account
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
                  {addDepositMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Credit
                </Button>
              </div>

              {unpaidBills && unpaidBills.length > 0 && (
                <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="font-semibold flex items-center gap-2 text-destructive">
                      <Receipt className="w-4 h-4" /> Unpaid Bills (
                      {unpaidBills.length})
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          const totalDue = unpaidBills.reduce((sum, bill) => {
                            const amt = parseFloat(bill.amount || "0");
                            const paid = parseFloat(bill.paidAmount || "0");
                            return sum + (amt - paid);
                          }, 0);
                          setPayAllAmount(totalDue.toFixed(2));
                          setShowPayAllDialog(true);
                        }}
                        data-testid="button-pay-all-bills"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Pay All Bills
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generateCombinedInvoice}
                        data-testid="button-generate-combined-invoice"
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Print Combined Invoice
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {unpaidBills.map((bill) => {
                      const remaining =
                        parseFloat(bill.amount) -
                        parseFloat(bill.paidAmount || "0");
                      return (
                        <div
                          key={bill.id}
                          className="flex items-center justify-between p-3 bg-background rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                Bill #{bill.id}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(bill.billDate), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {bill.description || "No description"}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span>
                                Total:{" "}
                                <strong className="text-blue-600">
                                  {parseFloat(bill.amount).toFixed(2)} AED
                                </strong>
                              </span>
                              <span>
                                Paid:{" "}
                                <strong className="text-green-600">
                                  {parseFloat(bill.paidAmount || "0").toFixed(
                                    2,
                                  )}{" "}
                                  AED
                                </strong>
                              </span>
                              <span>
                                Due:{" "}
                                <strong className="text-destructive">
                                  {remaining.toFixed(2)} AED
                                </strong>
                              </span>
                            </div>
                          </div>
                          {payingBillId === bill.id ? (
                            <div className="flex flex-col gap-2 ml-4">
                              {/* Warning if credit is available but paying with cash/card/bank */}
                              {(() => {
                                const creditAvailable = transactions?.reduce((sum, tx) => {
                                  if (tx.type === "deposit") return sum + parseFloat(tx.amount || "0");
                                  if (tx.type === "deposit_used") return sum - parseFloat(tx.amount || "0");
                                  return sum;
                                }, 0) || 0;
                                
                                if (creditAvailable > 0 && billPaymentMethod !== "deposit") {
                                  return (
                                    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-300">
                                      <span>⚠️ Client has {creditAvailable.toFixed(2)} AED credit available</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Amount"
                                value={billPaymentAmount}
                                onChange={(e) =>
                                  setBillPaymentAmount(e.target.value)
                                }
                                className="w-24"
                                data-testid={`input-pay-amount-${bill.id}`}
                              />
                              <Select
                                value={billPaymentMethod}
                                onValueChange={setBillPaymentMethod}
                              >
                                <SelectTrigger
                                  className="w-28"
                                  data-testid={`select-pay-method-${bill.id}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="card">Card</SelectItem>
                                  <SelectItem value="bank">Bank</SelectItem>
                                  <SelectItem value="deposit">Use Credit</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (billPaymentAmount) {
                                    handlePayBill(
                                      bill.id,
                                      billPaymentAmount,
                                      billPaymentMethod,
                                    );
                                  }
                                }}
                                disabled={
                                  !billPaymentAmount ||
                                  payBillMutation.isPending
                                }
                                data-testid={`button-confirm-pay-${bill.id}`}
                              >
                                {payBillMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Pay"
                                )}
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
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-4"
                              onClick={() => {
                                setTransactionClient(null);
                                navigate("/bills");
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
                        {(() => {
                          const sortedTx = [...transactions].sort(
                            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                          );
                          let creditBalance = 0;
                          return sortedTx.map((tx) => {
                            // deposit = credit added, deposit_used = credit used for payment
                            if (tx.type === "deposit") {
                              creditBalance += parseFloat(tx.amount);
                            } else if (tx.type === "deposit_used") {
                              creditBalance -= parseFloat(tx.amount);
                            }
                            // "payment" and "bill" types don't affect credit balance
                            
                            // Determine display type and styling based on type and payment method
                            const getTypeDisplay = () => {
                              if (tx.type === "deposit") {
                                return { label: "Add Credit to Account", color: "bg-green-100 text-green-700" };
                              }
                              if (tx.type === "deposit_used") {
                                return { label: "Paid with Credit", color: "bg-orange-100 text-orange-700" };
                              }
                              if (tx.type === "bill") {
                                return { label: "Bill", color: "bg-blue-100 text-blue-700" };
                              }
                              // For payment types, show the payment method
                              if (tx.type === "payment" || tx.paymentMethod) {
                                const method = tx.paymentMethod || "cash";
                                switch (method) {
                                  case "cash": return { label: "Paid in Cash", color: "bg-purple-100 text-purple-700" };
                                  case "card": return { label: "Paid in Card", color: "bg-indigo-100 text-indigo-700" };
                                  case "bank": return { label: "Paid in Bank", color: "bg-cyan-100 text-cyan-700" };
                                  default: return { label: `Paid in ${method}`, color: "bg-gray-100 text-gray-700" };
                                }
                              }
                              return { label: tx.type, color: "bg-gray-100 text-gray-700" };
                            };
                            const typeDisplay = getTypeDisplay();
                            
                            return (
                              <TableRow key={tx.id}>
                                <TableCell className="text-sm">
                                  {format(new Date(tx.date), "dd/MM/yyyy HH:mm")}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${typeDisplay.color}`}>
                                    {typeDisplay.label}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {tx.description}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-medium ${tx.type === "deposit" ? "text-green-600" : tx.type === "deposit_used" ? "text-orange-600" : "text-muted-foreground"}`}
                                >
                                  {tx.type === "deposit" ? "+" : tx.type === "deposit_used" ? "-" : ""}
                                  {parseFloat(tx.amount).toFixed(2)}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${creditBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {creditBalance.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No transactions yet
                  </p>
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

      {/* Combined Invoice Dialog */}
      <Dialog open={!!combinedInvoiceData} onOpenChange={(open) => !open && setCombinedInvoiceData(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Combined Due Invoice
            </DialogTitle>
          </DialogHeader>
          {combinedInvoiceData && (
            <div className="space-y-4" id="combined-invoice-print">
              <div className="text-center border-b pb-3">
                <h2 className="text-lg font-bold">Liquid Washes Laundry</h2>
                <p className="text-xs text-muted-foreground">Statement of Outstanding Bills</p>
                <p className="text-xs text-muted-foreground">Invoice #: {combinedInvoiceData.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">Date: {combinedInvoiceData.date}</p>
              </div>

              <div className="border-b pb-3">
                <p className="text-sm font-medium">{combinedInvoiceData.clientName}</p>
                {combinedInvoiceData.clientPhone && (
                  <p className="text-xs text-muted-foreground">{combinedInvoiceData.clientPhone}</p>
                )}
                {combinedInvoiceData.clientAddress && (
                  <p className="text-xs text-muted-foreground">{combinedInvoiceData.clientAddress}</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Outstanding Bills</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Bill #</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedInvoiceData.bills.map((bill) => (
                      <TableRow key={bill.billId}>
                        <TableCell className="text-xs">#{bill.billId}</TableCell>
                        <TableCell className="text-xs">{bill.date}</TableCell>
                        <TableCell className="text-xs text-right">{bill.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right text-green-600">{bill.paid.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right text-destructive font-medium">{bill.due.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total Due:</span>
                  <span className="text-lg font-bold text-destructive">
                    AED {combinedInvoiceData.totalDue.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const printContent = document.getElementById("combined-invoice-print");
                    if (printContent) {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Combined Invoice - ${combinedInvoiceData.clientName}</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background-color: #f5f5f5; }
                                .text-right { text-align: right; }
                                .text-center { text-align: center; }
                                .total { font-size: 18px; font-weight: bold; margin-top: 15px; }
                                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                                .due { color: #dc2626; }
                                .paid { color: #16a34a; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h1>Liquid Washes Laundry</h1>
                                <p>Statement of Outstanding Bills</p>
                                <p>Invoice #: ${combinedInvoiceData.invoiceNumber}</p>
                                <p>Date: ${combinedInvoiceData.date}</p>
                              </div>
                              <div>
                                <strong>${combinedInvoiceData.clientName}</strong><br/>
                                ${combinedInvoiceData.clientPhone || ""}<br/>
                                ${combinedInvoiceData.clientAddress || ""}
                              </div>
                              <h3>Outstanding Bills</h3>
                              <table>
                                <tr>
                                  <th>Bill #</th>
                                  <th>Date</th>
                                  <th class="text-right">Amount (AED)</th>
                                  <th class="text-right">Paid (AED)</th>
                                  <th class="text-right">Due (AED)</th>
                                </tr>
                                ${combinedInvoiceData.bills.map(bill => `
                                  <tr>
                                    <td>#${bill.billId}</td>
                                    <td>${bill.date}</td>
                                    <td class="text-right">${bill.amount.toFixed(2)}</td>
                                    <td class="text-right paid">${bill.paid.toFixed(2)}</td>
                                    <td class="text-right due">${bill.due.toFixed(2)}</td>
                                  </tr>
                                `).join("")}
                              </table>
                              <div class="total">
                                <span>Total Due: </span>
                                <span class="due">AED ${combinedInvoiceData.totalDue.toFixed(2)}</span>
                              </div>
                              <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                                Thank you for your business!
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }
                  }}
                  data-testid="button-print-combined-invoice"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCombinedInvoiceData(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cashier PIN Dialog for Cash Payments */}
      <Dialog
        open={showCashierPinDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCashierPinDialog(false);
            setCashierPin("");
            setCashierPinError("");
            setPendingCashPayment(null);
          }
        }}
      >
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
                type="tel"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={cashierPin}
                autoComplete="off"
                onChange={(e) => {
                  setCashierPin(e.target.value.replace(/\D/g, "").slice(0, 5));
                  setCashierPinError("");
                }}
                className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
                data-testid="input-cashier-pin"
              />
              {cashierPinError && (
                <p className="text-sm text-destructive text-center">
                  {cashierPinError}
                </p>
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
                disabled={
                  cashierPin.length !== 5 || verifyCashierPinMutation.isPending
                }
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

      <Dialog
        open={!!viewingClient}
        onOpenChange={(open) => !open && setViewingClient(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary flex items-center gap-2">
              <Users className="w-6 h-6" />
              {viewingClient?.name}
            </DialogTitle>
          </DialogHeader>

          {viewingClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewingClient.phone || "-"}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{viewingClient.address || "-"}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="font-medium">{viewingClient.billNumber || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
                  <Receipt className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-muted-foreground">Total Bills</p>
                  <p className="text-xl font-bold text-blue-600">
                    {getClientTotalBills(viewingClient).toFixed(2)} AED
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
                  <Wallet className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-muted-foreground">Total Deposits</p>
                  <p className="text-xl font-bold text-green-600">
                    {getClientTotalDeposits(viewingClient).toFixed(2)} AED
                  </p>
                </div>
                <div className="rounded-lg p-4 text-center bg-red-50 dark:bg-red-950/30">
                  <Wallet className="w-6 h-6 mx-auto mb-2 text-red-600" />
                  <p className="text-sm text-muted-foreground">Due Balance</p>
                  <p className="text-xl font-bold text-red-600">
                    {getClientBalanceDue(viewingClient).toFixed(2)} AED
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order History ({clientOrders?.length || 0})
                </h3>
              </div>

              {clientOrdersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !clientOrders || clientOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No orders found for this client</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientOrders.map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-mono font-semibold">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>
                            {order.entryDate
                              ? format(new Date(order.entryDate), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {getItemCount(order.items)} items
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {parseFloat(order.totalAmount || "0").toFixed(2)} AED
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.status === "released"
                                  ? "default"
                                  : order.status === "ready"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="capitalize"
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setViewingClient(null);
                                navigate(`/orders?highlight=${order.orderNumber}`);
                              }}
                              data-testid={`button-view-order-${order.id}`}
                              title="View Order"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Transaction History - shows where bill amounts came from */}
              {viewingClientTransactions && viewingClientTransactions.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <History className="w-5 h-5" />
                    Transaction History ({viewingClientTransactions.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const sortedTx = [...viewingClientTransactions].sort(
                            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                          );
                          let remainingBalance = 0;
                          return sortedTx.map((tx) => {
                            if (tx.type === "deposit") {
                              remainingBalance += parseFloat(tx.amount);
                            } else {
                              remainingBalance -= parseFloat(tx.amount);
                            }
                            const currentBalance = remainingBalance;
                            return (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">
                              {format(new Date(tx.date), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={tx.type === "bill" ? "default" : "secondary"}
                                className={tx.type === "bill" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}
                              >
                                {tx.type === "bill" ? "Bill" : "Deposit"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {tx.billId ? `#${tx.billId}` : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {tx.description}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${tx.type === "deposit" ? "text-green-600" : "text-blue-600"}`}>
                              {tx.type === "deposit" ? "+" : "-"}{parseFloat(tx.amount).toFixed(2)} AED
                            </TableCell>
                            <TableCell className={`text-right font-bold ${currentBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {currentBalance.toFixed(2)} AED
                            </TableCell>
                          </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setTransactionClient(viewingClient)}
                >
                  <History className="w-4 h-4 mr-2" />
                  Add Deposit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadClientPDF(viewingClient)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Summary
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ALL orders, bills, and transactions for ${viewingClient.name}? This cannot be undone.`)) {
                      deleteClientOrdersMutation.mutate(viewingClient.id);
                    }
                  }}
                  disabled={deleteClientOrdersMutation.isPending}
                  data-testid="button-delete-client-orders"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteClientOrdersMutation.isPending ? "Deleting..." : "Delete All History"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay All Bills Dialog */}
      <Dialog open={showPayAllDialog} onOpenChange={(open) => {
        setShowPayAllDialog(open);
        if (!open) {
          setPayAllAmount("");
          setPayAllMethod("cash");
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Pay All Outstanding Bills
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {transactionClient?.name && (
                  <span className="font-medium">{transactionClient.name}</span>
                )}
                {unpaidBills && (
                  <span className="block mt-1">
                    {unpaidBills.length} unpaid bill{unpaidBills.length !== 1 ? 's' : ''} totaling{' '}
                    <span className="font-semibold text-destructive">
                      {unpaidBills.reduce((sum, bill) => {
                        const amt = parseFloat(bill.amount || "0");
                        const paid = parseFloat(bill.paidAmount || "0");
                        return sum + (amt - paid);
                      }, 0).toFixed(2)} AED
                    </span>
                  </span>
                )}
              </p>
            </div>
            <div>
              <Label htmlFor="payAllAmount">Payment Amount (AED)</Label>
              <Input
                id="payAllAmount"
                type="number"
                step="0.01"
                value={payAllAmount}
                onChange={(e) => setPayAllAmount(e.target.value)}
                placeholder="Enter payment amount"
                data-testid="input-pay-all-amount"
              />
            </div>
            <div>
              <Label htmlFor="payAllMethod">Payment Method</Label>
              <select
                id="payAllMethod"
                className="w-full p-2 border rounded-md bg-background"
                value={payAllMethod}
                onChange={(e) => setPayAllMethod(e.target.value)}
                data-testid="select-pay-all-method"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowPayAllDialog(false)}
                data-testid="button-cancel-pay-all"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (transactionClient && payAllAmount && parseFloat(payAllAmount) > 0) {
                    payAllBillsMutation.mutate({
                      clientId: transactionClient.id,
                      amount: payAllAmount,
                      paymentMethod: payAllMethod,
                      notes: `Bulk payment for all outstanding bills`,
                    });
                  }
                }}
                disabled={payAllBillsMutation.isPending || !payAllAmount || parseFloat(payAllAmount) <= 0}
                data-testid="button-confirm-pay-all"
              >
                {payAllBillsMutation.isPending ? "Processing..." : "Pay Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
