import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, AlertTriangle, RotateCcw, Loader2, Mail, Send, Trash2, Calendar, CalendarDays, CalendarRange } from "lucide-react";

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function AdminSettings() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [showSendReportDialog, setShowSendReportDialog] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
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
    mutationFn: async ({ password, period }: { password: string; period: ReportPeriod }) => {
      const res = await apiRequest("POST", "/api/admin/send-report", { adminPassword: password, period });
      return res.json();
    },
    onSuccess: (data) => {
      setShowSendReportDialog(false);
      setReportPassword("");
      setReportError("");
      toast({
        title: "Report Sent",
        description: data.message || "Sales report sent successfully!",
      });
    },
    onError: (error: any) => {
      setReportError(error.message?.includes("Invalid") ? "Invalid admin password" : "Failed to send report");
    },
  });

  const periodLabels: Record<ReportPeriod, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };

  const periodDescriptions: Record<ReportPeriod, string> = {
    daily: "Today's sales",
    weekly: "This week's sales (Sunday to today)",
    monthly: "This month's sales",
    yearly: "This year's sales"
  };

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
              Sales Reports
            </CardTitle>
            <CardDescription>
              Send sales reports to liquidewashesruwais@gmail.com. Reports are sent automatically: Daily at 11:59 PM, Weekly every Saturday, Monthly on the last day, and Yearly on December 31st.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['daily', 'weekly', 'monthly', 'yearly'] as ReportPeriod[]).map((period) => (
                  <Button
                    key={period}
                    variant={reportPeriod === period ? "default" : "outline"}
                    className="flex flex-col h-auto py-3 gap-1"
                    onClick={() => setReportPeriod(period)}
                    data-testid={`button-period-${period}`}
                  >
                    {period === 'daily' && <Calendar className="w-5 h-5" />}
                    {period === 'weekly' && <CalendarDays className="w-5 h-5" />}
                    {period === 'monthly' && <CalendarRange className="w-5 h-5" />}
                    {period === 'yearly' && <CalendarRange className="w-5 h-5" />}
                    <span className="text-sm font-semibold">{periodLabels[period]}</span>
                  </Button>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <p className="text-sm font-medium">{periodLabels[reportPeriod]} Report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {periodDescriptions[reportPeriod]}
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
                      Send {periodLabels[reportPeriod]} Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        Send {periodLabels[reportPeriod]} Sales Report
                      </DialogTitle>
                      <DialogDescription>
                        This will send the {periodLabels[reportPeriod].toLowerCase()} sales report ({periodDescriptions[reportPeriod].toLowerCase()}) to liquidewashesruwais@gmail.com. Enter the admin password to confirm.
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
                        onClick={() => sendReportMutation.mutate({ password: reportPassword, period: reportPeriod })}
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
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
