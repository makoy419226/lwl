import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, Package, Shirt, CheckCircle2, Truck, Clock, 
  AlertTriangle, Plus, Minus, Search, Bell, Printer, User, Receipt, Download, Camera, Image, X, Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OrderReceipt } from "@/components/OrderReceipt";
import type { Order, Client, Product, Bill } from "@shared/schema";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [packingPinDialog, setPackingPinDialog] = useState<{ orderId: number } | null>(null);
  const [packingPin, setPackingPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [packingNotes, setPackingNotes] = useState("");
  const [deliveryPinDialog, setDeliveryPinDialog] = useState<{ orderId: number } | null>(null);
  const [deliveryPin, setDeliveryPin] = useState("");
  const [deliveryPinError, setDeliveryPinError] = useState("");
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [deliveryPhotoPreviews, setDeliveryPhotoPreviews] = useState<string[]>([]);
  const [tagPinDialog, setTagPinDialog] = useState<{ orderId: number } | null>(null);
  const [tagPin, setTagPin] = useState("");
  const [tagPinError, setTagPinError] = useState("");
  const [newCreatedOrder, setNewCreatedOrder] = useState<Order | null>(null);
  const [reportStartDate, setReportStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [viewPhotoOrder, setViewPhotoOrder] = useState<Order | null>(null);
  const pdfReceiptRef = useRef<HTMLDivElement>(null);
  const reportTableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: dueSoonOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders/due-soon"],
    refetchInterval: 60000,
  });

  const { data: bills } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const getClientBills = (clientId: number) => {
    return bills?.filter(b => b.clientId === clientId) || [];
  };

  const getClientUnpaidBills = (clientId: number) => {
    return getClientBills(clientId).filter(b => !b.isPaid);
  };

  const parseOrderItems = (itemsString: string | null) => {
    if (!itemsString) return [];
    return itemsString.split(", ").map(item => {
      const match = item.match(/^(.+)\s+x(\d+)$/);
      if (match) {
        return { name: match[1], quantity: parseInt(match[2]) };
      }
      return { name: item, quantity: 1 };
    });
  };

  const getProductImage = (productName: string) => {
    const product = products?.find(p => 
      p.name.toLowerCase() === productName.toLowerCase()
    );
    return product?.imageUrl;
  };

  useEffect(() => {
    if (dueSoonOrders && dueSoonOrders.length > 0) {
      toast({
        title: "Delivery Alert",
        description: `${dueSoonOrders.length} order(s) due for delivery soon!`,
        variant: "destructive",
      });
    }
  }, [dueSoonOrders?.length]);

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/orders/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order Updated", description: "Status updated successfully" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: (createdOrder: Order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateOpen(false);
      setNewCreatedOrder(createdOrder);
      toast({ title: "Order Created", description: "New order has been created. Generating PDF..." });
    },
  });

  const generatePDF = async () => {
    if (pdfReceiptRef.current && newCreatedOrder) {
      const opt = {
        margin: 8,
        filename: `Order_${newCreatedOrder.orderNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a5' as const, orientation: 'portrait' as const }
      };
      
      try {
        await html2pdf().set(opt).from(pdfReceiptRef.current).save();
        toast({ title: "PDF Downloaded", description: `Order ${newCreatedOrder.orderNumber} PDF saved` });
      } catch (err) {
        toast({ title: "PDF Error", description: "Failed to generate PDF", variant: "destructive" });
      }
    }
  };

  const generateTagReceipt = (order: Order) => {
    const client = clients?.find(c => c.id === order.clientId);
    const isUrgent = order.urgent;
    const parsedItems = parseOrderItems(order.items);
    
    const previousBills = bills?.filter(b => b.clientId === order.clientId) || [];
    const unpaidBills = previousBills.filter(b => !b.isPaid);
    const totalPreviousDue = unpaidBills.reduce((sum, b) => {
      const billTotal = parseFloat(b.amount) || 0;
      const billPaid = parseFloat(b.paidAmount || '0') || 0;
      return sum + (billTotal - billPaid);
    }, 0);
    
    const itemsHtml = parsedItems.map((item, idx) => 
      `<tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 5px 4px; font-size: 9px;">${idx + 1}</td>
        <td style="padding: 5px 4px; font-size: 9px;">${item.name}</td>
        <td style="padding: 5px 4px; font-size: 9px; text-align: center; font-weight: bold;">${item.quantity}</td>
        <td style="padding: 5px 4px; font-size: 9px; text-align: right;">${item.quantity} pcs</td>
      </tr>`
    ).join('');
    
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; max-width: 148mm; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 10px; margin-top: 4px; color: #666;">Professional Laundry Services - UAE</div>
          <div style="font-size: 9px; margin-top: 2px; color: #888;">For Orders/Delivery: +971 50 123 4567</div>
        </div>
        
        ${isUrgent ? `<div style="text-align: center; padding: 8px; margin: 10px 0; background: #fef2f2; border: 2px solid #dc2626; font-weight: bold; color: #dc2626; font-size: 12px; border-radius: 4px;">*** URGENT ORDER ***</div>` : ''}
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <div style="flex: 1;">
            <div style="font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 3px;">Order Number</div>
            <div style="font-size: 20px; font-weight: bold; color: #000; border: 2px dashed #000; padding: 8px 12px; display: inline-block;">${order.orderNumber}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; color: #666;">Entry Date</div>
            <div style="font-size: 11px; font-weight: bold;">${format(new Date(order.entryDate), "dd MMM yyyy")}</div>
            <div style="font-size: 10px; color: #666;">${format(new Date(order.entryDate), "hh:mm a")}</div>
            ${order.expectedDeliveryAt ? `
            <div style="font-size: 9px; color: #666; margin-top: 5px;">Expected Delivery</div>
            <div style="font-size: 11px; font-weight: bold; color: #2563eb;">${format(new Date(order.expectedDeliveryAt), "dd MMM yyyy")}</div>
            ` : ''}
          </div>
        </div>
        
        <div style="background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 10px; margin-bottom: 15px;">
          <div style="font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">Client Information</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <div style="font-size: 8px; color: #888;">Name</div>
              <div style="font-size: 12px; font-weight: bold;">${client?.name || order.customerName || 'Walk-in Customer'}</div>
            </div>
            <div>
              <div style="font-size: 8px; color: #888;">Phone</div>
              <div style="font-size: 12px; font-weight: bold;">${client?.phone || '-'}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 8px; color: #888;">Address</div>
              <div style="font-size: 10px;">${client?.address || '-'}</div>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 15px;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 4px;">ITEMS DETAIL</div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 6px 4px; text-align: left; font-size: 9px; border-bottom: 1px solid #000; width: 30px;">#</th>
                <th style="padding: 6px 4px; text-align: left; font-size: 9px; border-bottom: 1px solid #000;">Item Description</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 9px; border-bottom: 1px solid #000; width: 40px;">Qty</th>
                <th style="padding: 6px 4px; text-align: right; font-size: 9px; border-bottom: 1px solid #000; width: 60px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8f9fa; border-top: 1px solid #000;">
                <td colspan="2" style="padding: 6px 4px; font-size: 10px; font-weight: bold;">Total: ${parsedItems.reduce((sum, item) => sum + item.quantity, 0)} pcs</td>
                <td colspan="2" style="padding: 6px 4px; font-size: 12px; font-weight: bold; text-align: right;">AED ${parseFloat(order.totalAmount).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        ${order.discountPercent && parseFloat(order.discountPercent) > 0 ? `
        <div style="text-align: right; margin-bottom: 5px;">
          <span style="font-size: 10px; color: #666;">Discount: </span>
          <span style="font-size: 11px; font-weight: bold; color: #16a34a;">${order.discountPercent}%</span>
        </div>
        ` : ''}
        
        ${order.tips && parseFloat(order.tips) > 0 ? `
        <div style="text-align: right; margin-bottom: 5px;">
          <span style="font-size: 10px; color: #666;">Tips: </span>
          <span style="font-size: 11px; font-weight: bold;">AED ${parseFloat(order.tips).toFixed(2)}</span>
        </div>
        ` : ''}
        
        ${totalPreviousDue > 0 ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px; margin-bottom: 10px;">
          <div style="font-size: 10px; font-weight: bold; color: #856404; margin-bottom: 4px;">PREVIOUS OUTSTANDING DUES</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 9px; color: #856404;">${unpaidBills.length} unpaid bill(s)</span>
            <span style="font-size: 12px; font-weight: bold; color: #dc3545;">AED ${totalPreviousDue.toFixed(2)}</span>
          </div>
        </div>
        ` : ''}
        
        ${order.notes ? `
        <div style="background: #e8f4fd; border: 1px solid #90cdf4; border-radius: 4px; padding: 8px; margin-bottom: 10px;">
          <div style="font-size: 9px; font-weight: bold; color: #2b6cb0; margin-bottom: 3px;">ORDER NOTES</div>
          <div style="font-size: 10px;">${order.notes}</div>
        </div>
        ` : ''}
        
        <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
          <div>
            <div style="font-size: 8px; color: #888;">Packing</div>
            <div style="font-size: 10px; font-weight: bold;">${order.packingDone ? 'Done' : 'Pending'}</div>
          </div>
          <div>
            <div style="font-size: 8px; color: #888;">Status</div>
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">${order.status}</div>
          </div>
          <div>
            <div style="font-size: 8px; color: #888;">Tag</div>
            <div style="font-size: 10px; font-weight: bold; color: ${order.tagDone ? '#16a34a' : '#dc2626'};">${order.tagDone ? 'Done' : 'Pending'}</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #000; color: #888; font-size: 8px;">
          <div>Thank you for choosing Liquid Washes Laundry</div>
          <div style="margin-top: 4px; font-weight: bold; color: #000; font-size: 9px;">For Orders/Delivery: +971 50 123 4567</div>
          <div style="margin-top: 3px;">Generated on ${format(new Date(), "dd MMM yyyy 'at' hh:mm a")}</div>
        </div>
      </div>
    `;
    
    const opt = {
      margin: 8,
      filename: `Tag_${order.orderNumber}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a5' as const, orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(content).save();
    toast({ title: "Tag Downloaded", description: `Tag for ${order.orderNumber} saved` });
  };

  const generateWashingReceipt = (order: Order) => {
    const client = clients?.find(c => c.id === order.clientId);
    const isUrgent = order.urgent;
    
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-family: 'Courier New', monospace; padding: 10px; width: 70mm; font-size: 11px; color: #000;">
        <div style="text-align: center; border-bottom: 2px dashed ${isUrgent ? '#dc2626' : '#000'}; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: bold; color: ${isUrgent ? '#dc2626' : '#000'};">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 9px; margin-top: 3px;">WASHING SECTION</div>
        </div>
        
        ${isUrgent ? `
        <div style="text-align: center; padding: 8px; margin: 8px 0; background: #fef2f2; border: 2px solid #dc2626; font-weight: bold; color: #dc2626; font-size: 14px;">
          *** URGENT ORDER ***
        </div>
        ` : ''}
        
        <div style="text-align: center; font-size: 18px; font-weight: bold; padding: 10px; border: 2px dashed #000; margin: 10px 0; color: ${isUrgent ? '#dc2626' : '#000'};">
          ${order.orderNumber}
        </div>
        
        <div style="margin: 10px 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">
          <div style="margin-bottom: 5px;"><strong>Client:</strong> ${client?.name || 'Walk-in'}</div>
          <div style="margin-bottom: 5px;"><strong>Phone:</strong> ${client?.phone || order.customerName || '-'}</div>
          <div><strong>Date:</strong> ${format(new Date(order.entryDate), "dd/MM/yyyy HH:mm")}</div>
        </div>
        
        <div style="margin: 10px 0; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">ITEMS FOR WASHING:</div>
          <div style="line-height: 1.8; font-size: 12px;">
            ${order.items?.split(',').map(item => `<div style="padding: 3px 0; border-bottom: 1px dotted #ccc;">${item.trim()}</div>`).join('') || 'No items'}
          </div>
        </div>
        
        ${order.notes ? `
        <div style="margin: 10px 0; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 10px;">NOTES:</div>
          <div style="font-size: 11px;">${order.notes}</div>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000; font-size: 9px; color: #666;">
          <div>Printed: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
          <div style="font-weight: bold; color: #000; font-size: 10px; margin-top: 5px;">Orders/Delivery: +971 50 123 4567</div>
        </div>
      </div>
    `;
    
    const opt = {
      margin: 2,
      filename: `Washing_${order.orderNumber}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: [80, 150] as [number, number], orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(content).save();
    toast({ title: "Washing Receipt Downloaded", description: `Thermal receipt for ${order.orderNumber} saved` });
  };

  useEffect(() => {
    if (newCreatedOrder && pdfReceiptRef.current) {
      const timer = setTimeout(() => {
        generatePDF();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [newCreatedOrder]);

  const exportReportToExcel = (dateItemMap: Record<string, Record<string, number>>, sortedDates: string[], sortedItems: string[], itemTotals: Record<string, number>) => {
    const wsData: (string | number)[][] = [];
    
    wsData.push(["Item Quantity Report", "", "", `From: ${reportStartDate} To: ${reportEndDate}`]);
    wsData.push([]);
    
    const headerRow: (string | number)[] = ["Item Name", ...sortedDates, "Total"];
    wsData.push(headerRow);
    
    sortedItems.forEach(itemName => {
      const row: (string | number)[] = [itemName];
      sortedDates.forEach(date => {
        row.push(dateItemMap[date][itemName] || 0);
      });
      row.push(itemTotals[itemName]);
      wsData.push(row);
    });
    
    const dailyTotalRow: (string | number)[] = ["Daily Total"];
    sortedDates.forEach(date => {
      dailyTotalRow.push(Object.values(dateItemMap[date]).reduce((sum, qty) => sum + qty, 0));
    });
    dailyTotalRow.push(Object.values(itemTotals).reduce((sum, qty) => sum + qty, 0));
    wsData.push(dailyTotalRow);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Report");
    XLSX.writeFile(wb, `Item_Report_${reportStartDate}_to_${reportEndDate}.xlsx`);
    toast({ title: "Excel Downloaded", description: "Item report exported to Excel" });
  };

  const exportReportToPDF = () => {
    if (reportTableRef.current) {
      const opt = {
        margin: 10,
        filename: `Item_Report_${reportStartDate}_to_${reportEndDate}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
      };
      
      html2pdf().set(opt).from(reportTableRef.current).save();
      toast({ title: "PDF Downloaded", description: "Item report exported to PDF" });
    }
  };

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/packing/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && packingPinDialog) {
        const existingOrder = orders?.find(o => o.id === packingPinDialog.orderId);
        const combinedNotes = packingNotes 
          ? (existingOrder?.notes ? `${existingOrder.notes}\n[Packing: ${packingNotes}]` : `[Packing: ${packingNotes}]`)
          : existingOrder?.notes;
        updateOrderMutation.mutate({
          id: packingPinDialog.orderId,
          updates: {
            packingDone: true,
            packingDate: new Date().toISOString(),
            packingBy: data.worker.name,
            packingWorkerId: data.worker.id,
            notes: combinedNotes,
          },
        });
        setPackingPinDialog(null);
        setPackingPin("");
        setPinError("");
        setPackingNotes("");
      }
    },
    onError: () => {
      setPinError("Invalid PIN. Please try again.");
    },
  });

  const handlePackingWithPin = (orderId: number) => {
    setPackingPinDialog({ orderId });
    setPackingPin("");
    setPinError("");
    setPackingNotes("");
  };

  const submitPackingPin = () => {
    if (packingPin.length !== 5) {
      setPinError("PIN must be 5 digits");
      return;
    }
    verifyPinMutation.mutate(packingPin);
  };

  const verifyDeliveryPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/delivery/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && deliveryPinDialog) {
        updateOrderMutation.mutate({
          id: deliveryPinDialog.orderId,
          updates: {
            delivered: true,
            deliveryDate: new Date().toISOString(),
            deliveryBy: data.worker.name,
            deliveredByWorkerId: data.worker.id,
            deliveryPhoto: deliveryPhotos[0] || null,
            deliveryPhotos: deliveryPhotos.length > 0 ? deliveryPhotos : null,
          },
        });
        setDeliveryPinDialog(null);
        setDeliveryPin("");
        setDeliveryPinError("");
        setDeliveryPhotos([]);
        setDeliveryPhotoPreviews([]);
      }
    },
    onError: () => {
      setDeliveryPinError("Invalid PIN. Please try again.");
    },
  });

  const handleDeliveryPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (deliveryPhotos.length >= 1) {
        toast({ title: "Maximum Photos", description: "You can only upload 1 photo", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Photo must be less than 5MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setDeliveryPhotos(prev => [...prev, base64]);
        setDeliveryPhotoPreviews(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeDeliveryPhoto = (index: number) => {
    setDeliveryPhotos(prev => prev.filter((_, i) => i !== index));
    setDeliveryPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearDeliveryPhotos = () => {
    setDeliveryPhotos([]);
    setDeliveryPhotoPreviews([]);
  };

  const handleDeliveryWithPin = (orderId: number) => {
    setDeliveryPinDialog({ orderId });
    setDeliveryPin("");
    setDeliveryPinError("");
  };

  const submitDeliveryPin = () => {
    if (deliveryPin.length !== 5) {
      setDeliveryPinError("PIN must be 5 digits");
      return;
    }
    verifyDeliveryPinMutation.mutate(deliveryPin);
  };

  const verifyTagPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/delivery/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && tagPinDialog) {
        updateOrderMutation.mutate({
          id: tagPinDialog.orderId,
          updates: {
            tagDone: true,
            tagDate: new Date().toISOString(),
            tagBy: data.worker.name,
          },
        });
        setTagPinDialog(null);
        setTagPin("");
        setTagPinError("");
      }
    },
    onError: () => {
      setTagPinError("Invalid PIN. Please try again.");
    },
  });

  const handleTagWithPin = (orderId: number) => {
    setTagPinDialog({ orderId });
    setTagPin("");
    setTagPinError("");
  };

  const submitTagPin = () => {
    if (tagPin.length !== 5) {
      setTagPinError("PIN must be 5 digits");
      return;
    }
    verifyTagPinMutation.mutate(tagPin);
  };

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = !searchTerm || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "create") return matchesSearch && !order.tagDone;
    if (activeTab === "tag-complete") return matchesSearch && order.tagDone && !order.packingDone;
    if (activeTab === "packing-done") return matchesSearch && order.packingDone && !order.delivered;
    if (activeTab === "delivery") return matchesSearch && order.delivered;
    return matchesSearch;
  });

  const getStatusBadge = (order: Order) => {
    if (order.delivered) return <Badge className="bg-green-500">Delivered</Badge>;
    if (order.packingDone) return <Badge className="bg-purple-500">Ready</Badge>;
    if (order.tagDone) return <Badge className="bg-blue-500">Washing</Badge>;
    return <Badge className="bg-orange-500">Tag Pending</Badge>;
  };

  const getTimeRemaining = (expectedDeliveryAt: Date | null) => {
    if (!expectedDeliveryAt) return null;
    const now = new Date();
    const diff = new Date(expectedDeliveryAt).getTime() - now.getTime();
    if (diff <= 0) return <Badge variant="destructive" className="animate-pulse">Overdue</Badge>;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return <Badge variant="secondary">{hours}h {minutes % 60}m</Badge>;
    }
    if (minutes <= 30) {
      return <Badge variant="destructive" className="animate-pulse">{minutes}m</Badge>;
    }
    return <Badge variant="secondary">{minutes}m</Badge>;
  };

  const handleStatusUpdate = (orderId: number, field: string, value: boolean) => {
    const updates: any = { [field]: value };
    if (value) {
      updates[field.replace('Done', 'Date').replace('delivered', 'deliveryDate')] = new Date().toISOString();
    }
    updateOrderMutation.mutate({ id: orderId, updates });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Order Tracking
          </h1>
          <div className="flex items-center gap-4">
            {dueSoonOrders && dueSoonOrders.length > 0 && (
              <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                <Bell className="w-4 h-4" />
                {dueSoonOrders.length} Due Soon
              </Badge>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-orders"
              />
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-order">
                  <Plus className="w-4 h-4 mr-2" />
                  New Order
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                </DialogHeader>
                <OrderForm 
                  clients={clients || []} 
                  onSubmit={(data) => createOrderMutation.mutate(data)}
                  isLoading={createOrderMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Shirt className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entry</p>
                  <p className="text-2xl font-bold" data-testid="text-entry-count">
                    {orders?.filter(o => !o.washingDone).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Washing</p>
                  <p className="text-2xl font-bold" data-testid="text-washing-count">
                    {orders?.filter(o => o.washingDone && !o.packingDone).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Packing</p>
                  <p className="text-2xl font-bold" data-testid="text-packing-count">
                    {orders?.filter(o => o.packingDone && !o.delivered).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold" data-testid="text-delivered-count">
                    {orders?.filter(o => o.delivered).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="create" className="bg-blue-100 dark:bg-blue-900/30 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Plus className="w-4 h-4 mr-1" />
              1. Create Order
            </TabsTrigger>
            <TabsTrigger value="tag-complete" className="bg-orange-100 dark:bg-orange-900/30 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Tag className="w-4 h-4 mr-1" />
              2. Tag Complete
            </TabsTrigger>
            <TabsTrigger value="packing-done" className="bg-green-100 dark:bg-green-900/30 data-[state=active]:bg-green-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1" />
              3. Packing Done
            </TabsTrigger>
            <TabsTrigger value="delivery" className="bg-purple-100 dark:bg-purple-900/30 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              <Truck className="w-4 h-4 mr-1" />
              4. Delivery
            </TabsTrigger>
            <TabsTrigger value="item-report">Item Report</TabsTrigger>
          </TabsList>

          {activeTab !== "item-report" && (
          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : filteredOrders?.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No orders found</p>
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Client Due</TableHead>
                      <TableHead>Items</TableHead>
                      {activeTab !== "create" && <TableHead>Amount</TableHead>}
                      <TableHead>Type</TableHead>
                      <TableHead>Time Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const groupedOrders = filteredOrders?.reduce((acc, order) => {
                        const groupKey = order.clientId ? `client-${order.clientId}` : `walkin-${order.customerName || 'unknown'}`;
                        if (!acc[groupKey]) {
                          acc[groupKey] = [];
                        }
                        acc[groupKey].push(order);
                        return acc;
                      }, {} as Record<string, typeof filteredOrders>);

                      return Object.entries(groupedOrders || {}).map(([groupKey, clientOrders]) => {
                        const isWalkIn = groupKey.startsWith('walkin-');
                        const clientId = isWalkIn ? null : parseInt(groupKey.replace('client-', ''));
                        const client = clientId ? clients?.find(c => c.id === clientId) : null;
                        const orderCount = clientOrders?.length || 0;
                        const displayName = client?.name || clientOrders?.[0]?.customerName || 'Walk-in Customer';
                        
                        return clientOrders?.map((order, idx) => (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell className="font-mono font-bold">{order.orderNumber}</TableCell>
                            {idx === 0 ? (
                              <>
                                <TableCell rowSpan={orderCount} className="align-top border-r p-0">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" className="w-full h-full justify-start px-4 py-2 font-semibold hover-elevate" data-testid={`button-client-${client?.id || 'walkin'}`}>
                                        <User className="w-4 h-4 mr-2" />
                                        {displayName}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80" align="start">
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <User className="w-5 h-5 text-primary" />
                                          <div>
                                            <p className="font-semibold">{client?.name}</p>
                                            <p className="text-sm text-muted-foreground">{client?.phone}</p>
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">Total Due:</span>
                                          <span className={`font-bold ${parseFloat(client?.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`}>
                                            {parseFloat(client?.balance || "0").toFixed(2)} AED
                                          </span>
                                        </div>
                                        {client && getClientUnpaidBills(client.id).length > 0 && (
                                          <div className="space-y-2">
                                            <p className="text-sm font-medium flex items-center gap-1">
                                              <Receipt className="w-4 h-4" /> Unpaid Bills:
                                            </p>
                                            <ScrollArea className="h-32">
                                              <div className="space-y-1">
                                                {getClientUnpaidBills(client.id).map(bill => (
                                                  <div key={bill.id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-2 py-1">
                                                    <span className="text-muted-foreground">
                                                      {format(new Date(bill.billDate), "dd/MM/yy")}
                                                    </span>
                                                    <span className="font-medium text-destructive">
                                                      {parseFloat(bill.amount).toFixed(2)} AED
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </ScrollArea>
                                          </div>
                                        )}
                                        {client && getClientUnpaidBills(client.id).length === 0 && (
                                          <p className="text-sm text-muted-foreground text-center py-2">No unpaid bills</p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell rowSpan={orderCount} className={`align-top font-semibold border-r ${parseFloat(client?.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`} data-testid={`text-client-due-${order.id}`}>
                                  {parseFloat(client?.balance || "0").toFixed(2)} AED
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell className={activeTab === "create" ? "max-w-md" : "max-w-xs"}>
                              {activeTab === "create" ? (
                                <div className="space-y-1">
                                  {parseOrderItems(order.items).map((item, i) => {
                                    const imageUrl = getProductImage(item.name);
                                    return (
                                      <div key={i} className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md px-2 py-1">
                                        {imageUrl ? (
                                          <img src={imageUrl} alt={item.name} className="w-6 h-6 object-contain" />
                                        ) : (
                                          <Shirt className="w-6 h-6 text-orange-500" />
                                        )}
                                        <span className="text-sm font-medium flex-1">{item.name}</span>
                                        <Badge className="bg-orange-500 text-white">{item.quantity} pcs</Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {parseOrderItems(order.items).map((item, i) => {
                                    const imageUrl = getProductImage(item.name);
                                    return (
                                      <div key={i} className="flex items-center gap-1 bg-muted/50 rounded px-1.5 py-0.5">
                                        {imageUrl ? (
                                          <img src={imageUrl} alt={item.name} className="w-4 h-4 object-contain" />
                                        ) : (
                                          <Shirt className="w-4 h-4 text-muted-foreground" />
                                        )}
                                        <span className="text-xs">{item.name}</span>
                                        <Badge variant="secondary" className="text-xs px-1 py-0 h-4">{item.quantity}</Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                            {activeTab !== "create" && <TableCell className="font-semibold">{order.totalAmount} AED</TableCell>}
                            <TableCell>
                              {order.deliveryType === 'delivery' ? (
                                <Badge variant="outline" className="gap-1">
                                  <Truck className="w-3 h-3" /> Delivery
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Take Away</Badge>
                              )}
                            </TableCell>
                            <TableCell>{getTimeRemaining(order.expectedDeliveryAt)}</TableCell>
                            <TableCell>{getStatusBadge(order)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => setPrintOrder(order)}
                                  data-testid={`button-print-${order.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {!order.tagDone && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300"
                                      onClick={() => generateTagReceipt(order)}
                                      data-testid={`button-print-tag-${order.id}`}
                                    >
                                      <Tag className="w-3 h-3 mr-1" />
                                      Print Tag
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleTagWithPin(order.id)}
                                      data-testid={`button-tag-done-${order.id}`}
                                    >
                                      Tag Done
                                    </Button>
                                  </>
                                )}
                                {order.tagDone && !order.packingDone && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300"
                                      onClick={() => generateWashingReceipt(order)}
                                      data-testid={`button-washing-receipt-${order.id}`}
                                    >
                                      <Printer className="w-3 h-3 mr-1" />
                                      Washing
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handlePackingWithPin(order.id)}
                                      data-testid={`button-packing-${order.id}`}
                                    >
                                      Packing Done
                                    </Button>
                                  </>
                                )}
                                {order.packingDone && !order.delivered && (
                                  <Button 
                                    size="sm" 
                                    variant="default"
                                    onClick={() => handleDeliveryWithPin(order.id)}
                                    data-testid={`button-deliver-${order.id}`}
                                  >
                                    <Truck className="w-3 h-3 mr-1" />
                                    Deliver
                                  </Button>
                                )}
                                {order.delivered && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-green-600">Completed</Badge>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      onClick={() => setViewPhotoOrder(order)}
                                      data-testid={`button-view-photo-${order.id}`}
                                      title={order.deliveryPhoto ? "View Delivery Photo" : "No photo available"}
                                    >
                                      <Camera className={`w-4 h-4 ${(order.deliveryPhotos && order.deliveryPhotos.length > 0) || order.deliveryPhoto ? "text-blue-900 dark:text-blue-400" : "text-red-500"}`} />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setNewCreatedOrder(order);
                                      }}
                                      data-testid={`button-invoice-${order.id}`}
                                    >
                                      <Receipt className="w-3 h-3 mr-1" />
                                      Invoice
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      });
                    })()}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
          )}

          {activeTab === "item-report" && (
            <TabsContent value="item-report" forceMount>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Item Quantity Report (Date-wise)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-start">From:</Label>
                      <Input
                        id="report-start"
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-40"
                        data-testid="input-report-start-date"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-end">To:</Label>
                      <Input
                        id="report-end"
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-40"
                        data-testid="input-report-end-date"
                      />
                    </div>
                  </div>

                  {(() => {
                    const startDate = new Date(reportStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(reportEndDate);
                    endDate.setHours(23, 59, 59, 999);

                    const filteredOrdersForReport = orders?.filter(order => {
                      const orderDate = new Date(order.entryDate);
                      return orderDate >= startDate && orderDate <= endDate;
                    }) || [];

                    const dateItemMap: Record<string, Record<string, number>> = {};
                    const allItems: Set<string> = new Set();

                    filteredOrdersForReport.forEach(order => {
                      const dateKey = format(new Date(order.entryDate), "dd/MM/yyyy");
                      if (!dateItemMap[dateKey]) {
                        dateItemMap[dateKey] = {};
                      }
                      const items = parseOrderItems(order.items);
                      items.forEach(item => {
                        allItems.add(item.name);
                        dateItemMap[dateKey][item.name] = (dateItemMap[dateKey][item.name] || 0) + item.quantity;
                      });
                    });

                    const sortedDates = Object.keys(dateItemMap).sort((a, b) => {
                      const [dayA, monthA, yearA] = a.split('/').map(Number);
                      const [dayB, monthB, yearB] = b.split('/').map(Number);
                      return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
                    });

                    const sortedItems = Array.from(allItems).sort();

                    const itemTotals: Record<string, number> = {};
                    sortedItems.forEach(item => {
                      itemTotals[item] = Object.values(dateItemMap).reduce((sum, dateData) => sum + (dateData[item] || 0), 0);
                    });

                    if (filteredOrdersForReport.length === 0) {
                      return (
                        <div className="text-center py-10 text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No orders found in the selected date range</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="flex gap-2 mb-4">
                          <Button 
                            variant="outline" 
                            onClick={() => exportReportToExcel(dateItemMap, sortedDates, sortedItems, itemTotals)}
                            data-testid="button-export-excel"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Excel
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={exportReportToPDF}
                            data-testid="button-export-pdf"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </Button>
                        </div>
                        <div ref={reportTableRef} className="border rounded-lg overflow-auto bg-white p-4">
                          <h3 className="text-lg font-bold mb-4">Item Quantity Report ({reportStartDate} to {reportEndDate})</h3>
                          <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-bold sticky left-0 bg-muted/50 z-10">Item Name</TableHead>
                              {sortedDates.map(date => (
                                <TableHead key={date} className="text-center font-bold min-w-[100px]">{date}</TableHead>
                              ))}
                              <TableHead className="text-center font-bold bg-primary/10 min-w-[100px]">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedItems.map(itemName => (
                              <TableRow key={itemName} data-testid={`row-item-${itemName}`}>
                                <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">{itemName}</TableCell>
                                {sortedDates.map(date => (
                                  <TableCell key={date} className="text-center">
                                    {dateItemMap[date][itemName] || "-"}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-bold bg-primary/10">
                                  {itemTotals[itemName]}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30 font-bold">
                              <TableCell className="sticky left-0 bg-muted/30 z-10 border-r">Daily Total</TableCell>
                              {sortedDates.map(date => (
                                <TableCell key={date} className="text-center">
                                  {Object.values(dateItemMap[date]).reduce((sum, qty) => sum + qty, 0)}
                                </TableCell>
                              ))}
                              <TableCell className="text-center bg-primary/20">
                                {Object.values(itemTotals).reduce((sum, qty) => sum + qty, 0)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {printOrder && (
        <OrderReceipt
          order={printOrder}
          client={clients?.find(c => c.id === printOrder.clientId)}
          onClose={() => setPrintOrder(null)}
        />
      )}

      {newCreatedOrder && (
        <Dialog open={!!newCreatedOrder} onOpenChange={(open) => !open && setNewCreatedOrder(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Order Created - {newCreatedOrder.orderNumber}
              </DialogTitle>
              <DialogDescription>
                Your order has been created. The PDF is being generated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button onClick={generatePDF} variant="default" data-testid="button-download-pdf">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={() => generateWashingReceipt(newCreatedOrder)} variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-washing-receipt">
                <Printer className="w-4 h-4 mr-2" />
                Washing Receipt
              </Button>
              <Button onClick={() => { setPrintOrder(newCreatedOrder); setNewCreatedOrder(null); }} variant="outline">
                <Printer className="w-4 h-4 mr-2" />
                Print Full
              </Button>
              <Button onClick={() => setNewCreatedOrder(null)} variant="ghost">
                Close
              </Button>
            </div>
            <div ref={pdfReceiptRef} className="bg-white p-6 rounded-lg border">
              <div style={{ fontFamily: 'Arial, sans-serif', color: '#333' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '30px', borderBottom: '2px solid #1e40af', paddingBottom: '20px' }}>
                  <div style={{ width: '60px', height: '60px', background: '#1e40af', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style={{ width: '36px', height: '36px' }}>
                      <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.2"/>
                      <circle cx="12" cy="12" r="3" fill="white"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e40af', marginBottom: '6px' }}>Liquid Washes Laundry</div>
                    <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.5 }}>
                      Centra Market D/109, Al Dhanna City, Al Ruwais<br />
                      Abu Dhabi, UAE<br />
                      +971 50 123 4567
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', margin: '20px 0', color: '#1e40af' }}>ORDER RECEIPT</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e40af', textAlign: 'center', margin: '20px 0', padding: '10px', background: '#f3f4f6', borderRadius: '8px' }}>
                  {newCreatedOrder.orderNumber}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div style={{ width: '48%' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Client</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{clients?.find(c => c.id === newCreatedOrder.clientId)?.name || 'N/A'}</div>
                  </div>
                  <div style={{ width: '48%' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Date</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{format(new Date(newCreatedOrder.entryDate), "dd/MM/yyyy HH:mm")}</div>
                  </div>
                </div>
                <div style={{ margin: '20px 0', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '10px' }}>Items</div>
                  <div style={{ fontSize: '14px' }}>{newCreatedOrder.items}</div>
                </div>
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e5e5e5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '18px', fontWeight: 'bold', color: '#1e40af' }}>
                    <span>Total Amount</span>
                    <span>{parseFloat(newCreatedOrder.totalAmount).toFixed(2)} AED</span>
                  </div>
                </div>
                <div style={{ marginTop: '40px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e5e5e5' }}>
                  <p style={{ fontSize: '12px', color: '#666' }}>Thank you for choosing Liquid Washes Laundry!</p>
                  <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#000', marginTop: '8px' }}>For Orders/Delivery: +971 50 123 4567</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!packingPinDialog} onOpenChange={(open) => !open && setPackingPinDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-primary" />
              Enter Packing PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add notes if needed, then enter your PIN to confirm packing.
            </p>
            <Textarea
              placeholder="Notes (e.g., missing clothes, damage report...)"
              value={packingNotes}
              onChange={(e) => setPackingNotes(e.target.value)}
              className="min-h-[60px]"
              data-testid="input-packing-notes"
            />
            <Input
              type="password"
              maxLength={5}
              placeholder="Enter 5-digit PIN"
              value={packingPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                setPackingPin(val);
                setPinError("");
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitPackingPin()}
              className="text-center text-2xl tracking-widest"
              data-testid="input-packing-pin"
            />
            {pinError && (
              <p className="text-sm text-destructive text-center">{pinError}</p>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setPackingPinDialog(null)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={submitPackingPin}
                disabled={packingPin.length !== 5 || verifyPinMutation.isPending}
                data-testid="button-submit-pin"
              >
                {verifyPinMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tagPinDialog} onOpenChange={(open) => !open && setTagPinDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              Enter Tag PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your PIN to confirm all tags are done for this order.
            </p>
            <Input
              type="password"
              maxLength={5}
              placeholder="Enter 5-digit PIN"
              value={tagPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                setTagPin(val);
                setTagPinError("");
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitTagPin()}
              className="text-center text-2xl tracking-widest"
              data-testid="input-tag-pin"
            />
            {tagPinError && (
              <p className="text-sm text-destructive text-center">{tagPinError}</p>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setTagPinDialog(null)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-orange-500 hover:bg-orange-600"
                onClick={submitTagPin}
                disabled={tagPin.length !== 5 || verifyTagPinMutation.isPending}
                data-testid="button-submit-tag-pin"
              >
                {verifyTagPinMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Tag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deliveryPinDialog} onOpenChange={(open) => { 
        if (!open) { 
          setDeliveryPinDialog(null); 
          clearDeliveryPhotos(); 
        } 
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Confirm Delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Delivery Photo (Optional)
              </Label>
              
              {deliveryPhotoPreviews.length > 0 ? (
                <div className="relative w-full">
                  <img 
                    src={deliveryPhotoPreviews[0]} 
                    alt="Delivery proof" 
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => removeDeliveryPhoto(0)}
                    data-testid="button-remove-photo-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Click to add photo</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif,.webp,.bmp,.gif,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleDeliveryPhotoChange}
                    data-testid="input-delivery-photo"
                  />
                </label>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Enter Staff PIN</Label>
              <Input
                type="password"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={deliveryPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setDeliveryPin(val);
                  setDeliveryPinError("");
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitDeliveryPin()}
                className="text-center text-2xl tracking-widest"
                data-testid="input-delivery-pin"
              />
            </div>
            {deliveryPinError && (
              <p className="text-sm text-destructive text-center">{deliveryPinError}</p>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => { setDeliveryPinDialog(null); clearDeliveryPhotos(); }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={submitDeliveryPin}
                disabled={deliveryPin.length !== 5 || verifyDeliveryPinMutation.isPending}
                data-testid="button-submit-delivery-pin"
              >
                {verifyDeliveryPinMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPhotoOrder} onOpenChange={(open) => !open && setViewPhotoOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Delivery Photos - Order #{viewPhotoOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Photos captured at delivery confirmation
            </DialogDescription>
          </DialogHeader>
          {(viewPhotoOrder?.deliveryPhotos && viewPhotoOrder.deliveryPhotos.length > 0) || viewPhotoOrder?.deliveryPhoto ? (
            <div className="space-y-3">
              {viewPhotoOrder?.deliveryPhotos && viewPhotoOrder.deliveryPhotos.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {viewPhotoOrder.deliveryPhotos.map((photo, index) => (
                    <img 
                      key={index}
                      src={photo} 
                      alt={`Delivery proof ${index + 1}`} 
                      className="w-full max-h-[300px] rounded-lg object-contain border"
                      data-testid={`img-delivery-photo-${index}`}
                    />
                  ))}
                </div>
              ) : viewPhotoOrder?.deliveryPhoto ? (
                <div className="flex justify-center">
                  <img 
                    src={viewPhotoOrder.deliveryPhoto} 
                    alt="Delivery proof" 
                    className="max-w-full max-h-[400px] rounded-lg object-contain"
                    data-testid="img-delivery-photo"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Camera className="w-12 h-12 mb-2 opacity-50" />
              <p>No delivery photos available</p>
            </div>
          )}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setViewPhotoOrder(null)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderForm({ clients, onSubmit, isLoading }: { 
  clients: Client[]; 
  onSubmit: (data: any) => void; 
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    clientId: "",
    deliveryType: "takeaway",
    expectedDeliveryAt: "",
    notes: "",
  });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [productSearch, setProductSearch] = useState("");

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleQuantityChange = (productId: number, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const handleManualQuantity = (productId: number, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities(prev => {
      if (qty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const orderItems = useMemo(() => {
    if (!products) return [];
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products.find(p => p.id === parseInt(productId));
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as { product: Product; quantity: number }[];
  }, [quantities, products]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + (parseFloat(item.product.price || "0") * item.quantity);
    }, 0);
  }, [orderItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || orderItems.length === 0) return;
    
    const itemsText = orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    onSubmit({
      ...formData,
      clientId: parseInt(formData.clientId),
      orderNumber,
      items: itemsText,
      totalAmount: orderTotal.toFixed(2),
      entryDate: new Date().toISOString(),
      expectedDeliveryAt: formData.expectedDeliveryAt || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
          <SelectTrigger data-testid="select-client">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name} - {client.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Select Items</Label>
        <Input
          placeholder="Search items..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="mb-2"
          data-testid="input-product-search"
        />
        <ScrollArea className="h-64 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-1/2">Item</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center w-32">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts?.map((product) => (
                <TableRow key={product.id} className={quantities[product.id] ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium text-sm">{product.name}</TableCell>
                  <TableCell className="text-right text-sm text-primary font-semibold">
                    {product.price ? `${parseFloat(product.price).toFixed(0)}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(product.id, -1)}
                        disabled={!quantities[product.id]}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={quantities[product.id] || ""}
                        onChange={(e) => handleManualQuantity(product.id, e.target.value)}
                        className="w-12 h-7 text-center text-sm font-bold p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                        data-testid={`input-qty-${product.id}`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(product.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {orderItems.length > 0 && (
        <div className="p-3 bg-primary/5 rounded-lg border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">{orderItems.length} item(s) selected</span>
            <span className="text-lg font-bold text-primary">{orderTotal.toFixed(2)} AED</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {orderItems.map(item => `${item.quantity}x ${item.product.name}`).join(", ")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Delivery Type</Label>
          <Select value={formData.deliveryType} onValueChange={(v) => setFormData({ ...formData, deliveryType: v })}>
            <SelectTrigger data-testid="select-delivery-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="takeaway">Take Away</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.deliveryType === 'delivery' && (
          <div className="space-y-2">
            <Label>Expected Delivery</Label>
            <Input
              type="datetime-local"
              value={formData.expectedDeliveryAt}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryAt: e.target.value })}
              data-testid="input-delivery-time"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Any special instructions..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          data-testid="input-notes"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || !formData.clientId || orderItems.length === 0} 
        data-testid="button-submit-order"
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Create Order ({orderTotal.toFixed(2)} AED)
      </Button>
    </form>
  );
}
