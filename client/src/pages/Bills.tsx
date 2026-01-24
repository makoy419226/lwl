import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { TopBar } from "@/components/TopBar";
import { useBills, useDeleteBill } from "@/hooks/use-bills";
import { useClients } from "@/hooks/use-clients";
import { useCreateProduct } from "@/hooks/use-products";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Loader2,
  FileText,
  Trash2,
  Plus,
  Minus,
  Receipt,
  Printer,
  Package,
  User,
  PlusCircle,
  AlertCircle,
  Key,
  DollarSign,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter, isSameDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Client, Bill, Order } from "@shared/schema";
import html2pdf from "html2pdf.js";
import logoImage from "@assets/image_1769169126339.png";

function parseDescriptionItems(description: string, products?: Product[]): { name: string; qty: number; price: number; total: number }[] {
  if (!description) return [];
  
  const orderMatch = description.match(/Order #[A-Z0-9-]+:\s*/i);
  const itemsText = orderMatch ? description.replace(orderMatch[0], '') : description;
  
  const itemParts = itemsText.split(',').map(s => s.trim()).filter(Boolean);
  
  return itemParts.map(part => {
    const match = part.match(/^(\d+)x\s+(.+)$/i);
    if (match) {
      const qty = parseInt(match[1]);
      const name = match[2].trim();
      const baseName = name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*/g, '').trim();
      let product = products?.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!product) {
        product = products?.find(p => p.name.toLowerCase() === baseName.toLowerCase());
      }
      const price = product ? parseFloat(product.price || '0') : 0;
      return { name, qty, price, total: qty * price };
    }
    return { name: part, qty: 1, price: 0, total: 0 };
  });
}

