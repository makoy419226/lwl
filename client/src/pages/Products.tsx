import { useState, useMemo, useEffect, useContext, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { UserContext } from "@/App";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useBills } from "@/hooks/use-bills";
import { getProductImage } from "@/lib/productImages";
import {
  Loader2,
  Search,
  Shirt,
  Footprints,
  Home,
  Sparkles,
  Check,
  X,
  Plus,
  Minus,
  ShoppingCart,
  Clock,
  Package,
  Truck,
  Zap,
  UserPlus,
  Lock,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Printer,
  Tag,
  GripVertical,
  Banknote,
  Star,
  ChevronDown,
} from "lucide-react";
import html2pdf from "html2pdf.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

const getCategoryIcon = (category: string | null, size: string = "w-5 h-5") => {
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
    default:
      return <Shirt className={`${size} text-primary`} />;
  }
};

export default function Products() {
  const user = useContext(UserContext);
  const searchParams = useSearch();
  const urlSearch = new URLSearchParams(searchParams).get("search") || "";
  const urlClientId = new URLSearchParams(searchParams).get("clientId");
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [initialClientLoaded, setInitialClientLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const newSearch = params.get("search") || "";
    if (newSearch !== searchTerm) {
      setSearchTerm(newSearch);
    }
  }, [searchParams]);

  const { data: clients } = useClients();
  const { data: bills } = useBills();

  useEffect(() => {
    if (urlClientId && clients && !initialClientLoaded) {
      const clientIdNum = parseInt(urlClientId, 10);
      if (!isNaN(clientIdNum)) {
        const client = clients.find((c) => c.id === clientIdNum);
        if (client) {
          setSelectedClientId(client.id);
          setCustomerName(client.name);
          setCustomerPhone(client.phone || "");
        }
      }
      setInitialClientLoaded(true);
    }
  }, [urlClientId, clients, initialClientLoaded]);

  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [editingPriceProduct, setEditingPriceProduct] = useState<{
    id: number;
    name: string;
    price: string;
    dryCleanPrice: string;
    ironOnlyPrice: string;
  } | null>(null);
  // Simple quantities: productId -> total quantity
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  // Service type splits: how many of each product are DC or Iron Only
  const [dcQuantities, setDcQuantities] = useState<Record<number, number>>({});
  const [ironQuantities, setIronQuantities] = useState<Record<number, number>>({});
  // Dialog for selecting service type quantity
  const [serviceTypeDialog, setServiceTypeDialog] = useState<{
    productId: number;
    productName: string;
    type: "dc" | "iron";
    maxQty: number;
  } | null>(null);
  const [serviceTypeQty, setServiceTypeQty] = useState("");
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [packingTypes, setPackingTypes] = useState<
    Record<number, "hanging" | "folding">
  >({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("0");
  const [walkInAddress, setWalkInAddress] = useState("");
  const [orderType, setOrderType] = useState<"normal" | "urgent">("normal");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery" | "iron_only">("pickup");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [tips, setTips] = useState("");
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("0");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [newClientPaymentMethod, setNewClientPaymentMethod] = useState("cash");
  const [newClientDiscount, setNewClientDiscount] = useState("");
  const [suggestedExistingClient, setSuggestedExistingClient] = useState<{
    id: number;
    name: string;
    phone: string;
    address: string | null;
  } | null>(null);
  const [customItems, setCustomItems] = useState<
    { name: string; price: number; quantity: number }[]
  >([]);
  const [showOtherItemDialog, setShowOtherItemDialog] = useState(false);
  const [otherItemName, setOtherItemName] = useState("");
  const [otherItemPrice, setOtherItemPrice] = useState("");
  const [otherItemQty, setOtherItemQty] = useState("1");
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [sizeDialogProduct, setSizeDialogProduct] = useState<{
    id: number;
    name: string;
    smallPrice: string | null;
    mediumPrice: string | null;
    largePrice: string | null;
    price: string | null;
  } | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [staffPin, setStaffPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingUrgent, setPendingUrgent] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [payNowAfterOrder, setPayNowAfterOrder] = useState(false);
  const [, navigate] = useLocation();
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [stockValue, setStockValue] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [showPrintTagDialog, setShowPrintTagDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductDryCleanPrice, setNewProductDryCleanPrice] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingProduct, setDraggingProduct] = useState<{ id: number; name: string } | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  
  // SQM pricing dialog state (for carpet and similar items)
  const [sqmDialog, setSqmDialog] = useState<{ open: boolean; productId: number | null; productName: string; sqmPrice: string }>({ 
    open: false, 
    productId: null, 
    productName: "", 
    sqmPrice: "12.00" 
  });
  const [sqmInput, setSqmInput] = useState("");
  const sqmDialogProcessing = useRef(false); // Prevent rapid clicks from crashing
  const [sqmValues, setSqmValues] = useState<Record<number, number>>({});
  
  // Track multiple carpet entries with different sqm values
  const [carpetEntries, setCarpetEntries] = useState<Array<{
    id: string; // unique id for each entry
    productId: number;
    sqm: number;
    serviceType: "normal" | "dc" | "iron";
  }>>([]);
  
  // Stock orders dialog - shows which orders contain a product
  const [stockOrdersDialog, setStockOrdersDialog] = useState<{ open: boolean; productName: string; count: number }>({ open: false, productName: "", count: 0 });
  const { data: stockProductOrders, isLoading: stockOrdersLoading } = useQuery<{ orderNumber: string; quantity: number; orderId: number }[]>({
    queryKey: ["/api/products/orders-by-product", stockOrdersDialog.productName],
    queryFn: async () => {
      const res = await fetch(`/api/products/orders-by-product?name=${encodeURIComponent(stockOrdersDialog.productName)}`);
      return res.json();
    },
    enabled: stockOrdersDialog.open && !!stockOrdersDialog.productName,
  });

  // Dialog for selecting which carpet to apply DC/Iron to
  const [carpetServiceDialog, setCarpetServiceDialog] = useState<{
    open: boolean;
    productId: number | null;
    productName: string;
    serviceType: "dc" | "iron";
  }>({ open: false, productId: null, productName: "", serviceType: "dc" });

  // Check if a product has size pricing defined in the database
  const hasSizeOption = (product: { name: string; smallPrice?: string | null; mediumPrice?: string | null; largePrice?: string | null }) => {
    // Product has size option if it has at least small and large prices defined
    const hasDbPrices = !!(product.smallPrice || product.largePrice);
    // Also check it's not already a sized variant
    const isNotSizedVariant = !product.name.includes("(Small)") && 
                              !product.name.includes("(Medium)") && 
                              !product.name.includes("(Large)");
    return hasDbPrices && isNotSizedVariant;
  };

  // Legacy function for backwards compatibility - checks product name patterns
  const hasSizeOptionByName = (productName: string) => {
    const sizeKeywords = ["Towel", "Comfort", "Blanket", "Duvet Cover", "Bed Sheet", "Curtain", "Window Screen"];
    return sizeKeywords.some(
      (key) =>
        productName.toLowerCase().includes(key.toLowerCase()) &&
        !productName.includes("(Small)") &&
        !productName.includes("(Medium)") &&
        !productName.includes("(Large)"),
    );
  };

  // Get the total quantity of sized items for a product (from customItems)
  const getSizedItemQuantity = (productName: string): number => {
    return customItems
      .filter(item => item.name.toLowerCase().startsWith(productName.toLowerCase()))
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Check if a product is selected (either in cart or in customItems for sized items)
  const isProductSelected = (product: { id: number; name: string; smallPrice?: string | null; largePrice?: string | null }) => {
    // Check if in cart (any service type)
    if (getTotalQuantityForProduct(product.id) > 0) return true;
    // Check if size-based product is in customItems
    if (hasSizeOption(product)) {
      return customItems.some(item => 
        item.name.toLowerCase().startsWith(product.name.toLowerCase())
      );
    }
    // Check if gutra product is in customItems
    if (isGutraProduct(product.name)) {
      return customItems.some(item => 
        item.name.toLowerCase().includes("gutra")
      );
    }
    return false;
  };
  
  // Get total quantity for a product (uses carpetEntries for sqm products)
  const getTotalQuantityForProduct = (productId: number): number => {
    const product = products?.find(p => p.id === productId);
    if (product?.isSqmPriced) {
      return carpetEntries.filter(e => e.productId === productId).length;
    }
    return quantities[productId] || 0;
  };
  
  // Check if product has DC items (uses carpetEntries for sqm products)
  const hasDcItems = (productId: number): boolean => {
    const product = products?.find(p => p.id === productId);
    if (product?.isSqmPriced) {
      return carpetEntries.some(e => e.productId === productId && e.serviceType === "dc");
    }
    return (dcQuantities[productId] || 0) > 0;
  };
  
  // Check if product has Iron Only items (uses carpetEntries for sqm products)
  const hasIronItems = (productId: number): boolean => {
    const product = products?.find(p => p.id === productId);
    if (product?.isSqmPriced) {
      return carpetEntries.some(e => e.productId === productId && e.serviceType === "iron");
    }
    return (ironQuantities[productId] || 0) > 0;
  };

  const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (cleaned.startsWith("+971")) {
      return "0" + cleaned.slice(4);
    }
    if (cleaned.startsWith("971") && cleaned.length > 9) {
      return "0" + cleaned.slice(3);
    }
    if (cleaned.startsWith("00971")) {
      return "0" + cleaned.slice(5);
    }
    return cleaned;
  };

  const checkExistingClientByPhone = (phone: string) => {
    if (!phone || phone.length < 9 || !clients) return;
    
    const normalizedInput = normalizePhone(phone);
    
    const matchingClient = clients.find((client) => {
      if (!client.phone) return false;
      const normalizedClientPhone = normalizePhone(client.phone);
      return normalizedClientPhone === normalizedInput;
    });
    
    if (matchingClient) {
      setSuggestedExistingClient({
        id: matchingClient.id,
        name: matchingClient.name,
        phone: matchingClient.phone || "",
        address: matchingClient.address,
      });
    } else {
      setSuggestedExistingClient(null);
    }
  };

  const [showGutraDialog, setShowGutraDialog] = useState(false);
  const [gutraDialogProduct, setGutraDialogProduct] = useState<{
    id: number;
    name: string;
    price: number;
  } | null>(null);
  const [gutraNisha, setGutraNisha] = useState<"nisha" | "without-nisha" | "">(
    "",
  );
  const [gutraStyle, setGutraStyle] = useState<"line" | "straight" | "">("");

  const isGutraProduct = (productName: string) => {
    return (
      productName.toLowerCase().includes("gutra") &&
      !productName.includes("Nisha") &&
      !productName.includes("Line") &&
      !productName.includes("Straight")
    );
  };

  const { data: products, isLoading, isError } = useProducts(searchTerm);
  const { data: allProducts } = useProducts(""); // Fetch all products for order lookups
  const { data: allOrders } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: allocatedStock } = useQuery<Record<string, number>>({
    queryKey: ["/api/products/allocated-stock"],
    staleTime: 30000, // 30 seconds cache
  });
  const { mutate: createClient, isPending: isCreatingClient } =
    useCreateClient();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define tab categories for the UI
  const tabCategories = [
    { id: "all", label: "All Items" },
    { id: "favorites", label: "Favorites", isFavorites: true },
    { id: "arabic", label: "Arabic Traditional", dbCategories: ["Arabic Clothes"] },
    { id: "mens", label: "Men's Clothes", dbCategories: ["Men's Clothes"] },
    { id: "ladies", label: "Ladies Clothes", dbCategories: ["Ladies' Clothes"] },
    { id: "babies", label: "Babies Clothes", dbCategories: ["Baby Clothes"] },
    { id: "linens", label: "Linens", dbCategories: ["Linens"] },
    { id: "general", label: "General Items", dbCategories: ["General Items", "Shop Items"] },
  ];

  const groupedProducts = useMemo(() => {
    if (!products) return {};
    const groups: Record<string, typeof products> = {};
    const categoryOrder = [
      "Arabic Clothes",
      "Men's Clothes",
      "Ladies' Clothes",
      "Baby Clothes",
      "Linens",
      "General Items",
    ];
    
    products.forEach((product) => {
      let category = product.category || "General Items";
      // Merge "Shop Items" into "General Items"
      if (category === "Shop Items") {
        category = "General Items";
      }
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });
    
    const sortedGroups: Record<string, typeof products> = {};
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
  }, [products]);

  // Filter products by selected tab
  const filteredGroupedProducts = useMemo(() => {
    if (selectedCategory === "all") return groupedProducts;
    
    const selectedTab = tabCategories.find(t => t.id === selectedCategory);
    if (!selectedTab) return groupedProducts;
    
    // Handle favorites tab
    if (selectedTab.isFavorites) {
      const favoriteProducts = allProducts?.filter(p => p.starred) || [];
      if (favoriteProducts.length === 0) return {};
      
      // Group favorites by their original category
      const grouped: Record<string, typeof products> = {};
      favoriteProducts.forEach(product => {
        const cat = product.category || "General Items";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat]!.push(product);
      });
      return grouped;
    }
    
    if (!selectedTab.dbCategories) return groupedProducts;
    
    const filtered: Record<string, typeof products> = {};
    Object.entries(groupedProducts).forEach(([cat, prods]) => {
      // Check if this category matches any of the tab's dbCategories
      const matchesTab = selectedTab.dbCategories.some(dbCat => {
        if (dbCat === "General Items") {
          return cat === "General Items";
        }
        return cat === dbCat;
      });
      if (matchesTab) {
        filtered[cat] = prods;
      }
    });
    return filtered;
  }, [groupedProducts, selectedCategory]);

  const { data: clientBalance } = useQuery<{
    totalDue: string;
    billCount: number;
    latestBillDate: string | null;
  }>({
    queryKey: ["/api/clients", selectedClientId, "unpaid-balance"],
    queryFn: async () => {
      const res = await fetch(
        `/api/clients/${selectedClientId}/unpaid-balance`,
      );
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const todaysOrders = useMemo(() => {
    if (!allOrders) return [];
    const today = format(new Date(), "yyyy-MM-dd");
    return allOrders.filter((order) => {
      const orderDate = order.entryDate
        ? format(new Date(order.entryDate), "yyyy-MM-dd")
        : null;
      return orderDate === today;
    });
  }, [allOrders]);

  const pendingWashing = todaysOrders.filter((o) => !o.washingDone);
  const pendingPacking = todaysOrders.filter(
    (o) => o.washingDone && !o.packingDone,
  );
  const pendingDelivery = todaysOrders.filter(
    (o) => o.packingDone && !o.delivered,
  );

  const handleEditImage = (productId: number, currentUrl: string | null) => {
    setEditingImageId(productId);
    setImageUrl(currentUrl || "");
  };

  const handleSaveImage = (productId: number) => {
    updateProduct.mutate(
      { id: productId, imageUrl },
      {
        onSuccess: () => {
          setEditingImageId(null);
          setImageUrl("");
        },
      },
    );
  };

  const handleCancelEdit = () => {
    setEditingImageId(null);
    setImageUrl("");
  };

  const handleEditStock = (productId: number, currentStock: number | null) => {
    setEditingStockId(productId);
    setStockValue(currentStock?.toString() || "0");
  };

  const handleSaveStock = (productId: number) => {
    const newStock = parseInt(stockValue) || 0;
    updateProduct.mutate(
      { id: productId, stockQuantity: newStock },
      {
        onSuccess: () => {
          setEditingStockId(null);
          setStockValue("");
          toast({
            title: "Stock updated",
            description: `Stock quantity updated to ${newStock}`,
          });
        },
        onError: (error: any) => {
          let message = "Failed to update stock";
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
      },
    );
  };

  const handleCancelStockEdit = () => {
    setEditingStockId(null);
    setStockValue("");
  };

  // Handle quantity change - simple add/remove from total quantity
  const handleQuantityChange = (productId: number, delta: number) => {
    const product = allProducts?.find(p => p.id === productId) || products?.find(p => p.id === productId);
    
    // Check if sqm-priced (carpet) - ALWAYS prompt for sqm on every add
    if (product?.isSqmPriced && delta > 0) {
      // Prevent rapid clicks from crashing - ignore if dialog is already processing
      if (sqmDialogProcessing.current || sqmDialog.open) {
        return;
      }
      sqmDialogProcessing.current = true;
      
      // Always show sqm dialog for carpet - allows multiple entries with different sqm
      setSqmDialog({
        open: true,
        productId,
        productName: product.name,
        sqmPrice: product.sqmPrice || product.price || "12.00"
      });
      setSqmInput("");
      
      // Reset processing flag after a short delay
      setTimeout(() => {
        sqmDialogProcessing.current = false;
      }, 300);
      return;
    }
    
    // If removing sqm-priced product, remove the last carpet entry
    if (product?.isSqmPriced && delta < 0) {
      const entriesForProduct = carpetEntries.filter(e => e.productId === productId);
      if (entriesForProduct.length > 0) {
        // Remove the last entry for this product
        const lastEntry = entriesForProduct[entriesForProduct.length - 1];
        setCarpetEntries(prev => prev.filter(e => e.id !== lastEntry.id));
      }
      return;
    }
    
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        // Also clear DC/Iron quantities when removing product
        setDcQuantities((p) => {
          const { [productId]: __, ...r } = p;
          return r;
        });
        setIronQuantities((p) => {
          const { [productId]: __, ...r } = p;
          return r;
        });
        return rest;
      }
      // If reducing quantity, also reduce DC/Iron if needed
      if (delta < 0) {
        const dcQty = dcQuantities[productId] || 0;
        const ironQty = ironQuantities[productId] || 0;
        const totalSpecial = dcQty + ironQty;
        if (totalSpecial > newQty) {
          // Reduce from iron first, then dc
          let excess = totalSpecial - newQty;
          if (ironQty > 0) {
            const reduceIron = Math.min(excess, ironQty);
            setIronQuantities((p) => ({ ...p, [productId]: ironQty - reduceIron }));
            excess -= reduceIron;
          }
          if (excess > 0 && dcQty > 0) {
            setDcQuantities((p) => ({ ...p, [productId]: dcQty - excess }));
          }
        }
      }
      return { ...prev, [productId]: newQty };
    });
  };
  
  // Handle SQM dialog confirmation
  const handleSqmConfirm = () => {
    const sqm = parseFloat(sqmInput);
    if (!sqm || sqm <= 0 || !sqmDialog.productId) {
      toast({ title: "Please enter a valid square meter value", variant: "destructive" });
      return;
    }
    
    // Add new carpet entry with unique ID
    const newEntry = {
      id: `carpet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId: sqmDialog.productId,
      sqm,
      serviceType: "normal" as const
    };
    setCarpetEntries(prev => [...prev, newEntry]);
    setSqmDialog({ open: false, productId: null, productName: "", sqmPrice: "12.00" });
    setSqmInput("");
  };
  
  // Handle applying DC/Iron to a specific carpet entry
  const handleCarpetServiceSelect = (entryId: string) => {
    const serviceType = carpetServiceDialog.serviceType;
    setCarpetEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        // Toggle: if already this service, set to normal; otherwise set to service
        const newServiceType = entry.serviceType === serviceType ? "normal" : serviceType;
        return { ...entry, serviceType: newServiceType };
      }
      return entry;
    }));
    setCarpetServiceDialog({ open: false, productId: null, productName: "", serviceType: "dc" });
  };

  // Open dialog to set DC quantity
  const openServiceTypeDialog = (productId: number, productName: string, type: "dc" | "iron") => {
    const product = products?.find(p => p.id === productId);
    
    // Carpet (sqm-priced) items have no DC/Iron option
    if (product?.isSqmPriced) return;
    
    const totalQty = quantities[productId] || 0;
    if (totalQty === 0) return;
    
    const currentDc = dcQuantities[productId] || 0;
    const currentIron = ironQuantities[productId] || 0;
    const currentValue = type === "dc" ? currentDc : currentIron;
    
    setServiceTypeDialog({
      productId,
      productName,
      type,
      maxQty: totalQty,
    });
    setServiceTypeQty(currentValue.toString());
  };

  // Apply service type quantity from dialog
  const applyServiceTypeQty = () => {
    if (!serviceTypeDialog) return;
    
    const qty = parseInt(serviceTypeQty) || 0;
    const { productId, type, maxQty } = serviceTypeDialog;
    const otherQty = type === "dc" ? (ironQuantities[productId] || 0) : (dcQuantities[productId] || 0);
    const clampedQty = Math.min(Math.max(0, qty), maxQty - otherQty);
    
    if (type === "dc") {
      setDcQuantities((prev) => ({ ...prev, [productId]: clampedQty }));
    } else {
      setIronQuantities((prev) => ({ ...prev, [productId]: clampedQty }));
    }
    
    setServiceTypeDialog(null);
    setServiceTypeQty("");
  };

  // Get normal quantity (total - dc - iron)
  const getNormalQuantity = (productId: number): number => {
    const total = quantities[productId] || 0;
    const dc = dcQuantities[productId] || 0;
    const iron = ironQuantities[productId] || 0;
    return Math.max(0, total - dc - iron);
  };

  const handleProductClick = (product: {
    id: number;
    name: string;
    price?: string | null;
    smallPrice?: string | null;
    mediumPrice?: string | null;
    largePrice?: string | null;
  }) => {
    if (hasSizeOption(product)) {
      setSizeDialogProduct({
        id: product.id,
        name: product.name,
        price: product.price || null,
        smallPrice: product.smallPrice || null,
        mediumPrice: product.mediumPrice || null,
        largePrice: product.largePrice || null,
      });
      setShowSizeDialog(true);
    } else if (isGutraProduct(product.name)) {
      setGutraDialogProduct({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price || "0"),
      });
      setGutraNisha("");
      setGutraStyle("");
      setShowGutraDialog(true);
    } else {
      handleQuantityChange(product.id, 1);
    }
  };

  const handleAddGutraItem = () => {
    if (!gutraDialogProduct || !gutraNisha || !gutraStyle) {
      toast({
        title: "Select options",
        description: "Please select both Nisha and Line/Straight options.",
        variant: "destructive",
      });
      return;
    }

    const nishaLabel = gutraNisha === "nisha" ? "Nisha" : "Without Nisha";
    const styleLabel = gutraStyle === "line" ? "Line" : "Straight";
    const itemName = `${gutraDialogProduct.name} (${nishaLabel}, ${styleLabel})`;

    setCustomItems((prev) => {
      const existing = prev.find((item) => item.name === itemName);
      if (existing) {
        return prev.map((item) =>
          item.name === itemName
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        { name: itemName, price: gutraDialogProduct.price, quantity: 1 },
      ];
    });

    setShowGutraDialog(false);
    setGutraDialogProduct(null);
    setGutraNisha("");
    setGutraStyle("");
    toast({ title: "Added", description: `${itemName} added to order.` });
  };

  const handleAddSizedItem = (size: "small" | "medium" | "large") => {
    if (!sizeDialogProduct) return;

    // Get price from database - use the product's size prices
    let price = 0;
    if (size === "small" && sizeDialogProduct.smallPrice) {
      price = parseFloat(sizeDialogProduct.smallPrice);
    } else if (size === "medium" && sizeDialogProduct.mediumPrice) {
      price = parseFloat(sizeDialogProduct.mediumPrice);
    } else if (size === "medium" && sizeDialogProduct.price) {
      // Fall back to normal price for medium if mediumPrice not set
      price = parseFloat(sizeDialogProduct.price);
    } else if (size === "large" && sizeDialogProduct.largePrice) {
      price = parseFloat(sizeDialogProduct.largePrice);
    }
    
    const sizeLabel = size === "small" ? "Small" : size === "medium" ? "Medium" : "Large";
    const itemName = `${sizeDialogProduct.name} (${sizeLabel})`;

    setCustomItems((prev) => {
      const existing = prev.find((item) => item.name === itemName);
      if (existing) {
        return prev.map((item) =>
          item.name === itemName
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { name: itemName, price, quantity: 1 }];
    });

    setShowSizeDialog(false);
    setSizeDialogProduct(null);
    toast({ title: "Added", description: `${itemName} added to order.` });
  };

  // Build order items with service type splits (Normal, DC, Iron as separate lines)
  const orderItems = useMemo(() => {
    if (!allProducts) return [];
    const items: { product: (typeof allProducts)[0]; quantity: number; serviceType: "normal" | "dc" | "iron"; sqm?: number }[] = [];
    
    // First, add carpet entries (sqm-priced products)
    carpetEntries.forEach((entry) => {
      const product = allProducts.find((p) => p.id === entry.productId);
      if (!product) return;
      items.push({ 
        product, 
        quantity: 1, 
        serviceType: entry.serviceType, 
        sqm: entry.sqm 
      });
    });
    
    // Then add regular quantity-based products (excluding sqm-priced ones)
    Object.entries(quantities).forEach(([productIdStr, totalQty]) => {
      const productId = parseInt(productIdStr);
      if (isNaN(productId) || totalQty <= 0) return;
      
      const product = allProducts.find((p) => p.id === productId);
      if (!product || product.isSqmPriced) return; // Skip sqm-priced, handled above
      
      const dcQty = dcQuantities[productId] || 0;
      const ironQty = ironQuantities[productId] || 0;
      const normalQty = Math.max(0, totalQty - dcQty - ironQty);
      
      // Add normal items first
      if (normalQty > 0) {
        items.push({ product, quantity: normalQty, serviceType: "normal" });
      }
      // Add DC items
      if (dcQty > 0) {
        items.push({ product, quantity: dcQty, serviceType: "dc" });
      }
      // Add Iron Only items
      if (ironQty > 0) {
        items.push({ product, quantity: ironQty, serviceType: "iron" });
      }
    });
    
    return items;
  }, [quantities, dcQuantities, ironQuantities, allProducts, carpetEntries]);

  const orderTotal = useMemo(() => {
    const productTotal = orderItems.reduce((sum, item) => {
      let price: number;
      
      // Check if this is a sqm-priced item (like carpet) - always normal service only
      if (item.product.isSqmPriced && item.sqm) {
        const sqmPrice = parseFloat(item.product.sqmPrice || item.product.price || "12");
        const multiplier = 1;
        return sum + (item.sqm * sqmPrice * multiplier);
      }
      
      const priceKey = `${item.product.id}-${item.serviceType}`;
      if (customPrices[priceKey] !== undefined) {
        price = customPrices[priceKey];
      } else if (item.serviceType === "iron") {
        price = parseFloat(item.product.ironOnlyPrice || item.product.price || "0");
      } else if (item.serviceType === "dc") {
        price = parseFloat(item.product.dryCleanPrice || item.product.price || "0");
      } else {
        price = parseFloat(item.product.price || "0");
      }
      return sum + price * item.quantity;
    }, 0);
    const customTotal = customItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    return productTotal + customTotal;
  }, [orderItems, customItems, customPrices]);

  const hasOrderItems = orderItems.length > 0 || customItems.length > 0 || carpetEntries.length > 0;

  // Detect if walk-in customer phone matches an existing client
  const clientMatch = useMemo(() => {
    if (!isWalkIn || !walkInPhone || walkInPhone.length < 4) return null;
    
    // Normalize phone number for comparison
    const normalizePhone = (phone: string) => {
      let cleaned = phone.replace(/\D/g, '');
      // Remove common UAE prefixes
      if (cleaned.startsWith('00971')) cleaned = cleaned.slice(5);
      else if (cleaned.startsWith('971')) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      return cleaned;
    };
    
    // Check if phone is valid (not placeholder like XXXXXXXXX or 0000000)
    const isValidPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '');
      // Must have at least 7 real digits and not be all same digit
      if (cleaned.length < 7) return false;
      if (/^(.)\1+$/.test(cleaned)) return false; // All same digit
      if (/^0+$/.test(cleaned)) return false; // All zeros
      return true;
    };
    
    const normalizedWalkIn = normalizePhone(walkInPhone);
    // Need at least 7 digits for a match to avoid false positives
    if (normalizedWalkIn.length < 7) return null;
    
    const matchingClient = clients?.find(client => {
      if (!client.phone) return false;
      if (!isValidPhone(client.phone)) return false; // Skip invalid phone numbers
      const normalizedClient = normalizePhone(client.phone);
      if (normalizedClient.length < 7) return false; // Client must also have valid phone
      // Only match if exact match or last 9 digits match
      return normalizedClient === normalizedWalkIn || 
             (normalizedWalkIn.length >= 9 && normalizedClient.endsWith(normalizedWalkIn.slice(-9)));
    });
    
    if (matchingClient) {
      return {
        client: matchingClient,
        message: "Customer already exists with this phone number"
      };
    }
    return null;
  }, [isWalkIn, walkInPhone, clients]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] }); // Refresh clients for walk-in auto-created clients
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] }); // Refresh bills for auto-created bills
      queryClient.invalidateQueries({
        queryKey: ["/api/products/allocated-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] }); // Refresh products to show updated stock
      setQuantities({});
      setDcQuantities({});
      setIronQuantities({});
      setCustomerName("");
      setSearchTerm("");
      
      // If Pay Now was clicked, redirect to bills page with highlighted bill
      if (payNowAfterOrder) {
        setPayNowAfterOrder(false);
        clearOrder();
        // Navigate to bills page and highlight the corresponding bill
        if (data.billId) {
          navigate(`/bills?highlightBill=${data.billId}`);
        } else {
          // Fallback to orders page if no bill ID
          navigate(`/orders?payOrder=${data.id}`);
        }
        return;
      }
      
      // Store the created order and show print tag dialog
      setCreatedOrder(data);
      setShowPrintTagDialog(true);
    },
    onError: (error: any) => {
      let cleanMessage = "Failed to create order";
      let isCustomerExists = false;
      let isBillingRights = false;
      
      try {
        const errorMsg = String(error.message || error || "");
        
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
        
        isCustomerExists = cleanMessage.toLowerCase().includes("customer details already exist") ||
                          cleanMessage.toLowerCase().includes("customer already exists");
        isBillingRights = cleanMessage.toLowerCase().includes("billing rights") ||
                          cleanMessage.toLowerCase().includes("admin pin");
      } catch (err) {
        // Keep default message
      }
      
      toast({
        title: isBillingRights ? "PIN Not Authorized" : (isCustomerExists ? "Customer Already Exists" : "Error"),
        description: cleanMessage,
        variant: "destructive",
      });
    },
  });

  const handleCreateOrder = () => {
    if (!selectedClientId && !isWalkIn) {
      toast({
        title: "Select a client",
        description: "Please select a client from the dropdown.",
        variant: "destructive",
      });
      return;
    }
    // Require at least 2 of 3 fields for walk-in customers
    if (isWalkIn) {
      const hasName = walkInName.trim().length > 0;
      const hasPhone = walkInPhone.replace(/^\+971/, "").replace(/\D/g, "").length > 0;
      const hasAddress = walkInAddress.trim().length > 0;
      const filledFields = [hasName, hasPhone, hasAddress].filter(Boolean).length;
      
      if (filledFields < 2) {
        toast({
          title: "More details needed",
          description: "Please fill at least 2 fields: name, phone, or address.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!hasOrderItems) {
      toast({
        title: "No items",
        description: "Please add items to the order.",
        variant: "destructive",
      });
      return;
    }
    // Use the selected order type directly
    setPendingUrgent(orderType === "urgent");
    setShowPinDialog(true);
    setStaffPin("");
    setPinError("");
  };

  const submitOrder = (isUrgent: boolean) => {
    setPendingUrgent(isUrgent);
    setShowUrgentDialog(false);
    setShowPinDialog(true);
    setStaffPin("");
    setPinError("");
  };

  const verifyPinAndCreateOrder = async () => {
    if (staffPin.length !== 5) {
      setPinError("PIN must be 5 digits");
      return;
    }

    setIsVerifyingPin(true);
    setPinError("");

    try {
      // Use workers/verify-pin which only accepts admin, reception, and cashier PINs
      const res = await fetch("/api/workers/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: staffPin }),
      });

      if (!res.ok) {
        // Try to get the error message from the response
        try {
          const errorData = await res.json();
          setPinError(errorData.message || "This PIN has no billing rights. Use admin or reception/cashier PIN.");
        } catch {
          setPinError("This PIN has no billing rights. Use admin or reception/cashier PIN.");
        }
        setIsVerifyingPin(false);
        return;
      }

      const data = await res.json();

      const productItemsText = orderItems.map((item) => {
        const packing = packingTypes[item.product.id] || "folding";
        const serviceLabel = item.serviceType === "iron" ? "IO" : item.serviceType === "dc" ? "DC" : "N";
        const itemPriceKey = `${item.product.id}-${item.serviceType}`;
        const hasCustomPrice = customPrices[itemPriceKey] !== undefined;
        const priceLabel = hasCustomPrice ? ` @ ${customPrices[itemPriceKey]} AED` : "";
        
        // For sqm-priced items (like carpet), show sqm × price
        if (item.product.isSqmPriced && item.sqm) {
          const sqmPrice = parseFloat(item.product.sqmPrice || item.product.price || "12");
          const totalPrice = item.sqm * sqmPrice;
          return `${item.sqm} sqm ${item.product.name} @ ${totalPrice.toFixed(2)} AED`;
        }
        
        return `${item.quantity}x ${item.product.name} [${serviceLabel}] (${packing})${priceLabel}`;
      });
      const customItemsText = customItems.map(
        (item) => `${item.quantity}x ${item.name} @ ${item.price} AED`,
      );
      const itemsText = [...productItemsText, ...customItemsText].join(", ");
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      
      const hasDCItems = orderItems.some(item => item.serviceType === "dc");
      const hasIronItems = orderItems.some(item => item.serviceType === "iron");

      let subtotal = pendingUrgent ? orderTotal * 2 : orderTotal;
      const discPct = parseFloat(discountPercent) || 0;
      const discountAmt = (subtotal * discPct) / 100;
      const tipsAmt = parseFloat(tips) || 0;
      const finalTotal = subtotal - discountAmt + tipsAmt;

      createOrderMutation.mutate({
        clientId: isWalkIn ? null : selectedClientId,
        customerName: isWalkIn ? (walkInName.trim() || "-") : (customerName.trim() || "-"),
        customerPhone: isWalkIn ? (walkInPhone.trim() || "-") : (customerPhone.trim() || "-"),
        deliveryAddress: walkInAddress.trim() || "-",
        orderNumber,
        items: itemsText,
        totalAmount: subtotal.toFixed(2),
        discountPercent: discPct.toFixed(2),
        discountAmount: discountAmt.toFixed(2),
        tips: tipsAmt.toFixed(2),
        finalAmount: finalTotal.toFixed(2),
        entryDate: new Date().toISOString(),
        expectedDeliveryAt: expectedDeliveryAt.trim() || null,
        deliveryType: deliveryType,
        serviceType: hasIronItems ? "iron_only" : hasDCItems ? "dry_clean" : "normal",
        urgent: pendingUrgent,
        entryBy: data.worker?.name || "Staff",
        entryByWorkerId: data.worker?.id || null,
        createdBy: data.worker?.name || user?.name || "Staff",
        notes: orderNotes.trim() || null,
      });

      setShowPinDialog(false);
      setStaffPin("");
    } catch (err) {
      setPinError("Failed to verify PIN");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const clearOrder = () => {
    setQuantities({});
    setDcQuantities({});
    setIronQuantities({});
    setSqmValues({});
    setCarpetEntries([]);
    setCustomPrices({});
    setPackingTypes({});
    setCustomItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedClientId(null);
    setIsWalkIn(false);
    setWalkInName("");
    setWalkInPhone("0");
    setWalkInAddress("");
    setDiscountPercent("");
    setTips("");
    setOrderType("normal");
    setDeliveryType("pickup");
    setExpectedDeliveryAt("");
    setOrderNotes("");
  };

  const parseOrderItems = (items: string) => {
    const parsed: { name: string; quantity: number }[] = [];
    const itemParts = items.split(", ");
    for (const part of itemParts) {
      const match = part.match(/^(\d+)x\s+(.+)$/);
      if (match) {
        parsed.push({ name: match[2], quantity: parseInt(match[1], 10) });
      }
    }
    return parsed;
  };

  const generateTagReceipt = (order: Order) => {
    const client = clients?.find((c) => c.id === order.clientId);
    const isUrgent = order.urgent;
    const parsedItems = parseOrderItems(order.items || "");

    const previousBills = bills?.filter((b) => b.clientId === order.clientId) || [];
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
      </tr>`
      )
      .join("");

    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; max-width: 148mm; color: #000; background: #fff;">
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
            ${order.expectedDeliveryAt ? `
            <div style="font-size: 9px; color: #666; margin-top: 5px;">Expected Delivery</div>
            <div style="font-size: 11px; font-weight: bold; color: #2563eb;">${order.expectedDeliveryAt}</div>
            ` : ""}
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
        
        ${totalPreviousDue > 0 ? `
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
        ` : ""}
        
        ${order.notes ? `
        <div style="background: #e8f4fd; border: 1px solid #90cdf4; border-radius: 4px; padding: 8px; margin-bottom: 10px;">
          <div style="font-size: 9px; font-weight: bold; color: #2b6cb0; margin-bottom: 3px;">ORDER NOTES</div>
          <div style="font-size: 10px;">${order.notes}</div>
        </div>
        ` : ""}
        
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

  const handlePrintTagDialogClose = (printNow: boolean) => {
    if (printNow && createdOrder) {
      generateTagReceipt(createdOrder);
    }
    setShowPrintTagDialog(false);
    setCreatedOrder(null);
    clearOrder();
    toast({
      title: "Order created",
      description: printNow ? "Order created and tag downloaded." : "Order created. You can print the tag later from Orders page.",
    });
  };

  const handleAddOtherItem = () => {
    if (!otherItemName.trim()) {
      toast({
        title: "Enter item name",
        description: "Please enter item name.",
        variant: "destructive",
      });
      return;
    }
    if (!otherItemPrice || parseFloat(otherItemPrice) <= 0) {
      toast({
        title: "Enter price",
        description: "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }
    const qty = parseInt(otherItemQty) || 1;
    setCustomItems((prev) => [
      ...prev,
      {
        name: otherItemName.trim(),
        price: parseFloat(otherItemPrice),
        quantity: qty,
      },
    ]);
    setOtherItemName("");
    setOtherItemPrice("");
    setOtherItemQty("1");
    setShowOtherItemDialog(false);
    toast({
      title: "Item added",
      description: `${otherItemName} added to order.`,
    });
  };

  const removeCustomItem = (index: number) => {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePackingTypeChange = (
    productId: number,
    type: "hanging" | "folding",
  ) => {
    setPackingTypes((prev) => ({ ...prev, [productId]: type }));
  };

  const handleCreateNewClient = () => {
    if (!newClientName.trim()) {
      toast({
        title: "Enter name",
        description: "Please enter client name.",
        variant: "destructive",
      });
      return;
    }
    if (!newClientPhone.trim()) {
      toast({
        title: "Enter phone",
        description: "Phone number is required.",
        variant: "destructive",
      });
      return;
    }
    createClient(
      {
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
        email: newClientEmail.trim() || "",
        address: newClientAddress.trim() || "",
        amount: "0",
        deposit: "0",
        balance: "0",
        contact: newClientContact.trim() || "",
        billNumber: "",
        preferredPaymentMethod: newClientPaymentMethod || "cash",
        discountPercent: newClientDiscount || "0",
      },
      {
        onSuccess: (client: Client) => {
          setSelectedClientId(client.id);
          setCustomerName(client.name);
          setCustomerPhone(client.phone || "");
          if (client.discountPercent) {
            setDiscountPercent(client.discountPercent);
          }
          setShowNewClientDialog(false);
          setNewClientName("");
          setNewClientPhone("0");
          setNewClientAddress("");
          setNewClientEmail("");
          setNewClientContact("");
          setNewClientPaymentMethod("cash");
          setNewClientDiscount("");
          toast({
            title: "Client created",
            description: `${client.name} has been added.`,
          });
        },
        onError: (error: Error & { existingClient?: { id: number; name: string; phone: string; address: string | null } }) => {
          try {
            const errorData = JSON.parse(error.message);
            if (errorData.existingClient) {
              setSuggestedExistingClient(errorData.existingClient);
              toast({
                title: "Phone number exists",
                description: `This number belongs to "${errorData.existingClient.name}". Use existing client or enter a different number.`,
                variant: "destructive",
              });
              return;
            }
          } catch {
            // Not a JSON error, try to extract message from error string
          }
          let message = "Failed to create client.";
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
      },
    );
  };

  // Handle moving a product to a new category (drag & drop)
  const handleMoveProductToCategory = async (productId: number, productName: string, newCategory: string) => {
    // Map tab ID to actual category name
    const categoryMap: Record<string, string> = {
      "arabic": "Arabic Clothes",
      "mens": "Men's Clothes",
      "ladies": "Ladies' Clothes",
      "babies": "Baby Clothes",
      "linens": "Linens",
      "general": "General Items",
    };
    
    const actualCategory = categoryMap[newCategory];
    if (!actualCategory) return;
    
    try {
      await apiRequest("PUT", `/api/products/${productId}`, {
        category: actualCategory,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Item moved",
        description: `${productName} moved to ${actualCategory}`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to move item",
        variant: "destructive",
      });
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, product: { id: number; name: string }) => {
    if (!isEditMode || user?.role !== "admin") return;
    setDraggingProduct(product);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(product));
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggingProduct(null);
    setDragOverTab(null);
  };

  // Handle drop on tab
  const handleDropOnTab = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (!draggingProduct || tabId === "all") return;
    
    handleMoveProductToCategory(draggingProduct.id, draggingProduct.name, tabId);
    setDraggingProduct(null);
    setDragOverTab(null);
  };

  // Handle drag over tab
  const handleDragOverTab = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (tabId !== "all") {
      setDragOverTab(tabId);
    }
  };

  // Render order slip content (reusable for both sidebar and popup)
  const renderOrderSlipContent = (isPopup: boolean = false) => (
    <div className={`${isPopup ? "p-4 space-y-3 flex-1 overflow-y-auto pb-32" : "p-3 space-y-3 flex-1 overflow-y-auto"}`}>
      {/* Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-bold">Item</th>
              <th className="text-center py-2 px-1 font-bold">Qty</th>
              <th className="text-right py-2 px-2 font-bold">Price</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item, idx) => {
              let basePrice: number;
              let displayPrice: number;
              
              // For sqm-priced items (carpet), calculate total price from sqm using inventory prices
              if (item.product.isSqmPriced && item.sqm) {
                const sqmPrice = parseFloat(item.product.sqmPrice || item.product.price || "12");
                displayPrice = item.sqm * sqmPrice;
                basePrice = displayPrice;
              } else if (item.serviceType === "iron") {
                basePrice = parseFloat(item.product.ironOnlyPrice || item.product.price || "0");
                displayPrice = basePrice;
              } else if (item.serviceType === "dc") {
                basePrice = parseFloat(item.product.dryCleanPrice || item.product.price || "0");
                displayPrice = basePrice;
              } else {
                basePrice = parseFloat(item.product.price || "0");
                displayPrice = basePrice;
              }
              const priceKey = `${item.product.id}-${item.serviceType}`;
              const unitPrice = customPrices[priceKey] !== undefined ? customPrices[priceKey] : basePrice;
              const itemPrice = item.product.isSqmPriced ? displayPrice : unitPrice * item.quantity;
              const hasCustomPrice = !item.product.isSqmPriced && customPrices[priceKey] !== undefined;
              const bgClass = item.serviceType === "iron" ? "bg-orange-50 dark:bg-orange-900/20" : item.serviceType === "dc" ? "bg-purple-50 dark:bg-purple-900/20" : "";
              const itemKey = item.product.isSqmPriced ? `carpet-${idx}` : `${item.product.id}-${item.serviceType}`;
              const carpetIndex = item.product.isSqmPriced ? orderItems.filter((o, i) => o.product.isSqmPriced && i <= idx).length : 0;
              const displayName = item.product.isSqmPriced && item.sqm 
                ? `Carpet #${carpetIndex} (${item.sqm}sqm)` 
                : item.product.name;
              return (
                <tr key={itemKey} className={`border-b ${bgClass}`}>
                  <td className="py-2 px-2 font-medium">
                    {displayName}
                    {item.serviceType === "dc" && <span className="ml-1 text-[9px] bg-purple-600 text-white px-1 rounded">DC</span>}
                    {item.serviceType === "iron" && <span className="ml-1 text-[9px] bg-orange-500 text-white px-1 rounded">IO</span>}
                  </td>
                  <td className="py-2 px-1 text-center font-bold">
                    {item.quantity}
                  </td>
                  <td className="py-1 px-1 text-right">
                    {item.product.isSqmPriced ? (
                      <span className="font-bold text-sm">{itemPrice.toFixed(0)}</span>
                    ) : (
                    <div className="flex flex-col items-end">
                      <input
                        type="number"
                        data-testid={`input-price-${item.product.id}`}
                        value={unitPrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCustomPrices(prev => ({ ...prev, [priceKey]: val }));
                        }}
                        className={`w-16 text-right font-bold px-1 py-0.5 rounded border text-sm ${hasCustomPrice ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300" : "bg-transparent border-transparent"}`}
                        min="0"
                        step="0.5"
                      />
                      {item.quantity > 1 && (
                        <span className="text-[9px] text-muted-foreground">={itemPrice.toFixed(0)}</span>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {customItems.map((item, idx) => (
              <tr key={`custom-${idx}`} className="border-b bg-amber-50 dark:bg-amber-900/20">
                <td className="py-2 px-2 font-medium flex items-center gap-1">
                  {item.name}
                  <button onClick={() => removeCustomItem(idx)} className="text-red-500 hover:text-red-700">
                    <X className="w-3 h-3" />
                  </button>
                </td>
                <td className="py-2 px-1 text-center font-bold">{item.quantity}</td>
                <td className="py-2 px-2 text-right font-bold">{(item.price * item.quantity).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {orderItems.length === 0 && customItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No items added yet</p>
          <p className="text-xs">Tap items to add them</p>
        </div>
      )}

      {/* Totals */}
      {(orderItems.length > 0 || customItems.length > 0) && (
        <>
          <div className="border rounded-lg p-3 space-y-1 bg-muted/30">
            <div className="flex justify-between text-xs">
              <span>Subtotal</span>
              <span className="font-semibold">{orderTotal.toFixed(2)} AED</span>
            </div>
            {orderType === "urgent" && (
              <div className="flex justify-between text-xs text-orange-600 font-semibold">
                <span>Urgent (x2)</span>
                <span>+{orderTotal.toFixed(2)} AED</span>
              </div>
            )}
            {parseFloat(discountPercent) > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Discount ({discountPercent}%)</span>
                <span>-{(((orderType === "urgent" ? orderTotal * 2 : orderTotal) * parseFloat(discountPercent)) / 100).toFixed(2)} AED</span>
              </div>
            )}
            {parseFloat(tips) > 0 && (
              <div className="flex justify-between text-xs text-blue-600">
                <span>Tips</span>
                <span>+{parseFloat(tips).toFixed(2)} AED</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-primary border-t pt-2 mt-2">
              <span>TOTAL</span>
              <span>
                {(() => {
                  const base = orderType === "urgent" ? orderTotal * 2 : orderTotal;
                  const discountAmt = (base * (parseFloat(discountPercent) || 0)) / 100;
                  const tipsAmt = parseFloat(tips) || 0;
                  return (base - discountAmt + tipsAmt).toFixed(2);
                })()} AED
              </span>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Select Client</Label>
            <div className="relative">
              <Input
                placeholder="Click to select or type to search..."
                value={clientSearchTerm}
                onChange={(e) => {
                  setClientSearchTerm(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                className="h-12 text-base pr-8"
                data-testid={isPopup ? "popup-search-client" : "sidebar-search-client"}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              {showClientDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-accent font-medium text-primary border-b"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedClientId(null);
                      setIsWalkIn(true);
                      setCustomerName("Walk-in Customer");
                      setClientSearchTerm("");
                      setShowClientDropdown(false);
                    }}
                    data-testid="option-walkin"
                  >
                    Walk-in Customer
                  </div>
                  {clients?.filter((client) => {
                    if (!clientSearchTerm.trim()) return true;
                    const search = clientSearchTerm.toLowerCase();
                    return (
                      client.name.toLowerCase().includes(search) ||
                      (client.phone && client.phone.toLowerCase().includes(search))
                    );
                  }).slice(0, 10).map((client) => (
                    <div
                      key={client.id}
                      className="px-3 py-2 cursor-pointer hover:bg-accent text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setIsWalkIn(false);
                        setSelectedClientId(client.id);
                        setCustomerName(client.name);
                        setCustomerPhone(client.phone || "");
                        if (client.discountPercent) setDiscountPercent(client.discountPercent);
                        setClientSearchTerm("");
                        setShowClientDropdown(false);
                      }}
                      data-testid={`option-client-${client.id}`}
                    >
                      {client.name} - {client.phone || "No phone"}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(selectedClientId || isWalkIn) && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                Selected: <span className="font-medium text-foreground">{isWalkIn ? "Walk-in Customer" : customerName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 ml-2 text-xs"
                  onClick={() => {
                    setSelectedClientId(null);
                    setIsWalkIn(false);
                    setCustomerName("");
                    setCustomerPhone("");
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Walk-in Customer Fields */}
          {isWalkIn && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <div>
                <Label className="text-xs font-semibold">Customer Name</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="Enter name..."
                  value={walkInName}
                  onChange={(e) => {
                    setWalkInName(e.target.value.toUpperCase());
                    setCustomerName(e.target.value.toUpperCase() || "Walk-in Customer");
                  }}
                  data-testid={isPopup ? "popup-input-walkin-name" : "sidebar-input-walkin-name"}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Phone Number</Label>
                <div className="flex flex-col gap-1 mt-1">
                  <Input
                    className={`h-8 text-xs ${walkInPhone.replace(/\D/g, "").length >= 10 ? "border-green-500 focus-visible:ring-green-500" : ""} ${clientMatch ? "border-red-500 ring-2 ring-red-300" : ""}`}
                    placeholder="05XXXXXXXX"
                    value={walkInPhone.replace(/\D/g, "").slice(0, 10)}
                    onChange={(e) => {
                      let digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      if (digits.length > 0 && !digits.startsWith("0")) {
                        digits = "0" + digits.slice(0, 9);
                      }
                      setWalkInPhone(digits || "0");
                    }}
                    inputMode="numeric"
                    maxLength={10}
                    data-testid={isPopup ? "popup-input-walkin-phone" : "sidebar-input-walkin-phone"}
                  />
                  {walkInPhone.replace(/\D/g, "").length >= 10 && (
                    <p className="text-xs text-green-600 font-medium">10 digits - complete</p>
                  )}
                </div>
              </div>
              {clientMatch && (
                <div className="bg-red-100 dark:bg-red-950 border border-red-500 rounded-lg p-2 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-red-700 dark:text-red-300">
                        {clientMatch.message}: {clientMatch.client.name}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1 text-xs h-7 bg-red-50 dark:bg-red-900 border-red-300"
                        onClick={() => {
                          setIsWalkIn(false);
                          setSelectedClientId(clientMatch.client.id);
                          setCustomerName(clientMatch.client.name);
                          setCustomerPhone(clientMatch.client.phone || "");
                          setWalkInAddress(clientMatch.client.address || "");
                          setWalkInName("");
                          setWalkInPhone("0");
                        }}
                      >
                        Use existing: {clientMatch.client.name}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold">Address <span className="text-destructive">*</span></Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="Enter address..."
                  value={walkInAddress}
                  onChange={(e) => setWalkInAddress(e.target.value.toUpperCase())}
                  data-testid={isPopup ? "popup-input-walkin-address" : "sidebar-input-walkin-address"}
                />
              </div>
            </div>
          )}

          {/* Order Type */}
          <div className="flex gap-2">
            <Button
              variant={orderType === "normal" ? "default" : "outline"}
              className="flex-1 h-9 text-xs"
              onClick={() => setOrderType("normal")}
            >
              <Clock className="w-3 h-3 mr-1" /> Normal
            </Button>
            <Button
              variant={orderType === "urgent" ? "default" : "outline"}
              className={`flex-1 h-9 text-xs ${orderType === "urgent" ? "bg-orange-500 hover:bg-orange-600" : ""}`}
              onClick={() => setOrderType("urgent")}
            >
              <Zap className="w-3 h-3 mr-1" /> Urgent 2x
            </Button>
          </div>

          {/* Delivery Type */}
          <div className="flex gap-2">
            <Button
              variant={deliveryType === "pickup" ? "default" : "outline"}
              className="flex-1 h-9 text-xs"
              onClick={() => setDeliveryType("pickup")}
            >
              <Package className="w-3 h-3 mr-1" /> Pickup
            </Button>
            <Button
              variant={deliveryType === "delivery" ? "default" : "outline"}
              className="flex-1 h-9 text-xs"
              onClick={() => setDeliveryType("delivery")}
            >
              <Truck className="w-3 h-3 mr-1" /> Delivery
            </Button>
          </div>

          {/* Expected Pickup/Delivery Date */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              {deliveryType === "pickup" ? "Pickup" : "Delivery"} Date (Optional)
            </Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={expectedDeliveryAt?.startsWith(format(new Date(), "yyyy-MM-dd")) ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs px-2"
                onClick={() => {
                  const today = new Date();
                  setExpectedDeliveryAt(format(today, "yyyy-MM-dd"));
                }}
                data-testid={isPopup ? "popup-button-date-today" : "sidebar-button-date-today"}
              >
                Today
              </Button>
              <Button
                type="button"
                variant={expectedDeliveryAt?.startsWith(format(new Date(Date.now() + 86400000), "yyyy-MM-dd")) ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs px-2"
                onClick={() => {
                  const tomorrow = new Date(Date.now() + 86400000);
                  setExpectedDeliveryAt(format(tomorrow, "yyyy-MM-dd"));
                }}
                data-testid={isPopup ? "popup-button-date-tomorrow" : "sidebar-button-date-tomorrow"}
              >
                Tomorrow
              </Button>
              <Input
                type="date"
                className="flex-1 h-8 text-xs px-1"
                value={expectedDeliveryAt?.split("T")[0] || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    const time = expectedDeliveryAt?.split("T")[1];
                    setExpectedDeliveryAt(time ? `${e.target.value}T${time}` : e.target.value);
                  } else {
                    setExpectedDeliveryAt("");
                  }
                }}
                data-testid={isPopup ? "popup-input-custom-date" : "sidebar-input-custom-date"}
              />
              {expectedDeliveryAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setExpectedDeliveryAt("")}
                  data-testid={isPopup ? "popup-button-clear-date" : "sidebar-button-clear-date"}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            {expectedDeliveryAt && (
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Time (Optional):</Label>
                <Input
                  type="time"
                  className="flex-1 h-8 text-xs"
                  value={expectedDeliveryAt?.split("T")[1] || ""}
                  onChange={(e) => {
                    const date = expectedDeliveryAt?.split("T")[0] || expectedDeliveryAt;
                    if (e.target.value) {
                      setExpectedDeliveryAt(`${date}T${e.target.value}`);
                    } else {
                      setExpectedDeliveryAt(date);
                    }
                  }}
                  data-testid={isPopup ? "popup-input-pickup-time" : "sidebar-input-pickup-time"}
                />
                {expectedDeliveryAt?.includes("T") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setExpectedDeliveryAt(expectedDeliveryAt?.split("T")[0] || "")}
                    data-testid={isPopup ? "popup-button-clear-time" : "sidebar-button-clear-time"}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Order Notes */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Notes</Label>
            <Input
              type="text"
              placeholder="Special instructions..."
              className="h-9 text-xs"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              data-testid={isPopup ? "popup-input-order-notes" : "sidebar-input-order-notes"}
            />
          </div>

          {/* Place Order Buttons */}
          <div className="flex gap-2">
            <Button
              className={`flex-1 h-10 font-bold ${clientMatch ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" : ""}`}
              onClick={() => {
                if (isPopup) setShowCartPopup(false);
                handleCreateOrder();
              }}
              disabled={createOrderMutation.isPending || (!selectedClientId && !isWalkIn) || !!clientMatch}
              data-testid={isPopup ? "popup-button-place-order" : "sidebar-button-place-order"}
            >
              {createOrderMutation.isPending && !payNowAfterOrder ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {clientMatch ? "Use existing" : `${(() => {
                const base = orderType === "urgent" ? orderTotal * 2 : orderTotal;
                const discountAmt = (base * (parseFloat(discountPercent) || 0)) / 100;
                const tipsAmt = parseFloat(tips) || 0;
                return (base - discountAmt + tipsAmt).toFixed(2);
              })()} AED`}
            </Button>
            <Button
              variant="outline"
              className="h-10 font-bold border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
              onClick={() => {
                if (isPopup) setShowCartPopup(false);
                setPayNowAfterOrder(true);
                handleCreateOrder();
              }}
              disabled={createOrderMutation.isPending || (!selectedClientId && !isWalkIn) || !!clientMatch}
              data-testid={isPopup ? "popup-button-pay-now" : "sidebar-button-pay-now"}
            >
              {createOrderMutation.isPending && payNowAfterOrder ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Banknote className="w-4 h-4 mr-1" />}
              Pay Now
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Left side - New Order */}
      <div className="flex-1 flex flex-col min-w-0 xl:mr-[340px]">
        <div className="sticky top-0 z-30 w-full bg-gradient-to-r from-primary/10 via-white to-primary/5 dark:from-primary/20 dark:via-background dark:to-primary/10 backdrop-blur-md border-b border-primary/20 shadow-sm">
          <div className="h-12 px-3 flex items-center justify-between gap-3">
            <h1 className="text-lg font-display font-black text-primary flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              New Order
            </h1>
            <div className="flex-1 max-w-sm relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Search className="w-4 h-4" />
              </div>
              <Input
                className="pl-9 pr-8 h-9 rounded-full border-2 border-primary/20 bg-background focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-products"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Edit Mode Toggle - Admin Only */}
            {user?.role === "admin" && (
              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                className={`h-9 gap-1.5 ${isEditMode ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                onClick={() => setIsEditMode(!isEditMode)}
                data-testid="button-toggle-edit-mode"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">{isEditMode ? "Exit Edit" : "Edit"}</span>
              </Button>
            )}
          </div>
          
          {/* Category Tabs */}
          <div className="px-2 pb-2 overflow-x-auto">
            {isEditMode && (
              <div className="mb-2 px-2 py-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg text-xs text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <GripVertical className="w-4 h-4" />
                <span>Drag items to category tabs to move them</span>
              </div>
            )}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
              <TabsList className="inline-flex h-auto items-center justify-start gap-2 bg-transparent p-1 w-auto min-w-full">
                {tabCategories.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={`px-4 py-2 text-xs font-medium whitespace-nowrap border border-border rounded-md bg-background shadow-sm data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary transition-all ${
                      isEditMode && tab.id !== "all" ? "border-2 border-dashed" : ""
                    } ${
                      dragOverTab === tab.id ? "border-primary bg-primary/20 scale-105" : ""
                    }`}
                    data-testid={`tab-category-${tab.id}`}
                    onDragOver={(e) => isEditMode && handleDragOverTab(e, tab.id)}
                    onDragLeave={() => setDragOverTab(null)}
                    onDrop={(e) => isEditMode && handleDropOnTab(e, tab.id)}
                  >
                    {tab.isFavorites && <Star className="w-3.5 h-3.5 mr-1 fill-current" />}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <main className="flex-1 flex overflow-hidden">
          <div
            className={`flex-1 px-2 py-2 overflow-auto ${orderItems.length > 0 ? "pr-0" : ""}`}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p>Loading...</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 text-destructive">
                <p className="font-semibold text-lg">Failed to load</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Favorites tab - clean flat grid */}
                {selectedCategory === "favorites" && (
                  <>
                    {allProducts?.filter(p => p.starred).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Star className="w-12 h-12 mb-4 text-yellow-400" />
                        <p className="font-semibold text-lg">No Favorites Yet</p>
                        <p className="text-sm mt-2">Turn on Edit Mode to star items as favorites</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                        {allProducts?.filter(p => p.starred).map((product) => (
                          <div
                            key={`fav-${product.id}`}
                            className={`relative rounded-lg sm:rounded-xl border-2 p-2 sm:p-3 md:p-4 flex flex-col items-center cursor-pointer hover-elevate ${
                              isProductSelected(product)
                                ? "border-primary border-[3px] bg-primary/15 ring-2 ring-primary/50 shadow-lg shadow-primary/20"
                                : "border-yellow-300/50 dark:border-yellow-700/50 bg-gradient-to-br from-yellow-50 to-amber-50/50 dark:from-yellow-900/20 dark:to-amber-900/10 hover:border-yellow-400"
                            }`}
                            onClick={() => !isEditMode && handleProductClick(product)}
                            data-testid={`box-favorite-${product.id}`}
                          >
                            {/* Star indicator */}
                            <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center bg-yellow-400 text-yellow-900 shadow-sm">
                              <Star className="w-3 h-3 fill-current" />
                            </div>
                            <div className="w-full h-20 sm:h-24 md:h-28 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1 sm:mb-2 shadow-sm relative">
                              {(() => {
                                const imageSrc = product.imageUrl || getProductImage(product.name);
                                if (imageSrc) {
                                  return (
                                    <img
                                      src={imageSrc}
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                      }}
                                    />
                                  );
                                }
                                return null;
                              })()}
                              <div className="fallback-icon absolute inset-0 flex items-center justify-center" style={{ display: (product.imageUrl || getProductImage(product.name)) ? 'none' : 'flex' }}>
                                {getCategoryIcon(product.category)}
                              </div>
                            </div>
                            <div className="text-xs sm:text-sm leading-tight text-center font-bold text-foreground line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] flex items-center justify-center px-0.5 sm:px-1">
                              {product.name}
                            </div>
                            <div className="flex flex-col items-center mt-0.5 sm:mt-1 gap-0.5 w-full">
                              {isProductSelected(product) ? (
                                <div
                                  className={`text-sm sm:text-lg font-black px-2 sm:px-3 py-0.5 sm:py-1 rounded-full ${
                                    hasIronItems(product.id)
                                      ? "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30"
                                      : hasDcItems(product.id) 
                                      ? "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30" 
                                      : "text-primary bg-primary/10"
                                  }`}
                                >
                                  {(() => {
                                    // For sqm-priced products (carpet), always show price per sqm
                                    if (product.isSqmPriced) {
                                      const sqmPrice = product.sqmPrice ? parseFloat(product.sqmPrice).toFixed(0) : (product.price ? parseFloat(product.price).toFixed(0) : "12");
                                      return `${sqmPrice}aed/sqm`;
                                    }
                                    const dcQty = dcQuantities[product.id] || 0;
                                    const ironQty = ironQuantities[product.id] || 0;
                                    const normalQty = getNormalQuantity(product.id);
                                    const prices: string[] = [];
                                    if (normalQty > 0) prices.push(`${normalQty}x N`);
                                    if (dcQty > 0) prices.push(`${dcQty}x DC`);
                                    if (ironQty > 0) prices.push(`${ironQty}x IO`);
                                    return prices.length > 0 ? prices.join(", ") : `${product.price ? parseFloat(product.price).toFixed(0) : "-"} AED`;
                                  })()}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5 text-[10px] sm:text-xs">
                                  {product.isSqmPriced ? (
                                    <>
                                      <span className="text-primary font-bold">
                                        {product.sqmPrice ? parseFloat(product.sqmPrice).toFixed(0) : (product.price ? parseFloat(product.price).toFixed(0) : "12")} AED
                                      </span>
                                      <div className="text-[8px] sm:text-[9px] text-muted-foreground">per sqm</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="text-primary font-bold">
                                          {product.price ? parseFloat(product.price).toFixed(0) : "-"}
                                        </span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className="text-purple-600 dark:text-purple-400 font-bold">
                                          {product.dryCleanPrice ? parseFloat(product.dryCleanPrice).toFixed(0) : "-"}
                                        </span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className="text-orange-600 dark:text-orange-400 font-bold">
                                          {product.ironOnlyPrice ? parseFloat(product.ironOnlyPrice).toFixed(0) : "-"}
                                        </span>
                                      </div>
                                      <div className="text-[8px] sm:text-[9px] text-muted-foreground">
                                        N / DC / IO
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {(getTotalQuantityForProduct(product.id) > 0 || (hasSizeOption(product) && getSizedItemQuantity(product.name) > 0)) ? (
                              <>
                                <div
                                  className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-background animate-pulse"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>{getTotalQuantityForProduct(product.id) || getSizedItemQuantity(product.name)}</span>
                                </div>
                                <div
                                  className="flex flex-col gap-0.5 sm:gap-1 mt-1.5 sm:mt-2 w-full"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex gap-0.5">
                                    <Button
                                      size="sm"
                                      variant={(dcQuantities[product.id] || 0) > 0 ? "default" : "outline"}
                                      className={`flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 ${(dcQuantities[product.id] || 0) > 0 ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                                      onClick={() => openServiceTypeDialog(product.id, product.name, "dc")}
                                      data-testid={`button-fav-dryClean-${product.id}`}
                                    >
                                      DC {(dcQuantities[product.id] || 0) > 0 && `(${dcQuantities[product.id]})`}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={(ironQuantities[product.id] || 0) > 0 ? "default" : "outline"}
                                      className={`flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 ${(ironQuantities[product.id] || 0) > 0 ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                                      onClick={() => openServiceTypeDialog(product.id, product.name, "iron")}
                                      data-testid={`button-fav-ironOnly-${product.id}`}
                                    >
                                      Iron {(ironQuantities[product.id] || 0) > 0 && `(${ironQuantities[product.id]})`}
                                    </Button>
                                  </div>
                                  <div className="flex gap-0.5">
                                    <Button
                                      size="sm"
                                      variant={
                                        packingTypes[product.id] === "hanging"
                                          ? "default"
                                          : "outline"
                                      }
                                      className="flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2"
                                      onClick={() =>
                                        handlePackingTypeChange(product.id, "hanging")
                                      }
                                      data-testid={`button-fav-hanging-${product.id}`}
                                    >
                                      Hang
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={
                                        packingTypes[product.id] === "folding" ||
                                        !packingTypes[product.id]
                                          ? "default"
                                          : "outline"
                                      }
                                      className="flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2"
                                      onClick={() =>
                                        handlePackingTypeChange(product.id, "folding")
                                      }
                                      data-testid={`button-fav-folding-${product.id}`}
                                    >
                                      Fold
                                    </Button>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityChange(product.id, -1);
                                  }}
                                  data-testid={`button-fav-qty-minus-${product.id}`}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {/* Regular category view */}
                {selectedCategory !== "favorites" && Object.entries(filteredGroupedProducts).map(([category, categoryProducts]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-2 bg-muted/50 rounded-lg sticky top-0 z-10">
                      {getCategoryIcon(category, "w-6 h-6")}
                      <h3 className="font-bold text-sm">{category}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {categoryProducts?.length || 0}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                      {categoryProducts?.map((product) => (
                        <div
                          key={product.id}
                          draggable={isEditMode && user?.role === "admin"}
                          onDragStart={(e) => handleDragStart(e, { id: product.id, name: product.name })}
                          onDragEnd={handleDragEnd}
                          className={`relative rounded-lg sm:rounded-xl border-2 p-2 sm:p-3 md:p-4 flex flex-col items-center cursor-pointer hover-elevate ${
                            isProductSelected(product)
                              ? "border-primary border-[3px] bg-primary/15 ring-2 ring-primary/50 shadow-lg shadow-primary/20"
                              : "border-border/50 bg-gradient-to-br from-card to-muted/30 hover:border-primary/60"
                          } ${isEditMode ? "cursor-grab active:cursor-grabbing" : ""} ${
                            draggingProduct?.id === product.id ? "opacity-50 ring-2 ring-orange-400" : ""
                          }`}
                          onClick={() => !isEditMode && handleProductClick(product)}
                          data-testid={`box-product-${product.id}`}
                        >
                          {/* Star button - only show in edit mode */}
                          {isEditMode && (
                            <button
                              className={`absolute top-1 left-1 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                product.starred
                                  ? "bg-yellow-400 text-yellow-900 shadow-md"
                                  : "bg-muted/80 text-muted-foreground hover:bg-yellow-200 hover:text-yellow-700"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateProduct.mutate({
                                  id: product.id,
                                  starred: !product.starred,
                                });
                              }}
                              data-testid={`button-star-${product.id}`}
                            >
                              <Star className={`w-3.5 h-3.5 ${product.starred ? "fill-current" : ""}`} />
                            </button>
                          )}
                          {/* Star indicator when not in edit mode but item is starred */}
                          {!isEditMode && product.starred && (
                            <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center bg-yellow-400 text-yellow-900 shadow-sm">
                              <Star className="w-3 h-3 fill-current" />
                            </div>
                          )}
                          {/* Edit mode indicator */}
                          {isEditMode && user?.role === "admin" && (
                            <div className="absolute top-1 right-1 z-10 w-5 h-5 bg-orange-500 text-white rounded flex items-center justify-center">
                              <GripVertical className="w-3 h-3" />
                            </div>
                          )}
                          <div
                            className="w-full h-20 sm:h-24 md:h-28 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1 sm:mb-2 shadow-sm relative"
                          >
                            {(() => {
                              const imageSrc = product.imageUrl || getProductImage(product.name);
                              if (imageSrc) {
                                return (
                                  <img
                                    src={imageSrc}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }}
                                  />
                                );
                              }
                              return null;
                            })()}
                            <div className="fallback-icon absolute inset-0 flex items-center justify-center" style={{ display: (product.imageUrl || getProductImage(product.name)) ? 'none' : 'flex' }}>
                              {getCategoryIcon(product.category)}
                            </div>
                          </div>

                          <div
                            className="text-xs sm:text-sm leading-tight text-center font-bold text-foreground line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] flex items-center justify-center px-0.5 sm:px-1"
                            data-testid={`text-product-name-${product.id}`}
                          >
                            {product.name}
                          </div>

                          <div 
                            className="flex flex-col items-center mt-0.5 sm:mt-1 gap-0.5 w-full"
                          >
                            {isProductSelected(product) ? (
                              // Show price based on service selection when item is added
                              <div
                                className={`text-sm sm:text-lg font-black px-2 sm:px-3 py-0.5 sm:py-1 rounded-full ${
                                  hasIronItems(product.id)
                                    ? "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30"
                                    : hasDcItems(product.id) 
                                    ? "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30" 
                                    : "text-primary bg-primary/10"
                                }`}
                                data-testid={`text-product-active-price-${product.id}`}
                              >
                                {(() => {
                                  // For sqm-priced products (carpet), always show price per sqm
                                  if (product.isSqmPriced) {
                                    const sqmPrice = product.sqmPrice ? parseFloat(product.sqmPrice).toFixed(0) : (product.price ? parseFloat(product.price).toFixed(0) : "12");
                                    return `${sqmPrice}aed/sqm`;
                                  }
                                  const dcQty = dcQuantities[product.id] || 0;
                                  const ironQty = ironQuantities[product.id] || 0;
                                  const normalQty = getNormalQuantity(product.id);
                                  const prices: string[] = [];
                                  if (normalQty > 0) prices.push(`${normalQty}x N`);
                                  if (dcQty > 0) prices.push(`${dcQty}x DC`);
                                  if (ironQty > 0) prices.push(`${ironQty}x IO`);
                                  return prices.length > 0 ? prices.join(", ") : `${product.price ? parseFloat(product.price).toFixed(0) : "-"} AED`;
                                })()}
                              </div>
                            ) : (
                              // Show all three prices when item not added
                              <div className="flex flex-col items-center gap-0.5 text-[10px] sm:text-xs">
                                {product.isSqmPriced ? (
                                  <>
                                    <span className="text-primary font-bold">
                                      {product.sqmPrice ? parseFloat(product.sqmPrice).toFixed(0) : (product.price ? parseFloat(product.price).toFixed(0) : "12")} AED
                                    </span>
                                    <div className="text-[8px] sm:text-[9px] text-muted-foreground">per sqm</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className="text-primary font-bold">
                                        {product.price ? parseFloat(product.price).toFixed(0) : "-"}
                                      </span>
                                      <span className="text-muted-foreground">/</span>
                                      <span className="text-purple-600 dark:text-purple-400 font-bold">
                                        {product.dryCleanPrice ? parseFloat(product.dryCleanPrice).toFixed(0) : "-"}
                                      </span>
                                      <span className="text-muted-foreground">/</span>
                                      <span className="text-orange-600 dark:text-orange-400 font-bold">
                                        {product.ironOnlyPrice ? parseFloat(product.ironOnlyPrice).toFixed(0) : "-"}
                                      </span>
                                    </div>
                                    <div className="text-[8px] sm:text-[9px] text-muted-foreground">
                                      N / DC / IO
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {allocatedStock && (
                              <div className="flex flex-col items-center mt-1 gap-0.5">
                                <div
                                  className={`text-[10px] font-medium ${(allocatedStock[product.name] || 0) > 0 ? "text-primary cursor-pointer hover:underline font-semibold" : "text-muted-foreground"}`}
                                  data-testid={`text-stock-${product.id}`}
                                  onClick={(e) => {
                                    const count = allocatedStock[product.name] || 0;
                                    if (count > 0) {
                                      e.stopPropagation();
                                      setStockOrdersDialog({ open: true, productName: product.name, count });
                                    }
                                  }}
                                >
                                  Stock: {allocatedStock[product.name] || 0}
                                </div>
                              </div>
                            )}

                          {(getTotalQuantityForProduct(product.id) > 0 || (hasSizeOption(product) && getSizedItemQuantity(product.name) > 0)) ? (
                            <>
                              <div
                                className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-background animate-pulse"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span data-testid={`text-qty-${product.id}`}>
                                  {getTotalQuantityForProduct(product.id) || getSizedItemQuantity(product.name)}
                                </span>
                              </div>
                              {!product.isSqmPriced && (
                              <div
                                className="flex flex-col gap-0.5 sm:gap-1 mt-1.5 sm:mt-2 w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex gap-0.5">
                                  <Button
                                    size="sm"
                                    variant={(dcQuantities[product.id] || 0) > 0 ? "default" : "outline"}
                                    className={`flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 ${(dcQuantities[product.id] || 0) > 0 ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                                    onClick={() => openServiceTypeDialog(product.id, product.name, "dc")}
                                    data-testid={`button-dryClean-${product.id}`}
                                  >
                                    DC {(dcQuantities[product.id] || 0) > 0 && `(${dcQuantities[product.id]})`}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(ironQuantities[product.id] || 0) > 0 ? "default" : "outline"}
                                    className={`flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 ${(ironQuantities[product.id] || 0) > 0 ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                                    onClick={() => openServiceTypeDialog(product.id, product.name, "iron")}
                                    data-testid={`button-ironOnly-${product.id}`}
                                  >
                                    Iron {(ironQuantities[product.id] || 0) > 0 && `(${ironQuantities[product.id]})`}
                                  </Button>
                                </div>
                                <div className="flex gap-0.5">
                                  <Button
                                    size="sm"
                                    variant={
                                      packingTypes[product.id] === "hanging"
                                        ? "default"
                                        : "outline"
                                    }
                                    className="flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2"
                                    onClick={() =>
                                      handlePackingTypeChange(product.id, "hanging")
                                    }
                                    data-testid={`button-hanging-${product.id}`}
                                  >
                                    Hang
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      packingTypes[product.id] === "folding" ||
                                      !packingTypes[product.id]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="flex-1 h-5 sm:h-6 md:h-7 text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2"
                                    onClick={() =>
                                      handlePackingTypeChange(product.id, "folding")
                                    }
                                    data-testid={`button-folding-${product.id}`}
                                  >
                                    Fold
                                  </Button>
                                </div>
                              </div>
                              )}
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuantityChange(product.id, -1);
                                }}
                                data-testid={`button-qty-minus-${product.id}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      ))}
                      
                      {/* Add New Item Card - Only for admin */}
                      {user?.role === "admin" && !isEditMode && (
                        <div
                          className="relative rounded-lg sm:rounded-xl border-2 border-dashed border-primary/40 p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center cursor-pointer hover-elevate min-h-[160px] sm:min-h-[180px] md:min-h-[200px]"
                          onClick={() => {
                            setNewProductCategory(category);
                            setShowNewProductDialog(true);
                          }}
                          data-testid={`button-add-new-item-${category.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <Plus className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary" />
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-primary text-center">
                            Add New Item
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1">
                            to {category}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Floating Cart Button - Only on tablet/mobile (hidden on xl+) */}
        {hasOrderItems && (
          <button
            onClick={() => setShowCartPopup(true)}
            className={`fixed bottom-4 right-4 z-50 flex xl:hidden items-center gap-2 px-4 py-3 rounded-full shadow-2xl ${
              orderType === "urgent" 
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" 
                : "bg-gradient-to-r from-primary to-primary/90 text-white"
            }`}
            data-testid="button-open-cart"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-background text-primary text-xs font-bold rounded-full flex items-center justify-center border border-primary/20">
                {orderItems.reduce((sum, item) => sum + item.quantity, 0) + customItems.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <span className="font-bold text-sm">
              {orderType === "urgent" ? (orderTotal * 2).toFixed(0) : orderTotal.toFixed(0)} AED
            </span>
          </button>
        )}
      </div>

      {/* Right Sidebar - Order Slip (Only on xl+ screens) */}
      <div className="hidden xl:flex fixed right-0 top-0 h-screen w-[340px] flex-col border-l bg-background z-40">
        <div className="px-3 py-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-2 text-primary">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Order Slip</span>
            <Badge className="ml-auto text-xs font-bold bg-primary text-white">
              {orderItems.reduce((sum, item) => sum + item.quantity, 0) + customItems.reduce((sum, item) => sum + item.quantity, 0)} items
            </Badge>
          </div>
        </div>
        {renderOrderSlipContent(false)}
      </div>

      {/* Urgent/Normal Service Dialog */}
      <Dialog open={showUrgentDialog} onOpenChange={setShowUrgentDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              Select Service Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-4">
              <div className="font-semibold text-foreground text-lg mb-1">
                Order Total: {orderTotal.toFixed(2)} AED
              </div>
              <div className="text-xs">
                Urgent service = Double price ({(orderTotal * 2).toFixed(2)}{" "}
                AED)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => submitOrder(false)}
                disabled={createOrderMutation.isPending}
                data-testid="button-normal-service"
              >
                <Clock className="w-8 h-8 text-blue-500" />
                <div className="font-semibold">Normal</div>
                <div className="text-xs text-muted-foreground">
                  {orderTotal.toFixed(2)} AED
                </div>
              </Button>
              <Button
                className="h-24 flex flex-col gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => submitOrder(true)}
                disabled={createOrderMutation.isPending}
                data-testid="button-urgent-service"
              >
                <Zap className="w-8 h-8" />
                <div className="font-semibold">Urgent</div>
                <div className="text-xs">{(orderTotal * 2).toFixed(2)} AED</div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff PIN Dialog */}
      <Dialog
        open={showPinDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowPinDialog(false);
            setStaffPin("");
            setPinError("");
          }
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Enter Manager/Cashier PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              Enter your 5-digit PIN to proceed
            </div>
            <Input
              id="staff-pin"
              type="tel"
              inputMode="numeric"
              maxLength={5}
              placeholder="Enter 5-digit PIN"
              value={staffPin}
              autoComplete="off"
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                setStaffPin(val);
                setPinError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && verifyPinAndCreateOrder()}
              className="text-center text-2xl tracking-widest [-webkit-text-security:disc]"
              data-testid="input-staff-pin"
            />
            {pinError && (
              <p className="text-sm text-destructive text-center">{pinError}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPinDialog(false);
                  setStaffPin("");
                  setPinError("");
                }}
                data-testid="button-cancel-pin"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={verifyPinAndCreateOrder}
                disabled={staffPin.length !== 5 || isVerifyingPin}
                data-testid="button-confirm-pin"
              >
                {isVerifyingPin ? "..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Item Dialog */}
      <Dialog open={showOtherItemDialog} onOpenChange={setShowOtherItemDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Other Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item Name *</Label>
              <Input
                placeholder="Enter item name"
                value={otherItemName}
                onChange={(e) => setOtherItemName(e.target.value)}
                data-testid="input-other-item-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Price (AED) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={otherItemPrice}
                  onChange={(e) => setOtherItemPrice(e.target.value)}
                  data-testid="input-other-item-price"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={otherItemQty}
                  onChange={(e) => setOtherItemQty(e.target.value)}
                  data-testid="input-other-item-qty"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowOtherItemDialog(false);
                  setOtherItemName("");
                  setOtherItemPrice("");
                  setOtherItemQty("1");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddOtherItem}
                data-testid="button-add-other-item-confirm"
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog */}
      <Dialog open={showNewProductDialog} onOpenChange={setShowNewProductDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add New Item to Inventory
            </DialogTitle>
            <DialogDescription>
              This item will be added to <span className="font-semibold text-primary">{newProductCategory}</span> category and saved to inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item Name *</Label>
              <Input
                placeholder="e.g., Dress Shirt, Jacket, etc."
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                data-testid="input-new-product-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Normal Price (AED) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  data-testid="input-new-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Dry Clean Price (AED)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newProductDryCleanPrice}
                  onChange={(e) => setNewProductDryCleanPrice(e.target.value)}
                  data-testid="input-new-product-dryclean-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Category</Label>
              <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                <SelectTrigger data-testid="select-new-product-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arabic Clothes">Arabic Traditional Clothes</SelectItem>
                  <SelectItem value="Men's Clothes">Men's Clothes</SelectItem>
                  <SelectItem value="Ladies' Clothes">Ladies Clothes</SelectItem>
                  <SelectItem value="Baby Clothes">Babies Clothes</SelectItem>
                  <SelectItem value="Linens">Linens</SelectItem>
                  <SelectItem value="General Items">General Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowNewProductDialog(false);
                  setNewProductName("");
                  setNewProductPrice("");
                  setNewProductDryCleanPrice("");
                  setNewProductCategory("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!newProductName.trim() || !newProductPrice) {
                    toast({
                      title: "Missing information",
                      description: "Please enter item name and price",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsCreatingProduct(true);
                  try {
                    await apiRequest("POST", "/api/products", {
                      name: newProductName.trim(),
                      price: newProductPrice,
                      dryCleanPrice: newProductDryCleanPrice ? newProductDryCleanPrice : null,
                      category: newProductCategory || "General Items",
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                    toast({
                      title: "Item added",
                      description: `${newProductName} has been added to inventory`,
                    });
                    setShowNewProductDialog(false);
                    setNewProductName("");
                    setNewProductPrice("");
                    setNewProductDryCleanPrice("");
                    setNewProductCategory("");
                  } catch (err: any) {
                    toast({
                      title: "Error",
                      description: err.message || "Failed to add item",
                      variant: "destructive",
                    });
                  } finally {
                    setIsCreatingProduct(false);
                  }
                }}
                disabled={!newProductName.trim() || !newProductPrice || isCreatingProduct}
                data-testid="button-save-new-product"
              >
                {isCreatingProduct ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add to Inventory"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-md max-h-[80vh] sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 pb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Name *</Label>
                <Input
                  placeholder="Client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value.toUpperCase())}
                  data-testid="input-new-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Phone *</Label>
                <Input
                  placeholder="05XXXXXXXX"
                  value={newClientPhone.replace(/\D/g, "").slice(0, 10)}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    if (digits.length > 0 && !digits.startsWith("0")) {
                      digits = "0" + digits.slice(0, 9);
                    }
                    const phoneValue = digits || "0";
                    setNewClientPhone(phoneValue);
                    checkExistingClientByPhone(phoneValue);
                  }}
                  maxLength={10}
                  inputMode="numeric"
                  data-testid="input-new-client-phone"
                />
              </div>
            </div>
            {suggestedExistingClient && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Phone number already exists
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      This number belongs to: <strong>{suggestedExistingClient.name}</strong>
                      {suggestedExistingClient.address && (
                        <span className="block text-muted-foreground">{suggestedExistingClient.address}</span>
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        setSelectedClientId(suggestedExistingClient.id);
                        setCustomerName(suggestedExistingClient.name);
                        setCustomerPhone(suggestedExistingClient.phone || "");
                        setWalkInAddress(suggestedExistingClient.address || "");
                        setIsWalkIn(false);
                        setShowNewClientDialog(false);
                        setSuggestedExistingClient(null);
                        setNewClientName("");
                        setNewClientPhone("0");
                        setNewClientAddress("");
                        setNewClientEmail("");
                        setNewClientContact("");
                        setNewClientPaymentMethod("cash");
                        setNewClientDiscount("");
                        toast({
                          title: "Client selected",
                          description: `Using existing client: ${suggestedExistingClient.name}`,
                        });
                      }}
                      data-testid="button-use-existing-client"
                    >
                      Use This Client
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Email</Label>
              <Input
                type="email"
                placeholder="Email address"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                data-testid="input-new-client-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Address</Label>
              <Input
                placeholder="Full address"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value.toUpperCase())}
                data-testid="input-new-client-address"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Contact Person</Label>
              <Input
                placeholder="Contact person name"
                value={newClientContact}
                onChange={(e) => setNewClientContact(e.target.value.toUpperCase())}
                data-testid="input-new-client-contact"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Method</Label>
                <Select
                  value={newClientPaymentMethod}
                  onValueChange={setNewClientPaymentMethod}
                >
                  <SelectTrigger data-testid="select-new-client-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={newClientDiscount}
                  onChange={(e) => setNewClientDiscount(e.target.value)}
                  data-testid="input-new-client-discount"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowNewClientDialog(false);
                  setSuggestedExistingClient(null);
                  setNewClientName("");
                  setNewClientPhone("0");
                  setNewClientAddress("");
                  setNewClientEmail("");
                  setNewClientContact("");
                  setNewClientPaymentMethod("cash");
                  setNewClientDiscount("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateNewClient}
                disabled={isCreatingClient}
                data-testid="button-create-new-client"
              >
                {isCreatingClient ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Size Selection Dialog */}
      <Dialog open={showSizeDialog} onOpenChange={setShowSizeDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-xs max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Select Size</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              <div className="font-bold text-foreground text-lg">
                {sizeDialogProduct?.name}
              </div>
            </div>

            {sizeDialogProduct && (
              <div className="grid grid-cols-3 gap-3">
                {sizeDialogProduct.smallPrice && (
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10"
                    onClick={() => handleAddSizedItem("small")}
                    data-testid="button-size-small"
                  >
                    <div className="text-2xl font-black text-primary">S</div>
                    <div className="font-bold">Small</div>
                    <div className="text-sm font-bold text-primary">
                      {parseFloat(sizeDialogProduct.smallPrice).toFixed(0)} AED
                    </div>
                  </Button>
                )}
                {(sizeDialogProduct.mediumPrice || sizeDialogProduct.price) && (
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10"
                    onClick={() => handleAddSizedItem("medium")}
                    data-testid="button-size-medium"
                  >
                    <div className="text-2xl font-black text-primary">M</div>
                    <div className="font-bold">Medium</div>
                    <div className="text-sm font-bold text-primary">
                      {parseFloat(sizeDialogProduct.mediumPrice || sizeDialogProduct.price || "0").toFixed(0)} AED
                    </div>
                  </Button>
                )}
                {sizeDialogProduct.largePrice && (
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10"
                    onClick={() => handleAddSizedItem("large")}
                    data-testid="button-size-large"
                  >
                    <div className="text-2xl font-black text-primary">L</div>
                    <div className="font-bold">Large</div>
                    <div className="text-sm font-bold text-primary">
                      {parseFloat(sizeDialogProduct.largePrice).toFixed(0)} AED
                    </div>
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SQM Pricing Dialog (for Carpet) */}
      <Dialog open={sqmDialog.open} onOpenChange={(open) => !open && setSqmDialog({ open: false, productId: null, productName: "", sqmPrice: "12.00" })}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Carpet Size</DialogTitle>
            <DialogDescription className="text-center">
              {sqmDialog.productName} is priced at <span className="font-bold text-foreground">{sqmDialog.sqmPrice} AED per square meter</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">How many square meters is the carpet?</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Enter square meters (e.g., 5)"
                value={sqmInput}
                onChange={(e) => setSqmInput(e.target.value)}
                className="text-center text-lg font-bold h-14"
                autoFocus
                data-testid="input-sqm-value"
              />
            </div>
            {sqmInput && parseFloat(sqmInput) > 0 && (
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Price:</div>
                <div className="text-2xl font-bold text-primary">
                  {(parseFloat(sqmInput) * parseFloat(sqmDialog.sqmPrice)).toFixed(2)} AED
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {sqmInput} sqm × {sqmDialog.sqmPrice} AED/sqm
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12"
                onClick={() => setSqmDialog({ open: false, productId: null, productName: "", sqmPrice: "12.00" })}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 h-12"
                onClick={handleSqmConfirm}
                disabled={!sqmInput || parseFloat(sqmInput) <= 0}
                data-testid="button-confirm-sqm"
              >
                Add to Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Carpet Service Picker Dialog (for DC/Iron on multiple carpets) */}
      <Dialog 
        open={carpetServiceDialog.open} 
        onOpenChange={(open) => !open && setCarpetServiceDialog({ open: false, productId: null, productName: "", serviceType: "dc" })}
      >
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              Select Carpet for {carpetServiceDialog.serviceType === "dc" ? "Dry Clean" : "Iron Only"}
            </DialogTitle>
            <DialogDescription className="text-center">
              You have multiple carpets. Which one would you like to apply {carpetServiceDialog.serviceType === "dc" ? "Dry Clean" : "Iron Only"} to?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 flex-1 overflow-y-auto max-h-[50vh]">
            {carpetServiceDialog.productId && carpetEntries
              .filter(e => e.productId === carpetServiceDialog.productId)
              .map((entry, index) => {
                const product = products?.find(p => p.id === entry.productId);
                const sqmPrice = parseFloat(product?.sqmPrice || product?.price || "12");
                const totalPrice = entry.sqm * sqmPrice;
                const isSelected = entry.serviceType === carpetServiceDialog.serviceType;
                
                return (
                  <Button
                    key={entry.id}
                    variant="outline"
                    className={`w-full h-auto py-3 flex flex-col items-start gap-1 border-2 ${isSelected ? "border-primary bg-primary/10" : ""}`}
                    onClick={() => handleCarpetServiceSelect(entry.id)}
                    data-testid={`button-carpet-select-${index}`}
                  >
                    <div className="flex justify-between w-full">
                      <span className="font-bold">Carpet #{index + 1}</span>
                      <span className="text-sm text-muted-foreground">
                        {entry.serviceType === "normal" ? "Normal" : entry.serviceType === "dc" ? "DC" : "Iron"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.sqm} sqm = {totalPrice.toFixed(2)} AED
                    </div>
                    {isSelected && (
                      <div className="text-xs text-primary font-semibold">Click to remove {carpetServiceDialog.serviceType === "dc" ? "DC" : "Iron"}</div>
                    )}
                  </Button>
                );
              })}
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => setCarpetServiceDialog({ open: false, productId: null, productName: "", serviceType: "dc" })}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gutra Options Dialog */}
      <Dialog open={showGutraDialog} onOpenChange={setShowGutraDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Gutra Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              <div className="font-bold text-foreground text-lg">
                {gutraDialogProduct?.name}
              </div>
              <div className="text-primary font-bold">
                {gutraDialogProduct?.price?.toFixed(2)} AED
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Nisha Option</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={`h-16 flex flex-col gap-1 border-2 ${gutraNisha === "nisha" ? "border-primary bg-primary/10" : ""}`}
                  onClick={() => setGutraNisha("nisha")}
                  data-testid="button-gutra-nisha"
                >
                  <div className="font-bold">Nisha</div>
                </Button>
                <Button
                  variant="outline"
                  className={`h-16 flex flex-col gap-1 border-2 ${gutraNisha === "without-nisha" ? "border-primary bg-primary/10" : ""}`}
                  onClick={() => setGutraNisha("without-nisha")}
                  data-testid="button-gutra-without-nisha"
                >
                  <div className="font-bold">Without Nisha</div>
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Style</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={`h-16 flex flex-col gap-1 border-2 ${gutraStyle === "line" ? "border-primary bg-primary/10" : ""}`}
                  onClick={() => setGutraStyle("line")}
                  data-testid="button-gutra-line"
                >
                  <div className="font-bold">Line</div>
                </Button>
                <Button
                  variant="outline"
                  className={`h-16 flex flex-col gap-1 border-2 ${gutraStyle === "straight" ? "border-primary bg-primary/10" : ""}`}
                  onClick={() => setGutraStyle("straight")}
                  data-testid="button-gutra-straight"
                >
                  <div className="font-bold">Straight</div>
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleAddGutraItem}
              disabled={!gutraNisha || !gutraStyle}
              data-testid="button-add-gutra"
            >
              Add to Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Type Quantity Dialog */}
      <Dialog 
        open={!!serviceTypeDialog} 
        onOpenChange={(open) => !open && setServiceTypeDialog(null)}
      >
        <DialogContent aria-describedby={undefined} className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">
              {serviceTypeDialog?.type === "dc" ? "Dry Clean" : "Iron Only"} Items
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground">
              <div className="font-bold text-foreground text-lg">
                {serviceTypeDialog?.productName}
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                Total items: {serviceTypeDialog?.maxQty}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                How many for {serviceTypeDialog?.type === "dc" ? "Dry Clean" : "Iron Only"}?
              </Label>
              <Input
                type="number"
                min="0"
                max={serviceTypeDialog?.maxQty || 0}
                value={serviceTypeQty}
                onChange={(e) => setServiceTypeQty(e.target.value)}
                placeholder="0"
                className="text-center text-lg font-bold"
                data-testid="input-service-type-qty"
              />
              <div className="text-xs text-muted-foreground text-center">
                Remaining will be Normal service
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setServiceTypeDialog(null)}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${serviceTypeDialog?.type === "dc" ? "bg-purple-600 hover:bg-purple-700" : "bg-orange-500 hover:bg-orange-600"}`}
                onClick={applyServiceTypeQty}
                data-testid="button-apply-service-type"
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Prices Dialog */}
      <Dialog
        open={!!editingPriceProduct}
        onOpenChange={(open) => !open && setEditingPriceProduct(null)}
      >
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Prices - {editingPriceProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Normal Price (AED)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editingPriceProduct?.price || ""}
                onChange={(e) =>
                  setEditingPriceProduct((prev) =>
                    prev ? { ...prev, price: e.target.value } : null
                  )
                }
                data-testid="input-edit-normal-price"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Dry Clean Price (AED)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editingPriceProduct?.dryCleanPrice || ""}
                onChange={(e) =>
                  setEditingPriceProduct((prev) =>
                    prev ? { ...prev, dryCleanPrice: e.target.value } : null
                  )
                }
                data-testid="input-edit-dc-price"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Iron Only Price (AED)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editingPriceProduct?.ironOnlyPrice || ""}
                onChange={(e) =>
                  setEditingPriceProduct((prev) =>
                    prev ? { ...prev, ironOnlyPrice: e.target.value } : null
                  )
                }
                data-testid="input-edit-iron-price"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingPriceProduct(null)}
                data-testid="button-cancel-edit-price"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (editingPriceProduct) {
                    updateProduct.mutate({
                      id: editingPriceProduct.id,
                      price: editingPriceProduct.price || undefined,
                      dryCleanPrice: editingPriceProduct.dryCleanPrice || undefined,
                      ironOnlyPrice: editingPriceProduct.ironOnlyPrice || undefined,
                    });
                    setEditingPriceProduct(null);
                  }
                }}
                disabled={updateProduct.isPending}
                data-testid="button-save-prices"
              >
                {updateProduct.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cart Popup Dialog - Only for tablet/mobile (xl+ uses sidebar) */}
      <Dialog open={showCartPopup} onOpenChange={setShowCartPopup}>
        <DialogContent aria-describedby={undefined} className="max-w-sm max-h-[70vh] sm:max-h-[85vh] overflow-y-auto p-0 flex flex-col xl:hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              Order Slip
              <Badge className="ml-auto text-xs font-bold bg-primary text-white">
                {orderItems.length + customItems.length} items
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {renderOrderSlipContent(true)}
        </DialogContent>
      </Dialog>

      {/* Print Tag Prompt Dialog */}
      <Dialog open={showPrintTagDialog} onOpenChange={(open) => {
        if (!open) handlePrintTagDialogClose(false);
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Order Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Order #{createdOrder?.orderNumber} has been created. Would you like to print the order tag now?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {createdOrder && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-bold">{createdOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {clients?.find(c => c.id === createdOrder.clientId)?.name || createdOrder.customerName || "Walk-in"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-bold text-primary">AED {createdOrder.finalAmount || createdOrder.totalAmount}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => handlePrintTagDialogClose(true)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Tag Now
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handlePrintTagDialogClose(false)}
              >
                Print Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOrdersDialog.open} onOpenChange={(open) => setStockOrdersDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[400px] max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>{stockOrdersDialog.productName}</DialogTitle>
            <DialogDescription>
              {stockOrdersDialog.count} items across undelivered orders
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[50vh]">
            {stockOrdersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : stockProductOrders && stockProductOrders.length > 0 ? (
              <div className="space-y-1.5">
                {stockProductOrders.map((order, idx) => (
                  <div
                    key={`${order.orderNumber}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-md border"
                    data-testid={`row-stock-order-${order.orderId}`}
                  >
                    <span className="font-mono font-semibold text-sm">{order.orderNumber}</span>
                    <Badge variant="secondary">{order.quantity}x</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No orders found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
