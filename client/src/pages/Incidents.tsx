import { useState } from "react";
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
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    orderNumber: "",
    itemName: "",
    reason: "",
    notes: "",
    refundAmount: "",
    itemValue: "",
    responsibleStaffId: "",
    responsibleStaffName: "",
    incidentType: "refund",
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
      orderNumber: "",
      itemName: "",
      reason: "",
      notes: "",
      refundAmount: "",
      itemValue: "",
      responsibleStaffId: "",
      responsibleStaffName: "",
      incidentType: "refund",
      status: "open",
      incidentDate: new Date().toISOString().split('T')[0],
      resolution: "",
    });
    setOrderLookupNumber("");
    setFoundOrder(null);
    setOrderItems([]);
    setSelectedItemIndex(null);
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
          toast({ title: "Not Found", description: "No delivered order found with this number", variant: "destructive" });
        } else {
          toast({ title: "Error", description: "Failed to lookup order", variant: "destructive" });
        }
        setFoundOrder(null);
        setOrderItems([]);
        return;
      }
      const data = await res.json();
      setFoundOrder(data.order);
      setOrderItems(data.items || []);
      setSelectedItemIndex(null);
      setFormData(prev => ({
        ...prev,
        orderNumber: data.order.orderNumber,
        customerName: data.order.customerName || "",
      }));
      toast({ title: "Order Found", description: `Found ${data.items?.length || 0} items in order ${data.order.orderNumber}` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to lookup order", variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  const selectOrderItem = (index: number) => {
    const item = orderItems[index];
    if (item) {
      setSelectedItemIndex(index);
      setFormData(prev => ({
        ...prev,
        itemName: item.name,
        itemValue: String(item.price * item.quantity),
      }));
    }
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
      orderNumber: incident.orderNumber || "",
      itemName: incident.itemName || "",
      reason: incident.reason,
      notes: incident.notes || "",
      refundAmount: incident.refundAmount || "",
      itemValue: incident.itemValue || "",
      responsibleStaffId: incident.responsibleStaffId?.toString() || "",
      responsibleStaffName: incident.responsibleStaffName || "",
      incidentType: incident.incidentType || "refund",
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

  const totalRefunds = filteredIncidents?.reduce((sum, i) => sum + parseFloat(i.refundAmount || "0"), 0) || 0;

  const IncidentForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
        <Label className="text-sm font-medium">Lookup Order (Optional)</Label>
        <div className="flex gap-2">
          <Input
            value={orderLookupNumber}
            onChange={(e) => setOrderLookupNumber(e.target.value)}
            placeholder="Enter order number to lookup"
            onKeyDown={(e) => e.key === "Enter" && lookupOrder()}
            data-testid="input-lookup-incident-order"
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={lookupOrder} 
            disabled={lookupLoading}
            data-testid="button-lookup-incident-order"
          >
            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {foundOrder && orderItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Select item from order <span className="font-mono font-bold">{foundOrder.orderNumber}</span>:
            </p>
            <div className="max-h-32 overflow-y-auto border rounded-md">
              {orderItems.map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center gap-3 p-2 cursor-pointer border-b last:border-b-0 hover-elevate ${selectedItemIndex === idx ? 'bg-primary/10' : ''}`}
                  onClick={() => selectOrderItem(idx)}
                  data-testid={`incident-item-select-${idx}`}
                >
                  <Checkbox 
                    checked={selectedItemIndex === idx}
                    onCheckedChange={() => selectOrderItem(idx)}
                    data-testid={`incident-checkbox-item-${idx}`}
                  />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                  </div>
                  <Badge variant="outline">AED {(item.price * item.quantity).toFixed(2)}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        {foundOrder && orderItems.length === 0 && (
          <p className="text-sm text-amber-600">No items found in this order</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name *</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            placeholder="Enter customer name"
            data-testid="input-incident-customer-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerPhone">Customer Phone</Label>
          <Input
            id="customerPhone"
            value={formData.customerPhone}
            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            placeholder="Phone number"
            data-testid="input-incident-customer-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="orderNumber">Order Number</Label>
          <Input
            id="orderNumber"
            value={formData.orderNumber}
            onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
            placeholder="Related order #"
            data-testid="input-incident-order-number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="itemName">Item Name</Label>
          <Input
            id="itemName"
            value={formData.itemName}
            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            placeholder="Affected item"
            data-testid="input-incident-item-name"
          />
        </div>
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
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="refundAmount">Refund Amount (AED)</Label>
          <Input
            id="refundAmount"
            type="number"
            step="0.01"
            value={formData.refundAmount}
            onChange={(e) => setFormData({ ...formData, refundAmount: e.target.value })}
            placeholder="0.00"
            data-testid="input-incident-refund-amount"
          />
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="responsibleStaff">Responsible Staff</Label>
          <Select
            value={formData.responsibleStaffId}
            onValueChange={(value) => {
              const worker = workers?.find(w => w.id.toString() === value);
              setFormData({
                ...formData,
                responsibleStaffId: value,
                responsibleStaffName: worker?.name || ""
              });
            }}
          >
            <SelectTrigger data-testid="select-incident-staff">
              <SelectValue placeholder="Select staff" />
            </SelectTrigger>
            <SelectContent>
              {workers?.filter(w => w.active).map(worker => (
                <SelectItem key={worker.id} value={worker.id.toString()}>
                  {worker.name}
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
            <DialogContent className="max-w-2xl">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
          </DialogHeader>
          <IncidentForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
