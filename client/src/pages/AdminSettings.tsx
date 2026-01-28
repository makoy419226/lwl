import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, AlertTriangle, RotateCcw, Loader2, Mail, Send, Trash2, Calendar, CalendarDays, CalendarRange, User, Key, Lock, Pencil, Shield, Check, Eye, EyeOff } from "lucide-react";

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function AdminSettings() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [showSendReportDialog, setShowSendReportDialog] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  
  // Admin account states
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  
  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpError, setOtpError] = useState("");
  
  // Visibility toggles for admin password/PIN display
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  
  const { toast } = useToast();

  // Fetch admin account settings
  const { data: adminAccount } = useQuery<{ username: string; email: string; pin: string; password: string; hasPin: boolean }>({
    queryKey: ["/api/admin/account"],
  });

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

  // Update admin account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; username: string; email: string; pin: string }) => {
      const res = await apiRequest("PUT", "/api/admin/account", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account"] });
      setShowEditAccountDialog(false);
      setEditPassword("");
      setAccountError("");
      toast({
        title: "Account Updated",
        description: "Admin account settings have been updated.",
      });
    },
    onError: (error: any) => {
      setAccountError(error.message?.includes("Invalid") ? "Invalid admin password" : "Failed to update account");
    },
  });

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-password-otp", {});
      return res.json();
    },
    onSuccess: (data) => {
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: data.message || "Check your email for the verification code.",
      });
    },
    onError: (error: any) => {
      setOtpError("Failed to send OTP. Please try again.");
    },
  });

  // Change password with OTP mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { otp: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/admin/change-password-with-otp", data);
      return res.json();
    },
    onSuccess: () => {
      setShowChangePasswordDialog(false);
      setOtpSent(false);
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpError("");
      toast({
        title: "Password Changed",
        description: "Your admin password has been updated successfully.",
      });
    },
    onError: (error: any) => {
      setOtpError(error.message?.includes("Invalid") ? "Invalid OTP code" : error.message?.includes("expired") ? "OTP has expired" : "Failed to change password");
    },
  });

  const handleEditAccountOpen = () => {
    if (adminAccount) {
      setEditUsername(adminAccount.username);
      setEditEmail(adminAccount.email);
      setEditPin("");
      setEditPassword("");
      setAccountError("");
    }
    setShowEditAccountDialog(true);
  };

  const handleChangePasswordOpen = () => {
    setOtpSent(false);
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpError("");
    setShowChangePasswordDialog(true);
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
        {/* Admin Account Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5" />
              Admin Account
            </CardTitle>
            <CardDescription>
              Manage your admin account settings including username, email, password, and PIN.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Account Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Username</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {adminAccount?.username || "admin"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {adminAccount?.email || "shussaingazi@yahoo.com"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Password</p>
                  <div className="font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono">
                      {showAdminPassword ? (adminAccount?.password || "admin123") : "••••••••"}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowAdminPassword(!showAdminPassword)}>
                      {showAdminPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">PIN</p>
                  <div className="font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono">
                      {adminAccount?.hasPin 
                        ? (showAdminPin ? adminAccount?.pin : "••••") 
                        : "Not set"}
                    </span>
                    {adminAccount?.hasPin && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowAdminPin(!showAdminPin)}>
                        {showAdminPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleEditAccountOpen}
                  data-testid="button-edit-admin-account"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Account Details
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleChangePasswordOpen}
                  data-testid="button-change-admin-password"
                >
                  <Lock className="w-4 h-4" />
                  Change Password (OTP)
                </Button>
              </div>
            </div>

            {/* Edit Account Dialog */}
            <Dialog open={showEditAccountDialog} onOpenChange={(open) => {
              setShowEditAccountDialog(open);
              if (!open) {
                setEditPassword("");
                setAccountError("");
              }
            }}>
              <DialogContent aria-describedby={undefined} className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-primary" />
                    Edit Admin Account
                  </DialogTitle>
                  <DialogDescription>
                    Update your admin account details. Enter your current password to confirm changes.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-username">Username</Label>
                    <Input
                      id="edit-username"
                      placeholder="Enter username"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      data-testid="input-edit-admin-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="Enter email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      data-testid="input-edit-admin-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pin">PIN (5 digits)</Label>
                    <Input
                      id="edit-pin"
                      type="password"
                      maxLength={5}
                      placeholder="Enter new PIN or leave empty"
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      data-testid="input-edit-admin-pin"
                    />
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="edit-password">Current Password (required)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="Enter current admin password"
                      value={editPassword}
                      onChange={(e) => {
                        setEditPassword(e.target.value);
                        setAccountError("");
                      }}
                      data-testid="input-current-admin-password"
                    />
                    {accountError && (
                      <p className="text-sm text-destructive">{accountError}</p>
                    )}
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditAccountDialog(false);
                      setEditPassword("");
                      setAccountError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateAccountMutation.mutate({
                      currentPassword: editPassword,
                      username: editUsername,
                      email: editEmail,
                      pin: editPin
                    })}
                    disabled={!editPassword || updateAccountMutation.isPending}
                    data-testid="button-save-admin-account"
                  >
                    {updateAccountMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Change Password via OTP Dialog */}
            <Dialog open={showChangePasswordDialog} onOpenChange={(open) => {
              setShowChangePasswordDialog(open);
              if (!open) {
                setOtpSent(false);
                setOtpCode("");
                setNewPassword("");
                setConfirmPassword("");
                setOtpError("");
              }
            }}>
              <DialogContent aria-describedby={undefined} className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Change Admin Password
                  </DialogTitle>
                  <DialogDescription>
                    {!otpSent 
                      ? "We'll send a verification code to your registered email address."
                      : "Enter the OTP code sent to your email and set your new password."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!otpSent ? (
                    <div className="text-center py-4">
                      <Mail className="w-12 h-12 mx-auto text-primary mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Click below to send a one-time password to<br />
                        <span className="font-medium">{adminAccount?.email || "shussaingazi@yahoo.com"}</span>
                      </p>
                      <Button
                        onClick={() => sendOtpMutation.mutate()}
                        disabled={sendOtpMutation.isPending}
                        data-testid="button-send-otp"
                      >
                        {sendOtpMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send OTP
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp-code">OTP Code</Label>
                        <Input
                          id="otp-code"
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setOtpError("");
                          }}
                          data-testid="input-otp-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          placeholder="Enter new password (min 6 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          data-testid="input-new-admin-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          data-testid="input-confirm-admin-password"
                        />
                      </div>
                      {otpError && (
                        <p className="text-sm text-destructive">{otpError}</p>
                      )}
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-destructive">Passwords do not match</p>
                      )}
                    </>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowChangePasswordDialog(false);
                      setOtpSent(false);
                      setOtpCode("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setOtpError("");
                    }}
                  >
                    Cancel
                  </Button>
                  {otpSent && (
                    <Button
                      onClick={() => changePasswordMutation.mutate({ otp: otpCode, newPassword })}
                      disabled={
                        !otpCode || 
                        otpCode.length !== 6 || 
                        !newPassword || 
                        newPassword.length < 6 || 
                        newPassword !== confirmPassword ||
                        changePasswordMutation.isPending
                      }
                      data-testid="button-verify-otp-change-password"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Change Password
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

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
              <DialogContent aria-describedby={undefined} className="max-w-md max-h-[85vh] overflow-y-auto">
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
                  <DialogContent aria-describedby={undefined} className="max-w-md max-h-[85vh] overflow-y-auto">
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
