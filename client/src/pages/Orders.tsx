import { useState, useEffect, useMemo, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  const [deliveryInvoiceOrder, setDeliveryInvoiceOrder] =
    useState<Order | null>(null);

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
      queryClient.invalidateQueries({
        queryKey: ["/api/products/allocated-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Order Updated",
        description: "Status updated successfully",
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
    onError: (error) => {
      try {
        const errorMsg = error.message; // e.g., '400: {"message":"Customer name is required"}'

        // 1. Split the string at the first colon
        const firstColonIndex = errorMsg.indexOf(":");

        if (firstColonIndex !== -1) {
          const statusCode = errorMsg.substring(0, firstColonIndex).trim();
          const jsonString = errorMsg.substring(firstColonIndex + 1).trim();

          // 2. Parse the JSON part
          const parsedBody = JSON.parse(jsonString);
          const cleanMessage = parsedBody.message || "An error occurred";

          toast({
            title: `Error ${statusCode}`,
            description: cleanMessage,
            variant: "destructive",
          });
        } else {
          // Fallback if the format doesn't match the "400: {}" pattern
          throw new Error("Standard format not found");
        }
      } catch (err) {
        // If JSON parsing fails or the string is malformed
        toast({
          title: "Order Error",
          description: error.message || "Failed to create order",
          variant: "destructive",
        });
      }
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
      bills?.filter((b) => b.clientId === order.clientId) || [];
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
      <div style="font-family: Arial, sans-serif; padding: 15px; max-width: 148mm; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 10px; margin-top: 4px; color: #666;">Professional Laundry Services - UAE</div>
          <div style="font-size: 9px; margin-top: 2px; color: #888;">For Orders/Delivery: +971 50 123 4567</div>
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
          order.discountPercent && parseFloat(order.discountPercent) > 0
            ? `
        <div style="text-align: right; margin-bottom: 5px;">
          <span style="font-size: 10px; color: #666;">Discount: </span>
          <span style="font-size: 11px; font-weight: bold; color: #16a34a;">${order.discountPercent}%</span>
        </div>
        `
            : ""
        }
        
        ${
          order.tips && parseFloat(order.tips) > 0
            ? `
        <div style="text-align: right; margin-bottom: 5px;">
          <span style="font-size: 10px; color: #666;">Tips: </span>
          <span style="font-size: 11px; font-weight: bold;">AED ${parseFloat(order.tips).toFixed(2)}</span>
        </div>
        `
            : ""
        }
        
        ${
          totalPreviousDue > 0
            ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px; margin-bottom: 10px;">
          <div style="font-size: 10px; font-weight: bold; color: #856404; margin-bottom: 4px;">PREVIOUS OUTSTANDING DUES</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 9px; color: #856404;">${unpaidBills.length} unpaid bill(s)</span>
            <span style="font-size: 12px; font-weight: bold; color: #dc3545;">AED ${totalPreviousDue.toFixed(2)}</span>
          </div>
        </div>
        `
            : ""
        }
        
        ${
          order.notes
            ? `
        <div style="background: #e8f4fd; border: 1px solid #90cdf4; border-radius: 4px; padding: 8px; margin-bottom: 10px;">
          <div style="font-size: 9px; font-weight: bold; color: #2b6cb0; margin-bottom: 3px;">ORDER NOTES</div>
          <div style="font-size: 10px;">${order.notes}</div>
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
          <div style="margin-top: 4px; font-weight: bold; color: #000; font-size: 9px;">For Orders/Delivery: +971 50 123 4567</div>
          <div style="margin-top: 3px;">Generated on ${format(new Date(), "dd MMM yyyy 'at' hh:mm a")}</div>
        </div>
      </div>
    `;

    const opt = {
      margin: 8,
      filename: `Tag_${order.orderNumber}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm",
        format: "a5" as const,
        orientation: "portrait" as const,
      },
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
          <div style="font-weight: bold; color: #000; font-size: 10px; margin-top: 5px;">Orders/Delivery: +971 50 123 4567</div>
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
              itemCountVerified: itemCountVerified,
              verifiedAt: itemCountVerified ? new Date().toISOString() : null,
              verifiedByWorkerId: itemCountVerified ? data.worker.id : null,
              verifiedByWorkerName: itemCountVerified ? data.worker.name : null,
            },
          },
          {
            onSuccess: () => {
              // Show invoice after delivery
              if (currentOrder) {
                setDeliveryInvoiceOrder({
                  ...currentOrder,
                  delivered: true,
                  deliveryDate: new Date(),
                  deliveryBy: data.worker.name,
                });
              }
            },
          },
        );
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
    setDeliveryConfirmDialog({ orderId });
  };

  const confirmDeliveryAndProceed = () => {
    if (deliveryConfirmDialog) {
      setDeliveryPinDialog({ orderId: deliveryConfirmDialog.orderId });
      setDeliveryPin("");
      setDeliveryPinError("");
      setItemCountVerified(false);
      setDeliveryConfirmDialog(null);
    }
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
              if (nextOrder) {
                setTagPinDialog({ orderId: nextOrder.id });
                setTagPin("");
                setTagPinError("");
                toast({
                  title: "Tag Complete",
                  description: `Moving to next order: ${nextOrder.orderNumber}`,
                });
              } else {
                setTagPinDialog(null);
                setTagPin("");
                setTagPinError("");
                toast({
                  title: "All Done",
                  description: "No more orders pending for tagging",
                });
              }
            },
          },
        );
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
              <span className="hidden sm:inline">Order Tracking</span>
              <span className="sm:hidden">Orders</span>
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
            <Dialog open={isCreateOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button
                  className="h-11 px-3 lg:px-4 touch-manipulation whitespace-nowrap"
                  data-testid="button-new-order"
                >
                  <Plus className="w-4 h-4 lg:mr-2" />
                  <span className="hidden lg:inline">New Order</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                </DialogHeader>
                <OrderForm
                  key={`${prefilledClientId || ""}-${prefilledBillId || ""}`}
                  clients={clients || []}
                  bills={bills || []}
                  onSubmit={(data) => createOrderMutation.mutate(data)}
                  isLoading={createOrderMutation.isPending}
                  initialClientId={prefilledClientId}
                  initialBillId={prefilledBillId}
                />
              </DialogContent>
            </Dialog>
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
                            <div className="flex items-center gap-2">
                              {getStatusBadge(order)}
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
                                    className="font-medium text-left justify-start gap-2"
                                    data-testid={`button-mobile-client-${order.id}`}
                                  >
                                    <User className="w-4 h-4 text-primary shrink-0" />
                                    <span className="truncate max-w-[140px]">
                                      {displayName}
                                    </span>
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
                                      </div>
                                    </div>
                                    {client && (
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="text-sm">
                                          Balance:
                                        </span>
                                        <span
                                          className={`font-bold ${parseFloat(client.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`}
                                        >
                                          {parseFloat(
                                            client.balance || "0",
                                          ).toFixed(2)}{" "}
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

                            {/* Items Row */}
                            <div className="flex items-center justify-between gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    data-testid={`button-mobile-items-${order.id}`}
                                  >
                                    <Package className="w-3.5 h-3.5" />
                                    <span>{totalItems} items</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-64 p-2"
                                  align="start"
                                >
                                  <ScrollArea className="max-h-48">
                                    <div className="space-y-1">
                                      {items.map((item, i) => {
                                        const imageUrl = getProductImage(
                                          item.name,
                                        );
                                        return (
                                          <div
                                            key={i}
                                            className="flex items-center gap-2 p-1.5 rounded bg-muted/50"
                                          >
                                            {imageUrl ? (
                                              <img
                                                src={imageUrl}
                                                alt=""
                                                className="w-6 h-6 rounded object-cover"
                                              />
                                            ) : (
                                              <Shirt className="w-5 h-5 text-muted-foreground" />
                                            )}
                                            <span className="text-sm flex-1 truncate">
                                              {item.name}
                                            </span>
                                            <Badge
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {item.quantity}
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                              <span className="text-xs text-muted-foreground">
                                {getTimeRemaining(order.expectedDeliveryAt)}
                              </span>
                            </div>
                          </CardContent>

                          {/* Card Footer - Actions */}
                          <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPrintOrder(order)}
                              data-testid={`button-mobile-print-${order.id}`}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>

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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                      data-testid={`button-mobile-checklist-tagging-${order.id}`}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Checklists
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setStageChecklistDialog({
                                          order,
                                          stage: "tagging",
                                        })
                                      }
                                    >
                                      Tagging Checklist
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                      data-testid={`button-mobile-checklist-${order.id}`}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Checklists
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setStageChecklistDialog({
                                          order,
                                          stage: "tagging",
                                        })
                                      }
                                    >
                                      Tagging Checklist
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setStageChecklistDialog({
                                          order,
                                          stage: "packing",
                                        })
                                      }
                                    >
                                      Packing Checklist
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() =>
                                    handleDeliveryWithPin(order.id)
                                  }
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
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() =>
                                    handleDeliveryWithPin(order.id)
                                  }
                                  data-testid={`button-mobile-pickup-${order.id}`}
                                >
                                  <Package className="w-4 h-4 mr-1" />
                                  Ready for Pickup
                                </Button>
                              )}

                            {order.delivered && (
                              <>
                                <Badge
                                  variant="outline"
                                  className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Done
                                </Badge>
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
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => setNewCreatedOrder(order)}
                                  data-testid={`button-mobile-invoice-${order.id}`}
                                >
                                  <Receipt className="w-4 h-4 mr-1" />
                                  Invoice
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-orange-500"
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
                    <div
                      className="overflow-x-auto scrollbar-always-visible"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <Table className="w-full min-w-[900px]">
                        <TableHeader>
                          <TableRow className="transition-all duration-200">
                            <TableHead className="whitespace-nowrap w-16 sm:w-auto">
                              Order
                            </TableHead>
                            <TableHead className="whitespace-nowrap hidden lg:table-cell">
                              Bill
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              Client
                            </TableHead>
                            <TableHead className="whitespace-nowrap hidden xl:table-cell">
                              Due
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              Items
                            </TableHead>
                            {activeTab !== "create" && (
                              <TableHead className="whitespace-nowrap hidden sm:table-cell">
                                Amount
                              </TableHead>
                            )}
                            <TableHead className="whitespace-nowrap hidden lg:table-cell">
                              Type
                            </TableHead>
                            <TableHead className="whitespace-nowrap hidden sm:table-cell">
                              Time
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-20 sm:w-auto">
                              Status
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
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
                                    <TableCell className="font-mono font-bold text-sm">
                                      {order.orderNumber}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                      {order.billId ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="font-mono text-primary h-auto py-1 px-2"
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
                                          <Receipt className="w-3 h-3 mr-1" />#
                                          {order.billId}
                                        </Button>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">
                                          -
                                        </span>
                                      )}
                                    </TableCell>
                                    {idx === 0 ? (
                                      <>
                                        <TableCell
                                          rowSpan={orderCount}
                                          className="align-top border-r p-0 w-20 sm:w-28 md:w-32 lg:w-40"
                                        >
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                className="w-full h-full justify-start px-2 sm:px-3 py-2 font-semibold hover-elevate touch-manipulation"
                                                data-testid={`button-client-${client?.id || "walkin"}`}
                                              >
                                                <User className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                                                <span className="truncate text-xs sm:text-sm">
                                                  {displayName}
                                                </span>
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
                                                <div className="flex justify-between items-center gap-2">
                                                  <span className="text-sm">
                                                    Total Due:
                                                  </span>
                                                  <span
                                                    className={`font-bold ${parseFloat(client?.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`}
                                                  >
                                                    {parseFloat(
                                                      client?.balance || "0",
                                                    ).toFixed(2)}{" "}
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
                                        <TableCell
                                          rowSpan={orderCount}
                                          className={`align-top font-semibold border-r hidden xl:table-cell ${parseFloat(client?.balance || "0") > 0 ? "text-destructive" : "text-green-600"}`}
                                          data-testid={`text-client-due-${order.id}`}
                                        >
                                          {parseFloat(
                                            client?.balance || "0",
                                          ).toFixed(2)}{" "}
                                          AED
                                        </TableCell>
                                      </>
                                    ) : null}
                                    <TableCell>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 touch-manipulation text-xs sm:text-sm"
                                            data-testid={`button-view-items-${order.id}`}
                                          >
                                            <Package className="w-3 h-3" />
                                            <span className="font-medium">
                                              {parseOrderItems(
                                                order.items,
                                              ).reduce(
                                                (sum, item) =>
                                                  sum + item.quantity,
                                                0,
                                              )}
                                            </span>
                                            <ChevronDown className="w-3 h-3" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                          className="w-64 p-2"
                                          align="start"
                                        >
                                          <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {parseOrderItems(order.items).map(
                                              (item, i) => {
                                                const imageUrl =
                                                  getProductImage(item.name);
                                                return (
                                                  <div
                                                    key={i}
                                                    className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1.5"
                                                  >
                                                    {imageUrl ? (
                                                      <img
                                                        src={imageUrl}
                                                        alt={item.name}
                                                        className="w-5 h-5 object-contain"
                                                      />
                                                    ) : (
                                                      <Shirt className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                    <span className="text-sm flex-1 truncate">
                                                      {item.name}
                                                    </span>
                                                    <Badge
                                                      variant="secondary"
                                                      className="text-xs"
                                                    >
                                                      {item.quantity}
                                                    </Badge>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </TableCell>
                                    {activeTab !== "create" && (
                                      <TableCell className="font-semibold hidden sm:table-cell">
                                        {order.totalAmount} AED
                                      </TableCell>
                                    )}
                                    <TableCell className="hidden lg:table-cell">
                                      <Select
                                        value={order.deliveryType || ""}
                                        onValueChange={(newType) => {
                                          updateOrderMutation.mutate({
                                            id: order.id,
                                            updates: { deliveryType: newType },
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="w-24 h-8">
                                          <SelectValue>
                                            {order.deliveryType ===
                                            "delivery" ? (
                                              <div className="flex items-center gap-1">
                                                <Truck className="w-3 h-3" />{" "}
                                                Delivery
                                              </div>
                                            ) : (
                                              "Pickup"
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
                                    <TableCell className="hidden sm:table-cell">
                                      {getTimeRemaining(
                                        order.expectedDeliveryAt,
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(order)}
                                    </TableCell>
                                    <TableCell className="p-2 sm:p-3 lg:p-4">
                                      <div className="action-buttons">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="shrink-0 touch-manipulation"
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
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="bg-green-100 text-green-700 border-green-300 whitespace-nowrap touch-manipulation"
                                                  data-testid={`button-checklist-tagging-${order.id}`}
                                                >
                                                  <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                                  <span className="hidden sm:inline">
                                                    Checklists
                                                  </span>
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    setStageChecklistDialog({
                                                      order,
                                                      stage: "tagging",
                                                    })
                                                  }
                                                >
                                                  Tagging Checklist
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
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
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-green-100 text-green-700 border-green-300 whitespace-nowrap touch-manipulation"
                                                    data-testid={`button-checklist-${order.id}`}
                                                  >
                                                    <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                                    <span className="hidden sm:inline">
                                                      Checklists
                                                    </span>
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      setStageChecklistDialog({
                                                        order,
                                                        stage: "tagging",
                                                      })
                                                    }
                                                  >
                                                    Tagging Checklist
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      setStageChecklistDialog({
                                                        order,
                                                        stage: "packing",
                                                      })
                                                    }
                                                  >
                                                    Packing Checklist
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
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
                                              className="whitespace-nowrap touch-manipulation bg-green-600 hover:bg-green-700"
                                              onClick={() =>
                                                handleDeliveryWithPin(order.id)
                                              }
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
                                              className="whitespace-nowrap touch-manipulation bg-green-600 hover:bg-green-700"
                                              onClick={() =>
                                                handleDeliveryWithPin(order.id)
                                              }
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
                                            <Badge
                                              variant="outline"
                                              className="text-green-600 hidden sm:inline-flex"
                                            >
                                              Completed
                                            </Badge>
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
                                              size="sm"
                                              variant="outline"
                                              className="whitespace-nowrap touch-manipulation"
                                              onClick={() => {
                                                setNewCreatedOrder(order);
                                              }}
                                              data-testid={`button-invoice-${order.id}`}
                                            >
                                              <Receipt className="w-3 h-3 sm:mr-1" />
                                              <span className="hidden sm:inline">
                                                Invoice
                                              </span>
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="shrink-0 touch-manipulation text-orange-500"
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
                      +971 50 123 4567
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
                    For Orders/Delivery: +971 50 123 4567
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
        <DialogContent className="sm:max-w-lg">
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

      {/* Delivery Confirmation Dialog */}
      <Dialog
        open={!!deliveryConfirmDialog}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveryConfirmDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Order Completion
            </DialogTitle>
            <DialogDescription>
              Are you sure this order is correct and ready to be marked as delivered/picked up?
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              This action cannot be undone. Once marked as delivered or picked up:
            </p>
            <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 list-disc pl-5 space-y-1">
              <li>The order status cannot be changed</li>
              <li>The delivery type cannot be modified</li>
              <li>All items will be considered released</li>
            </ul>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeliveryConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={confirmDeliveryAndProceed}
            >
              Yes, Proceed
            </Button>
          </DialogFooter>
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
                  <span className="text-xs text-muted-foreground">
                    Click to add photo
                  </span>
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

            {/* Item Count Verification Section */}
            {deliveryPinDialog &&
              (() => {
                const order = orders?.find(
                  (o) => o.id === deliveryPinDialog.orderId,
                );
                const itemCount = order?.items
                  ? parseItems(order.items).reduce(
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
        <DialogContent className="max-w-md">
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
              </div>

              {selectedBill.description && (
                <div className="border-t pt-3">
                  <div className="text-sm text-muted-foreground mb-1">
                    Description:
                  </div>
                  <div className="text-sm">{selectedBill.description}</div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBillDialog(false)}
                >
                  Close
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

      {/* Delivery Invoice Dialog */}
      {deliveryInvoiceOrder &&
        (() => {
          const invoiceClient = clients?.find(
            (c) => c.id === deliveryInvoiceOrder.clientId,
          );
          const clientUnpaidBills =
            bills?.filter(
              (b) => b.clientId === deliveryInvoiceOrder.clientId && !b.isPaid,
            ) || [];
          const clientPreviousBalance = invoiceClient?.balance
            ? parseFloat(invoiceClient.balance)
            : 0;
          const clientPendingBillsTotal = clientUnpaidBills.reduce((sum, b) => {
            const billAmount = parseFloat(b.amount) || 0;
            const paidAmount = parseFloat(b.paidAmount || "0") || 0;
            return sum + (billAmount - paidAmount);
          }, 0);
          const orderItems = parseOrderItems(deliveryInvoiceOrder.items || "");
          const orderBill = bills?.find(
            (b) => b.id === deliveryInvoiceOrder.billId,
          );
          const orderTotal = orderBill
            ? parseFloat(orderBill.amount)
            : deliveryInvoiceOrder.totalAmount
              ? parseFloat(String(deliveryInvoiceOrder.totalAmount))
              : 0;

          return (
            <Dialog
              open={true}
              onOpenChange={() => setDeliveryInvoiceOrder(null)}
            >
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Delivery Invoice - Order #{deliveryInvoiceOrder.orderNumber}
                  </DialogTitle>
                  <DialogDescription>
                    Order delivered successfully
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4" id="delivery-invoice-content">
                  {/* Header */}
                  <div className="text-center border-b pb-4">
                    <h2 className="text-xl font-bold text-primary">
                      Liquid Washes Laundry
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Centra Market D/109, Al Dhanna City, Al Ruwais
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Abu Dhabi, UAE
                    </p>
                    <p className="text-sm font-medium">+971 50 123 4567</p>
                  </div>

                  {/* Invoice Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Invoice No:</p>
                      <p className="font-semibold">
                        INV-{deliveryInvoiceOrder.orderNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Date:</p>
                      <p className="font-semibold">
                        {format(new Date(), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Bill To:</p>
                    <p className="font-semibold">
                      {invoiceClient?.name || "Unknown Client"}
                    </p>
                    {invoiceClient?.phone && (
                      <p className="text-sm">{invoiceClient.phone}</p>
                    )}
                    {invoiceClient?.address && (
                      <p className="text-sm text-muted-foreground">
                        {invoiceClient.address}
                      </p>
                    )}
                  </div>

                  {/* Items Table */}
                  <div>
                    <h3 className="font-semibold mb-2">Items</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => {
                          const product = products?.find(
                            (p) =>
                              p.name.toLowerCase() === item.name.toLowerCase(),
                          );
                          const unitPrice = product
                            ? parseFloat(product.price || "0")
                            : 0;
                          const itemTotal = unitPrice * item.quantity;
                          return (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right">
                                {unitPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {itemTotal.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Order Total:</span>
                      <span className="font-semibold">
                        {orderTotal.toFixed(2)} AED
                      </span>
                    </div>
                    {orderBill && (
                      <div className="flex justify-between text-sm">
                        <span>Paid Amount:</span>
                        <span className="text-green-600">
                          {parseFloat(orderBill.paidAmount || "0").toFixed(2)}{" "}
                          AED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Client Due Summary */}
                  {(clientUnpaidBills.length > 0 ||
                    clientPreviousBalance > 0) && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
                      <h4 className="font-semibold text-orange-700 dark:text-orange-400">
                        Outstanding Balance
                      </h4>
                      {clientPreviousBalance > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Previous Balance:</span>
                          <span className="font-medium">
                            {clientPreviousBalance.toFixed(2)} AED
                          </span>
                        </div>
                      )}
                      {clientUnpaidBills.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>
                            Pending Bills ({clientUnpaidBills.length}):
                          </span>
                          <span className="font-medium">
                            {clientPendingBillsTotal.toFixed(2)} AED
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-orange-700 dark:text-orange-400 border-t border-orange-200 dark:border-orange-700 pt-2">
                        <span>Total Due:</span>
                        <span>
                          {(
                            clientPreviousBalance + clientPendingBillsTotal
                          ).toFixed(2)}{" "}
                          AED
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Delivery Info */}
                  <div className="text-sm text-muted-foreground border-t pt-3">
                    <p>
                      Delivered by: {deliveryInvoiceOrder.deliveryBy || "Staff"}
                    </p>
                    <p>
                      Delivery Date: {format(new Date(), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-sm text-muted-foreground border-t pt-3">
                    <p>Thank you for your business!</p>
                    <p>For inquiries: +971 50 123 4567</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const content = document.getElementById(
                        "delivery-invoice-content",
                      );
                      if (content) {
                        const printWindow = window.open(
                          "",
                          "_blank",
                          "width=800,height=600",
                        );
                        if (printWindow) {
                          printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Invoice INV-${deliveryInvoiceOrder.orderNumber}</title>
                            <style>
                              @page { size: A5; margin: 10mm; }
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              body { font-family: Arial, sans-serif; padding: 15px; max-width: 148mm; margin: 0 auto; }
                              .space-y-4 > * + * { margin-top: 1rem; }
                              .space-y-2 > * + * { margin-top: 0.5rem; }
                              .text-center { text-align: center; }
                              .text-right { text-align: right; }
                              .font-bold { font-weight: bold; }
                              .font-semibold { font-weight: 600; }
                              .font-medium { font-weight: 500; }
                              .text-xl { font-size: 1.25rem; }
                              .text-sm { font-size: 0.875rem; }
                              .text-muted { color: #666; }
                              .border-b { border-bottom: 1px solid #e5e5e5; padding-bottom: 1rem; }
                              .border-t { border-top: 1px solid #e5e5e5; padding-top: 0.75rem; }
                              .grid { display: grid; }
                              .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                              .gap-4 { gap: 1rem; }
                              .bg-muted { background: #f5f5f5; padding: 0.75rem; border-radius: 0.5rem; }
                              .bg-orange { background: #fff7ed; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #fed7aa; }
                              .text-orange { color: #c2410c; }
                              .text-green { color: #16a34a; }
                              table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
                              th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
                              th { background: #1e40af; color: white; font-size: 0.75rem; }
                              .flex { display: flex; }
                              .justify-between { justify-content: space-between; }
                              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                            </style>
                          </head>
                          <body>${content.innerHTML}</body>
                          </html>
                        `);
                          printWindow.document.close();
                          printWindow.focus();
                          setTimeout(() => {
                            printWindow.print();
                            printWindow.close();
                          }, 250);
                        }
                      }
                    }}
                    data-testid="button-print-delivery-invoice"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setDeliveryInvoiceOrder(null)}
                    data-testid="button-close-delivery-invoice"
                  >
                    Done
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
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
}: {
  clients: Client[];
  bills: Bill[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
  initialClientId?: string;
  initialBillId?: string;
}) {
  const [formData, setFormData] = useState({
    clientId: initialClientId || "",
    orderType: "regular",
    deliveryType: "pickup",
    paymentOption: "pay_later",
    expectedDeliveryAt: "",
    deliveryAddress: "",
    notes: "",
    billOption: (initialBillId ? "existing" : "new") as "new" | "existing",
    selectedBillId: initialBillId || "",
    customerName: "",
    customerPhone: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || orderItems.length === 0) return;

    const itemsText = orderItems
      .map((item) => `${item.quantity}x ${item.product.name}`)
      .join(", ");
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    const billId =
      formData.billOption === "existing" && formData.selectedBillId
        ? parseInt(formData.selectedBillId)
        : null;

    onSubmit({
      ...formData,
      clientId: parseInt(formData.clientId),
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
    });
  };

  function handleClientChange(clientId: string) {
    const client = clients.find((c) => c.id === parseInt(clientId));
    setFormData({
      ...formData,
      clientId,
      selectedBillId: "",
      billOption: "new",
      customerName: client?.name || "",
      customerPhone: client?.phone || "",
      deliveryAddress: client?.address || "",
    });
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
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name} - {client.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="express">Express</SelectItem>
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
            !formData.deliveryAddress.trim())
        }
        data-testid="button-submit-order"
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Create Order ({orderTotal.toFixed(2)} AED)
      </Button>
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
