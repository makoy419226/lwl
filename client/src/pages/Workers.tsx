import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Users, Pencil, Trash2, Package, Truck, Search, Calendar, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { Order } from "@shared/schema";

interface PackingWorker {
  id: number;
  name: string;
  active: boolean;
}

export default function Workers() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<PackingWorker | null>(null);
  const [formData, setFormData] = useState({ name: "", pin: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("stats");
  const [dateFilter, setDateFilter] = useState("today");
  const { toast } = useToast();

  const { data: workers, isLoading } = useQuery<PackingWorker[]>({
    queryKey: ["/api/packing-workers"],
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "week":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "all":
      default:
        return { start: new Date(0), end: now };
    }
  };

  const workerStats = useMemo(() => {
    if (!workers || !orders) return [];
    const { start, end } = getDateRange();
    
    return workers.map(worker => {
      const packedOrders = orders.filter(o => {
        if (o.packingWorkerId !== worker.id) return false;
        if (!o.packingDate) return false;
        try {
          const packDate = new Date(o.packingDate);
          return packDate >= start && packDate <= end;
        } catch { return false; }
      });
      
      const deliveredOrders = orders.filter(o => {
        if (o.deliveredByWorkerId !== worker.id) return false;
        if (!o.deliveryDate) return false;
        try {
          const delDate = new Date(o.deliveryDate);
          return delDate >= start && delDate <= end;
        } catch { return false; }
      });
      
      return {
        worker,
        packedCount: packedOrders.length,
        deliveredCount: deliveredOrders.length,
        totalTasks: packedOrders.length + deliveredOrders.length
      };
    }).sort((a, b) => b.totalTasks - a.totalTasks);
  }, [workers, orders, dateFilter]);

  const totals = useMemo(() => {
    return workerStats.reduce((acc, s) => ({
      packed: acc.packed + s.packedCount,
      delivered: acc.delivered + s.deliveredCount
    }), { packed: 0, delivered: 0 });
  }, [workerStats]);

  const filteredStats = workerStats.filter(s => 
    s.worker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; pin: string }) => {
      return apiRequest("POST", "/api/packing-workers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      setIsCreateOpen(false);
      setFormData({ name: "", pin: "" });
      toast({ title: "Worker Created", description: "New packing worker added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create worker", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/packing-workers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      setEditWorker(null);
      setFormData({ name: "", pin: "" });
      toast({ title: "Worker Updated", description: "Worker details updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/packing-workers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      toast({ title: "Worker Deleted", description: "Worker has been removed" });
    },
  });

  const handleCreate = () => {
    if (!formData.name || formData.pin.length !== 5) {
      toast({ title: "Error", description: "Name and 5-digit PIN are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editWorker || !formData.name) return;
    const updates: any = { name: formData.name };
    if (formData.pin && formData.pin.length === 5) {
      updates.pin = formData.pin;
    }
    updateMutation.mutate({ id: editWorker.id, updates });
  };

  const toggleActive = (worker: PackingWorker) => {
    updateMutation.mutate({ id: worker.id, updates: { active: !worker.active } });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Packing Workers
          </h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-worker">
                <Plus className="w-4 h-4 mr-2" />
                Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Packing Worker</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Worker Name</Label>
                  <Input
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-worker-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>5-Digit PIN</Label>
                  <Input
                    type="password"
                    maxLength={5}
                    placeholder="Enter 5-digit PIN"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    className="text-center tracking-widest"
                    data-testid="input-worker-pin"
                  />
                  <p className="text-xs text-muted-foreground">Workers use this PIN to confirm packing completion</p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !formData.name || formData.pin.length !== 5}
                  data-testid="button-submit-worker"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Worker
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="stats" data-testid="tab-stats">
                <BarChart3 className="w-4 h-4 mr-1" />
                Worker Stats
              </TabsTrigger>
              <TabsTrigger value="manage" data-testid="tab-manage">
                <Users className="w-4 h-4 mr-1" />
                Manage Workers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-36" data-testid="select-date-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search worker..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-worker"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="text-2xl font-bold">{totals.packed}</p>
                          <p className="text-xs text-muted-foreground">Total Packed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">{totals.delivered}</p>
                          <p className="text-xs text-muted-foreground">Total Delivered</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Worker Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker Name</TableHead>
                          <TableHead className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Package className="w-4 h-4 text-orange-500" />
                              Packed
                            </div>
                          </TableHead>
                          <TableHead className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Truck className="w-4 h-4 text-green-500" />
                              Delivered
                            </div>
                          </TableHead>
                          <TableHead className="text-center">Total Tasks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStats.map((s) => (
                          <TableRow key={s.worker.id} data-testid={`row-stats-${s.worker.id}`}>
                            <TableCell className="font-medium">
                              {s.worker.name}
                              {!s.worker.active && (
                                <Badge variant="secondary" className="ml-2">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                                {s.packedCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                {s.deliveredCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-bold">{s.totalTasks}</TableCell>
                          </TableRow>
                        ))}
                        {filteredStats.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No worker stats found for selected period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workers List</CardTitle>
            </CardHeader>
            <CardContent>
              {!workers || workers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No workers added yet. Add workers to enable PIN verification for packing.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.map((worker) => (
                      <TableRow key={worker.id} data-testid={`row-worker-${worker.id}`}>
                        <TableCell className="font-medium">{worker.name}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={worker.active}
                              onCheckedChange={() => toggleActive(worker)}
                              data-testid={`switch-active-${worker.id}`}
                            />
                            <Badge variant={worker.active ? "default" : "secondary"}>
                              {worker.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditWorker(worker);
                                setFormData({ name: worker.name, pin: "" });
                              }}
                              data-testid={`button-edit-${worker.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Delete worker "${worker.name}"?`)) {
                                  deleteMutation.mutate(worker.id);
                                }
                              }}
                              data-testid={`button-delete-${worker.id}`}
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
            </TabsContent>
          </Tabs>
        )}
      </main>

      <Dialog open={!!editWorker} onOpenChange={(open) => !open && setEditWorker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Worker Name</Label>
              <Input
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-worker-name"
              />
            </div>
            <div className="space-y-2">
              <Label>New PIN (optional)</Label>
              <Input
                type="password"
                maxLength={5}
                placeholder="Leave empty to keep current PIN"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                className="text-center tracking-widest"
                data-testid="input-edit-worker-pin"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.name}
              data-testid="button-update-worker"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Worker
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
