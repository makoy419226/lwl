import { useState, useEffect, useMemo, useRef, useContext } from "react";
import { UserContext } from "@/App";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getProductImage as getStockProductImage } from "@/lib/productImages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  Package,
  Shirt,
  CheckCircle2,
  Truck,
  Clock,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  Bell,
  Printer,
  User,
  Receipt,
  Download,
  Camera,
  Image,
  X,
  Tag,
  ChevronDown,
  Home,
  Sparkles,
  ShoppingCart,
  Footprints,
  RotateCcw,
  MapPin,
  Phone,
  Edit,
  Store,
} from "lucide-react";

const getCategoryIcon = (category: string | null, size: string = "w-4 h-4") => {
  switch (category) {
    case "Arabic Clothes":
      return <Shirt className={`${size} text-amber-600`} />;
    case "Men's Clothes":
      return <Shirt className={`${size} text-blue-600`} />;
    case "Ladies' Clothes":
      return <Sparkles className={`${size} text-pink-500`} />;
    case "Baby Clothes":
      return <Sparkles className={`${size} text-purple-500`} />;
    case "Linens":
      return <Home className={`${size} text-green-600`} />;
    case "Shop Items":
      return <ShoppingCart className={`${size} text-cyan-600`} />;
    case "General Items":
      return <Package className={`${size} text-gray-600`} />;
    case "Shoes, Carpets & More":
      return <Footprints className={`${size} text-orange-600`} />;
    default:
      return <Shirt className={`${size} text-primary`} />;
  }
};
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OrderReceipt } from "@/components/OrderReceipt";
import { StageChecklist } from "@/components/StageChecklist";
import type { Order, Client, Product, Bill } from "@shared/schema";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