export default function Bills() {
  const searchParams = useSearch();
  const urlSearch = new URLSearchParams(searchParams).get("search") || "";
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month" | "year" | "all">("all");
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const newSearch = params.get("search") || "";
    if (newSearch !== searchTerm) {
      setSearchTerm(newSearch);
    }
  }, [searchParams]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("bills");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>(
    {},
  );
  const [billDescription, setBillDescription] = useState("");
  const [createdBill, setCreatedBill] = useState<{
    bill: Bill;
    items: { name: string; qty: number; price: number }[];
  } | null>(null);
  const [viewBillPDF, setViewBillPDF] = useState<Bill | null>(null);
  const [viewBillDetails, setViewBillDetails] = useState<Bill | null>(null);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const invoiceRef = useRef<HTMLDivElement>(null);
  const billPdfRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL("image/png"));
      }
    };
    img.src = logoImage;
  }, []);

  const [showCreatorPinDialog, setShowCreatorPinDialog] = useState(false);
  const [creatorPin, setCreatorPin] = useState("");
  const [creatorPinError, setCreatorPinError] = useState("");
  const [pendingBillData, setPendingBillData] = useState<{
    customerName: string;
    customerPhone?: string;
    amount: string;
    description: string;
    billDate: string;
    referenceNumber: string;
  } | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [, setLocation] = useLocation();

  // Destructure refetch to ensure fresh data
  const { data: bills, isLoading, isError, refetch } = useBills();

  const filteredBills = useMemo(() => {
    if (!bills) return bills;
    
    let filtered = bills;
    
    // Time period filter
    if (timePeriod !== "all") {
      const now = new Date();
      filtered = filtered.filter(b => {
        const billDate = new Date(b.billDate);
        switch (timePeriod) {
          case "today":
            return isSameDay(billDate, now);
          case "week":
            return isAfter(billDate, startOfWeek(now, { weekStartsOn: 0 })) || isSameDay(billDate, startOfWeek(now, { weekStartsOn: 0 }));
          case "month":
            return isAfter(billDate, startOfMonth(now)) || isSameDay(billDate, startOfMonth(now));
          case "year":
            return isAfter(billDate, startOfYear(now)) || isSameDay(billDate, startOfYear(now));
          default:
            return true;
        }
      });
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.referenceNumber?.toLowerCase().includes(term) ||
        b.customerName?.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term) ||
        String(b.id).includes(term)
      );
    }
    
    return filtered;
  }, [bills, searchTerm, timePeriod]);
  const { data: clients = [] } = useClients();
  const { mutate: deleteBill } = useDeleteBill();
  const { mutate: createProduct, isPending: isCreatingProduct } =
    useCreateProduct();
  const { toast } = useToast();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: allOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const getClientTotalBill = (client: Client): number => {
    const baseBillAmount = parseFloat(client.amount || "0");
    if (!allOrders) return baseBillAmount;
    
    // Find all orders for this client that are linked to bills
    const clientOrders = allOrders.filter(order => order.clientId === client.id && order.billId);
    const ordersTotal = clientOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount || "0");
    }, 0);
    
    return baseBillAmount + ordersTotal;
  };

  // FIX 1: Ensure data is fresh when component mounts
  useEffect(() => {
    refetch();
  }, []);

  // FIX 2: Move expensive "Due Customers" calculation to useMemo
  // This prevents the calculation from running on every single render/keystroke
  const dueCustomersData = useMemo(() => {
    if (!bills || !clients) return { dueCustomers: [], totalOutstanding: 0 };

    // Filter purely based on financial status (Amount - Paid > 0)
    // We ignore "Pending" status here, only caring about money owed
    const unpaidBills = bills.filter((b) => {
      const amount = parseFloat(b.amount || "0");
      const paid = parseFloat(b.paidAmount || "0");
      return amount - paid > 0.01; // Tolerance for floating point
    });

    const clientDueMap = new Map<
      number,
      { client: Client; bills: Bill[]; totalDue: number }
    >();

    unpaidBills.forEach((bill) => {
      if (bill.clientId) {
        const client = clients.find((c) => c.id === bill.clientId);
        if (client) {
          const existing = clientDueMap.get(bill.clientId);
          const billAmount = parseFloat(bill.amount || "0");
          const paidAmount = parseFloat(bill.paidAmount || "0");
          const dueAmount = billAmount - paidAmount;

          if (existing) {
            existing.bills.push(bill);
            existing.totalDue += dueAmount;
          } else {
            clientDueMap.set(bill.clientId, {
              client,
              bills: [bill],
              totalDue: dueAmount,
            });
          }
        }
      }
    });

    const dueCustomers = Array.from(clientDueMap.values()).filter(
      (d) => d.totalDue > 0,
    );
    const totalOutstanding = dueCustomers.reduce(
      (sum, d) => sum + d.totalDue,
      0,
    );

    return { dueCustomers, totalOutstanding };
  }, [bills, clients]);

  const verifyCreatorPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/workers/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && pendingBillData) {
        createBillMutation.mutate({
          ...pendingBillData,
          createdByWorkerId: data.worker.id,
        });
        setShowCreatorPinDialog(false);
        setCreatorPin("");
        setCreatorPinError("");
        setPendingBillData(null);
      } else {
        setCreatorPinError("Invalid PIN. Please try again.");
      }
    },
    onError: () => {
      setCreatorPinError("Invalid PIN. Please try again.");
    },
  });

  const createBillMutation = useMutation({
    mutationFn: async (billData: {
      customerName: string;
      customerPhone?: string;
      amount: string;
      description: string;
      billDate: string;
      referenceNumber: string;
      createdByWorkerId?: number;
    }) => {
      const res = await apiRequest("POST", "/api/bills", billData);
      return res.json();
    },
    onSuccess: (bill: Bill) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });

      const items = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => {
          const product = products?.find((p) => p.id === parseInt(productId));
          return {
            name: product?.name || "Unknown",
            qty,
            price: parseFloat(product?.price || "0"),
          };
        });

      setCreatedBill({ bill, items });
      setIsCreateOpen(false);
      setSelectedItems({});
      setSelectedClientId("");
      setCustomerName("");
      setCustomerPhone("");
      setBillDescription("");

      toast({
        title: "Bill Created",
        description: "Invoice generated successfully.",
      });
    },
  });

  const getClientName = (clientId: number) => {
    return clients.find((c) => c.id === clientId)?.name || "Unknown Client";
  };

  const handleDelete = (billId: number) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      deleteBill(billId, {
        onSuccess: () => {
          toast({
            title: "Bill deleted",
            description: "The bill has been removed.",
          });
        },
      });
    }
  };

  const handleCreateNewItem = () => {
    if (!newItemName.trim()) {
      toast({
        title: "Error",
        description: "Please enter item name",
        variant: "destructive",
      });
      return;
    }
    if (!newItemPrice.trim() || isNaN(parseFloat(newItemPrice))) {
      toast({
        title: "Error",
        description: "Please enter valid price",
        variant: "destructive",
      });
      return;
    }

    createProduct(
      {
        name: newItemName.trim(),
        price: newItemPrice.trim(),
        category: newItemCategory.trim() || "General",
        stockQuantity: 0,
      },
      {
        onSuccess: () => {
          setShowNewItemDialog(false);
          setNewItemName("");
          setNewItemPrice("");
          setNewItemCategory("");
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        },
      },
    );
  };

  const updateItemQty = (productId: number, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const calculateTotal = () => {
    return Object.entries(selectedItems).reduce((total, [productId, qty]) => {
      const product = products?.find((p) => p.id === parseInt(productId));
      return total + parseFloat(product?.price || "0") * qty;
    }, 0);
  };

  const handleCreateBill = () => {
    if (!customerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter customer name",
        variant: "destructive",
      });
      return;
    }
    const total = calculateTotal();
    if (total <= 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const itemsList = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products?.find((p) => p.id === parseInt(productId));
        return `${product?.name} x${qty}`;
      })
      .join(", ");

    setPendingBillData({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      amount: total.toFixed(2),
      description: billDescription || itemsList,
      billDate: new Date().toISOString(),
      referenceNumber: `BILL-${Date.now()}`,
    });
    setShowCreatorPinDialog(true);
  };

  const handleVerifyCreatorPin = () => {
    if (!creatorPin.trim()) {
      setCreatorPinError("Please enter your PIN");
      return;
    }
    verifyCreatorPinMutation.mutate(creatorPin);
  };

  const printInvoice = () => {
    if (invoiceRef.current) {
      const printContent = invoiceRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Invoice - ${createdBill?.bill.referenceNumber}</title>
              <style>
                @page {
                  size: A4;
                  margin: 20mm;
                }
                body {
                  font-family: Arial, sans-serif;
                  font-size: 14px;
                  padding: 20px;
                  max-width: 210mm;
                  margin: 0 auto;
                  line-height: 1.5;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .text-sm { font-size: 12px; }
                .text-xs { font-size: 11px; }
                .border-b { border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
                .border-t { border-top: 1px solid #000; padding-top: 12px; margin-top: 12px; }
                .py-1 { padding: 8px 0; }
                .py-2 { padding: 12px 0; }
                .mb-2 { margin-bottom: 12px; }
                .pb-1 { padding-bottom: 8px; }
                .mb-1 { margin-bottom: 8px; }
                .border-dotted { border-bottom: 1px dotted #ccc; }
                .last\\:border-0:last-child { border: none; }
                .text-gray-600 { color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { border: 1px solid #333; padding: 10px 8px; }
                th { background: #1e40af; color: white; font-weight: bold; text-transform: uppercase; font-size: 11px; }
                td { font-size: 12px; }
                tbody tr:nth-child(even) { background: #f5f5f5; }
                @media print {
                  body { margin: 0; padding: 20mm; }
                  th { background: #1e40af !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  tbody tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .tracking-section { background: #f0f9ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        const images = printWindow.document.images;
        if (images.length === 0) {
          printWindow.print();
          printWindow.close();
        } else {
          let loaded = 0;
          const checkAllLoaded = () => {
            loaded++;
            if (loaded >= images.length) {
              printWindow.print();
              printWindow.close();
            }
          };
          for (let i = 0; i < images.length; i++) {
            if (images[i].complete) {
              checkAllLoaded();
            } else {
              images[i].onload = checkAllLoaded;
              images[i].onerror = checkAllLoaded;
            }
          }
        }
      }
    }
  };

  const shareWhatsApp = () => {
    if (!createdBill) return;
    const billDate = createdBill.bill.billDate
      ? format(new Date(createdBill.bill.billDate), "dd/MM/yyyy HH:mm")
      : "";

    let itemsList = createdBill.items
      .map(
        (item) =>
          `${item.name} x${item.qty} = ${(item.price * item.qty).toFixed(2)} AED`,
      )
      .join("%0A");

    const trackingUrl = `lwl.software/track`;
    const message =
      `*LIQUID WASHES LAUNDRY*%0A` +
      `Centra Market D/109, Al Dhanna City%0A` +
      `Al Ruwais, Abu Dhabi-UAE%0A` +
      `Tel: 026 815 824 | Mobile: +971 56 338 0001%0A` +
      `--------------------------------%0A` +
      `*INVOICE*%0A` +
      `--------------------------------%0A` +
      `Ref: ${createdBill.bill.referenceNumber}%0A` +
      `Date: ${billDate}%0A` +
      `Customer: ${createdBill.bill.customerName}%0A` +
      `--------------------------------%0A` +
      `*Items:*%0A` +
      `${itemsList}%0A` +
      `--------------------------------%0A` +
      `*TOTAL: AED ${parseFloat(createdBill.bill.amount).toFixed(2)}*%0A` +
      `--------------------------------%0A` +
      `Track your order at: ${trackingUrl}%0A` +
      `Order Number: ${createdBill.bill.referenceNumber}%0A` +
      `--------------------------------%0A` +
      `Thank you for your business!`;

    const phone = createdBill.bill.customerPhone?.replace(/\D/g, "") || "";
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const handlePayNow = (bill: Bill) => {
    setSelectedBill(bill);
    const remainingAmount =
      parseFloat(bill.amount) - parseFloat(bill.paidAmount || "0");
    setPaymentAmount(remainingAmount.toFixed(2));
    setPaymentNotes("");
    setPaymentMethod("cash");
    setShowPaymentDialog(true);
  };

  const payBillMutation = useMutation({
    mutationFn: async (data: {
      billId: number;
      amount: string;
      paymentMethod: string;
      notes?: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/bills/${data.billId}/pay`,
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedBill?.clientId, "transactions"] });
      setShowPaymentDialog(false);
      setSelectedBill(null);
      toast({
        title: "Payment Successful",
        description: "Bill has been paid successfully.",
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

  const handleProcessPayment = () => {
    if (!selectedBill || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    payBillMutation.mutate({
      billId: selectedBill.id,
      amount: paymentAmount,
      paymentMethod,
      notes: paymentNotes,
    });
  };

  const handlePayNowForClient = (client: Client, totalDue: number) => {
    // Find the oldest unpaid bill for this client that actually has a balance
    const clientUnpaidBills =
      bills?.filter((b) => {
        if (b.clientId !== client.id) return false;
        const amt = parseFloat(b.amount || "0");
        const paid = parseFloat(b.paidAmount || "0");
        return amt - paid > 0.01;
      }) || [];

    if (clientUnpaidBills.length === 0) {
      toast({
        title: "No Unpaid Bills",
        description: "This client has no unpaid bills.",
        variant: "destructive",
      });
      return;
    }

    setSelectedBill(clientUnpaidBills[0]);
    setPaymentAmount(totalDue.toFixed(2));
    setPaymentNotes(`Payment for ${client.name}'s outstanding balance`);
    setPaymentMethod("cash");
    setShowPaymentDialog(true);
  };

  const printBillPDF = async (bill: Bill) => {
    setViewBillPDF(bill);
    setTimeout(() => {
      if (billPdfRef.current) {
        const printContent = billPdfRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Bill - ${bill.referenceNumber || bill.id}</title>
                <style>
                  @page {
                    size: A4;
                    margin: 20mm;
                  }
                  body {
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    padding: 20px;
                    max-width: 210mm;
                    margin: 0 auto;
                    line-height: 1.5;
                  }
                  .text-center { text-align: center; }
                  .font-bold { font-weight: bold; }
                  .border-b { border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
                  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                  th, td { border: 1px solid #333; padding: 10px 8px; }
                  th { background: #1e40af; color: white; font-weight: bold; text-transform: uppercase; font-size: 11px; }
                  td { font-size: 12px; }
                  tbody tr:nth-child(even) { background: #f5f5f5; }
                  @media print {
                    body { margin: 0; padding: 20mm; }
                    th { background: #1e40af !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    tbody tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  }
                </style>
              </head>
              <body>
                ${printContent}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          const images = printWindow.document.images;
          if (images.length === 0) {
            printWindow.print();
            printWindow.close();
          } else {
            let loaded = 0;
            const checkAllLoaded = () => {
              loaded++;
              if (loaded >= images.length) {
                printWindow.print();
                printWindow.close();
              }
            };
            for (let i = 0; i < images.length; i++) {
              if (images[i].complete) {
                checkAllLoaded();
              } else {
                images[i].onload = checkAllLoaded;
                images[i].onerror = checkAllLoaded;
              }
            }
          }
        }
        setViewBillPDF(null);
      }
    }, 100);
  };

  const sortedProducts =
    products?.sort((a, b) => a.name.localeCompare(b.name)) || [];

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        onSearch={setSearchTerm}
        searchValue={searchTerm}
        pageTitle="Bills"
      />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="bills">Bills List</TabsTrigger>
            <TabsTrigger value="due">Due Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="bills">
            <div className="mb-4">
              <p className="text-muted-foreground">
                Track bill entries for customers.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Total: <span className="text-primary">{bills?.length || 0}</span>
                </div>
                <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Showing: <span className="text-primary">{filteredBills?.length || 0}</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-muted-foreground">View:</span>
                  <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as typeof timePeriod)}>
                    <SelectTrigger className="w-32" data-testid="select-time-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p>Loading bills...</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 text-destructive">
                <p className="font-semibold text-lg">Failed to load bills</p>
              </div>
            ) : filteredBills?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
                <FileText className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {searchTerm ? "No matching bills" : "No bills found"}
                </h3>
                <p className="max-w-md text-center">
                  {searchTerm ? `No bills match "${searchTerm}"` : "Bills are created automatically when orders are placed."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBills?.map((bill) => (
                  <Card
                    key={bill.id}
                    className={`relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer ${
                      bill.isPaid 
                        ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30" 
                        : "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
                    }`}
                    data-testid={`card-bill-${bill.id}`}
                    onClick={() => setViewBillDetails(bill)}
                  >
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${bill.isPaid ? "bg-green-500" : "bg-orange-500"}`} />
                    <CardHeader className="pb-2 pl-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={bill.isPaid ? "default" : "destructive"}
                              className={`text-[10px] px-2 py-0 ${bill.isPaid ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}
                            >
                              {bill.isPaid ? "PAID" : "UNPAID"}
                            </Badge>
                            {bill.referenceNumber && (
                              <span className="text-xs text-muted-foreground font-mono">
                                #{bill.referenceNumber}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-base font-bold truncate">
                            {bill.customerName || getClientName(bill.clientId!)}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(bill.billDate), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-5 pb-3">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            <span className="text-sm font-normal text-muted-foreground">AED </span>
                            {parseFloat(bill.amount || "0").toFixed(2)}
                          </p>
                          {bill.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {bill.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {!bill.isPaid && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                              onClick={() => handlePayNow(bill)}
                              data-testid={`button-pay-now-${bill.id}`}
                            >
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Pay
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => printBillPDF(bill)}
                            data-testid={`button-print-pdf-${bill.id}`}
                            title="Print Bill"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(bill.id)}
                            data-testid="button-delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="due">
            <div className="mb-4">
              <p className="text-muted-foreground">
                Clients with outstanding balances.
              </p>
            </div>

            {/* Render the pre-calculated due customers from useMemo */}
            {dueCustomersData.dueCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
                <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">
                  No due balances
                </h3>
                <p className="max-w-md text-center">
                  All clients are up to date with their payments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <span className="font-semibold text-orange-800 dark:text-orange-200">
                        Total Outstanding
                      </span>
                    </div>
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      AED {dueCustomersData.totalOutstanding.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    {dueCustomersData.dueCustomers.length} customer
                    {dueCustomersData.dueCustomers.length > 1 ? "s" : ""} with
                    unpaid balance
                  </p>
                </div>

                {dueCustomersData.dueCustomers.map(
                  ({ client, bills: clientBills, totalDue }) => (
                    <Card
                      key={client.id}
                      className="border-orange-200 dark:border-orange-800"
                      data-testid={`card-due-client-${client.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                              <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {client.name}
                              </CardTitle>
                              {client.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {client.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              Balance Due
                            </p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                              AED {totalDue.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              handlePayNowForClient(client, totalDue)
                            }
                            className="mt-2"
                            data-testid={`button-pay-client-${client.id}`}
                          >
                            Pay Now
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Unpaid Bills ({clientBills.length})
                          </p>
                          {clientBills.map((bill) => {
                            const billAmt = parseFloat(bill.amount || "0");
                            const paidAmt = parseFloat(bill.paidAmount || "0");
                            return (
                              <div
                                key={bill.id}
                                className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2"
                              >
                                <div>
                                  <span className="font-medium">
                                    {bill.referenceNumber || `Bill #${bill.id}`}
                                  </span>
                                  <span className="text-muted-foreground ml-2">
                                    {format(
                                      new Date(bill.billDate),
                                      "MMM dd, yyyy",
                                    )}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                                    {(billAmt - paidAmt).toFixed(2)} AED
                                  </span>
                                  {paidAmt > 0 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      (paid: {paidAmt.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </main>

      <Dialog
        open={!!createdBill}
        onOpenChange={(open) => !open && setCreatedBill(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Bill Created Successfully
            </DialogTitle>
            <DialogDescription>
              Invoice ready to print
            </DialogDescription>
          </DialogHeader>

          <div
            ref={invoiceRef}
            className="bg-white p-6 rounded-lg border text-black"
            style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", position: "relative" }}
          >
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              opacity: 0.08,
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <img src={logoBase64 || logoImage} alt="" style={{ width: "350px", height: "auto" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
            <div className="text-center border-b pb-3 mb-3">
              <img 
                src={logoBase64 || logoImage} 
                alt="Liquid Washes Laundry" 
                style={{ width: '120px', height: 'auto', objectFit: 'contain', margin: '0 auto 10px' }}
              />
              <div className="text-sm">Centra Market D/109, Al Dhanna City</div>
              <div className="text-sm">Al Ruwais, Abu Dhabi-UAE</div>
              <div className="text-sm mt-2">
                <span>Tel: 026 815 824</span>
                <span className="mx-2">|</span>
                <span>Mobile: +971 56 338 0001</span>
              </div>
            </div>
            <div className="text-center font-bold text-lg mb-3">INVOICE</div>
            <div className="text-sm mb-3">
              <div>Ref: {createdBill?.bill.referenceNumber}</div>
              <div>
                Date:{" "}
                {createdBill?.bill.billDate
                  ? format(
                      new Date(createdBill.bill.billDate),
                      "dd/MM/yyyy HH:mm",
                    )
                  : ""}
              </div>
              <div>Customer: {createdBill?.bill.customerName}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '8%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>S.No</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 'bold', width: '42%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '12%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 'bold', width: '18%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 'bold', width: '20%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {createdBill?.items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 1 ? '#f5f5f5' : 'white' }}>
                    <td style={{ textAlign: 'center', padding: '10px 8px', border: '1px solid #333' }}>{idx + 1}</td>
                    <td style={{ textAlign: 'left', padding: '10px 8px', border: '1px solid #333' }}>{item.name}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', border: '1px solid #333' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', border: '1px solid #333' }}>{item.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', border: '1px solid #333', fontWeight: '500' }}>{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>TOTAL:</span>
              <span>
                AED {parseFloat(createdBill?.bill.amount || "0").toFixed(2)}
              </span>
            </div>
            
            {createdBill?.bill.isPaid && (
              <div className="text-center mt-4">
                <div 
                  style={{
                    display: 'inline-block',
                    border: '3px solid #22c55e',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    color: '#22c55e',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    transform: 'rotate(-5deg)',
                    textTransform: 'uppercase'
                  }}
                >
                  PAID
                </div>
                <div className="text-sm mt-2 text-gray-600">
                  Payment Method: {
                    createdBill.bill.paymentMethod === 'deposit' 
                      ? 'CLIENT CREDIT' 
                      : (createdBill.bill.paymentMethod?.toUpperCase() || 'CASH')
                  }
                </div>
              </div>
            )}
            
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              background: '#f0f9ff', 
              borderRadius: '6px', 
              border: '1px dashed #1e40af',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '4px' }}>
                Track your order at this link:
              </div>
              <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>
                lwl.software/track
              </div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginTop: '4px' }}>
                Order Number: {createdBill?.bill.referenceNumber}
              </div>
            </div>
            <div className="text-center mt-4 text-xs">
              Thank you for your business!
            </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={printInvoice}
              className="flex-1"
              data-testid="button-print-invoice"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
            <Button
              onClick={shareWhatsApp}
              variant="outline"
              className="flex-1 text-green-600"
              data-testid="button-share-whatsapp"
            >
              <SiWhatsapp className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCreatedBill(null)}
            className="w-full"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {viewBillPDF && (
        <div className="fixed left-[-9999px]">
          <div
            ref={billPdfRef}
            className="bg-white p-6 rounded-lg border text-black"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: "12px",
              width: "210mm",
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              opacity: 0.08,
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <img src={logoBase64 || logoImage} alt="" style={{ width: "350px", height: "auto" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
            <div className="text-center border-b pb-3 mb-3">
              <img 
                src={logoBase64 || logoImage} 
                alt="Liquid Washes Laundry" 
                style={{ width: '120px', height: 'auto', objectFit: 'contain', margin: '0 auto 10px' }}
              />
              <div className="text-sm">Centra Market D/109, Al Dhanna City</div>
              <div className="text-sm">Al Ruwais, Abu Dhabi-UAE</div>
              <div className="text-sm mt-2">
                <span>Tel: 026 815 824</span>
                <span className="mx-2">|</span>
                <span>Mobile: +971 56 338 0001</span>
              </div>
            </div>
            <div className="text-center font-bold text-lg mb-3">INVOICE</div>
            <div className="text-sm mb-3">
              <div>Ref: {viewBillPDF.referenceNumber || viewBillPDF.id}</div>
              <div>
                Date:{" "}
                {viewBillPDF.billDate
                  ? format(new Date(viewBillPDF.billDate), "dd/MM/yyyy HH:mm")
                  : ""}
              </div>
              <div>
                Customer:{" "}
                {viewBillPDF.customerName ||
                  getClientName(viewBillPDF.clientId!)}
              </div>
              {viewBillPDF.customerPhone && (
                <div>Phone: {viewBillPDF.customerPhone}</div>
              )}
            </div>
            
            {(() => {
              const parsedItems = parseDescriptionItems(viewBillPDF.description || '', products);
              if (parsedItems.length > 0) {
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '8%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>S.No</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 'bold', width: '42%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '12%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 'bold', width: '18%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Price</th>
                        <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 'bold', width: '20%', background: '#1e40af', color: 'white', border: '1px solid #333' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItems.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 1 ? '#f5f5f5' : 'white' }}>
                          <td style={{ textAlign: 'center', padding: '10px 8px', border: '1px solid #333' }}>{idx + 1}</td>
                          <td style={{ textAlign: 'left', padding: '10px 8px', border: '1px solid #333' }}>{item.name}</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px', border: '1px solid #333' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right', padding: '10px 8px', border: '1px solid #333' }}>{item.price.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '10px 8px', border: '1px solid #333', fontWeight: '500' }}>{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
              return null;
            })()}
            
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>TOTAL:</span>
              <span>
                AED {parseFloat(viewBillPDF.amount || "0").toFixed(2)}
              </span>
            </div>
            
            {viewBillPDF.isPaid && (
              <div className="text-center mt-4">
                <div 
                  style={{
                    display: 'inline-block',
                    border: '3px solid #22c55e',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    color: '#22c55e',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    transform: 'rotate(-5deg)',
                    textTransform: 'uppercase'
                  }}
                >
                  PAID
                </div>
                <div className="text-sm mt-2 text-gray-600">
                  Payment Method: {
                    viewBillPDF.paymentMethod === 'deposit' 
                      ? 'CLIENT CREDIT' 
                      : (viewBillPDF.paymentMethod?.toUpperCase() || 'CASH')
                  }
                </div>
              </div>
            )}
            
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              background: '#f0f9ff', 
              borderRadius: '6px', 
              border: '1px dashed #1e40af',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '4px' }}>
                Track your order at this link:
              </div>
              <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>
                lwl.software/track
              </div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginTop: '4px' }}>
                Order Number: {viewBillPDF?.referenceNumber}
              </div>
            </div>
            <div className="text-center mt-4 text-xs">
              Thank you for your business!
            </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary" />
              Add New Item
            </DialogTitle>
            <DialogDescription>
              Create a new laundry item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Enter item name"
                data-testid="input-new-item-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Price (AED)</Label>
              <Input
                type="number"
                step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Enter price"
                data-testid="input-new-item-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Category (Optional)</Label>
              <Input
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                placeholder="e.g. Traditional Wear, Formal Wear"
                data-testid="input-new-item-category"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNewItemDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateNewItem}
                disabled={isCreatingProduct}
                data-testid="button-save-new-item"
              >
                {isCreatingProduct && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreatorPinDialog}
        onOpenChange={(open) => {
          setShowCreatorPinDialog(open);
          if (!open) {
            setCreatorPin("");
            setCreatorPinError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Staff PIN Required
            </DialogTitle>
            <DialogDescription>
              Enter your staff PIN to create this bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff PIN</Label>
              <Input
                id="creator-pin"
                type="tel"
                value={creatorPin}
                autoComplete="off"
                onChange={(e) => {
                  setCreatorPin(e.target.value);
                  setCreatorPinError("");
                }}
                placeholder="Enter your PIN"
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCreatorPin()}
                className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
                data-testid="input-creator-pin"
              />
              {creatorPinError && (
                <p className="text-sm text-destructive">{creatorPinError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreatorPinDialog(false);
                  setCreatorPin("");
                  setCreatorPinError("");
                  setPendingBillData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleVerifyCreatorPin}
                disabled={verifyCreatorPinMutation.isPending}
                data-testid="button-verify-creator-pin"
              >
                {verifyCreatorPinMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Bill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setSelectedBill(null);
            setPaymentAmount("");
            setPaymentNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Pay Bill
            </DialogTitle>
            <DialogDescription>
              Process payment for {selectedBill?.referenceNumber}
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
              {selectedBill && (
                <p className="text-xs text-muted-foreground mt-1">
                  Bill Amount: AED {parseFloat(selectedBill.amount).toFixed(2)}{" "}
                  | Paid: AED{" "}
                  {parseFloat(selectedBill.paidAmount || "0").toFixed(2)} |
                  Remaining: AED{" "}
                  {(
                    parseFloat(selectedBill.amount) -
                    parseFloat(selectedBill.paidAmount || "0")
                  ).toFixed(2)}
                </p>
              )}
            </div>
            {(() => {
              const client = clients.find(c => c.id === selectedBill?.clientId);
              const clientDeposit = parseFloat(client?.deposit || "0");
              return (
                <>
                  {clientDeposit > 0 && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Customer has AED {clientDeposit.toFixed(2)} deposit balance available
                      </p>
                    </div>
                  )}
                  {paymentMethod === "cash" && clientDeposit > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Reminder: Customer still has deposit balance. Consider using "Deduct from Deposit" instead.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deduct from Deposit</SelectItem>
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

      {/* Bill Details Popup */}
      <Dialog open={!!viewBillDetails} onOpenChange={(open) => !open && setViewBillDetails(null)}>
        <DialogContent className={`max-w-md ${viewBillDetails?.isPaid ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800" : "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-orange-200 dark:border-orange-800"}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Bill Details
            </DialogTitle>
            <DialogDescription>
              {viewBillDetails?.referenceNumber && `Reference: ${viewBillDetails.referenceNumber}`}
            </DialogDescription>
          </DialogHeader>
          {viewBillDetails && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${viewBillDetails.isPaid ? "bg-green-50 dark:bg-green-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={viewBillDetails.isPaid ? "bg-green-500" : "bg-orange-500"}>
                    {viewBillDetails.isPaid ? "PAID" : "UNPAID"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(viewBillDetails.billDate), "MMM dd, yyyy")}
                  </span>
                </div>
                <p className="text-xl font-bold">{viewBillDetails.customerName || getClientName(viewBillDetails.clientId!)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold text-primary">
                    {parseFloat(viewBillDetails.amount || "0").toFixed(2)} <span className="text-sm">AED</span>
                  </p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(viewBillDetails.billDate), "dd MMM yyyy")}
                  </p>
                </div>
              </div>

              {viewBillDetails.description && (
                <div className="bg-muted/30 p-3 rounded-lg max-h-60 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2 font-semibold">Items</p>
                  <div className="space-y-1">
                    {viewBillDetails.description.split(',').map((item, index) => {
                      const trimmedItem = item.trim();
                      if (!trimmedItem) return null;
                      return (
                        <div key={index} className="flex items-center gap-2 text-sm py-1 border-b border-border/30 last:border-0">
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          <span>{trimmedItem}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {!viewBillDetails.isPaid && (
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      handlePayNow(viewBillDetails);
                      setViewBillDetails(null);
                    }}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    printBillPDF(viewBillDetails);
                    setViewBillDetails(null);
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    handleDelete(viewBillDetails.id);
                    setViewBillDetails(null);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
