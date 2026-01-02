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
import { Loader2, Plus, Users, Pencil, Trash2, Package, Truck, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [activeTab, setActiveTab] = useState("summary");
  const { toast } = useToast();

  const { data: workers, isLoading } = useQuery<PackingWorker[]>({
    queryKey: ["/api/packing-workers"],
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const workerSummary = useMemo(() => {
    if (!workers || !orders) return [];
    
    return workers.map(worker => {
      const packedOrders = orders.filter(o => o.packedByWorkerId === worker.id);
      const deliveredOrders = orders.filter(o => o.deliveredByWorkerId === worker.id);
      const pendingPacking = orders.filter(o => o.washingDone && !o.packingDone);
      const pendingDelivery = orders.filter(o => o.packingDone && !o.delivered);
      
      return {
        worker,
        packedCount: packedOrders.length,
        deliveredCount: deliveredOrders.length,
        packedOrders,
        deliveredOrders,
        pendingPacking,
        pendingDelivery
      };
    });
  }, [workers, orders]);

  const filteredSummary = workerSummary.filter(s => 
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