export default function Orders() {
  const user = useContext(UserContext);
  const canDeliver = user?.role === "driver" || user?.role === "admin";
  const canConfirmPickup = true; // All roles can confirm pickup
  const searchParams = useSearch();
  const urlSearch = new URLSearchParams(searchParams).get("search") || "";
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const newSearch = params.get("search") || "";
    if (newSearch !== searchTerm) {
      setSearchTerm(newSearch);
    }
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState("all");
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [packingPinDialog, setPackingPinDialog] = useState<{
    orderId: number;
  } | null>(null);
  const [packingPin, setPackingPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [packingNotes, setPackingNotes] = useState("");
  const [deliveryPinDialog, setDeliveryPinDialog] = useState<{
    orderId: number;
  } | null>(null);
  const [deliveryConfirmDialog, setDeliveryConfirmDialog] = useState<{
    orderId: number;
  } | null>(null);
  const [deliveryPin, setDeliveryPin] = useState("");
  const [deliveryPinError, setDeliveryPinError] = useState("");
  const [itemCountVerified, setItemCountVerified] = useState(false);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [deliveryPhotoPreviews, setDeliveryPhotoPreviews] = useState<string[]>(
    [],
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [tagPinDialog, setTagPinDialog] = useState<{ orderId: number } | null>(
    null,
  );
  const [tagPin, setTagPin] = useState("");
  const [tagPinError, setTagPinError] = useState("");
  const [newCreatedOrder, setNewCreatedOrder] = useState<Order | null>(null);
  const [reportStartDate, setReportStartDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [reportEndDate, setReportEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [viewPhotoOrder, setViewPhotoOrder] = useState<Order | null>(null);
  const pdfReceiptRef = useRef<HTMLDivElement>(null);
  const reportTableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(searchString);
  const urlBillId = urlParams.get("billId");
  const urlClientId = urlParams.get("clientId");

  const [prefilledClientId, setPrefilledClientId] = useState<
    string | undefined
  >();
  const [prefilledBillId, setPrefilledBillId] = useState<string | undefined>();
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const [incidentReportOrder, setIncidentReportOrder] = useState<Order | null>(
    null,
  );
  const [incidentType, setIncidentType] = useState("missing_item");
  const [incidentItems, setIncidentItems] = useState<string[]>([]);
  const [incidentReason, setIncidentReason] = useState("");
  const [incidentNotes, setIncidentNotes] = useState("");
  const [reporterName, setReporterName] = useState("");

  const [stageChecklistDialog, setStageChecklistDialog] = useState<{
    order: Order;
    stage: "tagging" | "washing" | "sorting" | "folding" | "packing";
  } | null>(null);

  const [editItemsDialog, setEditItemsDialog] = useState<Order | null>(null);
  const [editItemsQuantities, setEditItemsQuantities] = useState<Record<string, number>>({});
  const [editItemsPin, setEditItemsPin] = useState("");
  const [editItemsPinError, setEditItemsPinError] = useState("");
  const [isEditingItems, setIsEditingItems] = useState(false);

  const { data: orders, isLoading, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refresh every 30 seconds to get latest delivery statuses
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

  const { data: incidents } = useQuery<{ orderId: number }[]>({
    queryKey: ["/api/incidents"],
  });

  // Check if an order has any incident
  const orderHasIncident = (orderId: number): boolean => {
    if (!incidents) return false;
    return incidents.some(incident => incident.orderId === orderId);
  };

  // Calculate client's due balance from actual orders (unpaid amounts)
  const getClientDueBalance = (clientId: number): number => {
    if (!orders) return 0;
    const clientOrders = orders.filter(order => order.clientId === clientId);
    return clientOrders.reduce((sum, order) => {
      const total = parseFloat(order.totalAmount || "0");
      const paid = parseFloat(order.paidAmount || "0");
      return sum + (total - paid);
    }, 0);
  };

  useEffect(() => {
    if (urlBillId && urlClientId && bills) {
      const bill = bills.find((b) => b.id === parseInt(urlBillId));
      if (bill && bill.clientId === parseInt(urlClientId) && !bill.isPaid) {
        setPrefilledClientId(urlClientId);
        setPrefilledBillId(urlBillId);
        setIsCreateOpen(true);
        setLocation("/orders", { replace: true });
      } else {
        setLocation("/orders", { replace: true });
        toast({
          title: "Invalid Bill",
          description:
            "The selected bill is no longer available or has been paid.",
          variant: "destructive",
        });
      }
    }
  }, [urlBillId, urlClientId, bills]);

  const handleDialogClose = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setPrefilledClientId(undefined);
      setPrefilledBillId(undefined);
    }
  };

  const getClientBills = (clientId: number) => {
    return bills?.filter((b) => b.clientId === clientId) || [];
  };

  const getClientUnpaidBills = (clientId: number) => {
    return getClientBills(clientId).filter((b) => !b.isPaid);
  };

  const parseOrderItems = (
    itemsString: string | null,
  ): Array<{ name: string; quantity: number }> => {
    if (!itemsString) return [];

    const trimmed = itemsString.trim();

    // Try parsing as JSON first (array of objects format)
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            name: item.name || item.productName || "Unknown",
            quantity: item.quantity || item.qty || 1,
          }));
        }
      } catch (e) {
        // Fall through to string parsing
      }
    }

    // String format: "2x Shirt, 3x Pants" (quantity first) or "Shirt x2, Pants x3" (name first)
    return itemsString.split(", ").map((item) => {
      // Try "2x ProductName" format first (current format used in order creation)
      const quantityFirstMatch = item.match(/^(\d+)x\s+(.+)$/);
      if (quantityFirstMatch) {
        return {
          name: quantityFirstMatch[2].trim(),
          quantity: parseInt(quantityFirstMatch[1]),
        };
      }

      // Try "ProductName x2" format (legacy)
      const nameFirstMatch = item.match(/^(.+)\s+x(\d+)$/);
      if (nameFirstMatch) {
        return {
          name: nameFirstMatch[1].trim(),
          quantity: parseInt(nameFirstMatch[2]),
        };
      }

      // No quantity found, assume 1
      return { name: item.trim(), quantity: 1 };
    });
  };

  const getProductImage = (productName: string) => {
    const product = products?.find(
      (p) => p.name.toLowerCase() === productName.toLowerCase(),
    );
    return product?.imageUrl || getStockProductImage(productName);
  };

  // Get item price from item name format like "Abaya [N] (folding)" or "Jacket (Large) @ 8 AED"
  const getItemPrice = (itemName: string): number => {
    // Check for custom price format: "ProductName (Size) @ price AED"
    const customPriceMatch = itemName.match(/(.+?)\s*@\s*([\d.]+)\s*AED/i);
    if (customPriceMatch) {
      return parseFloat(customPriceMatch[2]);
    }
    
    // Check for dry clean service [D]
    const isDryClean = itemName.includes('[D]');
    
    // Extract base product name by removing service indicator and packaging type
    const baseProductName = itemName
      .replace(/\s*\[N\]\s*/g, '')
      .replace(/\s*\[D\]\s*/g, '')
      .replace(/\s*\(folding\)\s*/gi, '')
      .replace(/\s*\(hanger\)\s*/gi, '')
      .trim();
    
    const product = products?.find((p) => p.name.toLowerCase() === baseProductName.toLowerCase());
    if (product) {
      return isDryClean 
        ? parseFloat(product.dryCleanPrice || product.price || "0")
        : parseFloat(product.price || "0");
    }
    
    return 0;
  };

  // Calculate total from edit items quantities
  const calculateEditItemsTotal = (): number => {
    if (!editItemsDialog) return 0;
    let total = 0;
    Object.entries(editItemsQuantities).forEach(([name, qty]) => {
      total += getItemPrice(name) * qty;
    });
    // Apply urgent 2x multiplier if order is urgent
    if (editItemsDialog.urgent) {
      total *= 2;
    }
    return total;
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
      queryClient.invalidateQueries({
        queryKey: ["/api/products/allocated-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Order Updated",
        description: "Status updated successfully",
      });
    },
    onError: (error: any) => {
      let message = "Failed to update order";
      try {
        const errorMsg = String(error.message || "");
        const msgMatch = errorMsg.match(/"message"\s*:\s*"([^"]+)"/);
        if (msgMatch) message = msgMatch[1];
      } catch {}
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: (createdOrder: Order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/products/allocated-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] }); // Refresh products to show updated stock
      setIsCreateOpen(false);
      setPrefilledClientId(undefined);
      setPrefilledBillId(undefined);
      setNewCreatedOrder(createdOrder);
      toast({
        title: "Order Created",
        description: "New order has been created. Generating PDF...",
      });
    },
    onError: (error: any) => {
      let cleanMessage = "Failed to create order";
      let isCustomerExists = false;
      let isBillingRights = false;
      
      try {
        const errorMsg = String(error.message || error || "");
        console.log("Order error raw:", errorMsg);
        
        // Format is typically "403: {json}" or "400: {json}"
        // First try to extract the message directly using regex
        const msgMatch = errorMsg.match(/"message"\s*:\s*"([^"]+)"/);
        if (msgMatch) {
          cleanMessage = msgMatch[1];
        } else {
          // Try to find and parse JSON after status code
          const jsonStartIdx = errorMsg.indexOf("{");
          if (jsonStartIdx !== -1) {
            const jsonStr = errorMsg.substring(jsonStartIdx);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.message) {
                cleanMessage = parsed.message;
              }
            } catch {
              // If JSON parse fails, use the raw message
            }
          }
        }
        
        console.log("Parsed message:", cleanMessage);
        
        isCustomerExists = cleanMessage.toLowerCase().includes("customer details already exist") ||
                          cleanMessage.toLowerCase().includes("customer already exists");
        isBillingRights = cleanMessage.toLowerCase().includes("billing rights") ||
                          cleanMessage.toLowerCase().includes("admin pin");
      } catch (err) {
        console.error("Error parsing order error:", err);
      }
      
      toast({
        title: isBillingRights ? "PIN Not Authorized" : (isCustomerExists ? "Customer Already Exists" : "Error"),
        description: cleanMessage,
        variant: "destructive",
      });
    },
  });

  const generatePDF = async () => {
    if (pdfReceiptRef.current && newCreatedOrder) {
      const opt = {
        margin: 8,
        filename: `Order_${newCreatedOrder.orderNumber}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: "mm" as const,
          format: "a5" as const,
          orientation: "portrait" as const,
        },
      };

      try {
        await html2pdf().set(opt).from(pdfReceiptRef.current).save();
        toast({
          title: "PDF Downloaded",
          description: `Order ${newCreatedOrder.orderNumber} PDF saved`,
        });
      } catch (err) {
        toast({
          title: "PDF Error",
          description: "Failed to generate PDF",
          variant: "destructive",
        });
      }
    }
  };

  const generateTagReceipt = (order: Order) => {
    const client = clients?.find((c) => c.id === order.clientId);
    const isUrgent = order.urgent;
    const parsedItems = parseOrderItems(order.items);

    const previousBills =
      bills?.filter((b) => b.clientId === order.clientId && b.id !== order.billId) || [];
    const unpaidBills = previousBills.filter((b) => !b.isPaid);
    const totalPreviousDue = unpaidBills.reduce((sum, b) => {
      const billTotal = parseFloat(b.amount) || 0;
      const billPaid = parseFloat(b.paidAmount || "0") || 0;
      return sum + (billTotal - billPaid);
    }, 0);

    const itemsHtml = parsedItems
      .map(
        (item, idx) =>
          `<tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 5px 4px; font-size: 9px;">${idx + 1}</td>
        <td style="padding: 5px 4px; font-size: 9px;">${item.name}</td>
        <td style="padding: 5px 4px; font-size: 9px; text-align: center; font-weight: bold;">${item.quantity}</td>
        <td style="padding: 5px 4px; font-size: 9px; text-align: right;">${item.quantity} pcs</td>
      </tr>`,
      )
      .join("");

    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; max-width: 190mm; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 10px; margin-top: 4px; color: #666;">Professional Laundry Services - UAE</div>
          <div style="font-size: 9px; margin-top: 2px; color: #888;">Tel: 026 815 824 | Mobile: +971 56 338 0001</div>
        </div>
        
        ${isUrgent ? `<div style="text-align: center; padding: 8px; margin: 10px 0; background: #fef2f2; border: 2px solid #dc2626; font-weight: bold; color: #dc2626; font-size: 12px; border-radius: 4px;">*** URGENT ORDER ***</div>` : ""}
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <div style="flex: 1;">
            <div style="font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 3px;">Order Number</div>
            <div style="font-size: 20px; font-weight: bold; color: #000; border: 2px dashed #000; padding: 8px 12px; display: inline-block;">${order.orderNumber}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; color: #666;">Entry Date</div>
            <div style="font-size: 11px; font-weight: bold;">${format(new Date(order.entryDate), "dd MMM yyyy")}</div>
            <div style="font-size: 10px; color: #666;">${format(new Date(order.entryDate), "hh:mm a")}</div>
            ${
              order.expectedDeliveryAt
                ? `
            <div style="font-size: 9px; color: #666; margin-top: 5px;">Expected Delivery</div>
            <div style="font-size: 11px; font-weight: bold; color: #2563eb;">${format(new Date(order.expectedDeliveryAt), "dd MMM yyyy")}</div>
            `
                : ""
            }
          </div>
        </div>
        
        <div style="background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 10px; margin-bottom: 15px;">
          <div style="font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">Client Information</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <div style="font-size: 8px; color: #888;">Name</div>
              <div style="font-size: 12px; font-weight: bold;">${client?.name || order.customerName || "Walk-in Customer"}</div>
            </div>
            <div>
              <div style="font-size: 8px; color: #888;">Phone</div>
              <div style="font-size: 12px; font-weight: bold;">${client?.phone || "-"}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 8px; color: #888;">Address</div>
              <div style="font-size: 10px;">${client?.address || "-"}</div>
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
        
        ${
          totalPreviousDue > 0
            ? `
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 4px; padding: 10px; margin-bottom: 10px;">
          <div style="font-size: 11px; font-weight: bold; color: #856404; margin-bottom: 8px; border-bottom: 1px solid #ffc107; padding-bottom: 4px;">PREVIOUS OUTSTANDING BILLS (${unpaidBills.length})</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead>
              <tr style="background: #ffeeba;">
                <th style="padding: 4px; text-align: left; border-bottom: 1px solid #d39e00;">Bill #</th>
                <th style="padding: 4px; text-align: left; border-bottom: 1px solid #d39e00;">Date</th>
                <th style="padding: 4px; text-align: right; border-bottom: 1px solid #d39e00;">Due</th>
              </tr>
            </thead>
            <tbody>
              ${unpaidBills.map(bill => {
                const billTotal = parseFloat(bill.amount) || 0;
                const billPaid = parseFloat(bill.paidAmount || "0") || 0;
                const billDue = billTotal - billPaid;
                return `<tr style="border-bottom: 1px dashed #d39e00;">
                  <td style="padding: 3px 4px;">#${bill.referenceNumber || bill.id}</td>
                  <td style="padding: 3px 4px;">${format(new Date(bill.billDate), "dd/MM/yy")}</td>
                  <td style="padding: 3px 4px; text-align: right; font-weight: bold; color: #dc3545;">${billDue.toFixed(2)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 6px; border-top: 2px solid #d39e00;">
            <span style="font-size: 10px; font-weight: bold; color: #856404;">TOTAL PREVIOUS DUE:</span>
            <span style="font-size: 14px; font-weight: bold; color: #dc3545;">AED ${totalPreviousDue.toFixed(2)}</span>
          </div>
        </div>
        `
            : ""
        }
        
        ${
          totalPreviousDue > 0
            ? `
        <div style="background: #dc3545; color: white; border-radius: 4px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: bold;">GRAND TOTAL DUE:</span>
            <span style="font-size: 18px; font-weight: bold;">AED ${(parseFloat(order.totalAmount) + totalPreviousDue).toFixed(2)}</span>
          </div>
          <div style="font-size: 9px; margin-top: 4px; opacity: 0.9;">(Current: ${parseFloat(order.totalAmount).toFixed(2)} + Previous: ${totalPreviousDue.toFixed(2)})</div>
        </div>
        `
            : ""
        }
        
        <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
          <div>
            <div style="font-size: 8px; color: #888;">Packing</div>
            <div style="font-size: 10px; font-weight: bold;">${order.packingDone ? "Done" : "Pending"}</div>
          </div>
          <div>
            <div style="font-size: 8px; color: #888;">Status</div>
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">${order.status}</div>
          </div>
          <div>
            <div style="font-size: 8px; color: #888;">Tag</div>
            <div style="font-size: 10px; font-weight: bold; color: ${order.tagDone ? "#16a34a" : "#dc2626"};">${order.tagDone ? "Done" : "Pending"}</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #000; color: #888; font-size: 8px;">
          <div>Thank you for choosing Liquid Washes Laundry</div>
          <div style="margin-top: 4px; font-weight: bold; color: #000; font-size: 9px;">Tel: 026 815 824 | Mobile: +971 56 338 0001</div>
          <div style="margin-top: 3px;">Generated on ${format(new Date(), "dd MMM yyyy 'at' hh:mm a")}</div>
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `Tag_${order.orderNumber}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm",
        format: "a4" as const,
        orientation: "portrait" as const,
      },
      pagebreak: { mode: 'avoid-all' as const },
    };

    html2pdf().set(opt).from(content).save();
    toast({
      title: "Tag Downloaded",
      description: `Tag for ${order.orderNumber} saved`,
    });
  };

  const generateWashingReceipt = (order: Order) => {
    const client = clients?.find((c) => c.id === order.clientId);
    const isUrgent = order.urgent;

    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: 'Courier New', monospace; padding: 10px; width: 70mm; font-size: 11px; color: #000;">
        <div style="text-align: center; border-bottom: 2px dashed ${isUrgent ? "#dc2626" : "#000"}; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: bold; color: ${isUrgent ? "#dc2626" : "#000"};">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 9px; margin-top: 3px;">WASHING SECTION</div>
        </div>
        
        ${
          isUrgent
            ? `
        <div style="text-align: center; padding: 8px; margin: 8px 0; background: #fef2f2; border: 2px solid #dc2626; font-weight: bold; color: #dc2626; font-size: 14px;">
          *** URGENT ORDER ***
        </div>
        `
            : ""
        }
        
        <div style="text-align: center; font-size: 18px; font-weight: bold; padding: 10px; border: 2px dashed #000; margin: 10px 0; color: ${isUrgent ? "#dc2626" : "#000"};">
          ${order.orderNumber}
        </div>
        
        <div style="margin: 10px 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">
          <div style="margin-bottom: 5px;"><strong>Client:</strong> ${client?.name || "Walk-in"}</div>
          <div style="margin-bottom: 5px;"><strong>Phone:</strong> ${client?.phone || order.customerName || "-"}</div>
          <div><strong>Date:</strong> ${format(new Date(order.entryDate), "dd/MM/yyyy HH:mm")}</div>
        </div>
        
        <div style="margin: 10px 0; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">ITEMS FOR WASHING:</div>
          <div style="line-height: 1.8; font-size: 12px;">
            ${
              order.items
                ?.split(",")
                .map(
                  (item) =>
                    `<div style="padding: 3px 0; border-bottom: 1px dotted #ccc;">${item.trim()}</div>`,
                )
                .join("") || "No items"
            }
          </div>
        </div>
        
        ${
          order.notes
            ? `
        <div style="margin: 10px 0; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 10px;">NOTES:</div>
          <div style="font-size: 11px;">${order.notes}</div>
        </div>
        `
            : ""
        }
        
        <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000; font-size: 9px; color: #666;">
          <div>Printed: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
          <div style="font-weight: bold; color: #000; font-size: 10px; margin-top: 5px;">Tel: 026 815 824 | Mobile: +971 56 338 0001</div>
        </div>
      </div>
    `;

    const opt = {
      margin: 2,
      filename: `Washing_${order.orderNumber}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm",
        format: [80, 150] as [number, number],
        orientation: "portrait" as const,
      },
    };

    html2pdf().set(opt).from(content).save();
    toast({
      title: "Washing Receipt Downloaded",
      description: `Thermal receipt for ${order.orderNumber} saved`,
    });
  };

  useEffect(() => {
    if (newCreatedOrder && pdfReceiptRef.current) {
      const timer = setTimeout(() => {
        generatePDF();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [newCreatedOrder]);

  const exportReportToExcel = (
    dateItemMap: Record<string, Record<string, number>>,
    sortedDates: string[],
    sortedItems: string[],
    itemTotals: Record<string, number>,
  ) => {
    const wsData: (string | number)[][] = [];

    wsData.push([
      "Item Quantity Report",
      "",
      "",
      `From: ${reportStartDate} To: ${reportEndDate}`,
    ]);
    wsData.push([]);

    const headerRow: (string | number)[] = [
      "Item Name",
      ...sortedDates,
      "Total",
    ];
    wsData.push(headerRow);

    sortedItems.forEach((itemName) => {
      const row: (string | number)[] = [itemName];
      sortedDates.forEach((date) => {
        row.push(dateItemMap[date][itemName] || 0);
      });
      row.push(itemTotals[itemName]);
      wsData.push(row);
    });

    const dailyTotalRow: (string | number)[] = ["Daily Total"];
    sortedDates.forEach((date) => {
      dailyTotalRow.push(
        Object.values(dateItemMap[date]).reduce((sum, qty) => sum + qty, 0),
      );
    });
    dailyTotalRow.push(
      Object.values(itemTotals).reduce((sum, qty) => sum + qty, 0),
    );
    wsData.push(dailyTotalRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Report");
    XLSX.writeFile(
      wb,
      `Item_Report_${reportStartDate}_to_${reportEndDate}.xlsx`,
    );
    toast({
      title: "Excel Downloaded",
      description: "Item report exported to Excel",
    });
  };

  const exportReportToPDF = () => {
    if (reportTableRef.current) {
      const opt = {
        margin: 10,
        filename: `Item_Report_${reportStartDate}_to_${reportEndDate}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "landscape" as const,
        },
      };

      html2pdf().set(opt).from(reportTableRef.current).save();
      toast({
        title: "PDF Downloaded",
        description: "Item report exported to PDF",
      });
    }
  };

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/packing/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && packingPinDialog) {
        const existingOrder = orders?.find(
          (o) => o.id === packingPinDialog.orderId,
        );
        const combinedNotes = packingNotes
          ? existingOrder?.notes
            ? `${existingOrder.notes}\n[Packing: ${packingNotes}]`
            : `[Packing: ${packingNotes}]`
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

  const handlePackingWithPin = async (orderId: number) => {
    try {
      const res = await fetch(`/api/stage-checklists/order/${orderId}/packing`);
      if (res.ok) {
        const checklist = await res.json();
        if (!checklist || !checklist.isComplete) {
          toast({
            title: "Checklist Incomplete",
            description: "Please complete the packing checklist before entering your PIN.",
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.error("Error checking packing checklist:", error);
    }
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
        const currentOrder = orders?.find(
          (o) => o.id === deliveryPinDialog.orderId,
        );
        updateOrderMutation.mutate(
          {
            id: deliveryPinDialog.orderId,
            updates: {
              delivered: true,
              deliveryDate: new Date().toISOString(),
              deliveryBy: data.worker.name,
              deliveredByWorkerId: data.worker.id,
              deliveryPhoto: deliveryPhotos[0] || null,
              deliveryPhotos: deliveryPhotos.length > 0 ? deliveryPhotos : null,
              deliveryAddress: deliveryAddress || null,
              itemCountVerified: itemCountVerified,
              verifiedAt: itemCountVerified ? new Date().toISOString() : null,
              verifiedByWorkerId: itemCountVerified ? data.worker.id : null,
              verifiedByWorkerName: itemCountVerified ? data.worker.name : null,
            },
          },
        );
        setDeliveryPinDialog(null);
        setDeliveryPin("");
        setDeliveryPinError("");
        setDeliveryPhotos([]);
        setDeliveryPhotoPreviews([]);
        setDeliveryAddress("");
      }
    },
    onError: () => {
      setDeliveryPinError("Invalid PIN. Please try again.");
    },
  });

  const handleDeliveryPhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (deliveryPhotos.length >= 1) {
        toast({
          title: "Maximum Photos",
          description: "You can only upload 1 photo",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Photo must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setDeliveryPhotos((prev) => [...prev, base64]);
        setDeliveryPhotoPreviews((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeDeliveryPhoto = (index: number) => {
    setDeliveryPhotos((prev) => prev.filter((_, i) => i !== index));
    setDeliveryPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearDeliveryPhotos = () => {
    setDeliveryPhotos([]);
    setDeliveryPhotoPreviews([]);
  };

  const handleDeliveryWithPin = (orderId: number) => {
    const order = orders?.find(o => o.id === orderId);
    const client = order?.clientId ? clients?.find(c => c.id === order.clientId) : null;
    setDeliveryPinDialog({ orderId });
    setDeliveryPin("");
    setDeliveryPinError("");
    setItemCountVerified(false);
    setDeliveryAddress(client?.address || "");
  };

  const submitDeliveryPin = () => {
    if (deliveryPin.length !== 5) {
      setDeliveryPinError("PIN must be 5 digits");
      return;
    }
    verifyDeliveryPinMutation.mutate(deliveryPin);
  };

  const [pendingTagWorkerName, setPendingTagWorkerName] = useState<
    string | null
  >(null);

  const verifyTagPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/delivery/verify-pin", { pin });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && tagPinDialog) {
        const currentOrderId = tagPinDialog.orderId;
        setPendingTagWorkerName(data.worker.name);

        // Find next order BEFORE updating current one
        const pendingTagOrders =
          orders?.filter((o) => !o.tagDone && o.id !== currentOrderId) || [];
        const nextOrder =
          pendingTagOrders.length > 0 ? pendingTagOrders[0] : null;

        // Close dialog immediately
        setTagPinDialog(null);
        setTagPin("");
        setTagPinError("");
        
        updateOrderMutation.mutate(
          {
            id: currentOrderId,
            updates: {
              tagDone: true,
              tagDate: new Date().toISOString(),
              tagBy: data.worker.name,
            },
          },
          {
            onSuccess: () => {
              toast({
                title: "Tag Complete",
                description: `Order tagged successfully by ${data.worker.name}`,
              });
            },
          },
        );
      }
    },
    onError: () => {
      setTagPinError("Invalid PIN. Please try again.");
    },
  });

  const handleTagWithPin = async (orderId: number) => {
    try {
      const res = await fetch(`/api/stage-checklists/order/${orderId}/tagging`);
      if (res.ok) {
        const checklist = await res.json();
        if (!checklist || !checklist.isComplete) {
          toast({
            title: "Checklist Incomplete",
            description: "Please complete the tagging checklist before entering your PIN.",
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.error("Error checking tagging checklist:", error);
    }
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

  const createIncidentMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerPhone?: string;
      orderId: number;
      orderNumber: string;
      itemName: string;
      reason: string;
      notes?: string;
      responsibleStaffId?: number;
      responsibleStaffName?: string;
      reporterName?: string;
      incidentType: string;
      incidentDate: string;
    }) => {
      const res = await apiRequest("POST", "/api/incidents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({
        title: "Incident Reported",
        description: "The incident has been recorded successfully.",
      });
      resetIncidentForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to report incident",
        variant: "destructive",
      });
    },
  });

  const resetIncidentForm = () => {
    setIncidentReportOrder(null);
    setIncidentType("missing_item");
    setIncidentItems([]);
    setIncidentReason("");
    setIncidentNotes("");
    setReporterName("");
  };

  const handleEditItems = (order: Order) => {
    const parsedItems = parseOrderItems(order.items);
    const quantities: Record<string, number> = {};
    parsedItems.forEach((item) => {
      quantities[item.name] = item.quantity;
    });
    setEditItemsQuantities(quantities);
    setEditItemsDialog(order);
    setEditItemsPin("");
    setEditItemsPinError("");
  };

  const handleUpdateItemQuantity = (itemName: string, delta: number) => {
    setEditItemsQuantities((prev) => {
      const newQty = Math.max(0, (prev[itemName] || 0) + delta);
      if (newQty === 0) {
        const { [itemName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemName]: newQty };
    });
  };

  const submitEditItems = async () => {
    if (!editItemsDialog) return;
    if (editItemsPin.length !== 5) {
      setEditItemsPinError("PIN must be 5 digits");
      return;
    }

    const items = Object.entries(editItemsQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([name, quantity]) => ({ name, quantity }));

    if (items.length === 0) {
      setEditItemsPinError("Order must have at least one item");
      return;
    }

    setIsEditingItems(true);
    try {
      const res = await fetch(`/api/orders/${editItemsDialog.id}/update-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, staffPin: editItemsPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditItemsPinError(data.message || "Failed to update items");
        return;
      }

      const data = await res.json();
      toast({
        title: "Items Updated",
        description: data.message || `Order items updated by ${data.updatedBy}. Bill has been recalculated.`,
      });
      setEditItemsDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } catch (err) {
      setEditItemsPinError("Failed to update items");
    } finally {
      setIsEditingItems(false);
    }
  };

  const handleReportIncident = (order: Order) => {
    setIncidentReportOrder(order);
    setIncidentType("missing_item");
    setIncidentItems([]);
    setIncidentReason("");
    setIncidentNotes("");
  };

  const submitIncidentReport = () => {
    if (!incidentReportOrder) return;
    if (incidentItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      });
      return;
    }
    if (!incidentReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason",
        variant: "destructive",
      });
      return;
    }
    if (!reporterName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name as the reporter",
        variant: "destructive",
      });
      return;
    }

    const client = incidentReportOrder.clientId
      ? clients?.find((c) => c.id === incidentReportOrder.clientId)
      : null;

    createIncidentMutation.mutate({
      customerName:
        client?.name || incidentReportOrder.customerName || "Unknown",
      customerPhone: client?.phone || undefined,
      orderId: incidentReportOrder.id,
      orderNumber: incidentReportOrder.orderNumber,
      itemName: incidentItems.join(", "),
      reason: incidentReason,
      notes: incidentNotes || undefined,
      responsibleStaffId: incidentReportOrder.packingWorkerId || undefined,
      responsibleStaffName: incidentReportOrder.packingBy || undefined,
      reporterName: reporterName,
      incidentType: incidentType,
      incidentDate: new Date().toISOString(),
    });
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "create") return matchesSearch && !order.tagDone;
    if (activeTab === "tag-complete")
      return matchesSearch && order.tagDone && !order.packingDone;
    if (activeTab === "packing-done")
      return matchesSearch && order.packingDone && !order.delivered;
    if (activeTab === "for-delivery")
      return matchesSearch && order.packingDone && !order.delivered && order.deliveryType === "delivery";
    if (activeTab === "delivery") return matchesSearch && order.delivered;
    return matchesSearch;
  });

  const getStatusBadge = (order: Order) => {
    if (order.delivered)
      return (
        <Badge className="bg-green-500 dark:bg-green-600 text-white text-xs sm:text-sm transition-all duration-200">
          Delivered
        </Badge>
      );
    if (order.packingDone)
      return (
        <Badge className="bg-purple-500 dark:bg-purple-600 text-white text-xs sm:text-sm transition-all duration-200">
          Ready
        </Badge>
      );
    if (order.tagDone)
      return (
        <Badge className="bg-blue-500 dark:bg-blue-600 text-white text-xs sm:text-sm transition-all duration-200">
          Washing
        </Badge>
      );
    return (
      <Badge className="bg-orange-500 dark:bg-orange-600 text-white text-xs sm:text-sm transition-all duration-200">
        Pending
      </Badge>
    );
  };

  const getTimeRemaining = (expectedDeliveryAt: Date | null) => {
    if (!expectedDeliveryAt) return null;
    const now = new Date();
    const diff = new Date(expectedDeliveryAt).getTime() - now.getTime();
    if (diff <= 0)
      return (
        <Badge
          variant="destructive"
          className="animate-pulse text-xs sm:text-sm transition-all duration-200 whitespace-nowrap"
        >
          Overdue
        </Badge>
      );
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return (
        <Badge
          variant="secondary"
          className="text-xs sm:text-sm transition-all duration-200 whitespace-nowrap"
        >
          {hours}h {minutes % 60}m
        </Badge>
      );
    }
    if (minutes <= 30) {
      return (
        <Badge
          variant="destructive"
          className="animate-pulse text-xs sm:text-sm transition-all duration-200 whitespace-nowrap"
        >
          {minutes}m
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="text-xs sm:text-sm transition-all duration-200 whitespace-nowrap"
      >
        {minutes}m
      </Badge>
    );
  };

  const handleStatusUpdate = (
    orderId: number,
    field: string,
    value: boolean,
  ) => {
    const updates: any = { [field]: value };
    if (value) {
      updates[
        field.replace("Done", "Date").replace("delivered", "deliveryDate")
      ] = new Date().toISOString();
    }
    updateOrderMutation.mutate({ id: orderId, updates });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="min-h-16 lg:h-20 px-4 lg:px-6 py-3 lg:py-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
          <div className="flex items-center justify-between lg:justify-start gap-2">
            <h1 className="text-lg lg:text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
              <span className="hidden sm:inline">System Order Tracking</span>
              <span className="sm:hidden">Tracking</span>
            </h1>
            {dueSoonOrders && dueSoonOrders.length > 0 && (
              <Badge
                variant="destructive"
                className="animate-pulse flex items-center gap-1"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {dueSoonOrders.length} Due Soon
                </span>
                <span className="sm:hidden">{dueSoonOrders.length}</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full lg:w-64 h-11 touch-manipulation"
                data-testid="input-search-orders"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-4 lg:py-6 overflow-auto">
        <div className="stats-grid mb-4 lg:mb-6">
          <Card className="responsive-card">
            <CardContent className="p-3 lg:pt-6 lg:px-6">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 transition-all duration-200">
                  <Shirt className="w-5 h-5 lg:w-6 lg:h-6 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Received
                  </p>
                  <p
                    className="text-xl lg:text-2xl font-bold"
                    data-testid="text-entry-count"
                  >
                    {orders?.filter((o) => !o.washingDone).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="responsive-card">
            <CardContent className="p-3 lg:pt-6 lg:px-6">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 transition-all duration-200">
                  <Clock
                    className="w-5 h-5 lg:w-6 lg:h-6 text-blue-500 animate-spin"
                    style={{ animationDuration: "3s" }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Washing
                  </p>
                  <p
                    className="text-xl lg:text-2xl font-bold"
                    data-testid="text-washing-count"
                  >
                    {orders?.filter((o) => o.washingDone && !o.packingDone)
                      .length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="responsive-card">
            <CardContent className="p-3 lg:pt-6 lg:px-6">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 transition-all duration-200">
                  <Package className="w-5 h-5 lg:w-6 lg:h-6 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Ready
                  </p>
                  <p
                    className="text-xl lg:text-2xl font-bold"
                    data-testid="text-packing-count"
                  >
                    {orders?.filter((o) => o.packingDone && !o.delivered)
                      .length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="responsive-card">
            <CardContent className="p-3 lg:pt-6 lg:px-6">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 transition-all duration-200">
                  <CheckCircle2 className="w-5 h-5 lg:w-6 lg:h-6 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Released
                  </p>
                  <p
                    className="text-xl lg:text-2xl font-bold"
                    data-testid="text-delivered-count"
                  >
                    {orders?.filter((o) => o.delivered).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 mb-4">
            <TabsList className="inline-flex min-w-max h-auto p-1 gap-1">
              <TabsTrigger
                value="all"
                className="h-10 px-3 text-sm touch-manipulation"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="create"
                className="h-10 px-3 text-sm touch-manipulation bg-blue-100 dark:bg-blue-900/30 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">1.</span> Create
              </TabsTrigger>
              <TabsTrigger
                value="tag-complete"
                className="h-10 px-3 text-sm touch-manipulation bg-orange-100 dark:bg-orange-900/30 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <Tag className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">2.</span> Tag
              </TabsTrigger>
              <TabsTrigger
                value="packing-done"
                className="h-10 px-3 text-sm touch-manipulation bg-green-100 dark:bg-green-900/30 data-[state=active]:bg-green-500 data-[state=active]:text-white"
              >
                <Package className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">3.</span> Pack
              </TabsTrigger>
              <TabsTrigger
                value="for-delivery"
                className="h-10 px-3 text-sm touch-manipulation bg-cyan-100 dark:bg-cyan-900/30 data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
                data-testid="tab-for-delivery"
              >
                <MapPin className="w-4 h-4 mr-1" />
                For Delivery
              </TabsTrigger>
              <TabsTrigger
                value="delivery"
                className="h-10 px-3 text-sm touch-manipulation bg-purple-100 dark:bg-purple-900/30 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
              >
                <Truck className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">4.</span> Deliver
              </TabsTrigger>
              <TabsTrigger
                value="item-report"
                className="h-10 px-3 text-sm touch-manipulation"
              >
                Report
              </TabsTrigger>
            </TabsList>
          </div>

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
                <>
                  {/* Mobile Card Layout */}
                  <div className="md:hidden space-y-3">
                    {filteredOrders?.map((order) => {
                      const client = order.clientId
                        ? clients?.find((c) => c.id === order.clientId)
                        : null;
                      const displayName =
                        client?.name || order.customerName || "Walk-in";
                      const items = parseOrderItems(order.items);
                      const totalItems = items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      );

                      return (
                        <Card
                          key={order.id}
                          className="border shadow-sm"
                          data-testid={`card-order-${order.id}`}
                        >
                          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 pb-2 bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">
                                {order.orderNumber}
                              </span>
                              {order.deliveryType === "delivery" && (
                                <Truck className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusBadge(order)}
                              {order.packingDate && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(order.packingDate), "MMM d, h:mm a")}
                                </span>
                              )}
                            </div>
                          </CardHeader>

                          <CardContent className="p-3 pt-2 space-y-3">
                            {/* Client Row */}
                            <div className="flex items-center justify-between gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="font-medium text-left justify-start gap-2 h-auto py-1"
                                    data-testid={`button-mobile-client-${order.id}`}
                                  >
                                    <User className="w-4 h-4 text-primary shrink-0" />
                                    <div className="flex flex-col items-start">
                                      <span className="truncate max-w-[140px]">
                                        {displayName}
                                      </span>
                                      {(order.deliveryAddress || client?.address) && (
                                        <span className="text-xs text-muted-foreground font-normal truncate max-w-[140px]">
                                          {order.deliveryAddress || client?.address}
                                        </span>
                                      )}
                                    </div>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72" align="start">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 border-b pb-2">
                                      <User className="w-5 h-5 text-primary" />
                                      <div>
                                        <p className="font-semibold">
                                          {client?.name || displayName}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          {client?.phone || "No phone"}
                                        </p>
                                        {(order.deliveryAddress || client?.address) && (
                                          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{order.deliveryAddress || client?.address}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {client && (
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="text-sm">
                                          Due Balance:
                                        </span>
                                        <span
                                          className={`font-bold ${getClientDueBalance(client.id) === 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                          {getClientDueBalance(client.id).toFixed(2)}{" "}
                                          AED
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <span className="font-semibold text-sm">
                                {order.totalAmount} AED
                              </span>
                            </div>

                            {/* Delivery Address Row - shown in For Delivery tab */}
                            {activeTab === "for-delivery" && (
                              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground font-medium uppercase">Delivery Address</p>
                                    <p className="text-sm font-medium break-words">
                                      {order.deliveryAddress || client?.address || "No address on file"}
                                    </p>
                                  </div>
                                </div>
                                {client?.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-cyan-600 shrink-0" />
                                    <a 
                                      href={`tel:${client.phone}`}
                                      className="text-sm font-medium text-cyan-700 dark:text-cyan-400 underline"
                                    >
                                      {client.phone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Items & Delivery Info Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="gap-1">
                                  <Package className="w-3 h-3" />
                                  {totalItems} items
                                </Badge>
                                <Select
                                  value={order.deliveryType || ""}
                                  onValueChange={(newType) => {
                                    updateOrderMutation.mutate({
                                      id: order.id,
                                      updates: { deliveryType: newType },
                                    });
                                  }}
                                  disabled={order.delivered === true}
                                >
                                  <SelectTrigger 
                                    className={`w-24 h-7 text-xs ${order.delivered ? "opacity-60 cursor-not-allowed" : ""}`}
                                    data-testid={`select-mobile-delivery-type-${order.id}`}
                                  >
                                    <SelectValue>
                                      {order.deliveryType === "delivery" ? (
                                        <div className="flex items-center gap-1">
                                          <Truck className="w-3 h-3" />
                                          Delivery
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <Store className="w-3 h-3" />
                                          Pickup
                                        </div>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pickup">Pickup</SelectItem>
                                    <SelectItem value="delivery">Delivery</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {getTimeRemaining(order.expectedDeliveryAt)}
                              </span>
                            </div>

                          </CardContent>

                          {/* Card Footer - Actions */}
                          <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
                            {!order.tagDone && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                                  onClick={() => generateTagReceipt(order)}
                                  data-testid={`button-mobile-print-tag-${order.id}`}
                                >
                                  <Tag className="w-4 h-4 mr-1" />
                                  Print Tag
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                  onClick={() =>
                                    setStageChecklistDialog({
                                      order,
                                      stage: "tagging",
                                    })
                                  }
                                  data-testid={`button-mobile-checklist-tagging-${order.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Tagging List
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="flex-1"
                                  onClick={() => handleTagWithPin(order.id)}
                                  data-testid={`button-mobile-tag-done-${order.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Tag Done
                                </Button>
                              </>
                            )}

                            {order.tagDone && !order.packingDone && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                  onClick={() => generateWashingReceipt(order)}
                                  data-testid={`button-mobile-washing-${order.id}`}
                                >
                                  <Printer className="w-4 h-4 mr-1" />
                                  Washing
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                  onClick={() =>
                                    setStageChecklistDialog({
                                      order,
                                      stage: "packing",
                                    })
                                  }
                                  data-testid={`button-mobile-checklist-${order.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Packing List
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="flex-1"
                                  onClick={() => handlePackingWithPin(order.id)}
                                  data-testid={`button-mobile-packing-${order.id}`}
                                >
                                  <Package className="w-4 h-4 mr-1" />
                                  Pack Done
                                </Button>
                              </>
                            )}

                            {order.packingDone &&
                              !order.delivered &&
                              order.deliveryType === "delivery" && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="flex-1"
                                  onClick={() =>
                                    canDeliver && handleDeliveryWithPin(order.id)
                                  }
                                  disabled={!canDeliver}
                                  title={!canDeliver ? "Only drivers can confirm delivery" : ""}
                                  data-testid={`button-mobile-deliver-${order.id}`}
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Deliver
                                </Button>
                              )}

                            {order.packingDone &&
                              !order.delivered &&
                              order.deliveryType !== "delivery" && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="flex-1"
                                  onClick={() => handleDeliveryWithPin(order.id)}
                                  data-testid={`button-mobile-pickup-${order.id}`}
                                >
                                  <Package className="w-4 h-4 mr-1" />
                                  Ready for Pickup
                                </Button>
                              )}

                            {order.delivered && (
                              <>
                                <div className="flex-1 flex flex-col">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="w-full bg-green-600 hover:bg-green-600 cursor-default"
                                    disabled
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    {order.deliveryType === "delivery" ? "Delivered" : "Picked Up"}
                                  </Button>
                                  {order.deliveryBy && (
                                    <span className="text-xs text-muted-foreground text-center mt-1">
                                      by: {order.deliveryBy}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setViewPhotoOrder(order)}
                                  data-testid={`button-mobile-photo-${order.id}`}
                                >
                                  <Camera
                                    className={`w-4 h-4 ${(order.deliveryPhotos && order.deliveryPhotos.length > 0) || order.deliveryPhoto ? "text-blue-600" : "text-muted-foreground"}`}
                                  />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={orderHasIncident(order.id) ? "text-orange-500" : "text-muted-foreground"}
                                  onClick={() => handleReportIncident(order)}
                                  data-testid={`button-mobile-report-incident-${order.id}`}
                                  title="Report Incident"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop Table Layout */}
                  <Card className="responsive-card hidden md:block">
                    <div className="overflow-x-auto">
                      <Table className="w-full min-w-max">
                        <TableHeader>
                          <TableRow className="transition-all duration-200">
                            <TableHead className="w-[70px] lg:w-[90px]">
                              Order
                            </TableHead>
                            <TableHead className="hidden md:table-cell w-[80px]">
                              Bill
                            </TableHead>
                            <TableHead className="w-[100px] lg:w-[140px]">
                              Client
                            </TableHead>
                            {activeTab === "for-delivery" && (
                              <TableHead className="w-[120px] lg:w-[160px]">
                                Address
                              </TableHead>
                            )}
                            {activeTab === "for-delivery" && (
                              <TableHead className="w-[100px]">
                                Phone
                              </TableHead>
                            )}
                            <TableHead className="hidden md:table-cell w-[80px]">
                              Due
                            </TableHead>
                            <TableHead className="w-[60px]">
                              Items
                            </TableHead>
                            {activeTab !== "create" && (
                              <TableHead className="hidden md:table-cell w-[80px]">
                                Amount
                              </TableHead>
                            )}
                            <TableHead className="hidden md:table-cell w-[90px]">
                              Type
                            </TableHead>
                            <TableHead className="hidden md:table-cell w-[100px]">
                              Expected D&T
                            </TableHead>
                            <TableHead className="w-[80px] lg:w-[100px]">
                              Status
                            </TableHead>
                            <TableHead className="hidden md:table-cell w-[100px]">
                              READY D&T
                            </TableHead>
                            <TableHead className="w-[100px] lg:w-[140px]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const groupedOrders = filteredOrders?.reduce(
                              (acc, order) => {
                                const groupKey = order.clientId
                                  ? `client-${order.clientId}`
                                  : `walkin-${order.customerName || "unknown"}`;
                                if (!acc[groupKey]) {
                                  acc[groupKey] = [];
                                }
                                acc[groupKey].push(order);
                                return acc;
                              },
                              {} as Record<string, typeof filteredOrders>,
                            );

                            return Object.entries(groupedOrders || {}).map(
                              ([groupKey, clientOrders]) => {
                                const isWalkIn = groupKey.startsWith("walkin-");
                                const clientId = isWalkIn
                                  ? null
                                  : parseInt(groupKey.replace("client-", ""));
                                const client = clientId
                                  ? clients?.find((c) => c.id === clientId)
                                  : null;
                                const orderCount = clientOrders?.length || 0;
                                const displayName =
                                  client?.name ||
                                  clientOrders?.[0]?.customerName ||
                                  "Walk-in Customer";

                                return clientOrders?.map((order, idx) => (
                                  <TableRow
                                    key={order.id}
                                    data-testid={`row-order-${order.id}`}
                                  >
                                    <TableCell className="font-mono font-bold text-xs lg:text-sm truncate">
                                      {order.orderNumber.replace("ORD-", "")}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      {order.billId ? (
                                        <div className="flex flex-col items-start">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="font-mono text-primary h-auto py-1 px-1 text-xs"
                                            onClick={() => {
                                              const bill = bills?.find(
                                                (b) => b.id === order.billId,
                                              );
                                              if (bill) {
                                                setSelectedBill(bill);
                                                setShowBillDialog(true);
                                              }
                                            }}
                                            data-testid={`button-bill-${order.billId}`}
                                          >
                                            <Receipt className="w-3 h-3" />
                                            #{order.billId}
                                          </Button>
                                          {(() => {
                                            const bill = bills?.find((b) => b.id === order.billId);
                                            return bill?.createdBy ? (
                                              <span className="text-[10px] text-muted-foreground pl-1">
                                                Billed by: {bill.createdBy}
                                              </span>
                                            ) : null;
                                          })()}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">
                                          -
                                        </span>
                                      )}
                                    </TableCell>
                                    {idx === 0 ? (
                                      <>
                                        <TableCell
                                          rowSpan={orderCount}
                                          className="align-top border-r p-0"
                                        >
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                className="w-full h-auto justify-start px-1 lg:px-2 py-1 font-semibold hover-elevate touch-manipulation"
                                                data-testid={`button-client-${client?.id || "walkin"}`}
                                              >
                                                <div className="flex flex-col items-start text-left w-full">
                                                  <div className="flex items-center">
                                                    <User className="w-3 h-3 lg:w-4 lg:h-4 mr-1 shrink-0" />
                                                    <span className="truncate text-xs lg:text-sm max-w-[80px] lg:max-w-[120px] font-semibold">
                                                      {displayName}
                                                    </span>
                                                  </div>
                                                  {client?.address && (
                                                    <div className="flex items-center gap-0.5">
                                                      <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                                                      <span className="text-[10px] text-muted-foreground truncate max-w-[90px] lg:max-w-[130px]">
                                                        {client.address}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {client?.phone && (
                                                    <div className="flex items-center gap-0.5">
                                                      <Phone className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                                                      <span className="text-[10px] text-muted-foreground truncate max-w-[90px] lg:max-w-[130px]">
                                                        {client.phone}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                              className="w-80"
                                              align="start"
                                            >
                                              <div className="space-y-3">
                                                <div className="flex items-center gap-2 border-b pb-2">
                                                  <User className="w-5 h-5 text-primary" />
                                                  <div>
                                                    <p className="font-semibold">
                                                      {client?.name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                      {client?.phone}
                                                    </p>
                                                  </div>
                                                </div>
                                                {activeTab === "for-delivery" && (order.deliveryAddress || client?.address) && (
                                                  <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 space-y-2">
                                                    <div className="flex items-start gap-2">
                                                      <MapPin className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-muted-foreground font-medium uppercase">Delivery Address</p>
                                                        <p className="text-sm font-medium break-words">
                                                          {order.deliveryAddress || client?.address}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    {client?.phone && (
                                                      <div className="flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-cyan-600 shrink-0" />
                                                        <a 
                                                          href={`tel:${client.phone}`}
                                                          className="text-sm font-medium text-cyan-700 dark:text-cyan-400 underline"
                                                        >
                                                          {client.phone}
                                                        </a>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                <div className="flex justify-between items-center gap-2">
                                                  <span className="text-sm">
                                                    Due Balance:
                                                  </span>
                                                  <span
                                                    className={`font-bold ${client && getClientDueBalance(client.id) === 0 ? "text-green-600" : "text-red-600"}`}
                                                  >
                                                    {client ? getClientDueBalance(client.id).toFixed(2) : "0.00"}{" "}
                                                    AED
                                                  </span>
                                                </div>
                                                {client &&
                                                  getClientUnpaidBills(
                                                    client.id,
                                                  ).length > 0 && (
                                                    <div className="space-y-2">
                                                      <p className="text-sm font-medium flex items-center gap-1">
                                                        <Receipt className="w-4 h-4" />{" "}
                                                        Unpaid Bills:
                                                      </p>
                                                      <ScrollArea className="h-32">
                                                        <div className="space-y-1">
                                                          {getClientUnpaidBills(
                                                            client.id,
                                                          ).map((bill) => (
                                                            <div
                                                              key={bill.id}
                                                              className="flex justify-between items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1"
                                                            >
                                                              <span className="text-muted-foreground">
                                                                {format(
                                                                  new Date(
                                                                    bill.billDate,
                                                                  ),
                                                                  "dd/MM/yy",
                                                                )}
                                                              </span>
                                                              <span className="font-medium text-destructive">
                                                                {parseFloat(
                                                                  bill.amount,
                                                                ).toFixed(
                                                                  2,
                                                                )}{" "}
                                                                AED
                                                              </span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </ScrollArea>
                                                    </div>
                                                  )}
                                                {client &&
                                                  getClientUnpaidBills(
                                                    client.id,
                                                  ).length === 0 && (
                                                    <p className="text-sm text-muted-foreground text-center py-2">
                                                      No unpaid bills
                                                    </p>
                                                  )}
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                        {activeTab === "for-delivery" && (
                                          <TableCell
                                            rowSpan={orderCount}
                                            className="align-top text-xs text-muted-foreground border-r"
                                          >
                                            <div className="truncate max-w-[150px]" title={order.deliveryAddress || client?.address || ""}>
                                              {order.deliveryAddress || client?.address || "-"}
                                            </div>
                                          </TableCell>
                                        )}
                                        {activeTab === "for-delivery" && (
                                          <TableCell
                                            rowSpan={orderCount}
                                            className="align-top text-xs border-r"
                                          >
                                            {client?.phone ? (
                                              <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                                                {client.phone}
                                              </a>
                                            ) : "-"}
                                          </TableCell>
                                        )}
                                        <TableCell
                                          rowSpan={orderCount}
                                          className={`align-top font-semibold border-r hidden md:table-cell text-xs ${client && getClientDueBalance(client.id) === 0 ? "text-green-600" : "text-red-600"}`}
                                          data-testid={`text-client-due-${order.id}`}
                                        >
                                          {client ? getClientDueBalance(client.id).toFixed(0) : "0"} AED
                                        </TableCell>
                                      </>
                                    ) : null}
                                    <TableCell>
                                      <div className="flex items-center gap-1 text-xs sm:text-sm" data-testid={`text-items-count-${order.id}`}>
                                        <Package className="w-3 h-3 text-muted-foreground" />
                                        <span className="font-medium">
                                          {parseOrderItems(order.items).reduce((sum, item) => sum + item.quantity, 0)}
                                        </span>
                                      </div>
                                    </TableCell>
                                    {activeTab !== "create" && (
                                      <TableCell className="font-semibold hidden md:table-cell text-xs">
                                        {order.totalAmount} AED
                                      </TableCell>
                                    )}
                                    <TableCell className="hidden md:table-cell">
                                      <Select
                                        value={order.deliveryType || ""}
                                        onValueChange={(newType) => {
                                          updateOrderMutation.mutate({
                                            id: order.id,
                                            updates: { deliveryType: newType },
                                          });
                                        }}
                                        disabled={order.delivered === true}
                                      >
                                        <SelectTrigger className={`w-20 h-7 text-xs ${order.delivered ? "opacity-60 cursor-not-allowed" : ""}`}>
                                          <SelectValue>
                                            {order.deliveryType ===
                                            "delivery" ? (
                                              <div className="flex items-center gap-1">
                                                <Truck className="w-3 h-3" />
                                                Del
                                              </div>
                                            ) : (
                                              "Pick"
                                            )}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pickup">
                                            Pickup
                                          </SelectItem>
                                          <SelectItem value="delivery">
                                            Delivery
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                      {order.expectedDeliveryAt ? (
                                        <div>
                                          <div>{format(new Date(order.expectedDeliveryAt), "MMM d, yyyy")}</div>
                                          <div>{format(new Date(order.expectedDeliveryAt), "hh:mm a")}</div>
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(order)}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                      {order.packingDate ? (
                                        <div>
                                          <div>{format(new Date(order.packingDate), "MMMM d, yyyy")}</div>
                                          <div>time: {format(new Date(order.packingDate), "hh:mm a")}</div>
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell className="p-2 sm:p-3 lg:p-4">
                                      <div className="action-buttons">
                                        {!order.tagDone && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-orange-100 text-orange-700 border-orange-300 whitespace-nowrap touch-manipulation"
                                              onClick={() =>
                                                generateTagReceipt(order)
                                              }
                                              data-testid={`button-print-tag-${order.id}`}
                                            >
                                              <Tag className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Print Tag
                                              </span>
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-amber-100 text-amber-700 border-amber-300 whitespace-nowrap touch-manipulation"
                                              onClick={() => handleEditItems(order)}
                                              data-testid={`button-edit-items-${order.id}`}
                                            >
                                              <Edit className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Edit Items
                                              </span>
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-green-100 text-green-700 border-green-300 whitespace-nowrap touch-manipulation"
                                              onClick={() =>
                                                setStageChecklistDialog({
                                                  order,
                                                  stage: "tagging",
                                                })
                                              }
                                              data-testid={`button-checklist-tagging-${order.id}`}
                                            >
                                              <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Tagging List
                                              </span>
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="whitespace-nowrap touch-manipulation"
                                              onClick={() =>
                                                handleTagWithPin(order.id)
                                              }
                                              data-testid={`button-tag-done-${order.id}`}
                                            >
                                              <span className="sm:hidden">
                                                Tag
                                              </span>
                                              <span className="hidden sm:inline">
                                                Tag Done
                                              </span>
                                            </Button>
                                          </>
                                        )}
                                        {order.tagDone &&
                                          !order.packingDone && (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-blue-100 text-blue-700 border-blue-300 whitespace-nowrap touch-manipulation"
                                                onClick={() =>
                                                  generateWashingReceipt(order)
                                                }
                                                data-testid={`button-washing-receipt-${order.id}`}
                                              >
                                                <Printer className="w-3 h-3 sm:mr-1" />
                                                <span className="hidden sm:inline">
                                                  Washing
                                                </span>
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-green-100 text-green-700 border-green-300 whitespace-nowrap touch-manipulation"
                                                onClick={() =>
                                                  setStageChecklistDialog({
                                                    order,
                                                    stage: "packing",
                                                  })
                                                }
                                                data-testid={`button-checklist-${order.id}`}
                                              >
                                                <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                                <span className="hidden sm:inline">
                                                  Packing List
                                                </span>
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="whitespace-nowrap touch-manipulation"
                                                onClick={() =>
                                                  handlePackingWithPin(order.id)
                                                }
                                                data-testid={`button-packing-${order.id}`}
                                              >
                                                <span className="sm:hidden">
                                                  Pack
                                                </span>
                                                <span className="hidden sm:inline">
                                                  Packing Done
                                                </span>
                                              </Button>
                                            </>
                                          )}
                                        {order.packingDone &&
                                          !order.delivered &&
                                          order.deliveryType === "delivery" && (
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="whitespace-nowrap touch-manipulation"
                                              onClick={() =>
                                                canDeliver && handleDeliveryWithPin(order.id)
                                              }
                                              disabled={!canDeliver}
                                              title={!canDeliver ? "Only drivers can confirm delivery" : ""}
                                              data-testid={`button-deliver-${order.id}`}
                                            >
                                              <Truck className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Deliver
                                              </span>
                                            </Button>
                                          )}
                                        {order.packingDone &&
                                          !order.delivered &&
                                          order.deliveryType !== "delivery" && (
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="whitespace-nowrap touch-manipulation"
                                              onClick={() => handleDeliveryWithPin(order.id)}
                                              data-testid={`button-pickup-${order.id}`}
                                            >
                                              <Package className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Ready for Pickup
                                              </span>
                                            </Button>
                                          )}
                                        {order.delivered && (
                                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <div className="flex flex-col">
                                              <Button
                                                size="sm"
                                                variant="default"
                                                className="bg-green-600 hover:bg-green-600 cursor-default whitespace-nowrap"
                                                disabled
                                              >
                                                <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                                <span className="hidden sm:inline">
                                                  {order.deliveryType === "delivery" ? "Delivered" : "Picked Up"}
                                                </span>
                                              </Button>
                                              {order.deliveryBy && (
                                                <span className="text-xs text-muted-foreground mt-1">
                                                  by: {order.deliveryBy}
                                                </span>
                                              )}
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="shrink-0 touch-manipulation"
                                              onClick={() =>
                                                setViewPhotoOrder(order)
                                              }
                                              data-testid={`button-view-photo-${order.id}`}
                                              title={
                                                order.deliveryPhoto
                                                  ? "View Delivery Photo"
                                                  : "No photo available"
                                              }
                                            >
                                              <Camera
                                                className={`w-4 h-4 ${(order.deliveryPhotos && order.deliveryPhotos.length > 0) || order.deliveryPhoto ? "text-blue-900 dark:text-blue-400" : "text-red-500"}`}
                                              />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className={`shrink-0 touch-manipulation ${orderHasIncident(order.id) ? "text-orange-500" : "text-muted-foreground"}`}
                                              onClick={() =>
                                                handleReportIncident(order)
                                              }
                                              data-testid={`button-report-incident-${order.id}`}
                                              title="Report Incident"
                                            >
                                              <AlertTriangle className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ));
                              },
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </>
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Label
                        htmlFor="report-start"
                        className="whitespace-nowrap"
                      >
                        From:
                      </Label>
                      <Input
                        id="report-start"
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full sm:w-40 h-11 touch-manipulation"
                        data-testid="input-report-start-date"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Label htmlFor="report-end" className="whitespace-nowrap">
                        To:
                      </Label>
                      <Input
                        id="report-end"
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full sm:w-40 h-11 touch-manipulation"
                        data-testid="input-report-end-date"
                      />
                    </div>
                  </div>

                  {(() => {
                    const startDate = new Date(reportStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(reportEndDate);
                    endDate.setHours(23, 59, 59, 999);

                    const filteredOrdersForReport =
                      orders?.filter((order) => {
                        const orderDate = new Date(order.entryDate);
                        return orderDate >= startDate && orderDate <= endDate;
                      }) || [];

                    const dateItemMap: Record<
                      string,
                      Record<string, number>
                    > = {};
                    const allItems: Set<string> = new Set();

                    filteredOrdersForReport.forEach((order) => {
                      const dateKey = format(
                        new Date(order.entryDate),
                        "dd/MM/yyyy",
                      );
                      if (!dateItemMap[dateKey]) {
                        dateItemMap[dateKey] = {};
                      }
                      const items = parseOrderItems(order.items);
                      items.forEach((item) => {
                        allItems.add(item.name);
                        dateItemMap[dateKey][item.name] =
                          (dateItemMap[dateKey][item.name] || 0) +
                          item.quantity;
                      });
                    });

                    const sortedDates = Object.keys(dateItemMap).sort(
                      (a, b) => {
                        const [dayA, monthA, yearA] = a.split("/").map(Number);
                        const [dayB, monthB, yearB] = b.split("/").map(Number);
                        return (
                          new Date(yearA, monthA - 1, dayA).getTime() -
                          new Date(yearB, monthB - 1, dayB).getTime()
                        );
                      },
                    );

                    const sortedItems = Array.from(allItems).sort();

                    const itemTotals: Record<string, number> = {};
                    sortedItems.forEach((item) => {
                      itemTotals[item] = Object.values(dateItemMap).reduce(
                        (sum, dateData) => sum + (dateData[item] || 0),
                        0,
                      );
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
                            onClick={() =>
                              exportReportToExcel(
                                dateItemMap,
                                sortedDates,
                                sortedItems,
                                itemTotals,
                              )
                            }
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
                        <div
                          ref={reportTableRef}
                          className="border rounded-lg overflow-auto bg-white p-4"
                        >
                          <h3 className="text-lg font-bold mb-4">
                            Item Quantity Report ({reportStartDate} to{" "}
                            {reportEndDate})
                          </h3>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-bold sticky left-0 bg-muted/50 z-10">
                                  Item Name
                                </TableHead>
                                {sortedDates.map((date) => (
                                  <TableHead
                                    key={date}
                                    className="text-center font-bold min-w-[100px]"
                                  >
                                    {date}
                                  </TableHead>
                                ))}
                                <TableHead className="text-center font-bold bg-primary/10 min-w-[100px]">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedItems.map((itemName) => (
                                <TableRow
                                  key={itemName}
                                  data-testid={`row-item-${itemName}`}
                                >
                                  <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                                    {itemName}
                                  </TableCell>
                                  {sortedDates.map((date) => (
                                    <TableCell
                                      key={date}
                                      className="text-center"
                                    >
                                      {dateItemMap[date][itemName] || "-"}
                                    </TableCell>
                                  ))}
                                  <TableCell className="text-center font-bold bg-primary/10">
                                    {itemTotals[itemName]}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/30 font-bold">
                                <TableCell className="sticky left-0 bg-muted/30 z-10 border-r">
                                  Daily Total
                                </TableCell>
                                {sortedDates.map((date) => (
                                  <TableCell key={date} className="text-center">
                                    {Object.values(dateItemMap[date]).reduce(
                                      (sum, qty) => sum + qty,
                                      0,
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center bg-primary/20">
                                  {Object.values(itemTotals).reduce(
                                    (sum, qty) => sum + qty,
                                    0,
                                  )}
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
          client={clients?.find((c) => c.id === printOrder.clientId)}
          onClose={() => setPrintOrder(null)}
        />
      )}

      {newCreatedOrder && (
        <Dialog
          open={!!newCreatedOrder}
          onOpenChange={(open) => !open && setNewCreatedOrder(null)}
        >
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Order Created - {newCreatedOrder.orderNumber}
              </DialogTitle>
              <DialogDescription>
                Your order has been created. The PDF is being generated
                automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                onClick={generatePDF}
                variant="default"
                data-testid="button-download-pdf"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                onClick={() => generateWashingReceipt(newCreatedOrder)}
                variant="secondary"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-washing-receipt"
              >
                <Printer className="w-4 h-4 mr-2" />
                Washing Receipt
              </Button>
              <Button
                onClick={() => {
                  setPrintOrder(newCreatedOrder);
                  setNewCreatedOrder(null);
                }}
                variant="outline"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Full
              </Button>
              <Button onClick={() => setNewCreatedOrder(null)} variant="ghost">
                Close
              </Button>
            </div>
            <div ref={pdfReceiptRef} className="bg-white p-6 rounded-lg border">
              <div style={{ fontFamily: "Arial, sans-serif", color: "#333" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "15px",
                    marginBottom: "30px",
                    borderBottom: "2px solid #1e40af",
                    paddingBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      background: "#1e40af",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="white"
                      style={{ width: "36px", height: "36px" }}
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="white"
                        fillOpacity="0.2"
                      />
                      <circle cx="12" cy="12" r="3" fill="white" />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "bold",
                        color: "#1e40af",
                        marginBottom: "6px",
                      }}
                    >
                      Liquid Washes Laundry
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        lineHeight: 1.5,
                      }}
                    >
                      Centra Market D/109, Al Dhanna City, Al Ruwais
                      <br />
                      Abu Dhabi, UAE
                      <br />
                      Tel: 026 815 824 | Mobile: +971 56 338 0001
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    textAlign: "center",
                    margin: "20px 0",
                    color: "#1e40af",
                  }}
                >
                  ORDER RECEIPT
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#1e40af",
                    textAlign: "center",
                    margin: "20px 0",
                    padding: "10px",
                    background: "#f3f4f6",
                    borderRadius: "8px",
                  }}
                >
                  {newCreatedOrder.orderNumber}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "15px",
                  }}
                >
                  <div style={{ width: "48%" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Client
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>
                      {clients?.find((c) => c.id === newCreatedOrder.clientId)
                        ?.name || "N/A"}
                    </div>
                  </div>
                  <div style={{ width: "48%" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Date
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>
                      {format(
                        new Date(newCreatedOrder.entryDate),
                        "dd/MM/yyyy HH:mm",
                      )}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    margin: "20px 0",
                    padding: "15px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "10px" }}>
                    Items
                  </div>
                  <div style={{ fontSize: "14px" }}>
                    {newCreatedOrder.items}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "20px",
                    paddingTop: "20px",
                    borderTop: "2px solid #e5e5e5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#1e40af",
                    }}
                  >
                    <span>Total Amount</span>
                    <span>
                      {parseFloat(newCreatedOrder.totalAmount).toFixed(2)} AED
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "40px",
                    textAlign: "center",
                    paddingTop: "20px",
                    borderTop: "1px solid #e5e5e5",
                  }}
                >
                  <p style={{ fontSize: "12px", color: "#666" }}>
                    Thank you for choosing Liquid Washes Laundry!
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: "bold",
                      color: "#000",
                      marginTop: "8px",
                    }}
                  >
                    Tel: 026 815 824 | Mobile: +971 56 338 0001
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={!!packingPinDialog}
        onOpenChange={(open) => !open && setPackingPinDialog(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
              id="packing-pin" // Good practice to have an ID
              type="tel" // Changed to 'tel' to stop password managers
              maxLength={5}
              placeholder="Enter 5-digit PIN"
              value={packingPin}
              autoComplete="off" // Prevents autofill suggestions
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                setPackingPin(val);
                setPinError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitPackingPin()}
              // Added [-webkit-text-security:disc] to mask the input
              className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
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
                disabled={
                  packingPin.length !== 5 || verifyPinMutation.isPending
                }
                data-testid="button-submit-pin"
              >
                {verifyPinMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!tagPinDialog}
        onOpenChange={(open) => !open && setTagPinDialog(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              Enter Staff PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your staff PIN to confirm all tags are done for this order.
            </p>
            <Input
              id="tag-pin"
              type="tel"
              maxLength={5}
              placeholder="Enter 5-digit PIN"
              value={tagPin}
              autoComplete="off"
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                setTagPin(val);
                setTagPinError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitTagPin()}
              className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
              data-testid="input-tag-pin"
            />
            {tagPinError && (
              <p className="text-sm text-destructive text-center">
                {tagPinError}
              </p>
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
                {verifyTagPinMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Confirm Tag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!stageChecklistDialog}
        onOpenChange={(open) => !open && setStageChecklistDialog(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              Stage Checklist -{" "}
              {stageChecklistDialog?.stage
                ? stageChecklistDialog.stage.charAt(0).toUpperCase() +
                  stageChecklistDialog.stage.slice(1)
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please verify all items before marking this stage as complete.
            </p>
            {stageChecklistDialog && (
              <StageChecklist
                orderId={stageChecklistDialog.order.id}
                orderNumber={stageChecklistDialog.order.orderNumber}
                stage={stageChecklistDialog.stage}
                items={stageChecklistDialog.order.items}
                onComplete={() => {
                  toast({
                    title: "Checklist Complete",
                    description: `All items verified for ${stageChecklistDialog.stage}`,
                  });
                }}
              />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStageChecklistDialog(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deliveryPinDialog}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveryPinDialog(null);
            clearDeliveryPhotos();
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Confirm Delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                This action cannot be undone
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Order status and delivery type cannot be changed after confirmation.
              </p>
            </div>
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
                  <span className="text-xs text-muted-foreground">
                    Tap to open camera
                  </span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    capture="environment"
                    className="hidden"
                    onChange={handleDeliveryPhotoChange}
                    data-testid="input-delivery-photo"
                  />
                </label>
              )}
            </div>

            {/* Item Count Verification Section */}
            {deliveryPinDialog &&
              (() => {
                const order = orders?.find(
                  (o) => o.id === deliveryPinDialog.orderId,
                );
                const itemCount = order?.items
                  ? parseOrderItems(order.items).reduce(
                      (sum: number, item: any) => sum + (item.quantity || 1),
                      0,
                    )
                  : 0;
                return (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Item Count at Intake
                      </span>
                      <Badge
                        variant="outline"
                        className="text-lg font-bold"
                        data-testid="text-item-count"
                      >
                        {itemCount} items
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="itemVerified"
                        checked={itemCountVerified}
                        onCheckedChange={(checked) =>
                          setItemCountVerified(checked === true)
                        }
                        data-testid="checkbox-item-verified"
                      />
                      <label
                        htmlFor="itemVerified"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm all {itemCount} items are present and match
                        intake
                      </label>
                    </div>
                  </div>
                );
              })()}

            {/* Delivery Address - only shown for delivery orders, not pickup */}
            {deliveryPinDialog && orders?.find(o => o.id === deliveryPinDialog.orderId)?.deliveryType === "delivery" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery Address
                </Label>
                <Textarea
                  placeholder="Enter delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="input-delivery-address"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Enter Staff PIN</Label>
              <Input
                id="delivery-pin"
                type="tel"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={deliveryPin}
                autoComplete="off"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setDeliveryPin(val);
                  setDeliveryPinError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submitDeliveryPin()}
                className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
                data-testid="input-delivery-pin"
              />
            </div>
            {deliveryPinError && (
              <p className="text-sm text-destructive text-center">
                {deliveryPinError}
              </p>
            )}
            {!itemCountVerified && (
              <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                Please verify item count before confirming delivery
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDeliveryPinDialog(null);
                  clearDeliveryPhotos();
                }}
                data-testid="button-cancel-delivery"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={submitDeliveryPin}
                disabled={
                  deliveryPin.length !== 5 ||
                  verifyDeliveryPinMutation.isPending
                }
                data-testid="button-submit-delivery-pin"
              >
                {verifyDeliveryPinMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Confirm Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewPhotoOrder}
        onOpenChange={(open) => !open && setViewPhotoOrder(null)}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Delivery Photos - Order #{viewPhotoOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Photos captured at delivery confirmation
            </DialogDescription>
          </DialogHeader>
          {(viewPhotoOrder?.deliveryPhotos &&
            viewPhotoOrder.deliveryPhotos.length > 0) ||
          viewPhotoOrder?.deliveryPhoto ? (
            <div className="space-y-3">
              {viewPhotoOrder?.deliveryPhotos &&
              viewPhotoOrder.deliveryPhotos.length > 0 ? (
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

      {/* Bill Preview Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bill #{selectedBill?.id}
            </DialogTitle>
            <DialogDescription>
              Bill details and payment status
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Client:</div>
                <div className="font-medium">
                  {clients?.find((c) => c.id === selectedBill.clientId)?.name}
                </div>

                <div className="text-muted-foreground">Bill Date:</div>
                <div className="font-medium">
                  {format(new Date(selectedBill.billDate), "dd/MM/yyyy")}
                </div>

                <div className="text-muted-foreground">Total Amount:</div>
                <div className="font-semibold">
                  {parseFloat(selectedBill.amount).toFixed(2)} AED
                </div>

                <div className="text-muted-foreground">Paid Amount:</div>
                <div className="font-medium text-green-600">
                  {parseFloat(selectedBill.paidAmount || "0").toFixed(2)} AED
                </div>

                <div className="text-muted-foreground">Balance:</div>
                <div
                  className={`font-semibold ${parseFloat(selectedBill.amount) - parseFloat(selectedBill.paidAmount || "0") > 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {(
                    parseFloat(selectedBill.amount) -
                    parseFloat(selectedBill.paidAmount || "0")
                  ).toFixed(2)}{" "}
                  AED
                </div>

                <div className="text-muted-foreground">Status:</div>
                <div>
                  {selectedBill.isPaid ? (
                    <Badge className="bg-green-500">Paid</Badge>
                  ) : (
                    <Badge variant="destructive">Unpaid</Badge>
                  )}
                </div>

                {selectedBill.createdBy && (
                  <>
                    <div className="text-muted-foreground">Billed by:</div>
                    <div className="font-medium">{selectedBill.createdBy}</div>
                  </>
                )}
              </div>

              {selectedBill.description && (
                <div className="border-t pt-3">
                  <div className="text-sm text-muted-foreground mb-1">
                    Description:
                  </div>
                  <div className="text-sm">{selectedBill.description}</div>
                </div>
              )}

              {/* Previous Unpaid Bills Section */}
              {(() => {
                const currentBillDue = parseFloat(selectedBill.amount) - parseFloat(selectedBill.paidAmount || "0");
                const otherUnpaidBills = bills?.filter(
                  (b) => b.clientId === selectedBill.clientId && 
                         b.id !== selectedBill.id && 
                         !b.isPaid
                ) || [];
                const totalPreviousDue = otherUnpaidBills.reduce((sum, b) => {
                  return sum + (parseFloat(b.amount) - parseFloat(b.paidAmount || "0"));
                }, 0);
                const grandTotalDue = currentBillDue + totalPreviousDue;

                return (
                  <>
                    {otherUnpaidBills.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              Previous Unpaid Bills ({otherUnpaidBills.length})
                            </span>
                          </div>
                          <ScrollArea className="max-h-32">
                            <div className="space-y-1">
                              {otherUnpaidBills.map((bill) => {
                                const due = parseFloat(bill.amount) - parseFloat(bill.paidAmount || "0") - parseFloat(bill.refundedAmount || "0");
                                return (
                                  <div
                                    key={bill.id}
                                    className="flex justify-between items-center text-sm bg-white dark:bg-background rounded px-2 py-1"
                                  >
                                    <span className="text-muted-foreground">
                                      Bill #{bill.id} - {format(new Date(bill.billDate), "dd/MM/yy")}
                                    </span>
                                    <span className="font-medium text-destructive">
                                      {due.toFixed(2)} AED
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-300 dark:border-amber-700">
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              Total Previous Due:
                            </span>
                            <span className="font-bold text-destructive">
                              {totalPreviousDue.toFixed(2)} AED
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Grand Total Due */}
                    <div className="border-t pt-3">
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Total Amount Due:</span>
                          <span className="text-xl font-bold text-primary">
                            {grandTotalDue.toFixed(2)} AED
                          </span>
                        </div>
                        {otherUnpaidBills.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            (This bill: {currentBillDue.toFixed(2)} + Previous: {totalPreviousDue.toFixed(2)})
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBillDialog(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const client = clients?.find((c) => c.id === selectedBill.clientId);
                    const currentBillDue = parseFloat(selectedBill.amount) - parseFloat(selectedBill.paidAmount || "0");
                    const otherUnpaidBills = bills?.filter(
                      (b) => b.clientId === selectedBill.clientId && 
                             b.id !== selectedBill.id && 
                             !b.isPaid
                    ) || [];
                    const totalPreviousDue = otherUnpaidBills.reduce((sum, b) => {
                      return sum + (parseFloat(b.amount) - parseFloat(b.paidAmount || "0"));
                    }, 0);
                    const grandTotalDue = currentBillDue + totalPreviousDue;

                    const printContent = `
                      <html>
                        <head>
                          <title>Bill Summary - ${client?.name || 'Customer'}</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
                            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e5aa8; padding-bottom: 10px; }
                            .header img { max-width: 100px; height: auto; margin-bottom: 8px; }
                            .header h1 { margin: 0; font-size: 18px; color: #1e5aa8; }
                            .header p { margin: 5px 0; font-size: 12px; color: #666; }
                            .contact-info { display: flex; justify-content: center; gap: 15px; margin-top: 8px; font-size: 10px; color: #333; }
                            .section { margin-bottom: 15px; }
                            .section-title { font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                            .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
                            .row.bold { font-weight: bold; }
                            .total-box { background: #1e5aa8; color: white; padding: 10px; border-radius: 5px; margin-top: 10px; }
                            .grand-total { font-size: 16px; font-weight: bold; text-align: center; }
                            .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <img src="${window.location.origin}/attached_assets/company_logo.png" alt="LWL" onerror="this.style.display='none'" />
                            <h1>LIQUIDE WASHES LAUNDRY</h1>
                            <p style="color: #3b82f6; font-size: 9px; margin-top: 2px;">SMARTNESS PARTNERS</p>
                            <div class="contact-info">
                              <span>Tel: 026 815 824</span>
                              <span>Mobile: +971 56 338 0001</span>
                            </div>
                            <p style="margin-top: 8px;">Bill Summary</p>
                            <p>${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                          </div>
                          <div class="section">
                            <div class="row"><span>Customer:</span><span>${client?.name || 'Walk-in Customer'}</span></div>
                            ${client?.phone ? `<div class="row"><span>Phone:</span><span>${client.phone}</span></div>` : ''}
                          </div>
                          <div class="section">
                            <div class="section-title">Current Bill #${selectedBill.id}</div>
                            <div class="row"><span>Bill Date:</span><span>${format(new Date(selectedBill.billDate), "dd/MM/yyyy")}</span></div>
                            <div class="row"><span>Total Amount:</span><span>${parseFloat(selectedBill.amount).toFixed(2)} AED</span></div>
                            <div class="row"><span>Paid:</span><span>${parseFloat(selectedBill.paidAmount || "0").toFixed(2)} AED</span></div>
                            <div class="row bold"><span>Balance:</span><span>${currentBillDue.toFixed(2)} AED</span></div>
                            ${selectedBill.createdBy ? `<div class="row"><span>Billed by:</span><span>${selectedBill.createdBy}</span></div>` : ''}
                          </div>
                          ${otherUnpaidBills.length > 0 ? `
                          <div class="section">
                            <div class="section-title">Previous Unpaid Bills (${otherUnpaidBills.length})</div>
                            ${otherUnpaidBills.map(bill => {
                              const due = parseFloat(bill.amount) - parseFloat(bill.paidAmount || "0") - parseFloat(bill.refundedAmount || "0");
                              return `<div class="row"><span>Bill #${bill.id} (${format(new Date(bill.billDate), "dd/MM/yy")})</span><span>${due.toFixed(2)} AED</span></div>`;
                            }).join('')}
                            <div class="row bold" style="margin-top: 5px; border-top: 1px dashed #999; padding-top: 5px;"><span>Previous Total:</span><span>${totalPreviousDue.toFixed(2)} AED</span></div>
                          </div>
                          ` : ''}
                          <div class="total-box">
                            <div class="grand-total">TOTAL AMOUNT DUE: ${grandTotalDue.toFixed(2)} AED</div>
                          </div>
                          <div class="footer">
                            <p>Thank you for your business!</p>
                          </div>
                        </body>
                      </html>
                    `;
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(printContent);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  data-testid="button-print-bill-summary"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowBillDialog(false);
                    setLocation("/bills");
                  }}
                >
                  Go to Bills
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Items Dialog */}
      <Dialog
        open={!!editItemsDialog}
        onOpenChange={(open) => !open && setEditItemsDialog(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              Edit Order Items
            </DialogTitle>
            <DialogDescription>
              Adjust item quantities for order #{editItemsDialog?.orderNumber}. The bill will be recalculated automatically.
            </DialogDescription>
          </DialogHeader>
          {editItemsDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-medium">{editItemsDialog.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {clients?.find((c) => c.id === editItemsDialog.clientId)?.name || editItemsDialog.customerName || "Walk-in"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Total:</span>
                  <span className="font-medium">AED {editItemsDialog.finalAmount || editItemsDialog.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-muted-foreground">New Total:</span>
                  <span className="font-bold text-primary">AED {calculateEditItemsTotal().toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Items</Label>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {parseOrderItems(editItemsDialog.items).map((item) => {
                    const itemPrice = getItemPrice(item.name);
                    const qty = editItemsQuantities[item.name] || 0;
                    const lineTotal = itemPrice * qty;
                    return (
                      <div key={item.name} className="flex items-center justify-between p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(products?.find(p => p.name === item.name)?.category || null, "w-4 h-4")}
                            <span className="font-medium text-sm truncate">{item.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 ml-6">
                            {itemPrice.toFixed(2)} AED each = <span className="font-medium text-foreground">{lineTotal.toFixed(2)} AED</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => handleUpdateItemQuantity(item.name, -1)}
                            data-testid={`button-decrease-${item.name}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {qty}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => handleUpdateItemQuantity(item.name, 1)}
                            data-testid={`button-increase-${item.name}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Staff PIN (5 digits)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Enter your 5-digit PIN"
                  value={editItemsPin}
                  onChange={(e) => {
                    setEditItemsPin(e.target.value.replace(/\D/g, "").slice(0, 5));
                    setEditItemsPinError("");
                  }}
                  data-testid="input-edit-items-pin"
                />
                {editItemsPinError && (
                  <p className="text-sm text-destructive">{editItemsPinError}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditItemsDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitEditItems}
                  disabled={isEditingItems || editItemsPin.length !== 5}
                  data-testid="button-submit-edit-items"
                >
                  {isEditingItems ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Items"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Incident Report Dialog */}
      <Dialog
        open={!!incidentReportOrder}
        onOpenChange={(open) => !open && resetIncidentForm()}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Report Incident / Missing Item
            </DialogTitle>
            <DialogDescription>
              Report an issue with order #{incidentReportOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {incidentReportOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-medium">
                    {incidentReportOrder.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {clients?.find((c) => c.id === incidentReportOrder.clientId)
                      ?.name ||
                      incidentReportOrder.customerName ||
                      "Walk-in"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Responsible Staff:
                  </span>
                  <span className="font-medium">
                    {incidentReportOrder.packingBy || "Not assigned"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Incident Type</Label>
                <Select value={incidentType} onValueChange={setIncidentType}>
                  <SelectTrigger data-testid="select-incident-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing_item">Missing Item</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="complaint">
                      Customer Complaint
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Item(s)</Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {parseOrderItems(incidentReportOrder.items).map(
                    (item, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <Checkbox
                          id={`item-${idx}`}
                          checked={incidentItems.includes(
                            `${item.name} x${item.quantity}`,
                          )}
                          onCheckedChange={(checked) => {
                            const itemStr = `${item.name} x${item.quantity}`;
                            if (checked) {
                              setIncidentItems([...incidentItems, itemStr]);
                            } else {
                              setIncidentItems(
                                incidentItems.filter((i) => i !== itemStr),
                              );
                            }
                          }}
                          data-testid={`checkbox-item-${idx}`}
                        />
                        <label
                          htmlFor={`item-${idx}`}
                          className="text-sm flex-1"
                        >
                          {item.name} x{item.quantity}
                        </label>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason / Description</Label>
                <Textarea
                  placeholder="Describe the incident..."
                  value={incidentReason}
                  onChange={(e) => setIncidentReason(e.target.value)}
                  data-testid="input-incident-reason"
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  placeholder="Any additional details..."
                  value={incidentNotes}
                  onChange={(e) => setIncidentNotes(e.target.value)}
                  data-testid="input-incident-notes"
                />
              </div>

              <div className="space-y-2">
                <Label>Your Name (Reporter)</Label>
                <Input
                  placeholder="Enter your name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  data-testid="input-reporter-name"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetIncidentForm}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={submitIncidentReport}
                  disabled={createIncidentMutation.isPending}
                  data-testid="button-submit-incident"
                >
                  {createIncidentMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Report Incident
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderForm({
  clients,
  bills,
  onSubmit,
  isLoading,
  initialClientId,
  initialBillId,
  createdByUser,
  creatorRole,
}: {
  clients: Client[];
  bills: Bill[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
  initialClientId?: string;
  initialBillId?: string;
  createdByUser?: string;
  creatorRole?: string;
}) {
  const { toast } = useToast();
  
  // Get user role from localStorage for permission checking
  const storedUser = localStorage.getItem("user");
  const userInfo = storedUser ? JSON.parse(storedUser) : null;
  const userRole = userInfo?.role || creatorRole || "";
  
  const [formData, setFormData] = useState({
    clientId: initialClientId || "",
    orderType: "normal",
    deliveryType: "pickup",
    paymentOption: "pay_later",
    expectedDeliveryAt: "",
    deliveryAddress: "",
    notes: "",
    billOption: (initialBillId ? "existing" : "new") as "new" | "existing",
    selectedBillId: initialBillId || "",
    customerName: "",
    customerPhone: "+971",
  });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [productSearch, setProductSearch] = useState("");

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const selectedClient = clients.find(
    (c) => c.id === parseInt(formData.clientId),
  );

  const clientUnpaidBills = useMemo(() => {
    if (!formData.clientId || !bills) return [];
    const clientId = parseInt(formData.clientId);
    return bills.filter((b) => b.clientId === clientId && !b.isPaid);
  }, [formData.clientId, bills]);

  const clientTotalDue = useMemo(() => {
    return clientUnpaidBills.reduce((sum, b) => {
      const billAmount = parseFloat(b.amount) || 0;
      const paidAmount = parseFloat(b.paidAmount || "0") || 0;
      return sum + (billAmount - paidAmount);
    }, 0);
  }, [clientUnpaidBills]);

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  const groupedProducts = useMemo(() => {
    if (!filteredProducts) return {};
    const groups: Record<string, typeof filteredProducts> = {};
    const categoryOrder = [
      "Arabic Clothes",
      "Men's Clothes",
      "Ladies' Clothes",
      "Baby Clothes",
      "Linens",
      "Shop Items",
      "General Items",
      "Shoes, Carpets & More",
    ];
    
    filteredProducts.forEach((product) => {
      const category = product.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });
    
    const sortedGroups: Record<string, typeof filteredProducts> = {};
    categoryOrder.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });
    Object.keys(groups).forEach((cat) => {
      if (!sortedGroups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });
    
    return sortedGroups;
  }, [filteredProducts]);

  const handleQuantityChange = (productId: number, delta: number) => {
    setQuantities((prev) => {
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
    setQuantities((prev) => {
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
        const product = products.find((p) => p.id === parseInt(productId));
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as { product: Product; quantity: number }[];
  }, [quantities, products]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + parseFloat(item.product.price || "0") * item.quantity;
    }, 0);
  }, [orderItems]);

  // Check if entered info matches an existing client (moved before handleSubmit)
  const clientMatch = useMemo(() => {
    if (formData.clientId !== "walkin") return null;
    
    const normalizedPhone = formData.customerPhone?.replace(/\D/g, '').replace(/^(00971|971|\+971|0)/, '') || '';
    const enteredName = formData.customerName?.trim().toLowerCase() || '';
    const enteredAddress = formData.deliveryAddress?.trim().toLowerCase() || '';
    
    for (const client of clients) {
      const clientPhone = client.phone?.replace(/\D/g, '').replace(/^(00971|971|\+971|0)/, '') || '';
      const clientName = client.name?.trim().toLowerCase() || '';
      const clientAddress = client.address?.trim().toLowerCase() || '';
      
      const phoneMatches = clientPhone && normalizedPhone && clientPhone === normalizedPhone && normalizedPhone.length >= 7;
      const nameMatches = clientName && enteredName && clientName === enteredName;
      const addressMatches = clientAddress && enteredAddress && clientAddress === enteredAddress;
      
      if (phoneMatches) {
        if (nameMatches && addressMatches) {
          return { client, matchType: 'full', message: 'Name, phone number, and address match an existing client' };
        } else if (nameMatches) {
          return { client, matchType: 'name_phone', message: 'Name and phone number match an existing client' };
        } else {
          return { client, matchType: 'phone', message: 'Phone number matches an existing client' };
        }
      }
    }
    return null;
  }, [formData.customerPhone, formData.customerName, formData.deliveryAddress, formData.clientId, clients]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;
    // For walk-in, require customer name
    if (formData.clientId === "walkin" && !formData.customerName.trim()) {
      toast({ title: "Please enter customer name", variant: "destructive" });
      return;
    }
    // If walk-in matches existing client, block submission and prompt to use existing
    if (formData.clientId === "walkin" && clientMatch) {
      toast({ 
        title: "This client is already in the system!", 
        description: `Please use the existing client: ${clientMatch.client.name}`,
        variant: "destructive" 
      });
      return;
    }
    // For regular clients, require clientId
    if (!formData.clientId) return;

    const itemsText = orderItems
      .map((item) => `${item.quantity}x ${item.product.name}`)
      .join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    const billId =
      formData.billOption === "existing" && formData.selectedBillId
        ? parseInt(formData.selectedBillId)
        : null;

    const isWalkIn = formData.clientId === "walkin";

    onSubmit({
      ...formData,
      clientId: isWalkIn ? null : parseInt(formData.clientId),
      billId,
      orderNumber,
      items: itemsText,
      totalAmount: orderTotal.toFixed(2),
      entryDate: new Date().toISOString(),
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      paymentOption: formData.paymentOption,
      expectedDeliveryAt: formData.expectedDeliveryAt || null,
      createNewBill: formData.billOption === "new",
      createdBy: createdByUser || userInfo?.name || userInfo?.username,
      creatorRole: userRole,
    });
  };

  function handleClientChange(clientId: string) {
    if (clientId === "walkin") {
      // For walk-in, clear customer info so user can enter it
      setFormData({
        ...formData,
        clientId,
        selectedBillId: "",
        billOption: "new",
        customerName: "",
        customerPhone: "+971",
        deliveryAddress: "",
      });
    } else {
      const client = clients.find((c) => c.id === parseInt(clientId));
      setFormData({
        ...formData,
        clientId,
        selectedBillId: "",
        billOption: "new",
        customerName: client?.name || "",
        customerPhone: client?.phone || "+971",
        deliveryAddress: client?.address || "",
      });
    }
  }
  useEffect(() => {
    console.log("Form Data Updated:", formData);
  }, [formData]); // This runs every time formData changes

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={formData.clientId} onValueChange={handleClientChange}>
          <SelectTrigger data-testid="select-client">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent className="z-[100] max-h-[300px]">
            <SelectItem value="walkin">Walk-in Customer</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name} - {client.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.clientId === "walkin" && (
        <>
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              placeholder="Enter customer name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              data-testid="input-customer-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <div className="flex flex-col gap-1">
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                  +971
                </span>
                <Input
                  className={`rounded-l-none ${(formData.customerPhone?.replace(/^\+971/, "").replace(/\D/g, "").length || 0) >= 9 ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                  placeholder="XXXXXXXXX"
                  value={formData.customerPhone?.replace(/^\+971/, "").replace(/\D/g, "").slice(0, 9) || ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                    setFormData({ ...formData, customerPhone: "+971" + digits });
                  }}
                  inputMode="numeric"
                  maxLength={9}
                  data-testid="input-customer-phone"
                />
              </div>
              {(formData.customerPhone?.replace(/^\+971/, "").replace(/\D/g, "").length || 0) >= 9 && (
                <p className="text-xs text-green-600 font-medium">9 digits - limit reached</p>
              )}
            </div>
            {clientMatch && (
              <div className="p-4 border-2 border-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg mt-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-700 dark:text-red-400 text-base">
                    CUSTOMER ALREADY EXISTS!
                  </span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {clientMatch.message}: <strong className="text-red-700">{clientMatch.client.name}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Phone: {clientMatch.client.phone}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleClientChange(clientMatch.client.id.toString())}
                  data-testid="button-use-existing-client"
                >
                  Click here to use existing client: {clientMatch.client.name}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Order Type</Label>
        <Select
          value={formData.orderType}
          onValueChange={(v) => setFormData({ ...formData, orderType: v })}
        >
          <SelectTrigger data-testid="select-order-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Delivery Type</Label>
        <Select
          value={formData.deliveryType}
          onValueChange={(v) => setFormData({ ...formData, deliveryType: v })}
        >
          <SelectTrigger data-testid="select-delivery-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Payment Option</Label>
        <Select
          value={formData.paymentOption}
          onValueChange={(v) => setFormData({ ...formData, paymentOption: v })}
        >
          <SelectTrigger data-testid="select-payment-option">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pay_later">Pay Later</SelectItem>
            <SelectItem value="pay_now">Pay Now</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.deliveryType === "delivery" && (
        <div className="space-y-2">
          <Label>Delivery Address *</Label>
          <Textarea
            placeholder="Enter delivery address..."
            value={formData.deliveryAddress}
            onChange={(e) =>
              setFormData({ ...formData, deliveryAddress: e.target.value })
            }
            data-testid="input-delivery-address"
            className="min-h-[60px]"
            required
          />
        </div>
      )}

      {formData.deliveryType === "delivery" && (
        <div className="space-y-2">
          <Label>Expected Delivery</Label>
          <Input
            type="datetime-local"
            value={formData.expectedDeliveryAt}
            onChange={(e) =>
              setFormData({ ...formData, expectedDeliveryAt: e.target.value })
            }
            data-testid="input-delivery-time"
          />
        </div>
      )}

      {selectedClient && clientTotalDue > 0 && (
        <div className="p-3 border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-orange-700 dark:text-orange-400">
              Client has due bills
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              {clientUnpaidBills.length} unpaid bill(s)
            </span>
            <span className="font-bold text-orange-600">
              {clientTotalDue.toFixed(2)} AED
            </span>
          </div>
          <div className="space-y-2 max-h-24 overflow-auto">
            {clientUnpaidBills.map((bill) => (
              <div
                key={bill.id}
                className="flex justify-between items-center text-sm bg-white/50 dark:bg-black/20 rounded px-2 py-1"
              >
                <span className="text-muted-foreground">
                  Bill #{bill.referenceNumber || bill.id} -{" "}
                  {format(new Date(bill.billDate), "dd/MM/yy")}
                </span>
                <span className="font-medium text-orange-600">
                  {(
                    parseFloat(bill.amount) - parseFloat(bill.paidAmount || "0")
                  ).toFixed(2)}{" "}
                  AED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedClient && clientUnpaidBills.length > 0 && (
        <div className="space-y-2">
          <Label>Billing Option</Label>
          <div className="flex gap-4">
            <Button
              type="button"
              variant={formData.billOption === "new" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setFormData({
                  ...formData,
                  billOption: "new",
                  selectedBillId: "",
                })
              }
              data-testid="button-new-bill"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create New Bill
            </Button>
            <Button
              type="button"
              variant={
                formData.billOption === "existing" ? "default" : "outline"
              }
              size="sm"
              onClick={() =>
                setFormData({ ...formData, billOption: "existing" })
              }
              data-testid="button-existing-bill"
            >
              <Receipt className="w-4 h-4 mr-1" />
              Add to Existing Bill
            </Button>
          </div>
          {formData.billOption === "existing" && (
            <Select
              value={formData.selectedBillId}
              onValueChange={(v) =>
                setFormData({ ...formData, selectedBillId: v })
              }
            >
              <SelectTrigger data-testid="select-existing-bill">
                <SelectValue placeholder="Select unpaid bill" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {clientUnpaidBills.map((bill) => (
                  <SelectItem key={bill.id} value={bill.id.toString()}>
                    Bill #{bill.referenceNumber || bill.id} -{" "}
                    {format(new Date(bill.billDate), "dd/MM/yy")} (
                    {(
                      parseFloat(bill.amount) -
                      parseFloat(bill.paidAmount || "0")
                    ).toFixed(2)}{" "}
                    AED due)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Select Items</Label>
        <Input
          placeholder="Search items..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="mb-2"
          data-testid="input-product-search"
        />
        <ScrollArea className="h-80 border rounded-lg">
          <Accordion type="multiple" defaultValue={Object.keys(groupedProducts)} className="w-full">
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="px-3 py-2 text-sm font-semibold bg-muted/30 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category, "w-5 h-5")}
                    <span>{category}</span>
                    <Badge variant="secondary" className="text-xs">
                      {categoryProducts?.length || 0}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <Table>
                    <TableBody>
                      {categoryProducts?.map((product) => (
                        <TableRow
                          key={product.id}
                          className={quantities[product.id] ? "bg-primary/5" : ""}
                        >
                          <TableCell className="font-medium text-sm py-2">
                            {product.name}
                          </TableCell>
                          <TableCell className="text-right text-sm text-primary font-semibold w-16 py-2">
                            {product.price
                              ? `${parseFloat(product.price).toFixed(0)}`
                              : "-"}
                          </TableCell>
                          <TableCell className="w-32 py-2">
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
                                onChange={(e) =>
                                  handleManualQuantity(product.id, e.target.value)
                                }
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
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </div>

      {orderItems.length > 0 && (
        <div className="p-3 bg-primary/5 rounded-lg border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              {orderItems.length} item(s) selected
            </span>
            <span className="text-lg font-bold text-primary">
              {orderTotal.toFixed(2)} AED
            </span>
          </div>
          <div className="flex items-center justify-between mb-3 pb-3 border-b">
            <span className="text-xs font-medium text-muted-foreground">
              Action:
            </span>
            <Select
              value={formData.deliveryType}
              onValueChange={(v) =>
                setFormData({ ...formData, deliveryType: v })
              }
            >
              <SelectTrigger className="w-32 h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">for pickup</SelectItem>
                <SelectItem value="delivery">for delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {orderItems
              .map((item) => `${item.quantity}x ${item.product.name}`)
              .join(", ")}
          </p>
        </div>
      )}

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
        disabled={
          isLoading ||
          !formData.clientId ||
          orderItems.length === 0 ||
          (formData.billOption === "existing" && !formData.selectedBillId) ||
          (formData.deliveryType === "delivery" &&
            !formData.deliveryAddress.trim()) ||
          !!clientMatch
        }
        data-testid="button-submit-order"
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {clientMatch ? "Use existing client above" : `Create Order (${orderTotal.toFixed(2)} AED)`}
      </Button>
      {clientMatch && (
        <p className="text-sm text-red-600 text-center font-medium">
          Cannot create order - Customer "{clientMatch.client.name}" already exists with this phone number
        </p>
      )}
      {formData.billOption === "existing" && !formData.selectedBillId && (
        <p className="text-sm text-orange-600 text-center">
          Please select an existing bill to attach this order to
        </p>
      )}
      {formData.deliveryType === "delivery" &&
        !formData.deliveryAddress.trim() && (
          <p className="text-sm text-orange-600 text-center">
            Delivery address is required for delivery orders
          </p>
        )}
    </form>
  );
}
