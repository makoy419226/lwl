import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/TopBar";
import { useBills, useDeleteBill } from "@/hooks/use-bills";
import { useClients } from "@/hooks/use-clients";
import { useCreateProduct } from "@/hooks/use-products";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, FileText, Trash2, Plus, Minus, Receipt, Download, Printer, Package, User, PlusCircle, AlertCircle, ShoppingCart, Key } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Client, Bill } from "@shared/schema";
import html2pdf from "html2pdf.js";

export default function Bills() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("bills");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [billDescription, setBillDescription] = useState("");
  const [createdBill, setCreatedBill] = useState<{ bill: Bill; items: { name: string; qty: number; price: number }[] } | null>(null);
  const [viewBillPDF, setViewBillPDF] = useState<Bill | null>(null);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const invoiceRef = useRef<HTMLDivElement>(null);
  const billPdfRef = useRef<HTMLDivElement>(null);
  
  const [showCreatorPinDialog, setShowCreatorPinDialog] = useState(false);
  const [creatorPin, setCreatorPin] = useState("");
  const [creatorPinError, setCreatorPinError] = useState("");
  const [pendingBillData, setPendingBillData] = useState<{ customerName: string; customerPhone?: string; amount: string; description: string; billDate: string; referenceNumber: string } | null>(null);
  
  const [, setLocation] = useLocation();
  const { data: bills, isLoading, isError } = useBills();
  const { data: clients = [] } = useClients();
  const { mutate: deleteBill } = useDeleteBill();
  const { mutate: createProduct, isPending: isCreatingProduct } = useCreateProduct();
  const { toast } = useToast();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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
    mutationFn: async (billData: { customerName: string; customerPhone?: string; amount: string; description: string; billDate: string; referenceNumber: string; createdByWorkerId?: number }) => {
      const res = await apiRequest("POST", "/api/bills", billData);
      return res.json();
    },
    onSuccess: (bill: Bill) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      
      const items = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => {
          const product = products?.find(p => p.id === parseInt(productId));
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
    return clients.find(c => c.id === clientId)?.name || "Unknown Client";
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
      toast({ title: "Error", description: "Please enter item name", variant: "destructive" });
      return;
    }
    if (!newItemPrice.trim() || isNaN(parseFloat(newItemPrice))) {
      toast({ title: "Error", description: "Please enter valid price", variant: "destructive" });
      return;
    }
    
    createProduct({
      name: newItemName.trim(),
      price: newItemPrice.trim(),
      category: newItemCategory.trim() || "General",
      stockQuantity: 0,
    }, {
      onSuccess: () => {
        setShowNewItemDialog(false);
        setNewItemName("");
        setNewItemPrice("");
        setNewItemCategory("");
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      }
    });
  };

  const updateItemQty = (productId: number, delta: number) => {
    setSelectedItems(prev => {
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
      const product = products?.find(p => p.id === parseInt(productId));
      return total + (parseFloat(product?.price || "0") * qty);
    }, 0);
  };

  const handleCreateBill = () => {
    if (!customerName.trim()) {
      toast({ title: "Error", description: "Please enter customer name", variant: "destructive" });
      return;
    }
    const total = calculateTotal();
    if (total <= 0) {
      toast({ title: "Error", description: "Please add at least one item", variant: "destructive" });
      return;
    }

    const itemsList = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products?.find(p => p.id === parseInt(productId));
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

  const generatePDF = async () => {
    if (invoiceRef.current) {
      const opt = {
        margin: 5,
        filename: `invoice-${createdBill?.bill.referenceNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: [80, 150] as [number, number], orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(invoiceRef.current).save();
    }
  };

  const shareWhatsApp = () => {
    if (!createdBill) return;
    const billDate = createdBill.bill.billDate ? format(new Date(createdBill.bill.billDate), "dd/MM/yyyy HH:mm") : "";
    
    let itemsList = createdBill.items.map(item => 
      `${item.name} x${item.qty} = ${(item.price * item.qty).toFixed(2)} AED`
    ).join('%0A');
    
    const message = `*LIQUID WASHES LAUNDRY*%0A` +
      `Centra Market D/109, Al Dhanna City%0A` +
      `Al Ruwais, Abu Dhabi-UAE%0A` +
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
      `Thank you for your business!`;
    
    const phone = createdBill.bill.customerPhone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const downloadBillPDF = async (bill: Bill) => {
    setViewBillPDF(bill);
    setTimeout(async () => {
      if (billPdfRef.current) {
        const opt = {
          margin: 5,
          filename: `Bill-${bill.referenceNumber || bill.id}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: [80, 150] as [number, number], orientation: 'portrait' as const }
        };
        await html2pdf().set(opt).from(billPdfRef.current).save();
        setViewBillPDF(null);
        toast({ title: "PDF Downloaded", description: `Bill ${bill.referenceNumber || bill.id} saved` });
      }
    }, 300);
  };

  const sortedProducts = products?.sort((a, b) => a.name.localeCompare(b.name)) || [];

  return (
    <div className="flex flex-col h-screen">
      <TopBar 
        onSearch={() => {}}
        searchValue=""
        onAddClick={() => setIsCreateOpen(true)}
        addButtonLabel="Add Bill"
        pageTitle="Bills"
      />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="bills">Bills List</TabsTrigger>
            <TabsTrigger value="due">Due Customers</TabsTrigger>
            <TabsTrigger value="pricelist">Price List</TabsTrigger>
          </TabsList>

          <TabsContent value="bills">
            <div className="mb-4">
              <p className="text-muted-foreground">Track bill entries for customers.</p>
              <div className="mt-2 text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block">
                Total Bills: <span className="text-primary">{bills?.length || 0}</span>
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
            ) : bills?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
                <FileText className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">No bills found</h3>
                <p className="max-w-md text-center">Click 'Add Bill' to create your first bill.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bills?.map((bill) => (
                  <Card key={bill.id} className="border-border/50 hover:shadow-md transition-shadow" data-testid={`card-bill-${bill.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">{bill.customerName || getClientName(bill.clientId!)}</CardTitle>
                          {bill.referenceNumber && (
                            <p className="text-xs text-muted-foreground mt-1">{bill.referenceNumber}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {!bill.isPaid && bill.clientId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLocation(`/orders?billId=${bill.id}&clientId=${bill.clientId}`)}
                              data-testid={`button-add-order-${bill.id}`}
                              title="Add Order to this Bill"
                            >
                              <ShoppingCart className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadBillPDF(bill)}
                            data-testid={`button-download-pdf-${bill.id}`}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(bill.id)}
                            data-testid="button-delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Amount</p>
                          <p className="text-lg font-bold text-primary">AED {parseFloat(bill.amount || "0").toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Date</p>
                          <p className="text-sm font-semibold text-foreground">{format(new Date(bill.billDate), "MMM dd, yyyy")}</p>
                        </div>
                      </div>
                      {bill.description && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Description</p>
                          <p className="text-sm text-foreground">{bill.description}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="due">
            <div className="mb-4">
              <p className="text-muted-foreground">Clients with outstanding balances.</p>
            </div>
            {(() => {
              const unpaidBills = bills?.filter(b => !b.isPaid) || [];
              const clientDueMap = new Map<number, { client: Client; bills: Bill[]; totalDue: number }>();
              
              unpaidBills.forEach(bill => {
                if (bill.clientId) {
                  const client = clients.find(c => c.id === bill.clientId);
                  if (client) {
                    const existing = clientDueMap.get(bill.clientId);
                    const billAmount = parseFloat(bill.amount || "0");
                    const paidAmount = parseFloat(bill.paidAmount || "0");
                    const dueAmount = billAmount - paidAmount;
                    
                    if (existing) {
                      existing.bills.push(bill);
                      existing.totalDue += dueAmount;
                    } else {
                      clientDueMap.set(bill.clientId, { client, bills: [bill], totalDue: dueAmount });
                    }
                  }
                }
              });
              
              const dueCustomers = Array.from(clientDueMap.values()).filter(d => d.totalDue > 0);
              const totalOutstanding = dueCustomers.reduce((sum, d) => sum + d.totalDue, 0);
              
              if (dueCustomers.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-card/50">
                    <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                    <h3 className="text-xl font-bold text-foreground mb-2">No due balances</h3>
                    <p className="max-w-md text-center">All clients are up to date with their payments.</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <span className="font-semibold text-orange-800 dark:text-orange-200">Total Outstanding</span>
                      </div>
                      <span className="text-xl font-bold text-orange-600 dark:text-orange-400">AED {totalOutstanding.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">{dueCustomers.length} customer{dueCustomers.length > 1 ? 's' : ''} with unpaid balance</p>
                  </div>
                  
                  {dueCustomers.map(({ client, bills, totalDue }) => (
                    <Card key={client.id} className="border-orange-200 dark:border-orange-800" data-testid={`card-due-client-${client.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                              <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{client.name}</CardTitle>
                              {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Balance Due</p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">AED {totalDue.toFixed(2)}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Unpaid Bills ({bills.length})</p>
                          {bills.map(bill => {
                            const billAmt = parseFloat(bill.amount || "0");
                            const paidAmt = parseFloat(bill.paidAmount || "0");
                            return (
                              <div key={bill.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                                <div>
                                  <span className="font-medium">{bill.referenceNumber || `Bill #${bill.id}`}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {format(new Date(bill.billDate), "MMM dd, yyyy")}
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
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="pricelist">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Laundry Price List
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Item</TableHead>
                        <TableHead className="text-right font-bold">Price (AED)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedProducts.map(product => (
                        <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {parseFloat(product.price || "0").toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-visible flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-primary">Create New Bill</DialogTitle>
            <DialogDescription>Select items and client to create a bill</DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-4 flex-1 overflow-visible">
            <div className="flex-1 overflow-visible flex flex-col">
              <div className="grid grid-cols-2 gap-2 mb-4 relative z-50">
                <div>
                  <Label>Select Client</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(value) => {
                      setSelectedClientId(value);
                      if (value === "walkin") {
                        setCustomerName("Walk-in Customer");
                        setCustomerPhone("");
                      } else if (value) {
                        const client = clients.find(c => c.id === parseInt(value));
                        if (client) {
                          setCustomerName(client.name);
                          setCustomerPhone(client.phone || "");
                        }
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Choose a client..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100] max-h-[300px]">
                      <SelectItem value="walkin">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Walk-in Customer
                        </div>
                      </SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {client.name} - {client.phone}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Customer phone"
                    data-testid="input-customer-phone"
                    disabled={selectedClientId !== "" && selectedClientId !== "walkin"}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <Label>Select Items</Label>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowNewItemDialog(true)}
                  data-testid="button-new-item"
                >
                  <PlusCircle className="w-4 h-4 mr-1" />
                  New Item
                </Button>
              </div>
              <ScrollArea className="flex-1 border rounded-lg p-2">
                <div className="grid grid-cols-3 gap-2">
                  {sortedProducts.map(product => {
                    const qty = selectedItems[product.id] || 0;
                    return (
                      <div 
                        key={product.id} 
                        className={`p-2 border rounded-lg text-center ${qty > 0 ? 'border-primary bg-primary/5' : ''}`}
                        data-testid={`item-${product.id}`}
                      >
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-xs text-primary font-bold">{parseFloat(product.price || "0").toFixed(2)}</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-6 w-6"
                            onClick={() => updateItemQty(product.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{qty}</span>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-6 w-6"
                            onClick={() => updateItemQty(product.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="w-64 border-l pl-4 flex flex-col">
              <h3 className="font-bold mb-2">Bill Summary</h3>
              <div className="flex-1 overflow-auto border rounded-lg p-2 mb-2">
                {Object.entries(selectedItems)
                  .filter(([_, qty]) => qty > 0)
                  .map(([productId, qty]) => {
                    const product = products?.find(p => p.id === parseInt(productId));
                    const subtotal = parseFloat(product?.price || "0") * qty;
                    return (
                      <div key={productId} className="flex justify-between text-sm py-1 border-b">
                        <span>{product?.name} x{qty}</span>
                        <span className="font-medium">{subtotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
              </div>

              <div className="mb-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={billDescription}
                  onChange={(e) => setBillDescription(e.target.value)}
                  placeholder="Additional notes"
                  data-testid="input-bill-notes"
                />
              </div>

              <div className="border-t pt-2 mb-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{calculateTotal().toFixed(2)} AED</span>
                </div>
              </div>

              <Button 
                onClick={handleCreateBill}
                disabled={createBillMutation.isPending}
                className="w-full"
                data-testid="button-create-bill"
              >
                {createBillMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Receipt className="w-4 h-4 mr-2" />
                )}
                Create Bill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdBill} onOpenChange={(open) => !open && setCreatedBill(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Bill Created Successfully
            </DialogTitle>
            <DialogDescription>Invoice generated - download or share</DialogDescription>
          </DialogHeader>

          <div ref={invoiceRef} className="bg-white p-4 rounded-lg border text-black" style={{ fontFamily: 'Courier New, monospace', fontSize: '11px' }}>
            <div className="text-center border-b pb-2 mb-2">
              <div className="font-bold text-sm">LIQUID WASHES LAUNDRY</div>
              <div className="text-xs">Centra Market D/109, Al Dhanna City</div>
              <div className="text-xs">Al Ruwais, Abu Dhabi-UAE</div>
            </div>
            <div className="text-center font-bold mb-2">INVOICE</div>
            <div className="text-xs mb-2">
              <div>Ref: {createdBill?.bill.referenceNumber}</div>
              <div>Date: {createdBill?.bill.billDate ? format(new Date(createdBill.bill.billDate), "dd/MM/yyyy HH:mm") : ""}</div>
              <div>Customer: {createdBill?.bill.customerName}</div>
            </div>
            <div className="border-t border-b py-1 mb-2">
              {createdBill?.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.name} x{item.qty}</span>
                  <span>{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold">
              <span>TOTAL:</span>
              <span>AED {parseFloat(createdBill?.bill.amount || "0").toFixed(2)}</span>
            </div>
            <div className="text-center mt-3 text-xs">Thank you for your business!</div>
            <div className="text-center mt-2 text-xs font-bold">For Orders/Delivery: +971 50 123 4567</div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={generatePDF} className="flex-1" data-testid="button-download-invoice">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={shareWhatsApp} variant="outline" className="flex-1 text-green-600" data-testid="button-share-whatsapp">
              <SiWhatsapp className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setCreatedBill(null)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {viewBillPDF && (
        <div className="fixed left-[-9999px]">
          <div ref={billPdfRef} className="bg-white p-4 rounded-lg border text-black" style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', width: '70mm' }}>
            <div className="text-center border-b pb-2 mb-2">
              <div className="font-bold text-sm">LIQUID WASHES LAUNDRY</div>
              <div className="text-xs">Centra Market D/109, Al Dhanna City</div>
              <div className="text-xs">Al Ruwais, Abu Dhabi-UAE</div>
            </div>
            <div className="text-center font-bold mb-2">INVOICE</div>
            <div className="text-xs mb-2">
              <div>Ref: {viewBillPDF.referenceNumber || viewBillPDF.id}</div>
              <div>Date: {viewBillPDF.billDate ? format(new Date(viewBillPDF.billDate), "dd/MM/yyyy HH:mm") : ""}</div>
              <div>Customer: {viewBillPDF.customerName || getClientName(viewBillPDF.clientId!)}</div>
              {viewBillPDF.customerPhone && <div>Phone: {viewBillPDF.customerPhone}</div>}
            </div>
            <div className="border-t border-b py-1 mb-2">
              <div className="text-xs">{viewBillPDF.description}</div>
            </div>
            <div className="flex justify-between font-bold">
              <span>TOTAL:</span>
              <span>AED {parseFloat(viewBillPDF.amount || "0").toFixed(2)}</span>
            </div>
            <div className="text-center mt-3 text-xs">Thank you for your business!</div>
            <div className="text-center mt-2 text-xs font-bold">For Orders/Delivery: +971 50 123 4567</div>
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
              Create a new item for the price list
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
                {isCreatingProduct && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatorPinDialog} onOpenChange={(open) => {
        setShowCreatorPinDialog(open);
        if (!open) {
          setCreatorPin("");
          setCreatorPinError("");
        }
      }}>
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
                type="password"
                value={creatorPin}
                onChange={(e) => {
                  setCreatorPin(e.target.value);
                  setCreatorPinError("");
                }}
                placeholder="Enter your PIN"
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCreatorPin()}
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
                {verifyCreatorPinMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Bill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
