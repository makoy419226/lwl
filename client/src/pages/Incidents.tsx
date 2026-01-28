import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, AlertTriangle, Search, Pencil, Trash2, CheckCircle, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Incident, PackingWorker, Order } from "@shared/schema";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export default function Incidents() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editIncident, setEditIncident] = useState<Incident | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const [orderLookupNumber, setOrderLookupNumber] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([]);
  const [maxRefundAmount, setMaxRefundAmount] = useState<number>(0);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [isOrderSearchFocused, setIsOrderSearchFocused] = useState(false);
  const orderSearchRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    orderNumber: "",
    itemName: "",
    reason: "",
    notes: "",
    refundAmount: "",
    refundType: "credit", // "cash" or "credit"
    itemValue: "",
    responsibleStaffId: "",
    responsibleStaffName: "",
    incidentType: "refund",
    incidentStage: "delivery",
    status: "open",
    incidentDate: new Date().toISOString().split('T')[0],
    resolution: "",
  });

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: workers } = useQuery<PackingWorker[]>({
    queryKey: ["/api/packing-workers"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: drivers } = useQuery<any[]>({
    queryKey: ["/api/drivers"],
  });

  // Combine all staff types for the dropdown
  const allStaffMembers = useMemo(() => {
    const staff: { id: string; name: string; type: string }[] = [];
    
    // Add managers and other users (exclude inactive/merged accounts)
    users?.forEach(user => {
      if (user.active === true) {
        staff.push({
          id: `user-${user.id}`,
          name: user.name || user.username,
          type: user.role || 'User'
        });
      }
    });
    
    // Add staff workers
    workers?.filter(w => w.active).forEach(worker => {
      staff.push({
        id: `worker-${worker.id}`,
        name: worker.name,
        type: 'Staff'
      });
    });
    
    // Add drivers
    drivers?.filter((d: any) => d.active !== false).forEach((driver: any) => {
      staff.push({
        id: `driver-${driver.id}`,
        name: driver.name,
        type: 'Driver'
      });
    });
    
    return staff;
  }, [users, workers, drivers]);

  interface ActiveOrder {
    id: number;
    orderNumber: string;
    status: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    items: string;
    totalAmount: string;
  }

  const { data: activeOrders } = useQuery<ActiveOrder[]>({
    queryKey: ["/api/orders/active-with-clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/incidents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Incident Recorded", description: "The incident has been logged successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create incident", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/incidents/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setEditIncident(null);
      resetForm();
      toast({ title: "Incident Updated", description: "The incident has been updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/incidents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident Deleted", description: "The incident record has been removed" });
    },
  });

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      orderNumber: "",
      itemName: "",
      reason: "",
      notes: "",
      refundAmount: "",
      refundType: "credit",
      itemValue: "",
      responsibleStaffId: "",
      responsibleStaffName: "",
      incidentType: "refund",
      incidentStage: "delivery",
      status: "open",
      incidentDate: new Date().toISOString().split('T')[0],
      resolution: "",
    });
    setOrderLookupNumber("");
    setFoundOrder(null);
    setOrderItems([]);
    setSelectedItemIndices([]);
  };

  const lookupOrder = async () => {
    if (!orderLookupNumber.trim()) {
      toast({ title: "Error", description: "Please enter an order number", variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/orders/by-number/${encodeURIComponent(orderLookupNumber.trim())}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast({ title: "Not Found", description: "No order found with this number", variant: "destructive" });
        } else {
          toast({ title: "Error", description: "Failed to lookup order", variant: "destructive" });
        }
        setFoundOrder(null);
        setOrderItems([]);
        setSelectedItemIndices([]);
        setFormData(prev => ({ ...prev, itemName: "", itemValue: "" }));
        return;
      }
      const data = await res.json();
      setFoundOrder(data.order);
      setOrderItems(data.items || []);
      setSelectedItemIndices([]);
      setFormData(prev => ({
        ...prev,
        orderNumber: data.order.orderNumber,
        customerName: data.order.customerName || prev.customerName,
        customerPhone: data.customerPhone || prev.customerPhone,
        customerAddress: data.customerAddress || prev.customerAddress,
      }));
      toast({ title: "Order Found", description: `Found ${data.items?.length || 0} items in order ${data.order.orderNumber}` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to lookup order", variant: "destructive" });
      setFoundOrder(null);
      setOrderItems([]);
      setSelectedItemIndices([]);
      setFormData(prev => ({ ...prev, itemName: "", itemValue: "" }));
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleOrderItem = (index: number) => {
    setSelectedItemIndices(prev => {
      const newIndices = prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index];
      
      const selectedItems = newIndices.map(i => orderItems[i]).filter(Boolean);
      const itemNames = selectedItems.map(item => `${item.quantity}x ${item.name}`).join(", ");
      const totalValue = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      setFormData(f => ({
        ...f,
        itemName: itemNames,
        itemValue: String(totalValue),
      }));
      
      return newIndices;
    });
  };

  const handleCreate = () => {
    if (!formData.customerName || !formData.reason) {
      toast({ title: "Error", description: "Customer name and reason are required", variant: "destructive" });
      return;
    }
    const data = {
      ...formData,
      refundAmount: formData.refundAmount || "0",
      itemValue: formData.itemValue || "0",
      responsibleStaffId: formData.responsibleStaffId ? parseInt(formData.responsibleStaffId) : null,
      incidentDate: new Date(formData.incidentDate),
    };
    createMutation.mutate(data);
  };

  const handleUpdate = () => {
    if (!editIncident) return;
    const data = {
      ...formData,
      refundAmount: formData.refundAmount || "0",
      itemValue: formData.itemValue || "0",
      responsibleStaffId: formData.responsibleStaffId ? parseInt(formData.responsibleStaffId) : null,
      incidentDate: new Date(formData.incidentDate),
      resolvedDate: formData.status === "resolved" ? new Date() : null,
    };
    updateMutation.mutate({ id: editIncident.id, updates: data });
  };

  const openEdit = (incident: Incident) => {
    setEditIncident(incident);
    setFormData({
      customerName: incident.customerName,
      customerPhone: incident.customerPhone || "",
      customerAddress: incident.customerAddress || "",
      orderNumber: incident.orderNumber || "",
      itemName: incident.itemName || "",
      reason: incident.reason,
      notes: incident.notes || "",
      refundAmount: incident.refundAmount || "",
      refundType: (incident as any).refundType || "credit",
      itemValue: incident.itemValue || "",
      responsibleStaffId: incident.responsibleStaffId?.toString() || "",
      responsibleStaffName: incident.responsibleStaffName || "",
      incidentType: incident.incidentType || "refund",
      incidentStage: incident.incidentStage || "delivery",
      status: incident.status || "open",
      incidentDate: incident.incidentDate ? new Date(incident.incidentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      resolution: incident.resolution || "",
    });
  };

  const filteredIncidents = incidents?.filter(incident => {
    const matchesSearch = 
      incident.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (incident.orderNumber?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (incident.itemName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      incident.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "open":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Open</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "resolved":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "missing_item":
        return <Badge variant="outline" className="border-purple-500 text-purple-600">Missing Item</Badge>;
      case "refund":
        return <Badge variant="outline" className="border-red-500 text-red-600">Refund</Badge>;
      case "damage":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Damage</Badge>;
      case "complaint":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Complaint</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStageBadge = (stage: string | null) => {
    switch (stage) {
      case "reception":
        return <Badge variant="secondary" className="text-xs">Reception</Badge>;
      case "tagging":
        return <Badge variant="secondary" className="text-xs">Tagging</Badge>;
      case "washing":
        return <Badge variant="secondary" className="text-xs">Washing</Badge>;
      case "packing":
        return <Badge variant="secondary" className="text-xs">Packing</Badge>;
      case "delivery":
        return <Badge variant="secondary" className="text-xs">Delivery</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{stage}</Badge>;
    }
  };

  const totalRefunds = filteredIncidents?.reduce((sum, i) => sum + parseFloat(i.refundAmount || "0"), 0) || 0;

  const selectActiveOrder = (order: ActiveOrder) => {
    setFormData(prev => ({
      ...prev,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
    }));
    setOrderLookupNumber(order.orderNumber);
    toast({ title: "Order Selected", description: `Selected order ${order.orderNumber}` });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-blue-500";
      case "tagging": return "bg-purple-500";
      case "packing": return "bg-orange-500";
      case "ready": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const IncidentForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
        <Label className="text-sm font-medium">Select Active Order</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <input
            ref={orderSearchRef}
            type="text"
            placeholder="Type order number or select..."
            value={isOrderSearchFocused ? orderSearchTerm : (formData.orderNumber || orderSearchTerm)}
            onChange={(e) => setOrderSearchTerm(e.target.value)}
            onFocus={() => setIsOrderSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsOrderSearchFocused(false), 200)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-9 pr-8"
            data-testid="input-order-search"
          />
          {formData.orderNumber && (
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  orderNumber: "",
                  customerName: "",
                  customerPhone: "",
                  customerAddress: "",
                  itemName: "",
                }));
                setOrderSearchTerm("");
                setMaxRefundAmount(0);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        {(isOrderSearchFocused || !formData.orderNumber) && (
          <div className="border rounded-md max-h-48 overflow-y-auto bg-background">
            {activeOrders
              ?.filter(order => 
                orderSearchTerm === "" || 
                order.orderNumber.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                order.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase())
              )
              .map((order) => (
              <div 
                key={order.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFormData(prev => ({
                    ...prev,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    customerAddress: order.customerAddress,
                    itemName: order.items || "",
                  }));
                  setMaxRefundAmount(parseFloat(order.totalAmount) || 0);
                  setOrderSearchTerm("");
                  setIsOrderSearchFocused(false);
                }}
                className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                data-testid={`order-option-${order.id}`}
              >
                <span className="font-mono text-sm">{order.orderNumber}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-sm">{order.customerName}</span>
                <Badge className={`text-xs ml-auto ${getStatusBadgeColor(order.status)}`}>
                  {order.status}
                </Badge>
              </div>
            ))}
            {activeOrders?.filter(order => 
              orderSearchTerm === "" || 
              order.orderNumber.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
              order.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase())
            ).length === 0 && (
              <div className="p-3 text-center text-muted-foreground text-sm">
                No orders found
              </div>
            )}
          </div>
        )}
        {formData.orderNumber && formData.itemName && (
          <div className="mt-2 p-3 bg-muted/50 rounded-md border">
            <Label className="text-xs text-muted-foreground mb-2 block">Order Items:</Label>
            <div className="text-sm space-y-1">
              {formData.itemName.split(",").map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>{item.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="incidentType">Incident Type</Label>
          <Select
            value={formData.incidentType}
            onValueChange={(value) => setFormData({ ...formData, incidentType: value })}
          >
            <SelectTrigger data-testid="select-incident-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="missing_item">Missing Item</SelectItem>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="incidentStage">Where It Happened</Label>
          <Select
            value={formData.incidentStage}
            onValueChange={(value) => setFormData({ ...formData, incidentStage: value })}
          >
            <SelectTrigger data-testid="select-incident-stage">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reception">Reception (Order Entry)</SelectItem>
              <SelectItem value="tagging">Tagging</SelectItem>
              <SelectItem value="washing">Washing/Processing</SelectItem>
              <SelectItem value="packing">Packing/Ready</SelectItem>
              <SelectItem value="delivery">Delivery/Pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentDate">Incident Date</Label>
        <Input
          id="incidentDate"
          type="date"
          value={formData.incidentDate}
          onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
          data-testid="input-incident-date"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason *</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Describe the reason for this incident"
          rows={2}
          data-testid="input-incident-reason"
        />
      </div>

      {formData.incidentType === "refund" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="refundAmount">
              Refund Amount (AED)
              {maxRefundAmount > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Max: {maxRefundAmount.toFixed(2)})
                </span>
              )}
            </Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.01"
              max={maxRefundAmount > 0 ? maxRefundAmount : undefined}
              value={formData.refundAmount}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                if (maxRefundAmount > 0 && value > maxRefundAmount) {
                  toast({ 
                    title: "Refund Limit Exceeded", 
                    description: `Refund cannot exceed order total of AED ${maxRefundAmount.toFixed(2)}`,
                    variant: "destructive"
                  });
                  setFormData({ ...formData, refundAmount: maxRefundAmount.toString() });
                } else {
                  setFormData({ ...formData, refundAmount: e.target.value });
                }
              }}
              placeholder="0.00"
              data-testid="input-incident-refund-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refundType">Refund Method</Label>
            <Select
              value={formData.refundType}
              onValueChange={(value) => setFormData({ ...formData, refundType: value })}
            >
              <SelectTrigger data-testid="select-refund-type">
                <SelectValue placeholder="Select refund method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Refund as Cash</SelectItem>
                <SelectItem value="credit">Add to Credit Available</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="itemValue">Item Value (AED)</Label>
          <Input
            id="itemValue"
            type="number"
            step="0.01"
            value={formData.itemValue}
            onChange={(e) => setFormData({ ...formData, itemValue: e.target.value })}
            placeholder="0.00"
            data-testid="input-incident-item-value"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="responsibleStaff">Responsible Staff</Label>
          <Select
            value={formData.responsibleStaffId}
            onValueChange={(value) => {
              const staffMember = allStaffMembers?.find(s => s.id === value);
              setFormData({
                ...formData,
                responsibleStaffId: value,
                responsibleStaffName: staffMember?.name || ""
              });
            }}
          >
            <SelectTrigger data-testid="select-incident-staff">
              <SelectValue placeholder="Select staff" />
            </SelectTrigger>
            <SelectContent>
              {allStaffMembers?.map(staff => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.name} ({staff.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger data-testid="select-incident-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes"
          rows={2}
          data-testid="input-incident-notes"
        />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="resolution">Resolution</Label>
          <Textarea
            id="resolution"
            value={formData.resolution}
            onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
            placeholder="How was this resolved?"
            rows={2}
            data-testid="input-incident-resolution"
          />
        </div>
      )}

      <Button
        onClick={isEdit ? handleUpdate : handleCreate}
        disabled={createMutation.isPending || updateMutation.isPending}
        className="w-full"
        data-testid={isEdit ? "button-update-incident" : "button-create-incident"}
      >
        {(createMutation.isPending || updateMutation.isPending) && (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        )}
        {isEdit ? "Update Incident" : "Record Incident"}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Incident Records
          </h1>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-incident">
                <Plus className="w-4 h-4 mr-2" />
                Record Incident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record New Incident</DialogTitle>
              </DialogHeader>
              <IncidentForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Incidents</p>
                  <p className="text-2xl font-bold">{filteredIncidents?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Cases</p>
                  <p className="text-2xl font-bold">{incidents?.filter(i => i.status === "open").length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Refunds</p>
                  <p className="text-2xl font-bold text-red-600">{totalRefunds.toFixed(2)} AED</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>Incident List</CardTitle>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search incidents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-incidents"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredIncidents?.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No incidents recorded</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents?.map((incident) => (
                    <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                      <TableCell className="font-mono text-sm">
                        {incident.incidentDate ? format(new Date(incident.incidentDate), "dd/MM/yy HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{incident.customerName}</p>
                          <p className="text-xs text-muted-foreground">{incident.customerPhone || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{incident.orderNumber || "-"}</TableCell>
                      <TableCell>{incident.itemName || "-"}</TableCell>
                      <TableCell>{getTypeBadge(incident.incidentType)}</TableCell>
                      <TableCell>{getStageBadge(incident.incidentStage)}</TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {parseFloat(incident.refundAmount || "0").toFixed(2)} AED
                      </TableCell>
                      <TableCell>{incident.responsibleStaffName || "-"}</TableCell>
                      <TableCell>{getStatusBadge(incident.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(incident)}
                            data-testid={`button-edit-incident-${incident.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this incident?")) {
                                deleteMutation.mutate(incident.id);
                              }
                            }}
                            data-testid={`button-delete-incident-${incident.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editIncident} onOpenChange={(open) => { if (!open) { setEditIncident(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
          </DialogHeader>
          <IncidentForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
