import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useClients, useCreateClient } from "@/hooks/use-clients";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
    case "Shoes, Carpets & More":
      return <Footprints className={`${size} text-orange-600`} />;
    default:
      return <Shirt className={`${size} text-primary`} />;
  }
};

export default function Products() {
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
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [packingTypes, setPackingTypes] = useState<
    Record<number, "hanging" | "folding">
  >({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [tips, setTips] = useState("");
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [newClientPaymentMethod, setNewClientPaymentMethod] = useState("cash");
  const [newClientDiscount, setNewClientDiscount] = useState("");
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
  } | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [staffPin, setStaffPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingUrgent, setPendingUrgent] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [stockValue, setStockValue] = useState("");

  const sizeOptions: Record<string, { small: number; large: number }> = {
    Towel: { small: 5, large: 8 },
    Comfort: { small: 25, large: 35 },
    Blanket: { small: 15, large: 25 },
    "Duvet Cover": { small: 10, large: 15 },
    "Bed Sheet": { small: 5, large: 8 },
    Jacket: { small: 5, large: 8 },
    "Curtain/Window Screen": { small: 15, large: 25 },
  };

  const hasSizeOption = (productName: string) => {
    return Object.keys(sizeOptions).some(
      (key) =>
        productName.toLowerCase().includes(key.toLowerCase()) &&
        !productName.includes("(Small)") &&
        !productName.includes("(Large)"),
    );
  };

  const getSizeOptionKey = (productName: string) => {
    return Object.keys(sizeOptions).find((key) =>
      productName.toLowerCase().includes(key.toLowerCase()),
    );
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

  const groupedProducts = useMemo(() => {
    if (!products) return {};
    const groups: Record<string, typeof products> = {};
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
    
    products.forEach((product) => {
      const category = product.category || "Other";
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
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update stock",
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

  const handleProductClick = (product: {
    id: number;
    name: string;
    price?: string | null;
  }) => {
    if (hasSizeOption(product.name)) {
      setSizeDialogProduct(product);
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

  const handleAddSizedItem = (size: "small" | "large") => {
    if (!sizeDialogProduct) return;
    const sizeKey = getSizeOptionKey(sizeDialogProduct.name);
    if (!sizeKey) return;

    const price = sizeOptions[sizeKey][size];
    const itemName = `${sizeDialogProduct.name} (${size === "small" ? "Small" : "Large"})`;

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

  const orderItems = useMemo(() => {
    if (!products) return [];
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === parseInt(productId));
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as { product: (typeof products)[0]; quantity: number }[];
  }, [quantities, products]);

  const orderTotal = useMemo(() => {
    const productTotal = orderItems.reduce((sum, item) => {
      return sum + parseFloat(item.product.price || "0") * item.quantity;
    }, 0);
    const customTotal = customItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    return productTotal + customTotal;
  }, [orderItems, customItems]);

  const hasOrderItems = orderItems.length > 0 || customItems.length > 0;

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/products/allocated-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] }); // Refresh products to show updated stock
      setQuantities({});
      setCustomerName("");
      toast({
        title: "Order created",
        description: "Order has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create order.",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrder = () => {
    if (!selectedClientId && customerName !== "Walk-in Customer") {
      toast({
        title: "Select a client",
        description: "Please select a client from the dropdown.",
        variant: "destructive",
      });
      return;
    }
    if (!hasOrderItems) {
      toast({
        title: "No items",
        description: "Please add items to the order.",
        variant: "destructive",
      });
      return;
    }
    setShowUrgentDialog(true);
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
      const res = await fetch("/api/packing/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: staffPin }),
      });

      if (!res.ok) {
        setPinError("Invalid PIN");
        setIsVerifyingPin(false);
        return;
      }

      const data = await res.json();

      const productItemsText = orderItems.map((item) => {
        const packing = packingTypes[item.product.id] || "folding";
        return `${item.quantity}x ${item.product.name} (${packing})`;
      });
      const customItemsText = customItems.map(
        (item) => `${item.quantity}x ${item.name} @ ${item.price} AED`,
      );
      const itemsText = [...productItemsText, ...customItemsText].join(", ");
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

      let subtotal = pendingUrgent ? orderTotal * 2 : orderTotal;
      const discPct = parseFloat(discountPercent) || 0;
      const discountAmt = (subtotal * discPct) / 100;
      const tipsAmt = parseFloat(tips) || 0;
      const finalTotal = subtotal - discountAmt + tipsAmt;

      createOrderMutation.mutate({
        clientId: selectedClientId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        orderNumber,
        items: itemsText,
        totalAmount: subtotal.toFixed(2),
        discountPercent: discPct.toFixed(2),
        discountAmount: discountAmt.toFixed(2),
        tips: tipsAmt.toFixed(2),
        finalAmount: finalTotal.toFixed(2),
        entryDate: new Date().toISOString(),
        deliveryType: "pickup",
        urgent: pendingUrgent,
        entryBy: data.worker?.name || "Staff",
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
    setPackingTypes({});
    setCustomItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedClientId(null);
    setDiscountPercent("");
    setTips("");
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
          setNewClientPhone("");
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
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create client.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex h-screen">
      {/* Left side - New Order */}
      <div className="flex-1 flex flex-col min-w-0">
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
                className="pl-9 h-9 rounded-full border-2 border-primary/20 bg-white dark:bg-background focus:bg-white dark:focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
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
                {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-2 bg-muted/50 rounded-lg sticky top-0 z-10">
                      {getCategoryIcon(category, "w-6 h-6")}
                      <h3 className="font-bold text-sm">{category}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {categoryProducts?.length || 0}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {categoryProducts?.map((product) => (
                        <div
                          key={product.id}
                          className={`relative rounded-xl border-2 p-4 flex flex-col items-center cursor-pointer transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                            quantities[product.id]
                              ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/40 shadow-md"
                              : "border-border/50 bg-gradient-to-br from-card to-muted/30 hover:border-primary/60 hover:from-primary/5 hover:to-card"
                          }`}
                          onClick={() => handleProductClick(product)}
                          data-testid={`box-product-${product.id}`}
                        >
                          <div
                            className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center overflow-hidden flex-shrink-0 mb-2 shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditImage(product.id, product.imageUrl);
                            }}
                            title="Click to edit image"
                          >
                            {(product.imageUrl || getProductImage(product.name)) ? (
                              <img
                                src={product.imageUrl || getProductImage(product.name) || ''}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getCategoryIcon(product.category)
                            )}
                          </div>

                          <div
                            className="text-sm leading-tight text-center font-bold text-foreground line-clamp-2 min-h-[2.5rem] flex items-center justify-center px-1"
                            data-testid={`text-product-name-${product.id}`}
                          >
                            {product.name}
                          </div>

                          <div
                            className="text-lg font-black text-primary mt-1 bg-primary/10 px-2 py-0.5 rounded-full"
                            data-testid={`text-product-price-${product.id}`}
                          >
                            {product.price
                              ? `${parseFloat(product.price).toFixed(0)}`
                              : "-"}
                          </div>

                          {product.stockQuantity !== null &&
                            product.stockQuantity !== undefined && (
                              <div className="flex flex-col items-center mt-1 gap-0.5">
                                <div
                                  className="text-[10px] font-medium text-muted-foreground"
                                  data-testid={`text-stock-${product.id}`}
                                >
                                  Stock: {product.stockQuantity}
                                  {allocatedStock && allocatedStock[product.name] ? (
                                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                                      ({allocatedStock[product.name]} pending)
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )}

                          {quantities[product.id] ? (
                            <>
                              <div
                                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white text-sm font-bold flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-background animate-pulse"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span data-testid={`text-qty-${product.id}`}>
                                  {quantities[product.id]}
                                </span>
                              </div>
                              <div
                                className="flex flex-col gap-1.5 mt-3 w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  size="sm"
                                  variant={
                                    packingTypes[product.id] === "hanging"
                                      ? "default"
                                      : "outline"
                                  }
                                  className="w-full h-7 text-xs"
                                  onClick={() =>
                                    handlePackingTypeChange(product.id, "hanging")
                                  }
                                  data-testid={`button-hanging-${product.id}`}
                                >
                                  Hanging
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    packingTypes[product.id] === "folding" ||
                                    !packingTypes[product.id]
                                      ? "default"
                                      : "outline"
                                  }
                                  className="w-full h-7 text-xs"
                                  onClick={() =>
                                    handlePackingTypeChange(product.id, "folding")
                                  }
                                  data-testid={`button-folding-${product.id}`}
                                >
                                  Folding
                                </Button>
                              </div>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full"
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Order Summary Bar - Highlighted */}
        {hasOrderItems && (
          <div className="sticky bottom-0 z-40 mx-2 mb-2 p-3 border-2 border-primary shadow-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {orderItems.length + customItems.length} items selected
                  </p>
                  <p
                    className="text-xl font-black text-primary"
                    data-testid="text-order-total"
                  >
                    {orderTotal.toFixed(2)} AED
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {customerName && (
                  <span className="text-xs font-semibold text-muted-foreground px-2">
                    {customerName}
                  </span>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearOrder}
                  data-testid="button-clear-order"
                >
                  <X className="w-3 h-3" />
                </Button>

                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 text-xs"
                  onClick={handleCreateOrder}
                  disabled={
                    createOrderMutation.isPending ||
                    (!selectedClientId && customerName !== "Walk-in Customer")
                  }
                  data-testid="button-create-order"
                >
                  {createOrderMutation.isPending ? "..." : "CREATE"}
                </Button>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-primary/20 text-[10px] text-muted-foreground line-clamp-1">
              {orderItems.map((item, idx) => (
                <span key={item.product.id} className="font-medium">
                  {item.quantity}x {item.product.name}
                  {idx < orderItems.length + customItems.length - 1 ? ", " : ""}
                </span>
              ))}
              {customItems.map((item, idx) => (
                <span
                  key={`custom-${idx}`}
                  className="font-medium text-amber-600"
                >
                  {item.quantity}x {item.name}
                  {idx < customItems.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right side - Order Slip or Today's Work List */}
      <div className="w-80 border-l-2 border-primary/20 bg-gradient-to-b from-muted/50 to-background flex flex-col shadow-xl">
        {hasOrderItems ? (
          <>
            <div className="h-14 px-4 flex items-center justify-between border-b border-primary/20 bg-gradient-to-r from-primary/15 to-primary/5">
              <h2 className="text-base font-black text-primary flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                Order Slip
              </h2>
              <Badge className="text-xs font-bold bg-primary text-white shadow">
                {orderItems.length + customItems.length}
              </Badge>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="border-2 border-primary/20 rounded-xl bg-white dark:bg-background p-4 space-y-4 shadow-sm">
                <div className="text-center border-b border-primary/20 pb-3">
                  <div className="text-base font-black text-primary">
                    LIQUID WASHES LAUNDRY
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    Order Preview
                  </div>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-background">
                      <tr className="border-b">
                        <th className="text-left py-1 font-bold">#</th>
                        <th className="text-left py-1 font-bold">Item</th>
                        <th className="text-center py-1 font-bold">Qty</th>
                        <th className="text-right py-1 font-bold">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, idx) => (
                        <tr
                          key={item.product.id}
                          className="border-b border-dashed"
                        >
                          <td className="py-1 font-bold">{idx + 1}</td>
                          <td
                            className="py-1 font-bold truncate max-w-[100px]"
                            title={item.product.name}
                          >
                            {item.product.name}
                          </td>
                          <td className="py-1 text-center font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-1 text-right font-bold">
                            {(
                              parseFloat(item.product.price || "0") *
                              item.quantity
                            ).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                      {customItems.map((item, idx) => (
                        <tr
                          key={`custom-${idx}`}
                          className="border-b border-dashed bg-amber-50 dark:bg-amber-900/20"
                        >
                          <td className="py-1 font-bold">
                            {orderItems.length + idx + 1}
                          </td>
                          <td
                            className="py-1 font-bold truncate max-w-[100px] flex items-center gap-1"
                            title={item.name}
                          >
                            {item.name}
                            <button
                              onClick={() => removeCustomItem(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="py-1 text-center font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-1 text-right font-bold">
                            {(item.price * item.quantity).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Subtotal</span>
                    <span>{orderTotal.toFixed(2)} AED</span>
                  </div>
                  {parseFloat(discountPercent) > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Discount ({discountPercent}%)</span>
                      <span>
                        -
                        {(
                          (orderTotal * parseFloat(discountPercent)) /
                          100
                        ).toFixed(2)}{" "}
                        AED
                      </span>
                    </div>
                  )}
                  {parseFloat(tips) > 0 && (
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>Tips</span>
                      <span>+{parseFloat(tips).toFixed(2)} AED</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-primary">
                    <span>TOTAL</span>
                    <span>
                      {(
                        orderTotal -
                        (orderTotal * (parseFloat(discountPercent) || 0)) /
                          100 +
                        (parseFloat(tips) || 0)
                      ).toFixed(2)}{" "}
                      AED
                    </span>
                  </div>
                  {clientBalance && parseFloat(clientBalance.totalDue) > 0 && (
                    <>
                      <div className="border-t border-dashed mt-2 pt-2">
                        <div className="flex justify-between text-xs text-orange-600 font-semibold">
                          <span>Previous Balance</span>
                          <span data-testid="text-previous-balance">
                            {parseFloat(clientBalance.totalDue).toFixed(2)} AED
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-orange-700 dark:text-orange-400 mt-1">
                          <span>NEW TOTAL</span>
                          <span data-testid="text-new-total">
                            {(
                              parseFloat(clientBalance.totalDue) +
                              orderTotal -
                              (orderTotal *
                                (parseFloat(discountPercent) || 0)) /
                                100 +
                              (parseFloat(tips) || 0)
                            ).toFixed(2)}{" "}
                            AED
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <Label className="text-xs font-semibold">Select Client</Label>
                <Select
                  value={selectedClientId?.toString() || ""}
                  onValueChange={(value) => {
                    if (value === "walkin") {
                      setSelectedClientId(null);
                      setCustomerName("Walk-in Customer");
                      setCustomerPhone("");
                    } else if (value === "new") {
                      setShowNewClientDialog(true);
                    } else {
                      const client = clients?.find(
                        (c) => c.id.toString() === value,
                      );
                      if (client) {
                        setSelectedClientId(client.id);
                        setCustomerName(client.name);
                        setCustomerPhone(client.phone || "");
                        if (client.discountPercent) {
                          setDiscountPercent(client.discountPercent);
                        }
                      }
                    }
                  }}
                >
                  <SelectTrigger
                    className="h-8 text-xs"
                    data-testid="select-order-client"
                  >
                    <SelectValue placeholder="Choose client..." />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-background border shadow-lg max-h-[300px]">
                    <SelectItem
                      value="walkin"
                      className="font-medium text-primary"
                    >
                      Walk-in Customer
                    </SelectItem>
                    {clients?.map((client) => (
                      <SelectItem
                        key={client.id}
                        value={client.id.toString()}
                        className="py-2"
                      >
                        <span className="font-medium">{client.name}</span>
                        {client.phone && (
                          <span className="text-muted-foreground ml-2">
                            ({client.phone})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowNewClientDialog(true)}
                  data-testid="button-add-client-quick"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add New Client
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowOtherItemDialog(true)}
                  data-testid="button-add-other-item"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Other Item
                </Button>
                <div className="flex gap-1">
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder="Discount %"
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    data-testid="input-discount-percent"
                  />
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder="Tips"
                    type="number"
                    min="0"
                    value={tips}
                    onChange={(e) => setTips(e.target.value)}
                    data-testid="input-tips"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={clearOrder}
                    data-testid="button-clear-order-panel"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={handleCreateOrder}
                    disabled={
                      createOrderMutation.isPending ||
                      (!selectedClientId && customerName !== "Walk-in Customer")
                    }
                    data-testid="button-create-order-panel"
                  >
                    {createOrderMutation.isPending ? "..." : "CREATE"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="h-12 px-3 flex items-center border-b bg-white/80 dark:bg-background/80">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Today's Work
              </h2>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-3">
              {/* Washing Pending */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shirt className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Washing
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-bold"
                  >
                    {pendingWashing.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {pendingWashing.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-xs"
                    >
                      <div className="font-bold text-blue-700 dark:text-blue-300">
                        {order.orderNumber}
                      </div>
                      <div className="text-muted-foreground font-semibold line-clamp-1">
                        {order.items}
                      </div>
                    </div>
                  ))}
                  {pendingWashing.length === 0 && (
                    <div className="text-xs text-muted-foreground italic font-semibold">
                      No pending
                    </div>
                  )}
                </div>
              </div>

              {/* Packing Pending */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Packing
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-bold"
                  >
                    {pendingPacking.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {pendingPacking.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="bg-orange-50 dark:bg-orange-900/20 rounded p-2 text-xs"
                    >
                      <div className="font-bold text-orange-700 dark:text-orange-300">
                        {order.orderNumber}
                      </div>
                      <div className="text-muted-foreground font-semibold line-clamp-1">
                        {order.items}
                      </div>
                    </div>
                  ))}
                  {pendingPacking.length === 0 && (
                    <div className="text-xs text-muted-foreground italic font-semibold">
                      No pending
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Pending */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Delivery
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-bold"
                  >
                    {pendingDelivery.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {pendingDelivery.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="bg-green-50 dark:bg-green-900/20 rounded p-2 text-xs"
                    >
                      <div className="font-bold text-green-700 dark:text-green-300">
                        {order.orderNumber}
                      </div>
                      <div className="text-muted-foreground font-semibold line-clamp-1">
                        {order.items}
                      </div>
                    </div>
                  ))}
                  {pendingDelivery.length === 0 && (
                    <div className="text-xs text-muted-foreground italic font-semibold">
                      No pending
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground font-semibold">
                  Today's Orders:{" "}
                  <span className="font-bold text-foreground">
                    {todaysOrders.length}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Urgent/Normal Service Dialog */}
      <Dialog open={showUrgentDialog} onOpenChange={setShowUrgentDialog}>
        <DialogContent className="max-w-sm">
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Enter Staff PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              Enter your 5-digit PIN to create order
            </div>
            <Input
              id="staff-pin"
              type="tel"
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
        <DialogContent className="max-w-sm">
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

      {/* Full New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Name *</Label>
                <Input
                  placeholder="Client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  data-testid="input-new-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Phone *</Label>
                <Input
                  placeholder="Phone number"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  data-testid="input-new-client-phone"
                />
              </div>
            </div>
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
                onChange={(e) => setNewClientAddress(e.target.value)}
                data-testid="input-new-client-address"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Contact Person</Label>
              <Input
                placeholder="Contact person name"
                value={newClientContact}
                onChange={(e) => setNewClientContact(e.target.value)}
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
                  setNewClientName("");
                  setNewClientPhone("");
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
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Select Size</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              <div className="font-bold text-foreground text-lg">
                {sizeDialogProduct?.name}
              </div>
            </div>

            {sizeDialogProduct && getSizeOptionKey(sizeDialogProduct.name) && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10"
                  onClick={() => handleAddSizedItem("small")}
                  data-testid="button-size-small"
                >
                  <div className="text-2xl font-black text-primary">S</div>
                  <div className="font-bold">Small</div>
                  <div className="text-sm font-bold text-primary">
                    {
                      sizeOptions[getSizeOptionKey(sizeDialogProduct.name)!]
                        ?.small
                    }{" "}
                    AED
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10"
                  onClick={() => handleAddSizedItem("large")}
                  data-testid="button-size-large"
                >
                  <div className="text-2xl font-black text-primary">L</div>
                  <div className="font-bold">Large</div>
                  <div className="text-sm font-bold text-primary">
                    {
                      sizeOptions[getSizeOptionKey(sizeDialogProduct.name)!]
                        ?.large
                    }{" "}
                    AED
                  </div>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gutra Options Dialog */}
      <Dialog open={showGutraDialog} onOpenChange={setShowGutraDialog}>
        <DialogContent className="max-w-sm">
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
    </div>
  );
}
