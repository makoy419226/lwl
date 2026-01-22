import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, AlertTriangle, RotateCcw, ClipboardList, FileText, Users, Loader2 } from "lucide-react";

type ResetType = "orders" | "bills" | "clients" | null;

export default function AdminSettings() {
  const [resetType, setResetType] = useState<ResetType>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const { toast } = useToast();

  const resetMutation = useMutation({
    mutationFn: async ({ type, password }: { type: ResetType; password: string }) => {
      if (!type) throw new Error("No reset type specified");
      
      let endpoint = "";
      switch (type) {
        case "orders":
          endpoint = "/api/orders/reset-all";
          break;
        case "bills":
          endpoint = "/api/bills/reset-all";
          break;
        case "clients":
          endpoint = "/api/clients/reset-all";
          break;
      }
      
      const res = await apiRequest("POST", endpoint, { adminPassword: password });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      setResetType(null);
      setAdminPassword("");
      setResetError("");
      
      const typeLabel = variables.type === "orders" ? "Orders" : variables.type === "bills" ? "Bills" : "Clients";
      toast({
        title: `${typeLabel} Reset`,
        description: `All ${typeLabel.toLowerCase()} have been cleared successfully.`,
      });
    },
    onError: (error: any) => {
      setResetError(error.message?.includes("Invalid") ? "Invalid admin password" : "Failed to reset data");
    },
  });

  const handleReset = () => {
    if (resetType && adminPassword) {
      resetMutation.mutate({ type: resetType, password: adminPassword });
    }
  };

  const getResetInfo = (type: ResetType) => {
    switch (type) {
      case "orders":
        return {
          title: "Reset All Orders",
          description: "This will permanently delete all orders from the system. This action cannot be undone.",
          icon: ClipboardList,
        };
      case "bills":
        return {
          title: "Reset All Bills",
          description: "This will permanently delete all bills from the system. This action cannot be undone.",
          icon: FileText,
        };
      case "clients":
        return {
          title: "Reset All Clients",
          description: "This will permanently delete all clients and their transaction history from the system. This action cannot be undone.",
          icon: Users,
        };
      default:
        return null;
    }
  };

  const resetInfo = getResetInfo(resetType);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Admin Settings</h1>
            <p className="text-sm text-muted-foreground">System administration and data management</p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 lg:py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Data Reset Options
            </CardTitle>
            <CardDescription>
              These actions are permanent and cannot be undone. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Dialog open={resetType === "orders"} onOpenChange={(open) => {
                if (!open) {
                  setResetType(null);
                  setAdminPassword("");
                  setResetError("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-auto py-6 flex-col gap-2 border-destructive/30 hover:border-destructive hover:bg-destructive/5"
                    onClick={() => setResetType("orders")}
                    data-testid="button-reset-orders"
                  >
                    <ClipboardList className="w-8 h-8 text-destructive" />
                    <span className="font-semibold">Reset Orders</span>
                    <span className="text-xs text-muted-foreground">Clear all orders</span>
                  </Button>
                </DialogTrigger>
              </Dialog>

              <Dialog open={resetType === "bills"} onOpenChange={(open) => {
                if (!open) {
                  setResetType(null);
                  setAdminPassword("");
                  setResetError("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-auto py-6 flex-col gap-2 border-destructive/30 hover:border-destructive hover:bg-destructive/5"
                    onClick={() => setResetType("bills")}
                    data-testid="button-reset-bills"
                  >
                    <FileText className="w-8 h-8 text-destructive" />
                    <span className="font-semibold">Reset Bills</span>
                    <span className="text-xs text-muted-foreground">Clear all bills</span>
                  </Button>
                </DialogTrigger>
              </Dialog>

              <Dialog open={resetType === "clients"} onOpenChange={(open) => {
                if (!open) {
                  setResetType(null);
                  setAdminPassword("");
                  setResetError("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-auto py-6 flex-col gap-2 border-destructive/30 hover:border-destructive hover:bg-destructive/5"
                    onClick={() => setResetType("clients")}
                    data-testid="button-reset-clients"
                  >
                    <Users className="w-8 h-8 text-destructive" />
                    <span className="font-semibold">Reset Clients</span>
                    <span className="text-xs text-muted-foreground">Clear all clients</span>
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!resetType} onOpenChange={(open) => {
          if (!open) {
            setResetType(null);
            setAdminPassword("");
            setResetError("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                {resetInfo?.title}
              </DialogTitle>
              <DialogDescription>
                {resetInfo?.description} Enter the admin password to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">Admin Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Enter admin password..."
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setResetError("");
                  }}
                  data-testid="input-admin-password"
                />
                {resetError && (
                  <p className="text-sm text-destructive">{resetError}</p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResetType(null);
                  setAdminPassword("");
                  setResetError("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!adminPassword || resetMutation.isPending}
                data-testid="button-confirm-reset"
              >
                {resetMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                {resetInfo?.title}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
