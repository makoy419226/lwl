import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, AlertTriangle, RotateCcw, Loader2, Mail, Send, Trash2 } from "lucide-react";

export default function AdminSettings() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [showSendReportDialog, setShowSendReportDialog] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [reportError, setReportError] = useState("");
  const { toast } = useToast();

  const resetAllMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/admin/reset-all", { adminPassword: password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      setShowResetDialog(false);
      setAdminPassword("");
      setResetError("");
      
      toast({
        title: "System Reset Complete",
        description: "All orders, bills, clients, transactions, and inventory have been reset.",
      });
    },
    onError: (error: any) => {
      setResetError(error.message?.includes("Invalid") ? "Invalid admin password" : "Failed to reset data");
    },
  });

  const sendReportMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/admin/send-daily-report", { adminPassword: password });
      return res.json();
    },
    onSuccess: (data) => {
      setShowSendReportDialog(false);
      setReportPassword("");
      setReportError("");
      toast({
        title: "Report Sent",
        description: data.message || "Daily sales report sent successfully!",
      });
    },
    onError: (error: any) => {
      setReportError(error.message?.includes("Invalid") ? "Invalid admin password" : "Failed to send report");
    },
  });

  const handleResetAll = () => {
    if (adminPassword) {
      resetAllMutation.mutate(adminPassword);
    }
  };

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
              System Reset
            </CardTitle>
            <CardDescription>
              Reset all system data including orders, bills, clients, transactions, dues, and inventory stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showResetDialog} onOpenChange={(open) => {
              setShowResetDialog(open);
              if (!open) {
                setAdminPassword("");
                setResetError("");
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto gap-2"
                  data-testid="button-reset-all"
                >
                  <Trash2 className="w-5 h-5" />
                  Reset All Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Reset All System Data
                  </DialogTitle>
                  <DialogDescription>
                    This will permanently delete ALL data from the system including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All orders</li>
                      <li>All bills and payments</li>
                      <li>All clients</li>
                      <li>All deposits and transaction history</li>
                      <li>All customer dues</li>
                      <li>Inventory stock (reset to zero)</li>
                    </ul>
                    <p className="mt-3 font-semibold text-destructive">This action cannot be undone!</p>
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
                      setShowResetDialog(false);
                      setAdminPassword("");
                      setResetError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetAll}
                    disabled={!adminPassword || resetAllMutation.isPending}
                    data-testid="button-confirm-reset"
                  >
                    {resetAllMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    Reset All Data
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Mail className="w-5 h-5" />
              Daily Sales Report
            </CardTitle>
            <CardDescription>
              Daily sales reports are automatically sent to liquidewashesruwais@gmail.com at 1:00 AM UAE time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Click the button to manually send today's sales report to the admin email.
                </p>
              </div>
              <Dialog open={showSendReportDialog} onOpenChange={(open) => {
                setShowSendReportDialog(open);
                if (!open) {
                  setReportPassword("");
                  setReportError("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    className="gap-2"
                    data-testid="button-send-report"
                  >
                    <Send className="w-4 h-4" />
                    Send Report Now
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-primary" />
                      Send Daily Sales Report
                    </DialogTitle>
                    <DialogDescription>
                      This will send today's sales report to liquidewashesruwais@gmail.com. Enter the admin password to confirm.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-password">Admin Password</Label>
                      <Input
                        id="report-password"
                        type="password"
                        placeholder="Enter admin password..."
                        value={reportPassword}
                        onChange={(e) => {
                          setReportPassword(e.target.value);
                          setReportError("");
                        }}
                        data-testid="input-report-password"
                      />
                      {reportError && (
                        <p className="text-sm text-destructive">{reportError}</p>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSendReportDialog(false);
                        setReportPassword("");
                        setReportError("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => sendReportMutation.mutate(reportPassword)}
                      disabled={!reportPassword || sendReportMutation.isPending}
                      data-testid="button-confirm-send-report"
                    >
                      {sendReportMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
