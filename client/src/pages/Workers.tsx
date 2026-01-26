import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Users,
  Pencil,
  Trash2,
  Package,
  Truck,
  Search,
  Calendar,
  BarChart3,
  Tag,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Receipt,
  UserCog,
  Mail,
  Lock,
  Key,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import type { Order, Bill } from "@shared/schema";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";

interface PackingWorker {
  id: number;
  name: string;
  active: boolean;
}

interface SystemUser {
  id: number;
  username: string;
  role: string;
  name: string | null;
  email: string | null;
  active: boolean;
}

export default function Workers() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<PackingWorker | null>(null);
  const [formData, setFormData] = useState({ name: "", role: "Reception", pin: "" });
  const [customRole, setCustomRole] = useState("");
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const predefinedRoles = ["Reception", "Packer", "Delivery Driver", "Manager", "Supervisor"];
  const [activeTab, setActiveTab] = useState("stats");
  const [dateFilter, setDateFilter] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const { toast } = useToast();

  const [isUserCreateOpen, setIsUserCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "cashier",
    pin: "",
  });

  const { data: workers, isLoading } = useQuery<PackingWorker[]>({
    queryKey: ["/api/packing-workers"],
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: bills } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: systemUsers, isLoading: isLoadingUsers } = useQuery<
    SystemUser[]
  >({
    queryKey: ["/api/users"],
  });

  const getNextUsername = (role: string) => {
    const roleUsers = systemUsers?.filter(u => u.role === role) || [];
    return `${role}${roleUsers.length + 1}`;
  };

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
      case "custom":
        if (customFromDate && customToDate) {
          return {
            start: startOfDay(parseISO(customFromDate)),
            end: endOfDay(parseISO(customToDate)),
          };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      case "all":
      default:
        return { start: new Date(0), end: now };
    }
  };

  const workerStats = useMemo(() => {
    if (!workers || !orders) return [];
    const { start, end } = getDateRange();

    return workers
      .map((worker) => {
        const taggedOrders = orders.filter((o) => {
          if (o.tagWorkerId !== worker.id) return false;
          if (!o.tagDate) return false;
          try {
            const tagDate = new Date(o.tagDate);
            return tagDate >= start && tagDate <= end;
          } catch {
            return false;
          }
        });

        const packedOrders = orders.filter((o) => {
          if (o.packingWorkerId !== worker.id) return false;
          if (!o.packingDate) return false;
          try {
            const packDate = new Date(o.packingDate);
            return packDate >= start && packDate <= end;
          } catch {
            return false;
          }
        });

        const deliveredOrders = orders.filter((o) => {
          if (o.deliveredByWorkerId !== worker.id) return false;
          if (!o.deliveryDate) return false;
          try {
            const delDate = new Date(o.deliveryDate);
            return delDate >= start && delDate <= end;
          } catch {
            return false;
          }
        });

        const createdBills =
          bills?.filter((b) => {
            if (b.createdByWorkerId !== worker.id) return false;
            if (!b.billDate) return false;
            try {
              const billDate = new Date(b.billDate);
              return billDate >= start && billDate <= end;
            } catch {
              return false;
            }
          }) || [];

        const billsTotal = createdBills.reduce(
          (sum, b) => sum + parseFloat(b.amount || "0"),
          0,
        );

        return {
          worker,
          taggedCount: taggedOrders.length,
          packedCount: packedOrders.length,
          deliveredCount: deliveredOrders.length,
          billsCreated: createdBills.length,
          billsTotal,
          totalTasks:
            taggedOrders.length +
            packedOrders.length +
            deliveredOrders.length +
            createdBills.length,
        };
      })
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [workers, orders, bills, dateFilter, customFromDate, customToDate]);

  const totals = useMemo(() => {
    return workerStats.reduce(
      (acc, s) => ({
        tagged: acc.tagged + s.taggedCount,
        packed: acc.packed + s.packedCount,
        delivered: acc.delivered + s.deliveredCount,
        billsCreated: acc.billsCreated + s.billsCreated,
        billsTotal: acc.billsTotal + s.billsTotal,
      }),
      { tagged: 0, packed: 0, delivered: 0, billsCreated: 0, billsTotal: 0 },
    );
  }, [workerStats]);

  const getDateRangeLabel = () => {
    const { start, end } = getDateRange();
    return `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`;
  };

  const exportToExcel = () => {
    const data = filteredStats.map((s) => ({
      "Staff Name": s.worker.name,
      Status: s.worker.active ? "Active" : "Inactive",
      "Tags Done": s.taggedCount,
      "Packing Done": s.packedCount,
      Deliveries: s.deliveredCount,
      "Bills Created": s.billsCreated,
      "Bills Total (AED)": s.billsTotal.toFixed(2),
      "Total Tasks": s.totalTasks,
    }));

    data.push({
      "Staff Name": "TOTAL",
      Status: "",
      "Tags Done": totals.tagged,
      "Packing Done": totals.packed,
      Deliveries: totals.delivered,
      "Bills Created": totals.billsCreated,
      "Bills Total (AED)": totals.billsTotal.toFixed(2),
      "Total Tasks":
        totals.tagged + totals.packed + totals.delivered + totals.billsCreated,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Report");
    XLSX.writeFile(wb, `Staff_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel Downloaded", description: "Staff report saved" });
  };

  const exportToPDF = () => {
    const { start, end } = getDateRange();
    const content = document.createElement("div");
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 148mm; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="font-size: 20px; font-weight: bold; color: #1e40af;">LIQUID WASHES LAUNDRY</div>
          <div style="font-size: 14px; margin-top: 5px; font-weight: bold;">Staff Performance Report</div>
          <div style="font-size: 11px; margin-top: 5px; color: #666;">${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: left;">Staff</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Tags</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Packing</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Delivery</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Bills</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: right;">Bills AED</th>
              <th style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStats
              .map(
                (s) => `
              <tr>
                <td style="padding: 6px 4px; border: 1px solid #ddd;">${s.worker.name}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.taggedCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.packedCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.deliveredCount}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center;">${s.billsCreated}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: right;">${s.billsTotal.toFixed(2)}</td>
                <td style="padding: 6px 4px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${s.totalTasks}</td>
              </tr>
            `,
              )
              .join("")}
            <tr style="background: #e5e7eb; font-weight: bold;">
              <td style="padding: 8px 4px; border: 1px solid #ddd;">TOTAL</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.tagged}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.packed}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.delivered}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.billsCreated}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: right;">${totals.billsTotal.toFixed(2)}</td>
              <td style="padding: 8px 4px; border: 1px solid #ddd; text-align: center;">${totals.tagged + totals.packed + totals.delivered + totals.billsCreated}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888;">
          Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")} | Contact: +971 50 123 4567
        </div>
      </div>
    `;

    html2pdf()
      .set({
        margin: 5,
        filename: `Staff_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a5", orientation: "portrait" },
      })
      .from(content)
      .save();
    toast({ title: "PDF Downloaded", description: "Staff report saved" });
  };

  const filteredStats = workerStats.filter((s) =>
    s.worker.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; role: string; pin: string }) => {
      return apiRequest("POST", "/api/packing-workers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      setIsCreateOpen(false);
      setFormData({ name: "", role: "Reception", pin: "" });
      setCustomRole("");
      setIsCustomRole(false);
      toast({ title: "Staff Created", description: "New staff member added" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to create worker",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/packing-workers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      setEditWorker(null);
      setFormData({ name: "", role: "Reception", pin: "" });
      setCustomRole("");
      setIsCustomRole(false);
      toast({ title: "Staff Updated", description: "Staff details updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/packing-workers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packing-workers"] });
      toast({
        title: "Staff Deleted",
        description: "Staff member has been removed",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name || formData.pin.length !== 5) {
      toast({
        title: "Error",
        description: "Name and 5-digit PIN are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editWorker || !formData.name) return;
    const updates: any = { name: formData.name, role: formData.role };
    if (formData.pin && formData.pin.length === 5) {
      updates.pin = formData.pin;
    }
    updateMutation.mutate({ id: editWorker.id, updates });
  };

  const toggleActive = (worker: PackingWorker) => {
    updateMutation.mutate({
      id: worker.id,
      updates: { active: !worker.active },
    });
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      password: string;
      name: string;
      email: string;
      role: string;
    }) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsUserCreateOpen(false);
      setUserFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        role: "cashier",
        pin: "",
      });
      toast({ title: "User Created", description: "New user account added" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PUT", `/api/users/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      setUserFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        role: "cashier",
        pin: "",
      });
      toast({ title: "User Updated", description: "User details updated" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User account has been removed",
      });
    },
  });

  const handleCreateUser = () => {
    if (!userFormData.username || !userFormData.password) {
      toast({
        title: "Error",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(userFormData);
  };

  const handleUpdateUser = () => {
    if (!editUser) return;
    const updates: any = {};
    if (userFormData.username && userFormData.username !== editUser.username) {
      updates.username = userFormData.username;
    }
    if (userFormData.name) updates.name = userFormData.name;
    if (userFormData.email) updates.email = userFormData.email;
    if (userFormData.password) updates.password = userFormData.password;
    if (userFormData.role) updates.role = userFormData.role;
    if (userFormData.pin && /^\d{5}$/.test(userFormData.pin)) updates.pin = userFormData.pin;
    updateUserMutation.mutate({ id: editUser.id, updates });
  };

  const toggleUserActive = (user: SystemUser) => {
    updateUserMutation.mutate({
      id: user.id,
      updates: { active: !user.active },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 w-full bg-card border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Staff Members
          </h1>
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
                User Stats
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">
                <UserCog className="w-4 h-4 mr-1" />
                User Account Management
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger
                        className="w-36"
                        data-testid="select-date-filter"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {dateFilter === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-36"
                        data-testid="input-from-date"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-36"
                        data-testid="input-to-date"
                      />
                    </div>
                  )}
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
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      data-testid="button-export-excel"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-1" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToPDF}
                      data-testid="button-export-pdf"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="text-2xl font-bold">{totals.tagged}</p>
                          <p className="text-xs text-muted-foreground">
                            Tags Done
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">{totals.packed}</p>
                          <p className="text-xs text-muted-foreground">
                            Packing Done
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {totals.delivered}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Deliveries
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-cyan-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {totals.billsCreated}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Bills ({totals.billsTotal.toFixed(0)} AED)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {totals.tagged +
                              totals.packed +
                              totals.delivered +
                              totals.billsCreated}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Tasks
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Accordion type="multiple" defaultValue={["managers", "cashiers", "staff"]} className="space-y-2">
                  <AccordionItem value="managers" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Manager</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({systemUsers?.filter(u => u.role === "manager").length || 0} users)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {!systemUsers?.filter(u => u.role === "manager").length ? (
                        <p className="text-center text-muted-foreground py-4">No managers found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Receipt className="w-4 h-4 text-cyan-500" />
                                  Transactions
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Package className="w-4 h-4 text-green-500" />
                                  Orders
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  Unpaid
                                </div>
                              </TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {systemUsers?.filter(u => u.role === "manager").map((user) => {
                              const userBills = bills?.filter(b => b.notes?.includes(user.name || user.username)) || [];
                              const unpaidBills = userBills.filter(b => !b.isPaid);
                              return (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.username}</TableCell>
                                  <TableCell>{user.name || "-"}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                                      {userBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                      {userBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                      {unpaidBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Active" : "Inactive"}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cashiers" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Cashier</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({systemUsers?.filter(u => u.role === "cashier").length || 0} users)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {!systemUsers?.filter(u => u.role === "cashier").length ? (
                        <p className="text-center text-muted-foreground py-4">No cashiers found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Receipt className="w-4 h-4 text-cyan-500" />
                                  Transactions
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Package className="w-4 h-4 text-green-500" />
                                  Orders
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  Unpaid
                                </div>
                              </TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {systemUsers?.filter(u => u.role === "cashier").map((user) => {
                              const userBills = bills?.filter(b => b.notes?.includes(user.name || user.username)) || [];
                              const unpaidBills = userBills.filter(b => !b.isPaid);
                              return (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.username}</TableCell>
                                  <TableCell>{user.name || "-"}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                                      {userBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                      {userBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                      {unpaidBills.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Active" : "Inactive"}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="staff" className="border rounded-lg">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Staff</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({filteredStats.length} workers)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {filteredStats.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No staff workers found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Staff Name</TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Tag className="w-4 h-4 text-orange-500" />
                                  Tagged
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Package className="w-4 h-4 text-green-500" />
                                  Packed
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Truck className="w-4 h-4 text-purple-500" />
                                  Delivered
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Receipt className="w-4 h-4 text-cyan-500" />
                                  Bills
                                </div>
                              </TableHead>
                              <TableHead className="text-center">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStats.map((s) => (
                              <TableRow
                                key={s.worker.id}
                                data-testid={`row-stats-${s.worker.id}`}
                              >
                                <TableCell className="font-medium">
                                  {s.worker.name}
                                  {!s.worker.active && (
                                    <Badge variant="secondary" className="ml-2">
                                      Inactive
                                    </Badge>
                                  )}
                            </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                                  >
                                    {s.taggedCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                  >
                                    {s.packedCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                                  >
                                    {s.deliveredCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300"
                                  >
                                    {s.billsCreated} ({s.billsTotal.toFixed(0)})
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold">
                                  {s.totalTasks}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="w-5 h-5" />
                    System User Accounts
                  </CardTitle>
                  <Button
                    onClick={() => setIsUserCreateOpen(true)}
                    data-testid="button-add-user"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage login accounts for staff. Users with email addresses
                    can use the "Forgot Password" feature.
                  </p>
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : !systemUsers || systemUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No user accounts found
                    </div>
                  ) : (
                    <Accordion type="multiple" defaultValue={["managers", "cashiers", "staff"]} className="space-y-2">
                      <AccordionItem value="managers" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Manager</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "manager").length} users)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {systemUsers.filter(u => u.role === "manager").length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No managers found</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Username</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-center">Active</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {systemUsers.filter(u => u.role === "manager").map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.name || "-"}</TableCell>
                                    <TableCell>
                                      {user.email ? (
                                        <span className="flex items-center gap-1">
                                          <Mail className="w-3 h-3 text-muted-foreground" />
                                          {user.email}
                                        </span>
                                      ) : <span className="text-muted-foreground">Not set</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Switch checked={user.active} onCheckedChange={() => toggleUserActive(user)} />
                                        <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Active" : "Inactive"}</Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); }}>
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete user "${user.username}"?`)) { deleteUserMutation.mutate(user.id); } }}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="cashiers" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Cashier</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "cashier").length} users)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {systemUsers.filter(u => u.role === "cashier").length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No cashiers found</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Username</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-center">Active</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {systemUsers.filter(u => u.role === "cashier").map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.name || "-"}</TableCell>
                                    <TableCell>
                                      {user.email ? (
                                        <span className="flex items-center gap-1">
                                          <Mail className="w-3 h-3 text-muted-foreground" />
                                          {user.email}
                                        </span>
                                      ) : <span className="text-muted-foreground">Not set</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Switch checked={user.active} onCheckedChange={() => toggleUserActive(user)} />
                                        <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Active" : "Inactive"}</Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); }}>
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete user "${user.username}"?`)) { deleteUserMutation.mutate(user.id); } }}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="staff" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Staff</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({systemUsers.filter(u => u.role === "staff").length} users)
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {systemUsers.filter(u => u.role === "staff").length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No staff found</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Username</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-center">Active</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {systemUsers.filter(u => u.role === "staff").map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.name || "-"}</TableCell>
                                    <TableCell>
                                      {user.email ? (
                                        <span className="flex items-center gap-1">
                                          <Mail className="w-3 h-3 text-muted-foreground" />
                                          {user.email}
                                        </span>
                                      ) : <span className="text-muted-foreground">Not set</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Switch checked={user.active} onCheckedChange={() => toggleUserActive(user)} />
                                        <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Active" : "Inactive"}</Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => { setEditUser(user); setUserFormData({ username: user.username, password: "", name: user.name || "", email: user.email || "", role: user.role, pin: "" }); }}>
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete user "${user.username}"?`)) { deleteUserMutation.mutate(user.id); } }}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <Dialog
        open={!!editWorker}
        onOpenChange={(open) => !open && setEditWorker(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Name</Label>
              <Input
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                data-testid="input-edit-worker-name"
              />
            </div>
            <div className="space-y-2">
              <Label>New PIN (optional)</Label>
              <Input
                id="edit-worker-pin"
                type="tel"
                maxLength={5}
                placeholder="Leave empty to keep current PIN"
                value={formData.pin}
                autoComplete="off"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 5),
                  })
                }
                className="text-center tracking-widest [-webkit-text-security:disc]"
                data-testid="input-edit-worker-pin"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.name}
              data-testid="button-update-worker"
            >
              {updateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Update Worker
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserCreateOpen} onOpenChange={(open) => {
              if (open) {
                const defaultRole = "cashier";
                setUserFormData({ username: getNextUsername(defaultRole), password: "", name: "", email: "", role: defaultRole, pin: "" });
              }
              setIsUserCreateOpen(open);
            }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Add User Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={userFormData.username}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, username: e.target.value })
                }
                data-testid="input-new-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={userFormData.password}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, password: e.target.value })
                }
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="Enter display name"
                value={userFormData.name}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, name: e.target.value })
                }
                data-testid="input-new-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email (for password reset)
              </Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                data-testid="input-new-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userFormData.role}
                onValueChange={(value) =>
                  setUserFormData({ ...userFormData, role: value, username: getNextUsername(value) })
                }
              >
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateUser}
              disabled={
                createUserMutation.isPending ||
                !userFormData.username ||
                !userFormData.password
              }
              data-testid="button-submit-user"
            >
              {createUserMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit User: {editUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <UserCog className="w-3 h-3" />
                Username
              </Label>
              <Input
                placeholder="Enter username"
                value={userFormData.username}
                disabled
                className="bg-muted"
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="Enter display name"
                value={userFormData.name}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, name: e.target.value })
                }
                data-testid="input-edit-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email (for password reset)
              </Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                data-testid="input-edit-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                New Password (leave empty to keep current)
              </Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={userFormData.password}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, password: e.target.value })
                }
                data-testid="input-edit-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                New PIN (leave empty to keep current)
              </Label>
              <Input
                type="tel"
                maxLength={5}
                placeholder="Enter 5-digit PIN"
                value={userFormData.pin}
                autoComplete="off"
                onChange={(e) =>
                  setUserFormData({ ...userFormData, pin: e.target.value.replace(/\D/g, "").slice(0, 5) })
                }
                className="text-center tracking-widest"
                data-testid="input-edit-user-pin"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userFormData.role}
                onValueChange={(value) =>
                  setUserFormData({ ...userFormData, role: value })
                }
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              data-testid="button-update-user"
            >
              {updateUserMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Update User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
